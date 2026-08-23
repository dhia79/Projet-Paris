import type { ReactNode } from 'react'
import { CATEGORY_BADGE_CLASSES, CATEGORY_LABELS, type CoolSpotCategory } from '../types/coolspot'

export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded bg-slate-200 ${className}`} />
}

export function Spinner({ label = 'Chargement' }: { label?: string }) {
  return (
    <span role="status" aria-live="polite" className="inline-flex items-center gap-2 text-sm text-slate-600">
      <svg className="h-4 w-4 animate-spin text-cool-600" viewBox="0 0 24 24" aria-hidden>
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
        <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
      </svg>
      {label}
    </span>
  )
}

export function CategoryBadge({ category }: { category: CoolSpotCategory }) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${CATEGORY_BADGE_CLASSES[category]}`}
    >
      {CATEGORY_LABELS[category]}
    </span>
  )
}

export function FreeBadge({ isFree }: { isFree: boolean }) {
  return isFree ? (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
      <span aria-hidden>●</span> Gratuit
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700">
      <span aria-hidden>●</span> Payant
    </span>
  )
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <span aria-hidden className="text-4xl">🔍</span>
      <h3 className="mt-3 text-base font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-slate-600">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}
