/**
 * Unified domain contracts.
 *
 * Every heterogeneous Open Data Paris dataset is normalized into `CoolSpot`
 * before it ever reaches the store or the UI. Components never see a raw DTO.
 */

export const COOL_SPOT_CATEGORIES = ['fountain', 'green_space', 'indoor'] as const
export type CoolSpotCategory = (typeof COOL_SPOT_CATEGORIES)[number]

export const CATEGORY_LABELS: Record<CoolSpotCategory, string> = {
  fountain: 'Fontaine',
  green_space: 'Espace vert',
  indoor: 'Lieu frais intérieur',
}

/** Tailwind classes per category, colocated with the domain enum to avoid switch drift. */
export const CATEGORY_BADGE_CLASSES: Record<CoolSpotCategory, string> = {
  fountain: 'bg-sky-100 text-sky-800 ring-sky-600/20',
  green_space: 'bg-emerald-100 text-emerald-800 ring-emerald-600/20',
  indoor: 'bg-violet-100 text-violet-800 ring-violet-600/20',
}

export interface GeoCoordinates {
  readonly lat: number
  readonly lon: number
}

/** The single shape the whole application reasons about. */
export interface CoolSpot {
  readonly id: string
  readonly name: string
  readonly category: CoolSpotCategory
  /** Normalized as `75001`..`75020`, or `null` when the source is unusable. */
  readonly arrondissement: string | null
  readonly address: string
  readonly isFree: boolean
  readonly coordinates: GeoCoordinates | null
  readonly openingHours: string | null
  /** Dataset slug the record came from — kept for traceability / debugging. */
  readonly source: string
}

export type SortableColumn = 'name' | 'category' | 'arrondissement' | 'address' | 'isFree'
export type SortDirection = 'asc' | 'desc'

export interface CoolSpotFilter {
  query: string
  /** `'all'` means no category constraint. */
  category: CoolSpotCategory | 'all'
  /** `'all'` means no arrondissement constraint. */
  arrondissement: string
  isFreeOnly: boolean
}

export interface SortState {
  column: SortableColumn
  direction: SortDirection
}

export interface PaginationState {
  page: number
  pageSize: number
}

export interface ArrondissementStat {
  /** `75011` */
  readonly code: string
  /** `11e` — chart-friendly short label. */
  readonly label: string
  readonly total: number
  readonly fountain: number
  readonly green_space: number
  readonly indoor: number
}
