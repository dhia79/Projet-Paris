import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import type { ArrondissementStat } from '../types/coolspot'

export interface ArrondissementChartProps {
  stats: readonly ArrondissementStat[]
  loading: boolean
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null
  const data = payload[0]?.payload
  return (
    <div className="surf border surf-bd p-3 rounded-lg shadow-lg font-mono-data text-xs space-y-1.5 min-w-[160px]">
      <div className="font-bold ink border-b surf-bd pb-1">Paris {label}</div>
      <div className="text-emerald-700">Parcs: {data.green_space || 0}</div>
      <div className="text-blue-700">Fontaines: {data.fountain || 0}</div>
      <div className="text-slate-400">Lieux frais: {(data.indoor || 0) + (data.mist || 0)}</div>
      <div className="font-bold ink border-t surf-bd pt-1">Total: {data.total}</div>
    </div>
  )
}

export function ArrondissementChart({ stats, loading }: ArrondissementChartProps) {
  if (loading || stats.length === 0) return null

  return (
    <section className="surf border surf-bd rounded-lg p-6 space-y-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="font-mono-data text-xs acc-text uppercase tracking-wider flex items-center gap-2.5 font-bold">
          <span className="kicker-mark"></span>
          Distribution géographique par arrondissement
        </div>
        <span className="font-mono-data text-[10px] ink-mute uppercase">
          {stats.length} arrondissements recensés
        </span>
      </div>

      <div className="h-64 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={[...stats]} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <XAxis dataKey="label" stroke="#7A8087" fontSize={11} fontFamily="JetBrains Mono" />
            <YAxis stroke="#7A8087" fontSize={11} fontFamily="JetBrains Mono" />
            <Tooltip content={<CustomTooltip />} cursor={false} />
            <Legend
              wrapperStyle={{ fontFamily: 'JetBrains Mono', fontSize: '11px', paddingTop: '10px' }}
              formatter={(value) => {
                if (value === 'green_space') return 'Parcs & Canopées'
                if (value === 'fountain') return 'Fontaines'
                if (value === 'indoor') return 'Lieux Climatisés'
                return value
              }}
            />
            <Bar dataKey="green_space" stackId="a" fill="#10B981" radius={[0, 0, 0, 0]} />
            <Bar dataKey="fountain" stackId="a" fill="#3B82F6" radius={[0, 0, 0, 0]} />
            <Bar dataKey="indoor" stackId="a" fill="#CBD5E1" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}
