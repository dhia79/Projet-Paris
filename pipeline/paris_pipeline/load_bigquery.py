"""Load daily snapshots into BigQuery.

MySQL holds *current* state; BigQuery holds *history*. Every run appends a
dated snapshot so Metabase and the R notebook can answer questions MySQL
cannot -- how coverage moved between two heatwaves, which fountains go out of
service most often, whether a new park changed its arrondissement's score.

The table is partitioned by ``snapshot_date`` and clustered on the two columns
every dashboard filters by, so a single-day query never scans the full history.
"""

from __future__ import annotations

import logging
import os
from collections.abc import Sequence
from datetime import date
from typing import Any

from google.cloud import bigquery

from .normalize import CoolSpot

log = logging.getLogger(__name__)

DATASET = os.environ.get("BQ_DATASET", "paris_fraicheur")
SPOTS_TABLE = "cool_spots_snapshot"

SCHEMA: list[bigquery.SchemaField] = [
    bigquery.SchemaField("snapshot_date", "DATE", mode="REQUIRED"),
    bigquery.SchemaField("id", "STRING", mode="REQUIRED"),
    bigquery.SchemaField("name", "STRING"),
    bigquery.SchemaField("category", "STRING", mode="REQUIRED"),
    bigquery.SchemaField("arrondissement", "STRING"),
    bigquery.SchemaField("address", "STRING"),
    bigquery.SchemaField("is_free", "BOOL"),
    bigquery.SchemaField("price", "STRING"),
    bigquery.SchemaField("lat", "FLOAT"),
    bigquery.SchemaField("lon", "FLOAT"),
    bigquery.SchemaField("opening_hours", "STRING"),
    bigquery.SchemaField("is_open_now", "BOOL"),
    bigquery.SchemaField("canopy_score", "INTEGER"),
    bigquery.SchemaField("water_access", "BOOL"),
    bigquery.SchemaField("shade_level", "STRING"),
    bigquery.SchemaField("features", "STRING", mode="REPEATED"),
    bigquery.SchemaField("source", "STRING", mode="REQUIRED"),
]


def client() -> bigquery.Client:
    """Build a BigQuery client for the configured project."""
    return bigquery.Client(project=os.environ.get("GCP_PROJECT"))


def ensure_table(bq: bigquery.Client) -> bigquery.Table:
    """Create the partitioned snapshot table if it does not exist yet."""
    table_id = f"{bq.project}.{DATASET}.{SPOTS_TABLE}"

    bq.create_dataset(
        bigquery.Dataset(f"{bq.project}.{DATASET}"), exists_ok=True
    )

    table = bigquery.Table(table_id, schema=SCHEMA)
    table.time_partitioning = bigquery.TimePartitioning(
        type_=bigquery.TimePartitioningType.DAY, field="snapshot_date"
    )
    table.clustering_fields = ["arrondissement", "category"]
    return bq.create_table(table, exists_ok=True)


def _row(spot: CoolSpot, snapshot: date) -> dict[str, Any]:
    return {
        "snapshot_date": snapshot.isoformat(),
        "id": spot.id,
        "name": spot.name,
        "category": spot.category,
        "arrondissement": spot.arrondissement,
        "address": spot.address,
        "is_free": spot.is_free,
        "price": spot.price,
        "lat": spot.lat,
        "lon": spot.lon,
        "opening_hours": spot.opening_hours,
        "is_open_now": spot.is_open_now,
        "canopy_score": spot.canopy_score,
        "water_access": spot.water_access,
        "shade_level": spot.shade_level,
        "features": list(spot.features),
        "source": spot.source,
    }


def load_snapshot(spots: Sequence[CoolSpot], snapshot: date) -> int:
    """Replace the snapshot for ``snapshot`` with ``spots``.

    Writing with WRITE_TRUNCATE scoped to the day's partition makes a retried
    Airflow task idempotent -- a re-run replaces the day rather than doubling it.
    """
    if not spots:
        log.warning("no spots to load into BigQuery, skipping")
        return 0

    bq = client()
    ensure_table(bq)

    partition = snapshot.strftime("%Y%m%d")
    destination = f"{bq.project}.{DATASET}.{SPOTS_TABLE}${partition}"

    job_config = bigquery.LoadJobConfig(
        schema=SCHEMA,
        write_disposition=bigquery.WriteDisposition.WRITE_TRUNCATE,
        source_format=bigquery.SourceFormat.NEWLINE_DELIMITED_JSON,
    )

    rows = [_row(s, snapshot) for s in spots]
    job = bq.load_table_from_json(rows, destination, job_config=job_config)
    job.result()  # surfaces load errors as an exception

    log.info("loaded %d row(s) into %s", len(rows), destination)
    return len(rows)
