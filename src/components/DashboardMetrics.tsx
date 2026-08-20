import type { ArrondissementStat, CoolSpotCategory } from '../types/coolspot'
import { CATEGORY_LABELS } from '../types/coolspot'
import { Skeleton } from './ui'

interface MetricCardProps {
  label: string
  value: string
  hint?: string
  accent: string
  icon: string
}

function MetricCard({ label, value, hint, accent, icon }: MetricCardProps) {
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{value}</p>
          {hint ? <p className="mt-0.5 truncate text-xs text-slate-500">{hint}</p> : null}
        </div>
        <span aria-hidden className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg text-lg ${accent}`}>
          {icon}
        </span>
      </div>
    </div>
  )
}

export interface DashboardMetricsProps {
  totalCount: number
  sourceCount: number
  countsByCategory: Record<CoolSpotCategory, number>
  topArrondissement: ArrondissementStat | null
  loading: boolean
}

export function DashboardMetrics({
  totalCount,
  sourceCount,
  countsByCategory,
  topArrondissement,
  loading,
}: DashboardMetricsProps) {
  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="card p-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-3 h-7 w-16" />
            <Skeleton className="mt-2 h-3 w-32" />
          </div>
        ))}
      </div>
    )
  }

  const share = sourceCount > 0 ? Math.round((totalCount / sourceCount) * 100) : 0

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        label="Îlots trouvés"
        value={totalCount.toLocaleString('fr-FR')}
        hint={`${share}% des ${sourceCount.toLocaleString('fr-FR')} lieux référencés`}
        accent="bg-cool-100 text-cool-700"
        icon="❄️"
      />
      <MetricCard
        label={CATEGORY_LABELS.fountain}
        value={countsByCategory.fountain.toLocaleString('fr-FR')}
        hint="Eau potable en accès libre"
        accent="bg-sky-100 text-sky-700"
        icon="🚰"
      />
      <MetricCard
        label={CATEGORY_LABELS.green_space}
        value={countsByCategory.green_space.toLocaleString('fr-FR')}
        hint={`${countsByCategory.indoor.toLocaleString('fr-FR')} lieu(x) frais intérieur(s)`}
        accent="bg-emerald-100 text-emerald-700"
        icon="🌳"
      />
      <MetricCard
        label="Arrondissement le mieux doté"
        value={topArrondissement ? topArrondissement.label : '—'}
        hint={topArrondissement ? `${topArrondissement.total.toLocaleString('fr-FR')} îlots` : 'Aucune donnée'}
        accent="bg-violet-100 text-violet-700"
        icon="🏆"
      />
    </div>
  )
}
