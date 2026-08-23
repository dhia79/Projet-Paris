"""Daily ingestion of the Paris cool-spot datasets.

    Open Data Paris  ->  normalize  ->  MySQL (serving)  +  BigQuery (history)
                                              |
                                              +-> R vulnerability scores

Each dataset is fetched and normalized in its own task so one failing source
cannot sink the others -- the same graceful-degradation rule the browser code
followed, now enforced by the scheduler.
"""

from __future__ import annotations

import logging
from dataclasses import asdict
from datetime import timedelta
from typing import Any

import pendulum
from airflow.decorators import dag, task
from airflow.exceptions import AirflowFailException, AirflowSkipException

from paris_pipeline import load_bigquery, load_mysql
from paris_pipeline.datasets import ALL_DATASETS, BY_SLUG
from paris_pipeline.normalize import CoolSpot, dedupe
from paris_pipeline.opendata import OpenDataError, fetch_dataset

log = logging.getLogger(__name__)

DEFAULT_ARGS = {
    "owner": "data-platform",
    "retries": 2,
    "retry_delay": timedelta(minutes=5),
    "execution_timeout": timedelta(minutes=30),
}


@dag(
    dag_id="paris_coolspots_daily",
    description="Ingest Open Data Paris cool spots into MySQL and BigQuery",
    schedule="30 4 * * *",  # 04:30 Europe/Paris, after the city's nightly publish
    start_date=pendulum.datetime(2026, 1, 1, tz="Europe/Paris"),
    catchup=False,
    max_active_runs=1,
    default_args=DEFAULT_ARGS,
    tags=["paris", "opendata", "mysql", "bigquery"],
)
def paris_coolspots_daily() -> None:
    @task(task_id="extract_and_normalize")
    def extract_and_normalize(slug: str, **context: Any) -> dict[str, Any]:
        """Fetch one dataset and normalize it.

        Returns a plain dict so the result crosses XCom cleanly. An optional
        dataset that fails is skipped rather than failed, so the downstream
        merge still runs with whatever did load.
        """
        dataset = BY_SLUG[slug]
        run_id = context["run_id"]

        try:
            raw = fetch_dataset(
                dataset.slug,
                max_records=dataset.max_records,
                select=dataset.select,
            )
        except OpenDataError as exc:
            _record_failure(run_id, dataset.slug, str(exc))
            if dataset.required:
                raise AirflowFailException(f"required dataset {slug} failed: {exc}") from exc
            raise AirflowSkipException(f"optional dataset {slug} unavailable: {exc}") from exc

        # A record with no usable name is noise, not data.
        spots = [dataset.adapt(dto, i) for i, dto in enumerate(raw)]
        spots = [s for s in spots if len(s.name) > 1]

        dropped = len(raw) - len(spots)
        if dropped:
            log.warning("%s: dropped %d unusable record(s)", slug, dropped)
        log.info("%s: normalized %d spot(s)", slug, len(spots))

        return {
            "slug": slug,
            "raw_count": len(raw),
            "spots": [asdict(s) for s in spots],
        }

    @task(task_id="load_mysql")
    def load_to_mysql(results: list[dict[str, Any]], **context: Any) -> list[str]:
        """Upsert every dataset's spots, then sweep rows that disappeared."""
        run_id = context["run_id"]
        all_ids: list[str] = []

        with load_mysql.connect() as conn, conn.cursor() as cursor:
            for result in results:
                slug = result["slug"]
                spots = dedupe(_rehydrate(result["spots"]))

                load_mysql.upsert_spots(cursor, spots)
                load_mysql.sweep_removed(cursor, slug, (s.id for s in spots))
                load_mysql.record_run(
                    cursor,
                    run_id=run_id,
                    source=slug,
                    status="ok",
                    raw_count=result["raw_count"],
                    normalized_count=len(spots),
                )
                all_ids.extend(s.id for s in spots)

        log.info("MySQL load complete: %d spot(s) across %d dataset(s)", len(all_ids), len(results))
        return all_ids

    @task(task_id="load_bigquery")
    def load_to_bigquery(results: list[dict[str, Any]], **context: Any) -> int:
        """Append the day's snapshot to the partitioned history table."""
        spots = dedupe([s for r in results for s in _rehydrate(r["spots"])])
        snapshot = context["data_interval_start"].date()
        return load_bigquery.load_snapshot(spots, snapshot)

    @task(task_id="report")
    def report(mysql_ids: list[str], bq_rows: int) -> None:
        log.info("run summary: %d spot(s) in MySQL, %d row(s) in BigQuery", len(mysql_ids), bq_rows)

    # `.expand` fans out one task instance per dataset; the two loads then run
    # in parallel off the same collected results.
    extracted = extract_and_normalize.expand(slug=[d.slug for d in ALL_DATASETS])

    report(load_to_mysql(extracted), load_to_bigquery(extracted))


def _rehydrate(rows: list[dict[str, Any]]) -> list[CoolSpot]:
    """Rebuild CoolSpot objects from their XCom dict form."""
    return [CoolSpot(**{**row, "features": tuple(row.get("features") or ())}) for row in rows]


def _record_failure(run_id: str, slug: str, error: str) -> None:
    """Best-effort failure bookkeeping.

    The dashboard reads these rows to show data freshness, so a failed fetch
    should still be visible there -- but if MySQL is also down, the original
    fetch error is the one worth propagating.
    """
    try:
        with load_mysql.connect() as conn, conn.cursor() as cursor:
            load_mysql.record_run(
                cursor,
                run_id=run_id,
                source=slug,
                status="failed",
                raw_count=0,
                normalized_count=0,
                error=error,
            )
    except Exception:  # noqa: BLE001 - deliberately swallowed, see docstring
        log.exception("could not record the failure of %s", slug)


paris_coolspots_daily()
