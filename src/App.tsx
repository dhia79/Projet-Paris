import { useEffect } from 'react'
import { useCoolSpotStore } from './store/useCoolSpotStore'
import {
  selectActiveFiltersCount,
  selectAvailableArrondissements,
  selectAvailableSources,
  selectCountsByCategory,
  selectFilteredItems,
  selectPageCount,
  selectPaginatedItems,
  selectSortedItems,
  selectStatsByArrondissement,
} from './store/selectors'

import { Header } from './components/Header'
import { HeroSlider } from './components/HeroSlider'
import { DashboardMetrics } from './components/DashboardMetrics'
import { FilterBar } from './components/FilterBar'
import { ArrondissementChart } from './components/ArrondissementChart'
import { CoolSpotsTable } from './components/CoolSpotsTable'
import { EmergencyWizardModal } from './components/EmergencyWizardModal'
import { Footer } from './components/Footer'
import { ErrorBoundary } from './components/ErrorBoundary'

// Declare Lenis global from CDN
declare global {
  interface Window {
    Lenis?: any
  }
}

function ErrorPanel({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="surf border border-red-300 bg-red-50 p-6 rounded-lg font-mono-data text-xs space-y-3">
      <h2 className="text-sm font-bold text-red-900 font-serif-editorial">Chargement des données impossible</h2>
      <p className="text-red-800">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="px-4 py-2 rounded-md bg-red-600 font-bold text-white hover:bg-red-700 cursor-pointer"
      >
        Réessayer
      </button>
    </div>
  )
}

function DegradedNotice({ labels }: { labels: readonly string[] }) {
  return (
    <div role="status" className="surf border border-amber-300 bg-amber-50 px-4 py-3 rounded-lg text-xs font-mono-data text-amber-900">
      ⚠️ Résultats partiels : {labels.join(', ')} indisponible{labels.length === 1 ? '' : 's'}. Les autres jeux de données sont actifs.
    </div>
  )
}

export default function App() {
  const fetchAllDatasets = useCoolSpotStore((s) => s.fetchAllDatasets)
  const items = useCoolSpotStore((s) => s.items)
  const reports = useCoolSpotStore((s) => s.reports)
  const loading = useCoolSpotStore((s) => s.loading)
  const error = useCoolSpotStore((s) => s.error)
  const filters = useCoolSpotStore((s) => s.filters)
  const sort = useCoolSpotStore((s) => s.sort)
  const pagination = useCoolSpotStore((s) => s.pagination)
  const favorites = useCoolSpotStore((s) => s.favorites)

  const setFilter = useCoolSpotStore((s) => s.setFilter)
  const resetFilters = useCoolSpotStore((s) => s.resetFilters)
  const setSort = useCoolSpotStore((s) => s.setSort)
  const setPage = useCoolSpotStore((s) => s.setPage)
  const setPageSize = useCoolSpotStore((s) => s.setPageSize)
  const toggleFavorite = useCoolSpotStore((s) => s.toggleFavorite)

  useEffect(() => {
    void fetchAllDatasets()
  }, [fetchAllDatasets])

  // Initialize Lenis smooth scroll and Scroll Reveal Intersection Observer
  useEffect(() => {
    let lenis: any = null
    if (window.Lenis) {
      lenis = new window.Lenis({
        duration: 1.2,
        easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      })

      function raf(time: number) {
        lenis.raf(time)
        requestAnimationFrame(raf)
      }
      requestAnimationFrame(raf)
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible')
          }
        })
      },
      { threshold: 0.1 },
    )

    document.querySelectorAll('[data-reveal]').forEach((el) => observer.observe(el))

    return () => {
      observer.disconnect()
      if (lenis) lenis.destroy()
    }
  }, [items])

  const favoritesSet = new Set(favorites)
  const filtered = selectFilteredItems(items, filters, favoritesSet)
  const sorted = selectSortedItems(filtered, sort)
  const paginated = selectPaginatedItems(sorted, pagination)

  const totalCount = filtered.length
  const pageCount = selectPageCount(totalCount, pagination.pageSize)

  const sourceCount = reports.filter((r) => r.status === 'ok').length
  const failedLabels = reports.filter((r) => r.status === 'failed').map((r) => r.label)

  const countsByCategory = selectCountsByCategory(items)
  const statsByArrondissement = selectStatsByArrondissement(filtered)
  const availableArrondissements = selectAvailableArrondissements(items)
  const availableSources = selectAvailableSources(items)
  const activeFiltersCount = selectActiveFiltersCount(filters, useCoolSpotStore.getState().filters)

  return (
    <div className="min-h-screen relative overflow-x-hidden">
      {/* Skip to main content for accessibility */}
      <a
        href="#functional-dashboard"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-lg acc-bg text-slate-950 font-mono-data text-xs font-bold"
      >
        Aller au contenu principal
      </a>

      {/* Page-wide Theme Wash */}
      <div id="theme-accent-wash" className="fixed inset-0 pointer-events-none z-0"></div>

      {/* Background Grid Matrix */}
      <div className="fixed inset-0 pointer-events-none z-0 cartography-grid opacity-60"></div>

      {/* Ambient Dynamic Thermal Gradient Overlay */}
      <div
        id="ambient-thermal-bg"
        className="fixed inset-0 pointer-events-none z-0 transition-all duration-700 bg-gradient-to-b from-emerald-950/30 via-transparent to-transparent"
      ></div>

      {/* Main Layout Wrapper */}
      <div className="relative z-10 w-full">
        <Header />

        <main id="functional-dashboard" className="max-w-7xl mx-auto px-4 sm:px-8 py-6 space-y-8">
          {error ? (
            <ErrorPanel message={error} onRetry={() => void fetchAllDatasets()} />
          ) : (
            <>
              {failedLabels.length > 0 && <DegradedNotice labels={failedLabels} />}

              {/* Oasis Hero Category Slider */}
              <HeroSlider />

              {/* Metrics Strip */}
              <DashboardMetrics
                totalCount={items.length}
                sourceCount={sourceCount}
                countsByCategory={countsByCategory}
                loading={loading}
              />

              {/* Filters Bar */}
              <FilterBar
                filters={filters}
                sort={sort}
                favoritesCount={favorites.length}
                availableArrondissements={availableArrondissements}
                availableSources={availableSources}
                disabled={loading}
                onFilterChange={setFilter}
                onSortChange={setSort}
                onReset={resetFilters}
              />

              {/* Arrondissement Chart */}
              <ErrorBoundary>
                <ArrondissementChart stats={statsByArrondissement} loading={loading} />
              </ErrorBoundary>

              {/* Data Table */}
              <ErrorBoundary>
                <CoolSpotsTable
                  items={paginated}
                  allFilteredItems={filtered}
                  totalCount={totalCount}
                  sort={sort}
                  pagination={pagination}
                  pageCount={pageCount}
                  loading={loading}
                  favorites={favorites}
                  hasActiveFilters={activeFiltersCount > 0}
                  onSort={setSort}
                  onPageChange={setPage}
                  onPageSizeChange={setPageSize}
                  onResetFilters={resetFilters}
                  onToggleFavorite={toggleFavorite}
                />
              </ErrorBoundary>
            </>
          )}
        </main>

        {/* Emergency Wizard Modal */}
        <EmergencyWizardModal />

        {/* Editorial Footer */}
        <Footer />
      </div>
    </div>
  )
}
