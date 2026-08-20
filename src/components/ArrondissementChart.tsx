import { useMemo } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { CATEGORY_LABELS, type ArrondissementStat, type CoolSpotCategory } from '../types/coolspot'
import { EmptyState, Skeleton } from './ui'

/** Stack order and colors are declared once so legend, bars and tooltip stay in sync. */
const SERIES: readonly { key: CoolSpotCategory; color: string }[] = [
  { key: 'fountain', color: '#0ea5e9' },
  { key: 'green_space', color: '#10b981' },
  { key: 'indoor', color: '#8b5cf6' },
]

export interface ArrondissementChartProps {
  stats: readonly ArrondissementStat[]
  loading: boolean
}

export function ArrondissementChart({ stats, loading }: ArrondissementChartProps) {
  // Only render series that actually carry data — avoids a legend full of zeros.
  const activeSeries = useMemo(
    () => SERIES.filter(({ key }) => stats.some((stat) => stat[key] > 0)),
    [stats],
  )

  return (
    <section aria-label="Répartition par arrondissement" className="card p-4">
      <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Répartition par arrondissement</h2>
          <p className="text-xs text-slate-500">
            Mise à jour dynamique selon les filtres actifs · {stats.length} arrondissement
            {stats.length === 1 ? '' : 's'}
          </p>
        </div>
      </header>

      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : stats.length === 0 ? (
        <EmptyState
          title="Pas de données à représenter"
          description="Aucun îlot géolocalisé dans un arrondissement ne correspond aux filtres actuels."
        />
      ) : (
        <div className="h-64 w-full sm:h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats as ArrondissementStat[]} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: '#64748b' }}
                interval={0}
                axisLine={{ stroke: '#cbd5e1' }}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 11, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                cursor={{ fill: '#f1f5f9' }}
                contentStyle={{
                  borderRadius: 8,
                  border: '1px solid #e2e8f0',
                  fontSize: 12,
                  boxShadow: '0 4px 12px rgb(15 23 42 / 0.08)',
                }}
                labelFormatter={(label) => `Paris ${label}`}
                formatter={(value, name) => [value, String(name)]}
              />
              {activeSeries.length > 1 ? <Legend wrapperStyle={{ fontSize: 12 }} /> : null}
              {activeSeries.map(({ key, color }, index) => (
                <Bar
                  key={key}
                  dataKey={key}
                  name={CATEGORY_LABELS[key]}
                  stackId="spots"
                  fill={color}
                  // Round only the top-most bar of the stack.
                  radius={index === activeSeries.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                  isAnimationActive={false}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  )
}
