/**
 * Unified domain contracts for Paris Îlots de Fraîcheur.
 *
 * Every heterogeneous Open Data Paris dataset is normalized into `CoolSpot`
 * before it ever reaches the store or the UI.
 */

export const COOL_SPOT_CATEGORIES = ['fountain', 'green_space', 'indoor', 'mist'] as const
export type CoolSpotCategory = (typeof COOL_SPOT_CATEGORIES)[number]

export const CATEGORY_LABELS: Record<CoolSpotCategory, string> = {
  fountain: "Fontaine d'eau",
  green_space: 'Parc & Canopée',
  indoor: 'Lieu climatisé',
  mist: 'Baignade & Brumisateur',
}

export const CATEGORY_BADGE_CLASSES: Record<CoolSpotCategory, string> = {
  fountain: 'bg-sky-100 text-sky-800 border border-sky-200',
  green_space: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
  indoor: 'bg-slate-100 text-slate-600 border border-slate-200',
  mist: 'bg-cyan-100 text-cyan-800 border border-cyan-200',
}

export type AvailabilityFilter = 'ALL' | 'OPEN_NOW' | '247'
export type PriceFilter = 'ALL' | 'FREE' | 'MUNICIPAL'

export interface GeoCoordinates {
  readonly lat: number
  readonly lon: number
}

/** The single domain entity representation. */
export interface CoolSpot {
  readonly id: string
  readonly name: string
  readonly category: CoolSpotCategory
  /** Normalized as `75001`..`75020`, or `null` when unavailable. */
  readonly arrondissement: string | null
  readonly address: string
  readonly isFree: boolean
  readonly price: 'FREE' | 'MUNICIPAL'
  readonly coordinates: GeoCoordinates | null
  readonly openingHours: string | null
  readonly isOpenNow: boolean
  readonly canopyScore: number
  readonly waterAccess: boolean
  readonly shadeLevel: string
  readonly features: readonly string[]
  /** Dataset slug the record came from. */
  readonly source: string
}

export type SortableColumn = 'name' | 'category' | 'arrondissement' | 'address' | 'canopyScore'
export type SortDirection = 'asc' | 'desc'

export const SOURCE_LABELS: Record<string, string> = {
  'fontaines-a-boire': 'Fontaines à boire',
  'espaces_verts': 'Espaces verts',
  'ilots-de-fraicheur-equipements-activites': 'Équipements & activités',
}

export interface CoolSpotFilter {
  query: string
  /** `'all'` means no category constraint, or category name string. */
  category: CoolSpotCategory | 'all'
  /** `'all'` means no arrondissement constraint. */
  arrondissement: string
  availability: AvailabilityFilter
  price: PriceFilter
  /** `'all'` means no source constraint, or dataset slug string. */
  source: string
  favoritesOnly: boolean
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
  readonly mist: number
}
