import { useMemo } from 'react'
import { useCoolSpotStore, INITIAL_FILTER } from '../store/useCoolSpotStore'
import {
  selectActiveFiltersCount,
  selectAvailableArrondissements,
  selectAvailableSources,
  selectCountsByCategory,
  selectFilteredItems,
  selectSortedItems,
  selectStatsByArrondissement,
  selectVisibleItems,
} from '../store/selectors'

/**
 * Single read-model for the dashboard.
 *
 * Derived values live here rather than in the store so each computation is a
 * pure function memoized on its real inputs — no selector allocating a fresh
 * object on every store write, and no stale cache to invalidate by hand.
 *
 * App.tsx consumes this hook rather than calling the selectors itself: an
 * inline copy in the component drifted from this one, and the copy compared
 * the live filters against themselves, which pinned activeFiltersCount to 0.
 */
export function useCoolSpots() {
  const items = useCoolSpotStore((s) => s.items)
  const filters = useCoolSpotStore((s) => s.filters)
  const sort = useCoolSpotStore((s) => s.sort)
  const visibleCount = useCoolSpotStore((s) => s.visibleCount)
  const loadMore = useCoolSpotStore((s) => s.loadMore)
  const loading = useCoolSpotStore((s) => s.loading)
  const error = useCoolSpotStore((s) => s.error)
  const reports = useCoolSpotStore((s) => s.reports)
  const favorites = useCoolSpotStore((s) => s.favorites)

  // Memoized on the array identity: toggleFavorite always writes a new array,
  // so this rebuilds exactly when the set actually changes.
  const favoritesSet = useMemo(() => new Set(favorites), [favorites])

  const filteredItems = useMemo(
    () => selectFilteredItems(items, filters, favoritesSet),
    [items, filters, favoritesSet],
  )

  const sortedItems = useMemo(() => selectSortedItems(filteredItems, sort), [filteredItems, sort])

  const totalCount = filteredItems.length

  // Clamped rather than written back to the store, so this hook stays
  // render-pure: a filter that shrinks the result set below visibleCount must
  // not leave "showing 90 of 12" on screen.
  const revealedCount = Math.min(visibleCount, totalCount)
  const hasMore = revealedCount < totalCount

  const visibleItems = useMemo(
    () => selectVisibleItems(sortedItems, revealedCount),
    [sortedItems, revealedCount],
  )

  const statsByArrondissement = useMemo(
    () => selectStatsByArrondissement(filteredItems),
    [filteredItems],
  )

  // Deliberately over `items`, not `filteredItems`: the metrics strip reports
  // what the city has, and must not restate the filter the user just applied.
  const countsByCategory = useMemo(() => selectCountsByCategory(items), [items])

  const availableArrondissements = useMemo(
    () => selectAvailableArrondissements(items),
    [items],
  )

  const availableSources = useMemo(() => selectAvailableSources(items), [items])

  // Compared against INITIAL_FILTER — the store's current filters would be the
  // same object, and every comparison would trivially hold.
  const activeFiltersCount = useMemo(
    () => selectActiveFiltersCount(filters, INITIAL_FILTER),
    [filters],
  )

  const loadedSourceCount = useMemo(
    () => reports.filter((r) => r.status === 'ok').length,
    [reports],
  )

  const failedSourceLabels = useMemo(
    () => reports.filter((r) => r.status === 'failed').map((r) => r.label),
    [reports],
  )

  return {
    // raw state
    items,
    loading,
    error,
    reports,
    filters,
    sort,
    favorites,
    // derived
    filteredItems,
    visibleItems,
    revealedCount,
    hasMore,
    loadMore,
    totalCount,
    statsByArrondissement,
    countsByCategory,
    availableArrondissements,
    availableSources,
    activeFiltersCount,
    loadedSourceCount,
    failedSourceLabels,
  }
}
