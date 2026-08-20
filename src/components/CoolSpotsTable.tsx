import { useState } from 'react'
import type { CoolSpot, PaginationState, SortState, SortableColumn } from '../types/coolspot'
import { arrondissementLabel } from '../store/selectors'
import { PAGE_SIZE_OPTIONS } from '../store/useCoolSpotStore'
import { CategoryBadge, EmptyState, FreeBadge, Skeleton } from './ui'
import { SpotDetailsDrawer } from './SpotDetailsDrawer'

interface Column {
  key: SortableColumn
  label: string
  /** Hidden on small screens to keep the table readable without horizontal panic. */
  className?: string
}

const COLUMNS: readonly Column[] = [
  { key: 'name', label: 'Nom' },
  { key: 'category', label: 'Type' },
  { key: 'arrondissement', label: 'Arr.', className: 'hidden sm:table-cell' },
  { key: 'address', label: 'Adresse / accès', className: 'hidden md:table-cell' },
  { key: 'isFree', label: 'Tarif', className: 'hidden lg:table-cell' },
]

export interface CoolSpotsTableProps {
  items: readonly CoolSpot[]
  totalCount: number
  sort: SortState
  pagination: PaginationState
  pageCount: number
  loading: boolean
  hasActiveFilters: boolean
  onSort: (column: SortableColumn) => void
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
  onResetFilters: () => void
}

function SortIndicator({ active, direction }: { active: boolean; direction: SortState['direction'] }) {
  if (!active) return <span aria-hidden className="text-slate-300">↕</span>
  return <span aria-hidden className="text-cool-600">{direction === 'asc' ? '↑' : '↓'}</span>
}

function TableSkeleton() {
  return (
    <tbody>
      {Array.from({ length: 8 }, (_, row) => (
        <tr key={row} className="border-t border-slate-100">
          {COLUMNS.map((column) => (
            <td key={column.key} className={`px-4 py-3 ${column.className ?? ''}`}>
              <Skeleton className="h-4 w-full max-w-[12rem]" />
            </td>
          ))}
          <td className="px-4 py-3">
            <Skeleton className="h-4 w-16" />
          </td>
        </tr>
      ))}
    </tbody>
  )
}

export function CoolSpotsTable({
  items,
  totalCount,
  sort,
  pagination,
  pageCount,
  loading,
  hasActiveFilters,
  onSort,
  onPageChange,
  onPageSizeChange,
  onResetFilters,
}: CoolSpotsTableProps) {
  const [selected, setSelected] = useState<CoolSpot | null>(null)

  const from = totalCount === 0 ? 0 : (pagination.page - 1) * pagination.pageSize + 1
  const to = Math.min(pagination.page * pagination.pageSize, totalCount)

  return (
    <section aria-label="Liste des îlots de fraîcheur" className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <caption className="sr-only">
            Îlots de fraîcheur à Paris, triés par {sort.column} ({sort.direction})
          </caption>
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
            <tr>
              {COLUMNS.map((column) => {
                const active = sort.column === column.key
                return (
                  <th
                    key={column.key}
                    scope="col"
                    aria-sort={active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className={`px-4 py-3 font-semibold ${column.className ?? ''}`}
                  >
                    <button
                      type="button"
                      onClick={() => onSort(column.key)}
                      disabled={loading}
                      className="inline-flex items-center gap-1.5 hover:text-slate-900 disabled:opacity-50"
                    >
                      {column.label}
                      <SortIndicator active={active} direction={sort.direction} />
                    </button>
                  </th>
                )
              })}
              <th scope="col" className="px-4 py-3 text-right font-semibold">
                Actions
              </th>
            </tr>
          </thead>

          {loading ? (
            <TableSkeleton />
          ) : (
            <tbody>
              {items.map((spot) => (
                <tr key={spot.id} className="border-t border-slate-100 hover:bg-slate-50/70">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{spot.name}</p>
                    <p className="text-xs text-slate-500 sm:hidden">
                      {spot.arrondissement ? `Paris ${arrondissementLabel(spot.arrondissement)}` : '—'}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <CategoryBadge category={spot.category} />
                  </td>
                  <td className="hidden px-4 py-3 tabular-nums text-slate-700 sm:table-cell">
                    {spot.arrondissement ? arrondissementLabel(spot.arrondissement) : '—'}
                  </td>
                  <td className="hidden max-w-xs px-4 py-3 md:table-cell">
                    <p className="truncate text-slate-700" title={spot.address}>
                      {spot.address}
                    </p>
                    {spot.openingHours ? (
                      <p className="truncate text-xs text-slate-500">{spot.openingHours}</p>
                    ) : null}
                  </td>
                  <td className="hidden px-4 py-3 lg:table-cell">
                    <FreeBadge isFree={spot.isFree} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setSelected(spot)}
                      className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-white"
                    >
                      Détails
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          )}
        </table>
      </div>

      {!loading && items.length === 0 ? (
        <EmptyState
          title="Aucun îlot de fraîcheur trouvé"
          description="Aucun lieu ne correspond à cette combinaison de filtres. Élargissez la recherche ou réinitialisez les filtres."
          action={
            hasActiveFilters ? (
              <button
                type="button"
                onClick={onResetFilters}
                className="rounded-lg bg-cool-600 px-4 py-2 text-sm font-medium text-white hover:bg-cool-700"
              >
                Réinitialiser les filtres
              </button>
            ) : null
          }
        />
      ) : null}

      <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <label htmlFor="page-size" className="whitespace-nowrap">
            Lignes / page
          </label>
          <select
            id="page-size"
            value={pagination.pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm"
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
          <span className="whitespace-nowrap tabular-nums">
            {from}–{to} sur {totalCount.toLocaleString('fr-FR')}
          </span>
        </div>

        <nav aria-label="Pagination" className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onPageChange(1)}
            disabled={pagination.page <= 1}
            aria-label="Première page"
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-sm disabled:opacity-40"
          >
            ««
          </button>
          <button
            type="button"
            onClick={() => onPageChange(pagination.page - 1)}
            disabled={pagination.page <= 1}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-sm disabled:opacity-40"
          >
            Précédent
          </button>
          <span aria-current="page" className="px-2 text-sm tabular-nums text-slate-700">
            {pagination.page} / {pageCount}
          </span>
          <button
            type="button"
            onClick={() => onPageChange(pagination.page + 1)}
            disabled={pagination.page >= pageCount}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-sm disabled:opacity-40"
          >
            Suivant
          </button>
          <button
            type="button"
            onClick={() => onPageChange(pageCount)}
            disabled={pagination.page >= pageCount}
            aria-label="Dernière page"
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-sm disabled:opacity-40"
          >
            »»
          </button>
        </nav>
      </div>

      <SpotDetailsDrawer spot={selected} onClose={() => setSelected(null)} />
    </section>
  )
}
