import type { CoolSpot } from '../types/coolspot'
import type { CoolFacilityDTO, FountainDTO, GreenSpaceDTO } from '../types/opendata'
import { fetchDataset, OpenDataError } from './openDataClient'
import { adaptCoolFacility, adaptFountain, adaptGreenSpace } from './normalizers'
import { logger } from '../lib/logger'

/** Declarative dataset registry — adding a source is a single entry, no branching. */
interface DatasetDescriptor<TRecord> {
  readonly slug: string
  readonly label: string
  readonly maxRecords: number
  /**
   * Server-side projection. Critical for `espaces_verts`, whose `geom`
   * MultiPolygon column alone is several hundred KB per page.
   */
  readonly select?: readonly string[]
  readonly adapt: (dto: TRecord, index: number) => CoolSpot
  /** `false` for the optional third dataset: a failure must not sink the page. */
  readonly required: boolean
}

const FOUNTAINS: DatasetDescriptor<FountainDTO> = {
  slug: 'fontaines-a-boire',
  label: 'Fontaines à boire',
  maxRecords: 1_400, // slightly above the current total_count (~1 325)
  adapt: adaptFountain,
  required: true,
}

const GREEN_SPACES: DatasetDescriptor<GreenSpaceDTO> = {
  slug: 'espaces_verts',
  label: 'Espaces verts',
  maxRecords: 2_600, // slightly above the current total_count (~2 534)
  select: [
    'nsq_espace_vert',
    'nom_ev',
    'type_ev',
    'categorie',
    'adresse_numero',
    'adresse_typevoie',
    'adresse_libellevoie',
    'adresse_codepostal',
    'ouvert_ferme',
    'geom_x_y',
  ],
  adapt: adaptGreenSpace,
  required: true,
}

/**
 * The City of Paris' own curated "îlots de fraîcheur" list. Optional: it is the
 * smallest dataset and the page stays useful without it.
 */
const COOL_FACILITIES: DatasetDescriptor<CoolFacilityDTO> = {
  slug: 'ilots-de-fraicheur-equipements-activites',
  label: 'Lieux frais intérieurs',
  maxRecords: 600,
  adapt: adaptCoolFacility,
  required: false,
}

export interface DatasetLoadReport {
  readonly slug: string
  readonly label: string
  readonly status: 'ok' | 'failed'
  readonly rawCount: number
  readonly normalizedCount: number
  readonly error?: string
}

export interface CoolSpotLoadResult {
  readonly items: CoolSpot[]
  readonly reports: readonly DatasetLoadReport[]
}

async function loadOne<TRecord>(
  descriptor: DatasetDescriptor<TRecord>,
  signal?: AbortSignal,
): Promise<{ items: CoolSpot[]; report: DatasetLoadReport }> {
  const { slug, label, adapt, maxRecords, select } = descriptor
  try {
    const raw = await fetchDataset<TRecord>(slug, { maxRecords, select, signal })

    const items = raw
      .map((dto, index) => adapt(dto, index))
      // A record with neither a usable name nor an arrondissement is noise.
      .filter((spot) => spot.name.length > 1)

    const dropped = raw.length - items.length
    if (dropped > 0) logger.warn('adapter', `${slug}: dropped ${dropped} unusable record(s)`)
    logger.info('adapter', `${slug}: normalized ${items.length} CoolSpot(s)`, items[0] ?? null)

    return {
      items,
      report: { slug, label, status: 'ok', rawCount: raw.length, normalizedCount: items.length },
    }
  } catch (error) {
    if (signal?.aborted) throw error
    const message = error instanceof OpenDataError ? error.message : (error as Error).message
    logger.error('api', `${slug} failed: ${message}`)
    return {
      items: [],
      report: { slug, label, status: 'failed', rawCount: 0, normalizedCount: 0, error: message },
    }
  }
}

/** De-duplicates by id; ids are namespaced per dataset so collisions are intra-dataset only. */
function dedupe(items: readonly CoolSpot[]): CoolSpot[] {
  const byId = new Map<string, CoolSpot>()
  for (const item of items) if (!byId.has(item.id)) byId.set(item.id, item)
  const removed = items.length - byId.size
  if (removed > 0) logger.warn('adapter', `de-duplicated ${removed} record(s) with colliding ids`)
  return [...byId.values()]
}

/**
 * Fetches every configured dataset in parallel, normalizes each into `CoolSpot`,
 * and merges the results. Optional datasets degrade gracefully; if every
 * *required* dataset fails, the error is propagated to the store.
 */
export async function fetchAllCoolSpots(signal?: AbortSignal): Promise<CoolSpotLoadResult> {
  return logger.group('adapter', 'fetchAllCoolSpots — aggregate + normalize', async () => {
    const descriptors = [FOUNTAINS, GREEN_SPACES, COOL_FACILITIES] as const

    const settled = await Promise.all([
      loadOne(FOUNTAINS, signal),
      loadOne(GREEN_SPACES, signal),
      loadOne(COOL_FACILITIES, signal),
    ])

    const reports = settled.map((s) => s.report)
    const items = dedupe(settled.flatMap((s) => s.items))

    const requiredSlugs = new Set(descriptors.filter((d) => d.required).map((d) => d.slug))
    const requiredOk = reports.some((r) => requiredSlugs.has(r.slug) && r.status === 'ok')
    if (!requiredOk) {
      throw new Error(
        'Impossible de charger les données Open Data Paris. Vérifiez votre connexion puis réessayez.',
      )
    }

    logger.table(
      reports.map((r) => ({
        dataset: r.slug,
        status: r.status,
        raw: r.rawCount,
        normalized: r.normalizedCount,
        error: r.error ?? '—',
      })),
    )
    logger.info('adapter', `unified dataset ready: ${items.length} CoolSpot(s)`)

    return { items, reports }
  })
}
