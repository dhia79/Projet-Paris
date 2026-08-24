"""Ingestion entry point.

    Open Data Paris -> normalize -> score canopy from the tree register -> MySQL

Run it:

    python -m paris_pipeline.run

Scheduled by cron locally and by Cloud Scheduler in GCP. This used to be an
Airflow DAG; for three daily HTTP fetches that meant running a scheduler, a
webserver and a second database to do a cron job's work, so it is a script
again. Retries, per-source isolation and run bookkeeping are all still here --
they were never the part that needed a cluster.

Exit codes: 0 all sources loaded, 1 a required source failed, 2 configuration
is missing.
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
import uuid
from dataclasses import dataclass
from datetime import date

from . import canopy, load_mysql
from .datasets import ALL_DATASETS, Dataset
from .normalize import CoolSpot, dedupe
from .opendata import OpenDataError, export_dataset, fetch_dataset

log = logging.getLogger("paris_pipeline")

#: The city's tree register. Pulled through the bulk export endpoint -- paging
#: 200k rows a hundred at a time would be ~2 100 requests.
TREE_DATASET = "les-arbres"
TREE_SELECT = ("geo_point_2d", "arrondissement")


@dataclass(slots=True)
class SourceResult:
    """What one dataset produced, and whether it worked."""

    dataset: Dataset
    spots: list[CoolSpot]
    raw_count: int
    error: str | None = None

    @property
    def ok(self) -> bool:
        return self.error is None


def extract(dataset: Dataset) -> SourceResult:
    """Fetch and normalize one dataset, converting failure into a result."""
    try:
        raw = fetch_dataset(
            dataset.slug,
            max_records=dataset.max_records,
            select=dataset.select,
        )
    except OpenDataError as exc:
        log.error("%s: %s", dataset.slug, exc)
        return SourceResult(dataset, [], 0, error=str(exc))

    # A record with no usable name is noise, not data.
    spots = [dataset.adapt(dto, i) for i, dto in enumerate(raw)]
    spots = [s for s in spots if len(s.name) > 1]

    dropped = len(raw) - len(spots)
    if dropped:
        log.warning("%s: dropped %d unusable record(s)", dataset.slug, dropped)
    log.info("%s: normalized %d spot(s)", dataset.slug, len(spots))

    return SourceResult(dataset, spots, len(raw))


def extract_trees() -> list[canopy.Tree]:
    """Download the tree register and reduce it to scored points."""
    raw = export_dataset(TREE_DATASET, select=TREE_SELECT)
    trees = [t for t in (canopy.adapt_tree(dto) for dto in raw) if t is not None]
    log.info("%s: %d/%d tree(s) usable", TREE_DATASET, len(trees), len(raw))
    return trees


def load(results: list[SourceResult], run_id: str, snapshot: date) -> int:
    """Write every successful source to MySQL in one transaction.

    One transaction across all sources on purpose: a partial write would leave
    the dashboard showing fountains from today next to parks from yesterday,
    with no way to tell from the outside.
    """
    loaded = 0

    with load_mysql.connect() as conn, conn.cursor() as cursor:
        for result in results:
            slug = result.dataset.slug

            if not result.ok:
                load_mysql.record_run(
                    cursor,
                    run_id=run_id,
                    source=slug,
                    status="failed",
                    raw_count=0,
                    normalized_count=0,
                    error=result.error,
                )
                continue

            spots = result.spots
            load_mysql.upsert_spots(cursor, spots)
            load_mysql.sweep_removed(cursor, slug, (s.id for s in spots))
            load_mysql.record_run(
                cursor,
                run_id=run_id,
                source=slug,
                status="ok",
                raw_count=result.raw_count,
                normalized_count=len(spots),
            )
            loaded += len(spots)

        load_mysql.snapshot_arrondissements(cursor, snapshot)

    return loaded


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--skip-canopy",
        action="store_true",
        help="skip the tree register download and keep the adapters' baseline scores",
    )
    parser.add_argument("--verbose", "-v", action="store_true")
    args = parser.parse_args(argv)

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)-7s %(name)s: %(message)s",
    )

    if not os.environ.get("DB_PASSWORD"):
        log.error("DB_PASSWORD is not set")
        return 2

    run_id = os.environ.get("RUN_ID") or f"cli-{uuid.uuid4().hex[:12]}"
    snapshot = date.today()
    log.info("run %s starting", run_id)

    results = [extract(d) for d in ALL_DATASETS]

    if not any(r.ok for r in results if r.dataset.required):
        log.error("every required dataset failed; not writing to MySQL")
        # Still record the failures so the dashboard's freshness banner is honest.
        load(results, run_id, snapshot)
        return 1

    if not args.skip_canopy:
        try:
            trees = extract_trees()
            all_spots = [s for r in results if r.ok for s in r.spots]
            rescored, tree_counts = canopy.apply_canopy(all_spots, trees)

            by_id = {s.id: s for s in rescored}
            for result in results:
                if result.ok:
                    result.spots = [by_id.get(s.id, s) for s in result.spots]

            with load_mysql.connect() as conn, conn.cursor() as cursor:
                load_mysql.upsert_tree_counts(cursor, tree_counts, snapshot)
        except (OpenDataError, ValueError) as exc:
            # The canopy score is an enrichment. Losing it should cost the run
            # its scores, not its data.
            log.warning("canopy scoring skipped: %s", exc)

    for result in results:
        if result.ok:
            result.spots = dedupe(result.spots)

    loaded = load(results, run_id, snapshot)

    failed = [r.dataset.slug for r in results if not r.ok]
    log.info("run %s finished: %d spot(s) loaded, %d source(s) failed", run_id, loaded, len(failed))
    if failed:
        log.warning("failed source(s): %s", ", ".join(failed))

    return 1 if any(not r.ok and r.dataset.required for r in results) else 0


if __name__ == "__main__":
    sys.exit(main())
