import { useEffect, useRef, useState } from 'react'
import { CATEGORY_BADGE_CLASSES, CATEGORY_LABELS, type CoolSpot } from '../types/coolspot'
import { arrondissementLabel } from '../store/selectors'

export function SpotDetailsDrawer({ spot, onClose }: { spot: CoolSpot | null; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const [copied, setCopied] = useState(false)

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

  const copyAddress = () => {
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(`${spot.name}, ${spot.address}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const mapsUrl = spot.coordinates
    ? `https://www.google.com/maps/search/?api=1&query=${spot.coordinates.lat},${spot.coordinates.lon}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(spot.name + ' ' + spot.address)}`

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex justify-end">
      {/* Backdrop overlay */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Drawer Content Card */}
      <div className="surf border-l surf-bd max-w-lg w-full h-full p-6 space-y-6 overflow-y-auto relative z-10 shadow-2xl animate-in slide-in-from-right duration-300">
        {/* Close Button */}
        <button
          ref={closeRef}
          onClick={onClose}
          aria-label="Fermer la fiche"
          className="absolute top-4 right-4 ink-mute hover:text-[color:var(--ink)] p-1 cursor-pointer"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Drawer Content */}
        <div className="space-y-6">
          <div className="space-y-2">
            <span className={`px-2.5 py-1 rounded-md text-xs font-mono-data font-semibold ${CATEGORY_BADGE_CLASSES[spot.category]}`}>
              {CATEGORY_LABELS[spot.category]}
            </span>
            <h2 className="font-serif-editorial text-2xl sm:text-3xl ink leading-tight">{spot.name}</h2>
            <div className="font-mono-data text-xs acc-text font-semibold flex items-center gap-2">
              <span className="kicker-mark"></span>
              Score de fraîcheur: {spot.canopyScore}/100
            </div>
          </div>

          {/* Feature Tags */}
          <div className="flex flex-wrap gap-2">
            {spot.features?.map((feat, idx) => (
              <span key={idx} className="px-2.5 py-1 rounded-md bg-[color:var(--chip-bg)] border surf-bd text-[11px] font-mono-data ink-soft">
                ✓ {feat}
              </span>
            ))}
          </div>

          <hr className="surf-bd" />

          {/* Key Details List */}
          <dl className="space-y-4 font-mono-data text-xs">
            <div>
              <dt className="ink-mute uppercase tracking-wider text-[10px]">Arrondissement</dt>
              <dd className="ink font-semibold mt-0.5">
                {spot.arrondissement ? `Paris ${arrondissementLabel(spot.arrondissement)} (${spot.arrondissement})` : 'Non renseigné'}
              </dd>
            </div>

            <div>
              <dt className="ink-mute uppercase tracking-wider text-[10px]">Adresse</dt>
              <dd className="ink font-semibold mt-0.5 flex items-center justify-between gap-2">
                <span className="truncate">{spot.address}</span>
                <button
                  onClick={copyAddress}
                  className="px-2.5 py-1 rounded bg-[color:var(--chip-bg)] border surf-bd hover:acc-bd text-[10px] ink-mute hover:ink transition-colors shrink-0 cursor-pointer"
                >
                  {copied ? 'Copié ✓' : 'Copier'}
                </button>
              </dd>
            </div>

            <div>
              <dt className="ink-mute uppercase tracking-wider text-[10px]">Horaires / Accès</dt>
              <dd className="ink font-semibold mt-0.5">{spot.openingHours || 'Accès libre'}</dd>
            </div>

            <div>
              <dt className="ink-mute uppercase tracking-wider text-[10px]">Micro-climat & Ombrage</dt>
              <dd className="ink font-semibold mt-0.5">{spot.shadeLevel}</dd>
            </div>

            <div>
              <dt className="ink-mute uppercase tracking-wider text-[10px]">Source Open Data</dt>
              <dd className="ink-mute mt-0.5">{spot.source}</dd>
            </div>
          </dl>

          {/* Google Maps Link Button */}
          <div className="pt-4 border-t surf-bd">
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3 acc-gradient text-slate-950 font-bold font-mono-data text-xs rounded-lg transition-all hover:brightness-110 flex items-center justify-center gap-2"
            >
              <span>OUVRIR DANS GOOGLE MAPS</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
