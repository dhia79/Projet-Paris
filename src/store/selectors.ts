import {
  type ArrondissementStat,
  type CoolSpot,
  type CoolSpotCategory,
  type CoolSpotFilter,
  type PaginationState,
  type SortState,
} from '../types/coolspot'

/** Diacritic-insensitive, case-insensitive haystack for the search box. */
function fold(value: string): string {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

export function arrondissementLabel(code: string): string {
  const n = Number(code.slice(-2))
  return n === 1 ? '1er' : `${n}e`
}

export function matchesFilter(
  spot: CoolSpot,
  filter: CoolSpotFilter,
  favoritesSet: Set<string> = new Set(),
): boolean {
  if (filter.category !== 'all' && spot.category !== filter.category) return false
  if (filter.arrondissement !== 'all' && spot.arrondissement !== filter.arrondissement) return false
  if (filter.favoritesOnly && !favoritesSet.has(spot.id)) return false

  if (filter.price === 'FREE' && !spot.isFree) return false
  if (filter.price === 'MUNICIPAL' && spot.isFree) return false

  if (filter.availability === 'OPEN_NOW' && !spot.isOpenNow) return false
  if (filter.availability === '247' && !spot.openingHours?.toLowerCase().includes('24h')) return false

  const query = fold(filter.query.trim())
  if (!query) return true
  return fold(`${spot.name} ${spot.address} ${spot.arrondissement ?? ''}`).includes(query)
}

export function selectFilteredItems(
  items: readonly CoolSpot[],
  filter: CoolSpotFilter,
  favoritesSet: Set<string> = new Set(),
): CoolSpot[] {
  return items.filter((spot) => matchesFilter(spot, filter, favoritesSet))
}

const collator = new Intl.Collator('fr', { sensitivity: 'base', numeric: true })

function compareBy(column: SortState['column'], a: CoolSpot, b: CoolSpot): number {
  switch (column) {
    case 'canopyScore':
      return a.canopyScore - b.canopyScore
    case 'arrondissement':
      return collator.compare(a.arrondissement ?? '', b.arrondissement ?? '')
    case 'category':
      return collator.compare(a.category, b.category)
    case 'address':
      return collator.compare(a.address, b.address)
    case 'name':
      return collator.compare(a.name, b.name)
  }
}

function isMissing(column: SortState['column'], spot: CoolSpot): boolean {
  return column === 'arrondissement' && spot.arrondissement === null
}

export function selectSortedItems(items: readonly CoolSpot[], sort: SortState): CoolSpot[] {
  const factor = sort.direction === 'asc' ? 1 : -1
  return [...items].sort((a, b) => {
    const aMissing = isMissing(sort.column, a)
    const bMissing = isMissing(sort.column, b)
    if (aMissing !== bMissing) return aMissing ? 1 : -1

    const primary = compareBy(sort.column, a, b) * factor
    return primary !== 0 ? primary : collator.compare(a.name, b.name)
  })
}

export function selectPaginatedItems(
  items: readonly CoolSpot[],
  { page, pageSize }: PaginationState,
): CoolSpot[] {
  const start = (page - 1) * pageSize
  return items.slice(start, start + pageSize)
}

export function selectPageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize))
}

export function selectStatsByArrondissement(items: readonly CoolSpot[]): ArrondissementStat[] {
  const buckets = new Map<string, ArrondissementStat>()

  for (const spot of items) {
    if (!spot.arrondissement) continue
    const current =
      buckets.get(spot.arrondissement) ??
      ({
        code: spot.arrondissement,
        label: arrondissementLabel(spot.arrondissement),
        total: 0,
        fountain: 0,
        green_space: 0,
        indoor: 0,
        mist: 0,
      } satisfies ArrondissementStat)

    buckets.set(spot.arrondissement, {
      ...current,
      total: current.total + 1,
      [spot.category]: (current[spot.category] || 0) + 1,
    })
  }

  return [...buckets.values()].sort((a, b) => a.code.localeCompare(b.code))
}

export function selectCountsByCategory(
  items: readonly CoolSpot[],
): Record<CoolSpotCategory, number> {
  const counts: Record<CoolSpotCategory, number> = { fountain: 0, green_space: 0, indoor: 0, mist: 0 }
  for (const spot of items) {
    if (counts[spot.category] !== undefined) {
      counts[spot.category] += 1
    }
  }
  return counts
}

export function selectAvailableArrondissements(items: readonly CoolSpot[]): string[] {
  const codes = new Set<string>()
  for (const spot of items) if (spot.arrondissement) codes.add(spot.arrondissement)
  return [...codes].sort((a, b) => a.localeCompare(b))
}

export function selectActiveFiltersCount(filter: CoolSpotFilter, initial: CoolSpotFilter): number {
  let count = 0
  if (filter.query.trim() !== initial.query) count += 1
  if (filter.category !== initial.category) count += 1
  if (filter.arrondissement !== initial.arrondissement) count += 1
  if (filter.availability !== initial.availability) count += 1
  if (filter.price !== initial.price) count += 1
  if (filter.favoritesOnly !== initial.favoritesOnly) count += 1
  return count
}

export function selectTopArrondissement(stats: readonly ArrondissementStat[]): ArrondissementStat | null {
  return stats.reduce<ArrondissementStat | null>(
    (best, stat) => (best === null || stat.total > best.total ? stat : best),
    null,
  )
}
