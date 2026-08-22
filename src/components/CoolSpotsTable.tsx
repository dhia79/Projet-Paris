import { useState } from 'react'
import type { CoolSpot, PaginationState, SortState, SortableColumn } from '../types/coolspot'
import { CATEGORY_BADGE_CLASSES, CATEGORY_LABELS, SOURCE_LABELS } from '../types/coolspot'
import { arrondissementLabel } from '../store/selectors'
import { PAGE_SIZE_OPTIONS } from '../store/useCoolSpotStore'
import { SpotDetailsDrawer } from './SpotDetailsDrawer'

export interface CoolSpotsTableProps {
  items: readonly CoolSpot[]
  allFilteredItems: readonly CoolSpot[]
  totalCount: number
  sort: SortState
  pagination: PaginationState
  pageCount: number
  loading: boolean
  favorites: readonly string[]
  hasActiveFilters: boolean
  onSort: (column: SortableColumn) => void
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
  onResetFilters: () => void
  onToggleFavorite: (id: string) => void
}

function FreshnessBar({ score }: { score: number }) {
  let barColor = 'bg-emerald-500'
  if (score < 45) barColor = 'bg-sky-500'
  else if (score >= 85) barColor = 'bg-emerald-600'

  return (
    <div className="flex items-center gap-2 font-mono-data text-xs">
      <div className="w-16 sm:w-20 bg-[#EFECE3] h-2 rounded-full overflow-hidden border surf-bd">
        <div className={`h-full ${barColor} transition-all duration-500`} style={{ width: `${score}%` }} />
      </div>
      <span className="tabular-nums font-semibold ink text-[11px]">{score}/100</span>
    </div>
  )
}

function TableSkeleton() {
  return (
    <>
      {[1, 2, 3, 4, 5].map((idx) => (
        <tr key={idx} className="border-b surf-bd">
          <td className="py-4 px-4"><div className="h-4 rounded skeleton-shimmer w-3/4"></div></td>
          <td className="py-4 px-4"><div className="h-4 rounded skeleton-shimmer w-1/2"></div></td>
          <td className="py-4 px-4"><div className="h-4 rounded skeleton-shimmer w-1/3"></div></td>
          <td className="py-4 px-4"><div className="h-4 rounded skeleton-shimmer w-2/3"></div></td>
          <td className="py-4 px-4"><div className="h-4 rounded skeleton-shimmer w-1/4"></div></td>
          <td className="py-4 px-4"><div className="h-4 rounded skeleton-shimmer w-1/3"></div></td>
          <td className="py-4 px-4"><div className="h-4 rounded skeleton-shimmer w-16 ml-auto"></div></td>
        </tr>
      ))}
    </>
  )
}

