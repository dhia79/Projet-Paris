import { create } from 'zustand'
import type {
  CoolSpot,
  CoolSpotFilter,
  PaginationState,
  SortState,
  SortableColumn,
} from '../types/coolspot'
import { fetchAllCoolSpots, type DatasetLoadReport } from '../services/coolSpotService'
import { logger } from '../lib/logger'

export const INITIAL_FILTER: CoolSpotFilter = {
  query: '',
  category: 'all',
  arrondissement: 'all',
  isFreeOnly: false,
}

const INITIAL_SORT: SortState = { column: 'name', direction: 'asc' }
const INITIAL_PAGINATION: PaginationState = { page: 1, pageSize: 25 }

export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const

interface CoolSpotState {
  items: CoolSpot[]
  reports: readonly DatasetLoadReport[]
  loading: boolean
  error: string | null
  filters: CoolSpotFilter
  sort: SortState
  pagination: PaginationState
}

interface CoolSpotActions {
  fetchAllDatasets: () => Promise<void>
  setFilter: <K extends keyof CoolSpotFilter>(key: K, value: CoolSpotFilter[K]) => void
  resetFilters: () => void
  setSort: (column: SortableColumn) => void
  setPage: (page: number) => void
  setPageSize: (pageSize: number) => void
}

export type CoolSpotStore = CoolSpotState & CoolSpotActions

/** Module-scoped so a re-entrant fetch cancels the in-flight one. */
let inFlight: AbortController | null = null

export const useCoolSpotStore = create<CoolSpotStore>((set, get) => ({
  items: [],
  reports: [],
  loading: false,
  error: null,
  filters: INITIAL_FILTER,
  sort: INITIAL_SORT,
  pagination: INITIAL_PAGINATION,

  async fetchAllDatasets() {
    inFlight?.abort()
    const controller = new AbortController()
    inFlight = controller

    set({ loading: true, error: null })
    logger.info('store', 'fetchAllDatasets() → loading')

    try {
      const { items, reports } = await fetchAllCoolSpots(controller.signal)
      if (controller.signal.aborted) return
      set({ items, reports, loading: false, error: null })
      logger.info('store', `state hydrated with ${items.length} item(s)`, {
        datasets: reports.length,
      })
    } catch (error) {
      if (controller.signal.aborted) return
      const message =
        error instanceof Error ? error.message : 'Une erreur inattendue est survenue.'
      set({ loading: false, error: message })
      logger.error('store', 'fetchAllDatasets() failed', message)
    } finally {
      if (inFlight === controller) inFlight = null
    }
  },

  setFilter(key, value) {
    const current = get().filters
    if (current[key] === value) return
    // Any filter change invalidates the current page offset.
    set({ filters: { ...current, [key]: value }, pagination: { ...get().pagination, page: 1 } })
    logger.info('store', `setFilter(${String(key)})`, value)
  },

  resetFilters() {
    set({ filters: INITIAL_FILTER, pagination: { ...get().pagination, page: 1 } })
    logger.info('store', 'resetFilters()')
  },

  setSort(column) {
    const { sort } = get()
    const direction: SortState['direction'] =
      sort.column === column && sort.direction === 'asc' ? 'desc' : 'asc'
    set({ sort: { column, direction }, pagination: { ...get().pagination, page: 1 } })
    logger.info('store', 'setSort()', { column, direction })
  },

  setPage(page) {
    set({ pagination: { ...get().pagination, page: Math.max(1, page) } })
  },

  setPageSize(pageSize) {
    set({ pagination: { page: 1, pageSize } })
    logger.info('store', 'setPageSize()', pageSize)
  },
}))
