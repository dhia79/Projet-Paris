/**
 * Client for the Go backend (`services/api-go`).
 *
 * The dashboard used to normalize Open Data Paris in the browser. That path is
 * still there as a fallback, but when `VITE_API_BASE_URL` is set the data comes
 * from MySQL through this client instead: one HTTP round trip per page rather
 * than ~4 500 raw records paged out of a public API on every reload.
 */
import type { ArrondissementStat, CoolSpot } from '../types/coolspot'
import type { DatasetLoadReport } from './coolSpotService'
import { logger } from '../lib/logger'

const BASE_URL = import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, '') ?? ''

/** The API is only in play when it has been configured. */
export const isApiConfigured = BASE_URL !== ''

const REQUEST_TIMEOUT_MS = 15_000

/** Matches the Go handler's `MaxPageSize`; fewer round trips for a full load. */
const PAGE_SIZE = 500

export class ApiError extends Error {
  constructor(
    readonly path: string,
    message: string,
    readonly status?: number,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/** The `Page[T]` envelope every collection endpoint returns. */
interface ApiPage<T> {
  readonly items: T[]
  readonly total: number
  readonly page: number
  readonly pageSize: number
  readonly pageCount: number
}

async function request<T>(path: string, signal?: AbortSignal): Promise<T> {
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  const composed = signal ? AbortSignal.any([signal, timeout]) : timeout

  let response: Response
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      signal: composed,
      headers: { Accept: 'application/json' },
    })
  } catch (error) {
    // An aborted request is the caller's own cancellation — propagate it
    // untouched so the store can tell it apart from a real failure.
    if (signal?.aborted) throw error
    throw new ApiError(path, `Network error on ${path}: ${(error as Error).message}`)
  }

  if (!response.ok) {
    // The API answers errors as `{ "error": "..." }`; fall back to the status
    // line when the body is something else entirely (a proxy error page).
    let detail = `HTTP ${response.status}`
    try {
      const body = (await response.json()) as { error?: string }
      if (body.error) detail = body.error
    } catch {
      // Body was not JSON; the status line is all we have.
    }
    throw new ApiError(path, detail, response.status)
  }

  return (await response.json()) as T
}

/**
 * Pull every page of the spots collection.
 *
 * The store holds the full dataset in memory and filters client-side, so the
 * initial load is still "everything" — but it now arrives pre-normalized in
 * ~10 requests instead of ~45.
 */
async function fetchAllPages(signal?: AbortSignal): Promise<CoolSpot[]> {
  const first = await request<ApiPage<CoolSpot>>(
    `/api/v1/coolspots?page=1&pageSize=${PAGE_SIZE}`,
    signal,
  )

  const items = [...first.items]
  for (let page = 2; page <= first.pageCount; page++) {
    const next = await request<ApiPage<CoolSpot>>(
      `/api/v1/coolspots?page=${page}&pageSize=${PAGE_SIZE}`,
      signal,
    )
    items.push(...next.items)
  }

  if (items.length !== first.total) {
    // Not fatal — the pipeline may have written between two page requests —
    // but worth surfacing, because it also looks exactly like a paging bug.
    logger.warn('api', `expected ${first.total} spot(s), assembled ${items.length}`)
  }

  return items
}

/** Latest per-source ingestion outcome, for the data-freshness footer. */
export async function fetchIngestionReports(signal?: AbortSignal): Promise<DatasetLoadReport[]> {
  return request<DatasetLoadReport[]>('/api/v1/meta/ingestion', signal)
}

/** Per-arrondissement counts, computed by MySQL rather than in the browser. */
export async function fetchArrondissementStats(
  signal?: AbortSignal,
): Promise<ArrondissementStat[]> {
  return request<ArrondissementStat[]>('/api/v1/stats/arrondissements', signal)
}

/**
 * Load the full dataset plus its freshness reports.
 *
 * The reports are best-effort: a dashboard that renders 4 500 spots without a
 * freshness banner is far better than one that fails because a metadata
 * endpoint hiccuped.
 */
export async function fetchCoolSpotsFromApi(
  signal?: AbortSignal,
): Promise<{ items: CoolSpot[]; reports: DatasetLoadReport[] }> {
  return logger.group('api', 'fetchCoolSpotsFromApi — Go backend', async () => {
    const [items, reports] = await Promise.all([
      fetchAllPages(signal),
      fetchIngestionReports(signal).catch((error: unknown) => {
        logger.warn('api', 'ingestion reports unavailable', (error as Error).message)
        return [] as DatasetLoadReport[]
      }),
    ])

    logger.info('api', `loaded ${items.length} spot(s) from the API`)
    return { items, reports }
  })
}
