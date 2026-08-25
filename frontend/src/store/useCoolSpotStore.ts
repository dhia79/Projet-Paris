import { create } from 'zustand'
import type {
  CoolSpot,
  CoolSpotCategory,
  CoolSpotFilter,
  PriceFilter,
  SortState,
  SortableColumn,
} from '../types/coolspot'
import { fetchAllCoolSpots, type DatasetLoadReport } from '../services/coolSpotService'
import { logger } from '../lib/logger'

export const INITIAL_FILTER: CoolSpotFilter = {
  query: '',
  category: 'all',
  arrondissement: 'all',
  availability: 'ALL',
  price: 'ALL',
  source: 'all',
  favoritesOnly: false,
}

const INITIAL_SORT: SortState = { column: 'canopyScore', direction: 'desc' }
/**
 * Rows revealed per batch as the user scrolls.
 *
 * The store holds all ~4 400 matches, but the table only ever mounts
 * `visibleCount` rows: laying out the whole list at once is what would make
 * the browser stutter, not holding the data in memory.
 */
export const ROWS_PER_BATCH = 70

function loadFavoritesFromStorage(): string[] {
  try {
    const raw = localStorage.getItem('coolspot_favorites')
    if (raw) return JSON.parse(raw)
  } catch (err) {
    logger.warn('store', 'Failed to read favorites from localStorage', err)
  }
  return []
}

function saveFavoritesToStorage(favorites: string[]) {
  try {
    localStorage.setItem('coolspot_favorites', JSON.stringify(favorites))
  } catch (err) {
    logger.warn('store', 'Failed to save favorites to localStorage', err)
  }
}

interface CoolSpotState {
  items: CoolSpot[]
  reports: readonly DatasetLoadReport[]
  loading: boolean
  error: string | null
  filters: CoolSpotFilter
  sort: SortState
  visibleCount: number
  simulatedTemp: number
  favorites: string[]
  isWizardOpen: boolean
}

interface CoolSpotActions {
  fetchAllDatasets: () => Promise<void>
  setFilter: <K extends keyof CoolSpotFilter>(key: K, value: CoolSpotFilter[K]) => void
  resetFilters: () => void
  setSort: (column: SortableColumn) => void
  loadMore: () => void
  setSimulatedTemp: (temp: number) => void
  toggleFavorite: (id: string) => void
  setWizardOpen: (open: boolean) => void
  applyWizardChoices: (usage: CoolSpotCategory | 'all', price: PriceFilter, arr: string) => void
}

export type CoolSpotStore = CoolSpotState & CoolSpotActions

let inFlight: AbortController | null = null

export const useCoolSpotStore = create<CoolSpotStore>((set, get) => ({
  items: [],
  reports: [],
  loading: false,
  error: null,
  filters: INITIAL_FILTER,
  sort: INITIAL_SORT,
  visibleCount: ROWS_PER_BATCH,
  simulatedTemp: 32,
  favorites: loadFavoritesFromStorage(),
  isWizardOpen: false,

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
    set({ filters: { ...current, [key]: value }, visibleCount: ROWS_PER_BATCH })
    logger.info('store', `setFilter(${String(key)})`, value)
  },

  resetFilters() {
    set({ filters: INITIAL_FILTER, visibleCount: ROWS_PER_BATCH })
    logger.info('store', 'resetFilters()')
  },

  setSort(column) {
    const { sort } = get()
    const direction: SortState['direction'] =
      sort.column === column && sort.direction === 'desc' ? 'asc' : 'desc'
    set({ sort: { column, direction }, visibleCount: ROWS_PER_BATCH })
    logger.info('store', 'setSort()', { column, direction })
  },

  loadMore() {
    const next = get().visibleCount + ROWS_PER_BATCH
    set({ visibleCount: next })
    logger.info('store', 'loadMore()', next)
  },

  setSimulatedTemp(temp) {
    set({ simulatedTemp: temp })
  },

  toggleFavorite(id) {
    const current = get().favorites
    const next = current.includes(id) ? current.filter((f) => f !== id) : [...current, id]
    set({ favorites: next })
    saveFavoritesToStorage(next)
  },

  setWizardOpen(open) {
    set({ isWizardOpen: open })
  },

  applyWizardChoices(usage, price, arr) {
    set({
      filters: {
        ...get().filters,
        category: usage,
        price,
        arrondissement: arr,
      },
      visibleCount: ROWS_PER_BATCH,
      isWizardOpen: false,
    })
  },
}))
