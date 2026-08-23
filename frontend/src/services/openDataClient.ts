import type { OpenDataResponse } from '../types/opendata'
import { logger } from '../lib/logger'

const BASE_URL =
  import.meta.env.VITE_OPENDATA_BASE_URL ?? 'https://opendata.paris.fr/api/explore/v2.1/catalog/datasets'

/** The Explore API v2.1 caps `limit` at 100 per request. */
const MAX_PAGE_SIZE = 100
const REQUEST_TIMEOUT_MS = 15_000

export class OpenDataError extends Error {
  constructor(
    readonly dataset: string,
    message: string,
    readonly status?: number,
  ) {
    super(message)
    this.name = 'OpenDataError'
  }
}

interface FetchOptions {
  /** Hard cap on records pulled for a dataset (protects the browser from 20k-row payloads). */
  readonly maxRecords?: number
  /** Optional `select` projection — smaller payloads, faster demos. */
  readonly select?: readonly string[]
  readonly where?: string
  readonly signal?: AbortSignal
}

function buildUrl(dataset: string, offset: number, limit: number, options: FetchOptions): string {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) })
  if (options.select?.length) params.set('select', options.select.join(','))
  if (options.where) params.set('where', options.where)
  return `${BASE_URL}/${dataset}/records?${params.toString()}`
}

async function fetchPage<TRecord>(
  dataset: string,
  offset: number,
  limit: number,
  options: FetchOptions,
): Promise<OpenDataResponse<TRecord>> {
  const url = buildUrl(dataset, offset, limit, options)
  // Compose the caller's signal with our own timeout so both can cancel.
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout

  const response = await fetch(url, { signal, headers: { Accept: 'application/json' } })
  if (!response.ok) {
    throw new OpenDataError(dataset, `HTTP ${response.status} on ${dataset}`, response.status)
  }
  return (await response.json()) as OpenDataResponse<TRecord>
}

/** Concurrent in-flight page requests per dataset — enough to be fast, low enough to stay polite. */
const PAGE_CONCURRENCY = 4

/**
 * Fetch a dataset with bounded-concurrency pagination.
 *
 * The first page is fetched alone because its `total_count` is what tells us how
 * many further pages exist; the remaining offsets are then known up front and
 * fetched in windows of `PAGE_CONCURRENCY`. Sequential paging costs ~15s on
 * `espaces_verts` (26 pages); windowed paging cuts that to a few seconds without
 * firing 26 simultaneous requests at an anonymous-rate-limited API.
 */
export async function fetchDataset<TRecord>(
  dataset: string,
  options: FetchOptions = {},
): Promise<TRecord[]> {
  const maxRecords = options.maxRecords ?? 1_000

  return logger.group('api', `GET ${dataset} (max ${maxRecords})`, async () => {
    const first = await fetchPage<TRecord>(dataset, 0, Math.min(MAX_PAGE_SIZE, maxRecords), options)
    const target = Math.min(maxRecords, first.total_count)
    const records = [...first.results]

    logger.info('api', `${dataset}: total_count=${first.total_count}, fetching up to ${target}`)

    // Offsets for every page after the first.
    const offsets: number[] = []
    for (let offset = records.length; offset < target; offset += MAX_PAGE_SIZE) offsets.push(offset)

    for (let i = 0; i < offsets.length; i += PAGE_CONCURRENCY) {
      const window = offsets.slice(i, i + PAGE_CONCURRENCY)
      const pages = await Promise.all(
        window.map((offset) =>
          fetchPage<TRecord>(dataset, offset, Math.min(MAX_PAGE_SIZE, target - offset), options),
        ),
      )
      // Windows are pushed in offset order, so record order stays stable.
      for (const page of pages) records.push(...page.results)
    }

    logger.info('api', `${dataset}: ${records.length} raw records received`)
    return records
  })
}
