import { useCallback, useEffect } from 'react'
import { useCoolSpotStore } from './store/useCoolSpotStore'
import { useCoolSpots } from './hooks/useCoolSpots'
import { DashboardMetrics } from './components/DashboardMetrics'
import { FilterBar } from './components/FilterBar'
import { ArrondissementChart } from './components/ArrondissementChart'
import { CoolSpotsTable } from './components/CoolSpotsTable'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Spinner } from './components/ui'

function Header({ loading, datasetCount }: { loading: boolean; datasetCount: number }) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">
            <span aria-hidden className="mr-1.5">❄️</span>
            Îlots de Fraîcheur · Paris
          </h1>
          <p className="mt-0.5 text-sm text-slate-600">
            Où se rafraîchir pendant une vague de chaleur — données ouvertes de la Ville de Paris.
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          {loading ? (
            <Spinner label="Chargement des jeux de données…" />
          ) : (
            <span>
              {datasetCount} jeu{datasetCount === 1 ? '' : 'x'} de données agrégé
              {datasetCount === 1 ? '' : 's'}
            </span>
          )}
        </div>
      </div>
    </header>
  )
}

function ErrorPanel({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="card border-red-200 bg-red-50 p-5">
      <h2 className="text-sm font-semibold text-red-900">Chargement impossible</h2>
      <p className="mt-1 text-sm text-red-800">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
      >
        Réessayer
      </button>
    </div>
  )
}

/** Non-blocking notice when an optional dataset failed but the page is still usable. */
function DegradedNotice({ labels }: { labels: readonly string[] }) {
  return (
    <div role="status" className="card border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      Résultats partiels : {labels.join(', ')} indisponible{labels.length === 1 ? '' : 's'}. Les autres
      jeux de données sont bien chargés.
    </div>
  )
}

export default function App() {
  const fetchAllDatasets = useCoolSpotStore((s) => s.fetchAllDatasets)
  const setFilter = useCoolSpotStore((s) => s.setFilter)
  const resetFilters = useCoolSpotStore((s) => s.resetFilters)
  const setSort = useCoolSpotStore((s) => s.setSort)
  const setPage = useCoolSpotStore((s) => s.setPage)
  const setPageSize = useCoolSpotStore((s) => s.setPageSize)

  const {
    loading,
    error,
    reports,
    filters,
    sort,
    pagination,
    paginatedItems,
    totalCount,
    sourceCount,
    pageCount,
    statsByArrondissement,
    countsByCategory,
    availableArrondissements,
    topArrondissement,
    activeFiltersCount,
  } = useCoolSpots()

  useEffect(() => {
    void fetchAllDatasets()
  }, [fetchAllDatasets])

  const retry = useCallback(() => void fetchAllDatasets(), [fetchAllDatasets])

  const failedLabels = reports.filter((r) => r.status === 'failed').map((r) => r.label)
  const okCount = reports.filter((r) => r.status === 'ok').length

  return (
    <div className="min-h-dvh">
      <Header loading={loading} datasetCount={okCount} />

      <main className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 sm:px-6">
        {error ? (
          <ErrorPanel message={error} onRetry={retry} />
        ) : (
          <>
            {failedLabels.length > 0 ? <DegradedNotice labels={failedLabels} /> : null}

            <DashboardMetrics
              totalCount={totalCount}
              sourceCount={sourceCount}
              countsByCategory={countsByCategory}
              topArrondissement={topArrondissement}
              loading={loading}
            />

            <FilterBar
              filters={filters}
              availableArrondissements={availableArrondissements}
              activeFiltersCount={activeFiltersCount}
              resultCount={totalCount}
              disabled={loading}
              onFilterChange={setFilter}
              onReset={resetFilters}
            />

            <ErrorBoundary>
              <ArrondissementChart stats={statsByArrondissement} loading={loading} />
            </ErrorBoundary>

            <ErrorBoundary>
              <CoolSpotsTable
                items={paginatedItems}
                totalCount={totalCount}
                sort={sort}
                pagination={pagination}
                pageCount={pageCount}
                loading={loading}
                hasActiveFilters={activeFiltersCount > 0}
                onSort={setSort}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
                onResetFilters={resetFilters}
              />
            </ErrorBoundary>
          </>
        )}
      </main>

      <footer className="mx-auto max-w-7xl px-4 pb-8 text-xs text-slate-500 sm:px-6">
        Source : Open Data Paris (API Explore v2.1) — <code>fontaines-a-boire</code>,{' '}
        <code>espaces_verts</code>, <code>ilots-de-fraicheur-equipements-activites</code>. Les horaires et la
        disponibilité peuvent varier ; vérifiez sur place.
      </footer>
    </div>
  )
}
