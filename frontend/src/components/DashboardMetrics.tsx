import type { CoolSpotCategory } from '../types/coolspot'

export interface DashboardMetricsProps {
  totalCount: number
  sourceCount: number
  countsByCategory: Record<CoolSpotCategory, number>
  loading: boolean
}

export function DashboardMetrics({
  totalCount,
  sourceCount,
  countsByCategory,
  loading,
}: DashboardMetricsProps) {
  const fountainCount = countsByCategory.fountain || 0
  const greenCount = countsByCategory.green_space || 0
  const coolCount = (countsByCategory.indoor || 0) + (countsByCategory.mist || 0)

  return (
    <div
      data-reveal
      className="grid grid-cols-2 md:grid-cols-4 divide-x surf-bd border-y surf-bd surf rounded-lg shadow-sm"
    >
      {/* Stat 1: Total Refuges */}
      <div className="px-5 py-5 space-y-1 first:pl-5">
        <span className="font-mono-data text-[11px] ink-mute uppercase tracking-wider block">
          Refuges recensés
        </span>
        <div id="stat-total-count" className="text-3xl font-serif-editorial ink">
          {loading ? '—' : totalCount.toLocaleString('fr-FR')}
        </div>
        <span className="font-mono-data text-[10px] ink-mute block">
          {sourceCount} dataset{sourceCount > 1 ? 's' : ''} unifié{sourceCount > 1 ? 's' : ''}
        </span>
      </div>

      {/* Stat 2: Fontaines d'eau */}
      <div className="px-5 py-5 space-y-1">
        <span className="font-mono-data text-[11px] ink-mute uppercase tracking-wider block">
          Fontaines d'eau
        </span>
        <div id="stat-fountain-count" className="text-3xl font-serif-editorial text-blue-600 font-bold">
          {loading ? '—' : fountainCount.toLocaleString('fr-FR')}
        </div>
        <span className="font-mono-data text-[10px] ink-mute block">
          Eau de Paris, gratuit 24/7
        </span>
      </div>

      {/* Stat 3: Parcs & Canopée */}
      <div className="px-5 py-5 space-y-1">
        <span className="font-mono-data text-[11px] ink-mute uppercase tracking-wider block">
          Parcs & canopée
        </span>
        <div id="stat-green-count" className="text-3xl font-serif-editorial text-emerald-700 font-bold">
          {loading ? '—' : greenCount.toLocaleString('fr-FR')}
        </div>
        <span className="font-mono-data text-[10px] ink-mute block">
          Espaces verts ombragés
        </span>
      </div>

      {/* Stat 4: Lieux Climatisés */}
      <div className="px-5 py-5 space-y-1 last:pr-5">
        <span className="font-mono-data text-[11px] ink-mute uppercase tracking-wider block">
          Lieux climatisés
        </span>
        <div id="stat-cool-count" className="text-3xl font-serif-editorial text-amber-700">
          {loading ? '—' : coolCount.toLocaleString('fr-FR')}
        </div>
        <span className="font-mono-data text-[10px] ink-mute block">
          Musées & médiathèques
        </span>
      </div>
    </div>
  )
}
