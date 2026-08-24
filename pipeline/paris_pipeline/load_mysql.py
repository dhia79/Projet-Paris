"""Load normalized spots into the MySQL serving database.

The write is an upsert rather than a truncate-and-insert: the API reads the
same table continuously, and a truncate would serve an empty dashboard for the
duration of the load. Rows that vanish from the source are swept afterwards,
inside the same transaction.
"""

from __future__ import annotations

import json
import logging
import os
from collections.abc import Iterable, Iterator, Sequence
from contextlib import contextmanager
from datetime import UTC, date, datetime
from typing import Any

import pymysql
from pymysql.cursors import Cursor

from .normalize import CoolSpot

log = logging.getLogger(__name__)

BATCH_SIZE = 500

UPSERT_SQL = """
INSERT INTO cool_spots (
  id, name, category, arrondissement, address, is_free, price, lat, lon,
  opening_hours, is_open_now, canopy_score, water_access, shade_level,
  features, source
) VALUES (
  %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
) AS new
ON DUPLICATE KEY UPDATE
  name           = new.name,
  category       = new.category,
  arrondissement = new.arrondissement,
  address        = new.address,
  is_free        = new.is_free,
  price          = new.price,
  lat            = new.lat,
  lon            = new.lon,
  opening_hours  = new.opening_hours,
  is_open_now    = new.is_open_now,
  canopy_score   = new.canopy_score,
  water_access   = new.water_access,
  shade_level    = new.shade_level,
  features       = new.features,
  source         = new.source
"""


def connection_params() -> dict[str, Any]:
    """Build pymysql kwargs from the environment.

    Prefers the Cloud SQL unix socket when ``INSTANCE_CONNECTION_NAME`` is set,
    matching how the Go API connects.
    """
    params: dict[str, Any] = {
        "user": os.environ.get("DB_USER", "paris_pipeline"),
        "password": os.environ["DB_PASSWORD"],
        "database": os.environ.get("DB_NAME", "paris_fraicheur"),
        "charset": "utf8mb4",
        "autocommit": False,
        "connect_timeout": 10,
    }

    instance = os.environ.get("INSTANCE_CONNECTION_NAME")
    if instance:
        socket_dir = os.environ.get("DB_SOCKET_DIR", "/cloudsql")
        params["unix_socket"] = f"{socket_dir}/{instance}"
    else:
        params["host"] = os.environ.get("DB_HOST", "127.0.0.1")
        params["port"] = int(os.environ.get("DB_PORT", "3306"))

    return params


@contextmanager
def connect() -> Iterator[pymysql.connections.Connection]:
    """Yield a connection, committing on success and rolling back on failure."""
    conn = pymysql.connect(**connection_params())
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def _row(spot: CoolSpot) -> tuple[Any, ...]:
    return (
        spot.id,
        spot.name[:255],
        spot.category,
        spot.arrondissement,
        spot.address[:512],
        spot.is_free,
        spot.price,
        spot.lat,
        spot.lon,
        (spot.opening_hours or "")[:255] or None,
        spot.is_open_now,
        max(0, min(100, spot.canopy_score)),
        spot.water_access,
        spot.shade_level[:128],
        json.dumps(list(spot.features), ensure_ascii=False),
        spot.source,
    )


def upsert_spots(cursor: Cursor, spots: Sequence[CoolSpot]) -> int:
    """Upsert spots in batches. Returns the number of rows sent."""
    sent = 0
    for start in range(0, len(spots), BATCH_SIZE):
        batch = spots[start : start + BATCH_SIZE]
        cursor.executemany(UPSERT_SQL, [_row(s) for s in batch])
        sent += len(batch)
        log.info("upserted %d/%d spot(s)", sent, len(spots))
    return sent


def sweep_removed(cursor: Cursor, source: str, seen_ids: Iterable[str]) -> int:
    """Delete rows of ``source`` whose id is no longer in the feed.

    Guarded: an empty id set means the fetch produced nothing, and deleting the
    whole source on that basis would turn a transient upstream outage into data
    loss.
    """
    ids = list(seen_ids)
    if not ids:
        log.warning("%s: empty id set, skipping sweep", source)
        return 0

    placeholders = ",".join(["%s"] * len(ids))
    sql = f"DELETE FROM cool_spots WHERE source = %s AND id NOT IN ({placeholders})"
    cursor.execute(sql, [source, *ids])
    removed = cursor.rowcount
    if removed:
        log.info("%s: swept %d row(s) no longer present upstream", source, removed)
    return removed


def record_run(
    cursor: Cursor,
    run_id: str,
    source: str,
    status: str,
    raw_count: int,
    normalized_count: int,
    error: str | None = None,
) -> None:
    """Write the per-source outcome the dashboard footer reads back."""
    cursor.execute(
        """
        INSERT INTO ingestion_runs
          (run_id, source, status, raw_count, normalized_count, error, finished_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s) AS new
        ON DUPLICATE KEY UPDATE
          status           = new.status,
          raw_count        = new.raw_count,
          normalized_count = new.normalized_count,
          error            = new.error,
          finished_at      = new.finished_at
        """,
        (
            run_id,
            source,
            status,
            raw_count,
            normalized_count,
            (error or "")[:512] or None,
            datetime.now(UTC),
        ),
    )


def upsert_tree_counts(cursor: Cursor, counts: dict[str, int], computed_on: date) -> int:
    """Store the tree census per arrondissement.

    Read by the R analytics as its canopy input, and by the API for context on
    the arrondissement chart.
    """
    if not counts:
        log.warning("no tree counts to write")
        return 0

    rows = [(code, computed_on, total) for code, total in sorted(counts.items())]
    cursor.executemany(
        """
        INSERT INTO arrondissement_trees (code, computed_on, tree_count)
        VALUES (%s, %s, %s) AS new
        ON DUPLICATE KEY UPDATE tree_count = new.tree_count
        """,
        rows,
    )
    log.info("wrote tree counts for %d arrondissement(s)", len(rows))
    return len(rows)


def snapshot_arrondissements(cursor: Cursor, snapshot: date) -> int:
    """Append today's per-arrondissement aggregates to the history table.

    This is what BigQuery used to hold. Twenty rows a day is 7 300 a year --
    a decade of history is smaller than a single day of raw spot snapshots, and
    it answers the same questions without a second database.
    """
    cursor.execute(
        """
        INSERT INTO arrondissement_history
          (code, snapshot_date, total, fountain, green_space, indoor, mist,
           mean_canopy_score, water_access_ratio)
        SELECT code, %s, total, fountain, green_space, indoor, mist,
               COALESCE(mean_canopy_score, 0), COALESCE(water_access_ratio, 0)
        FROM v_arrondissement_stats AS new
        ON DUPLICATE KEY UPDATE
          total              = new.total,
          fountain           = new.fountain,
          green_space        = new.green_space,
          indoor             = new.indoor,
          mist               = new.mist,
          mean_canopy_score  = new.mean_canopy_score,
          water_access_ratio = new.water_access_ratio
        """,
        (snapshot,),
    )
    log.info("snapshotted %d arrondissement row(s) for %s", cursor.rowcount, snapshot)
    return cursor.rowcount
