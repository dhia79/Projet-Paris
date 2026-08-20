import { useMemo } from 'react'
import { useCoolSpotStore, INITIAL_FILTER } from '../store/useCoolSpotStore'
import {
  selectActiveFiltersCount,
  selectAvailableArrondissements,
  selectCountsByCategory,
  selectFilteredItems,
  selectPageCount,
  selectPaginatedItems,
  selectSortedItems,
  selectStatsByArrondissement,
  selectTopArrondissement,
} from '../store/selectors'

/**
 * Single read-model for the dashboard.
 *
 * Derived values live here rather than in the store so each computation is a
 * pure function memoized on its real inputs — no selector allocating a fresh
 * object on every store write, and no stale cache to invalidate by hand.
 */
export function useCoolSpots() {
  const items = useCoolSpotStore((s) => s.items)
  const filters = useCoolSpotStore((s) => s.filters)
  const sort = useCoolSpotStore((s) => s.sort)
  const pagination = useCoolSpotStore((s) => s.pagination)
  const loading = useCoolSpotStore((s) => s.loading)
  const error = useCoolSpotStore((s) => s.error)
  const reports = useCoolSpotStore((s) => s.reports)

  const filteredItems = useMemo(() => selectFilteredItems(items, filters), [items, filters])

  const sortedItems = useMemo(() => selectSortedItems(filteredItems, sort), [filteredItems, sort])

  const totalCount = filteredItems.length
  const pageCount = selectPageCount(totalCount, pagination.pageSize)
  // Clamp instead of writing back to the store: keeps this hook render-pure.
  const page = Math.min(pagination.page, pageCount)

  const paginatedItems = useMemo(
    () => selectPaginatedItems(sortedItems, { page, pageSize: pagination.pageSize }),
    [sortedItems, page, pagination.pageSize],
  )

  const statsByArrondissement = useMemo(
    () => selectStatsByArrondissement(filteredItems),
    [filteredItems],
  )

  const countsByCategory = useMemo(() => selectCountsByCategory(filteredItems), [filteredItems])

  const availableArrondissements = useMemo(
    () => selectAvailableArrondissements(items),
    [items],
  )

  const topArrondissement = useMemo(
    () => selectTopArrondissement(statsByArrondissement),
    [statsByArrondissement],
  )

  const activeFiltersCount = selectActiveFiltersCount(filters, INITIAL_FILTER)

  return {
    // raw state
    loading,
    error,
    reports,
    filters,
    sort,
    pagination: { ...pagination, page },
    // derived
    filteredItems,
    paginatedItems,
    totalCount,
    sourceCount: items.length,
    pageCount,
    statsByArrondissement,
    countsByCategory,
    availableArrondissements,
    topArrondissement,
    activeFiltersCount,
  }
}
