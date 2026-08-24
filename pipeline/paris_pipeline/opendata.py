"""Client for the Open Data Paris Explore API v2.1.

Server-side twin of ``frontend/src/services/openDataClient.ts``: same paging
contract, but it runs in a batch job where a large payload is unremarkable.

Two access modes, because the datasets differ by two orders of magnitude:
``fetch_dataset`` pages the records endpoint (fine up to a few thousand rows),
and ``export_dataset`` hits the bulk export endpoint, which returns a whole
dataset in one response -- the only sane way to read the ~200k Paris trees.
"""

from __future__ import annotations

import logging
import os
import time
from collections.abc import Iterator, Sequence
from typing import Any

import requests

log = logging.getLogger(__name__)

BASE_URL = os.environ.get(
    "OPENDATA_BASE_URL",
    "https://opendata.paris.fr/api/explore/v2.1/catalog/datasets",
)

#: The Explore API caps ``limit`` at 100 per request.
MAX_PAGE_SIZE = 100
REQUEST_TIMEOUT = (10, 30)  # (connect, read) seconds
MAX_ATTEMPTS = 4


class OpenDataError(RuntimeError):
    """A dataset could not be fetched."""

    def __init__(self, dataset: str, message: str, status: int | None = None) -> None:
        super().__init__(f"{dataset}: {message}")
        self.dataset = dataset
        self.status = status


def _get_with_retry(
    session: requests.Session,
    url: str,
    params: dict[str, Any],
    dataset: str,
    timeout: tuple[int, int] = REQUEST_TIMEOUT,
) -> Any:
    """GET with bounded exponential backoff.

    Only transient conditions are retried; a 4xx is a bug in our request and
    retrying it just delays the failure.
    """
    last_error: Exception | None = None

    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            response = session.get(url, params=params, timeout=timeout)
            if response.status_code == 429 or response.status_code >= 500:
                raise OpenDataError(dataset, f"HTTP {response.status_code}", response.status_code)
            if not response.ok:
                raise OpenDataError(dataset, f"HTTP {response.status_code}", response.status_code)
            return response.json()
        except (requests.RequestException, OpenDataError) as exc:
            status = getattr(exc, "status", None)
            if status is not None and 400 <= status < 500 and status != 429:
                raise
            last_error = exc
            if attempt == MAX_ATTEMPTS:
                break
            backoff = 2 ** (attempt - 1)
            log.warning("%s: attempt %d/%d failed (%s), retrying in %ds",
                        dataset, attempt, MAX_ATTEMPTS, exc, backoff)
            time.sleep(backoff)

    raise OpenDataError(dataset, f"exhausted {MAX_ATTEMPTS} attempts: {last_error}")


def fetch_dataset(
    slug: str,
    max_records: int,
    select: Sequence[str] | None = None,
    where: str | None = None,
    session: requests.Session | None = None,
) -> list[dict[str, Any]]:
    """Page through a dataset and return at most ``max_records`` raw records."""
    owns_session = session is None
    session = session or requests.Session()
    url = f"{BASE_URL}/{slug}/records"
    records: list[dict[str, Any]] = []

    try:
        offset = 0
        while len(records) < max_records:
            limit = min(MAX_PAGE_SIZE, max_records - len(records))
            params: dict[str, Any] = {"limit": limit, "offset": offset}
            if select:
                params["select"] = ",".join(select)
            if where:
                params["where"] = where

            payload = _get_with_retry(session, url, params, slug)
            page = payload.get("results") or []
            records.extend(page)

            total = payload.get("total_count")
            offset += len(page)
            # Stop on a short page, on exhaustion, or on an empty page -- any of
            # the three means there is nothing left and looping would spin.
            if not page or len(page) < limit or (total is not None and offset >= total):
                break

        log.info("%s: fetched %d record(s)", slug, len(records))
        return records
    finally:
        if owns_session:
            session.close()


def export_dataset(
    slug: str,
    select: Sequence[str] | None = None,
    where: str | None = None,
    session: requests.Session | None = None,
) -> list[dict[str, Any]]:
    """Download an entire dataset through the bulk export endpoint.

    Paging ``les-arbres`` 100 rows at a time would be ~2 100 requests. The
    export endpoint answers the same query in one, and is the documented way to
    pull a full dataset.

    ``select`` is not optional in practice: the tree dataset carries two dozen
    columns and we want two of them.
    """
    owns_session = session is None
    session = session or requests.Session()
    url = f"{BASE_URL}/{slug}/exports/json"

    params: dict[str, Any] = {}
    if select:
        params["select"] = ",".join(select)
    if where:
        params["where"] = where

    try:
        # A longer read timeout than the paged path: this is one big response,
        # and the server streams it while it assembles.
        payload = _get_with_retry(session, url, params, slug, timeout=(10, 180))
        records = payload if isinstance(payload, list) else payload.get("results", [])
        log.info("%s: exported %d record(s)", slug, len(records))
        return records
    finally:
        if owns_session:
            session.close()


def iter_dataset(slug: str, max_records: int, **kwargs: Any) -> Iterator[dict[str, Any]]:
    """Convenience iterator over :func:`fetch_dataset`."""
    yield from fetch_dataset(slug, max_records, **kwargs)
