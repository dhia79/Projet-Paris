import { useEffect, useRef } from 'react'
import { CATEGORY_LABELS, type CoolSpot } from '../types/coolspot'
import { arrondissementLabel } from '../store/selectors'
import { CategoryBadge, FreeBadge } from './ui'

interface Row {
  label: string
  value: string
}

function DetailRow({ label, value }: Row) {
  return (
    <div className="border-t border-slate-100 py-3">
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-900">{value}</dd>
    </div>
  )
}

export function SpotDetailsDrawer({ spot, onClose }: { spot: CoolSpot | null; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!spot) return
    closeRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [spot, onClose])

  if (!spot) return null

  const maps = spot.coordinates
    ? `https://www.google.com/maps/search/?api=1&query=${spot.coordinates.lat},${spot.coordinates.lon}`
    : null

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        role="presentation"
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Détails de ${spot.name}`}
        className="relative flex h-full w-full max-w-md flex-col overflow-y-auto bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 p-5">
          <div className="min-w-0">
            <CategoryBadge category={spot.category} />
            <h2 className="mt-2 text-lg font-semibold text-slate-900">{spot.name}</h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Fermer le panneau de détails"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            ✕
          </button>
        </header>

        <dl className="px-5 pb-5">
          <DetailRow label="Type" value={CATEGORY_LABELS[spot.category]} />
          <DetailRow
            label="Arrondissement"
            value={spot.arrondissement ? `Paris ${arrondissementLabel(spot.arrondissement)} (${spot.arrondissement})` : 'Non renseigné'}
          />
          <DetailRow label="Adresse" value={spot.address} />
          <DetailRow label="Horaires / accès" value={spot.openingHours ?? 'Non renseigné'} />
          <DetailRow
            label="Coordonnées"
            value={spot.coordinates ? `${spot.coordinates.lat.toFixed(5)}, ${spot.coordinates.lon.toFixed(5)}` : 'Non géolocalisé'}
          />
          <DetailRow label="Jeu de données source" value={spot.source} />
          <div className="border-t border-slate-100 py-3">
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Tarif</dt>
            <dd className="mt-1">
              <FreeBadge isFree={spot.isFree} />
            </dd>
          </div>
        </dl>

        {maps ? (
          <div className="mt-auto border-t border-slate-200 p-5">
            <a
              href={maps}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full rounded-lg bg-cool-600 px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-cool-700"
            >
              Ouvrir l'itinéraire ↗
            </a>
          </div>
        ) : null}
      </aside>
    </div>
  )
}
