import { useEffect, useId, useState } from 'react'
import {
  CATEGORY_LABELS,
  COOL_SPOT_CATEGORIES,
  type CoolSpotFilter,
} from '../types/coolspot'
import { arrondissementLabel } from '../store/selectors'
import { useDebouncedValue } from '../hooks/useDebouncedValue'

export interface FilterBarProps {
  filters: CoolSpotFilter
  availableArrondissements: readonly string[]
  activeFiltersCount: number
  resultCount: number
  disabled: boolean
  onFilterChange: <K extends keyof CoolSpotFilter>(key: K, value: CoolSpotFilter[K]) => void
  onReset: () => void
}

const CATEGORY_TABS = [
  { value: 'all' as const, label: 'Tous' },
  ...COOL_SPOT_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c] })),
]

export function FilterBar({
  filters,
  availableArrondissements,
  activeFiltersCount,
  resultCount,
  disabled,
  onFilterChange,
  onReset,
}: FilterBarProps) {
  const searchId = useId()
  const arrondissementId = useId()

  // Local input state keeps typing at 60fps; the store only sees debounced values.
  const [draftQuery, setDraftQuery] = useState(filters.query)
  const debouncedQuery = useDebouncedValue(draftQuery, 250)

  useEffect(() => {
    onFilterChange('query', debouncedQuery)
  }, [debouncedQuery, onFilterChange])

  // Re-sync when the store resets the filter from the outside.
  useEffect(() => {
    if (filters.query === '') setDraftQuery('')
  }, [filters.query])

  return (
    <section aria-label="Filtres" className="card p-4">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label htmlFor={searchId} className="block text-xs font-medium text-slate-600">
              Recherche
            </label>
            <div className="relative mt-1">
              <span aria-hidden className="pointer-events-none absolute inset-y-0 left-3 grid place-items-center text-slate-400">
                🔎
              </span>
              <input
                id={searchId}
                type="search"
                value={draftQuery}
                disabled={disabled}
                onChange={(event) => setDraftQuery(event.target.value)}
                placeholder="Nom du lieu, rue, avenue…"
                className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm placeholder:text-slate-400 disabled:bg-slate-100"
              />
            </div>
          </div>

          <div className="sm:w-56">
            <label htmlFor={arrondissementId} className="block text-xs font-medium text-slate-600">
              Arrondissement
            </label>
            <select
              id={arrondissementId}
              value={filters.arrondissement}
              disabled={disabled}
              onChange={(event) => onFilterChange('arrondissement', event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-100"
            >
              <option value="all">Tous les arrondissements</option>
              {availableArrondissements.map((code) => (
                <option key={code} value={code}>
                  Paris {arrondissementLabel(code)} ({code})
                </option>
              ))}
            </select>
          </div>

          <label className="flex cursor-pointer select-none items-center gap-2 sm:pb-2">
            <button
              type="button"
              role="switch"
              aria-checked={filters.isFreeOnly}
              disabled={disabled}
              onClick={() => onFilterChange('isFreeOnly', !filters.isFreeOnly)}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
                filters.isFreeOnly ? 'bg-cool-600' : 'bg-slate-300'
              }`}
            >
              <span
                aria-hidden
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  filters.isFreeOnly ? 'translate-x-[1.375rem]' : 'translate-x-0.5'
                }`}
              />
            </button>
            <span className="text-sm text-slate-700">Gratuit uniquement</span>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div role="tablist" aria-label="Catégories" className="flex flex-wrap gap-1.5">
            {CATEGORY_TABS.map((tab) => {
              const selected = filters.category === tab.value
              return (
                <button
                  key={tab.value}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  disabled={disabled}
                  onClick={() => onFilterChange('category', tab.value)}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${
                    selected
                      ? 'bg-cool-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>

          <div className="ml-auto flex items-center gap-3">
            <p aria-live="polite" className="text-sm text-slate-600">
              <span className="font-semibold tabular-nums text-slate-900">
                {resultCount.toLocaleString('fr-FR')}
              </span>{' '}
              résultat{resultCount === 1 ? '' : 's'}
            </p>
            {activeFiltersCount > 0 ? (
              <button
                type="button"
                onClick={() => {
                  setDraftQuery('')
                  onReset()
                }}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Réinitialiser ({activeFiltersCount})
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  )
}