export function CoolSpotsTable({
  items,
  allFilteredItems,
  totalCount,
  sort,
  pagination,
  pageCount,
  loading,
  favorites,
  hasActiveFilters,
  onSort,
  onPageChange,
  onPageSizeChange,
  onResetFilters,
  onToggleFavorite,
}: CoolSpotsTableProps) {
  const [selectedSpot, setSelectedSpot] = useState<CoolSpot | null>(null)

  const favoritesSet = new Set(favorites)

  const exportCSV = () => {
    const headers = ['ID', 'Nom', 'Categorie', 'Arrondissement', 'Adresse', 'Tarif', 'Frescheur', 'Horaires', 'Source']
    const rows = allFilteredItems.map((spot) => [
      `"${spot.id}"`,
      `"${spot.name.replace(/"/g, '""')}"`,
      `"${CATEGORY_LABELS[spot.category]}"`,
      `"${spot.arrondissement ? arrondissementLabel(spot.arrondissement) : ''}"`,
      `"${spot.address.replace(/"/g, '""')}"`,
      `"${spot.isFree ? 'Gratuit' : 'Payant'}"`,
      `"${spot.canopyScore}"`,
      `"${(spot.openingHours || '').replace(/"/g, '""')}"`,
      `"${spot.source}"`,
    ])

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `paris_ilots_fraicheur_export_${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const isLoadingState = loading

  return (
    <div data-reveal className="surf border surf-bd rounded-lg p-6 sm:p-8 space-y-6 shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b surf-bd ink-mute text-[11px] font-mono-data uppercase tracking-wide">
              <th className="py-3 px-4 font-medium">
                <button onClick={() => onSort('name')} className="hover:ink transition-colors flex items-center gap-1 cursor-pointer">
                  Désignation du site {sort.column === 'name' ? (sort.direction === 'asc' ? '↑' : '↓') : ''}
                </button>
              </th>
              <th className="py-3 px-4 font-medium">
                <button onClick={() => onSort('category')} className="hover:ink transition-colors flex items-center gap-1 cursor-pointer">
                  Catégorie {sort.column === 'category' ? (sort.direction === 'asc' ? '↑' : '↓') : ''}
                </button>
              </th>
              <th className="py-3 px-4 font-medium">
                <button onClick={() => onSort('arrondissement')} className="hover:ink transition-colors flex items-center gap-1 cursor-pointer">
                  Arrondissement & adresse {sort.column === 'arrondissement' ? (sort.direction === 'asc' ? '↑' : '↓') : ''}
                </button>
              </th>
              <th className="py-3 px-4 font-medium">
                <button onClick={() => onSort('canopyScore')} className="hover:ink transition-colors flex items-center gap-1 cursor-pointer">
                  Fraîcheur {sort.column === 'canopyScore' ? (sort.direction === 'asc' ? '↑' : '↓') : ''}
                </button>
              </th>
              <th className="py-3 px-4 font-medium">Statut & horaires</th>
              <th className="py-3 px-4 font-medium">Source</th>
              <th className="py-3 px-4 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody id="table-body">
            {isLoadingState ? (
              <TableSkeleton />
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-sm ink-mute space-y-3">
                  <p className="font-serif-editorial text-lg ink">Aucun refuge trouvé</p>
                  <p className="text-xs max-w-md mx-auto">
                    Aucun site ne correspond à la combinaison de filtres sélectionnée.
                  </p>
                  {hasActiveFilters && (
                    <button
                      onClick={onResetFilters}
                      className="px-4 py-2 text-xs font-mono-data rounded-lg acc-gradient text-slate-950 font-bold cursor-pointer"
                    >
                      Réinitialiser tous les filtres
                    </button>
                  )}
                </td>
              </tr>
            ) : (
              items.map((spot) => {
                const isFav = favoritesSet.has(spot.id)
                return (
                  <tr key={spot.id} className="border-b surf-bd hover-surf transition-colors editorial-row-entry">
                    {/* Name */}
                    <td className="py-3.5 px-4">
                      <div className="font-medium ink text-sm flex items-center gap-2">
                        <span>{spot.name}</span>
                      </div>
                      <span className="text-[10px] font-mono-data ink-mute">{spot.shadeLevel}</span>
                    </td>

                    {/* Category */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className={`px-2.5 py-1 rounded-md text-[11px] font-mono-data font-semibold ${CATEGORY_BADGE_CLASSES[spot.category]}`}>
                        {CATEGORY_LABELS[spot.category]}
                      </span>
                    </td>

                    {/* Arrondissement & Address */}
                    <td className="py-3.5 px-4">
                      <div className="font-mono-data text-xs ink">
                        {spot.arrondissement ? `Paris ${arrondissementLabel(spot.arrondissement)}` : 'Non renseigné'}
                      </div>
                      <div className="text-xs ink-mute truncate max-w-xs" title={spot.address}>
                        {spot.address}
                      </div>
                    </td>

                    {/* Freshness score gauge */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <FreshnessBar score={spot.canopyScore} />
                    </td>

                    {/* Hours & status */}
                    <td className="py-3.5 px-4 whitespace-nowrap font-mono-data text-xs">
                      <div className="ink-soft">{spot.openingHours || 'Accessible'}</div>
                      <div className="text-[10px] text-emerald-700 font-semibold">
                        {spot.isFree ? '100% Gratuit' : 'Tarif Municipal'}
                      </div>
                    </td>

                    {/* Source dataset */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded bg-[color:var(--chip-bg)] border surf-bd text-[10px] font-mono-data ink-mute">
                        {SOURCE_LABELS[spot.source] || spot.source}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        {/* Favorite Toggle */}
                        <button
                          onClick={() => onToggleFavorite(spot.id)}
                          title={isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                          className={`p-1.5 rounded-lg border surf-bd transition-colors cursor-pointer ${
                            isFav ? 'bg-amber-100 text-amber-600 border-amber-300' : 'ink-mute hover:ink hover:bg-slate-100'
                          }`}
                        >
                          {isFav ? '★' : '☆'}
                        </button>

                        {/* Details Drawer trigger */}
                        <button
                          onClick={() => setSelectedSpot(spot)}
                          className="px-3 py-1 rounded-md border surf-bd hover:acc-bd font-mono-data text-xs ink hover:acc-text transition-colors cursor-pointer"
                        >
                          Fiche →
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Table Footer & Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between pt-5 border-t surf-bd text-xs font-mono-data ink-mute gap-4">
        <div className="flex items-center gap-4 flex-wrap">
          <span id="table-status">
            {isLoadingState
              ? 'Chargement...'
              : `${totalCount.toLocaleString('fr-FR')} refuge${totalCount > 1 ? 's' : ''} affiché${totalCount > 1 ? 's' : ''}`}
          </span>
          <button onClick={exportCSV} className="text-[11px] ink-mute acc-hover-text underline decoration-dotted cursor-pointer">
            Exporter en CSV
          </button>
        </div>

        {/* Pagination Controls */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span>Par page:</span>
            <select
              value={pagination.pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="bg-transparent border-b surf-bd ink text-xs font-mono-data focus:outline-none cursor-pointer"
            >
              {PAGE_SIZE_OPTIONS.map((sz) => (
                <option key={sz} value={sz}>{sz}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPageChange(pagination.page - 1)}
              disabled={pagination.page <= 1 || isLoadingState}
              className="ink-mute acc-hover-text disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              ← Précédent
            </button>
            <span id="page-indicator" className="ink font-bold">
              {pagination.page} / {pageCount}
            </span>
            <button
              onClick={() => onPageChange(pagination.page + 1)}
              disabled={pagination.page >= pageCount || isLoadingState}
              className="ink-mute acc-hover-text disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              Suivant →
            </button>
          </div>
        </div>
      </div>

      {/* Spot Details Drawer */}
      <SpotDetailsDrawer spot={selectedSpot} onClose={() => setSelectedSpot(null)} />
    </div>
  )
}
