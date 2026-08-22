import { useEffect } from 'react'
import { useCoolSpotStore } from '../store/useCoolSpotStore'

export function Header() {
  const simulatedTemp = useCoolSpotStore((s) => s.simulatedTemp)
  const setSimulatedTemp = useCoolSpotStore((s) => s.setSimulatedTemp)
  const setWizardOpen = useCoolSpotStore((s) => s.setWizardOpen)

  useEffect(() => {
    const root = document.documentElement
    const opacity = Math.min(0.8, 0.1 + (simulatedTemp - 25) * 0.035)
    root.style.setProperty('--heat-opacity', opacity.toFixed(2))

    if (simulatedTemp >= 38) {
      root.style.setProperty('--heat-wash', 'rgb(103 0 13 / 0.45)')
    } else if (simulatedTemp >= 34) {
      root.style.setProperty('--heat-wash', 'rgb(203 24 29 / 0.35)')
    } else if (simulatedTemp >= 30) {
      root.style.setProperty('--heat-wash', 'rgb(217 119 6 / 0.30)')
    } else {
      root.style.setProperty('--heat-wash', 'rgb(6 78 59 / 0.25)')
    }
  }, [simulatedTemp])

  let alertBadge = '— Modéré'
  let alertClass = 'text-emerald-700'
  if (simulatedTemp >= 38) {
    alertBadge = '— Urgence Canicule'
    alertClass = 'text-red-700 font-bold animate-pulse'
  } else if (simulatedTemp >= 34) {
    alertBadge = '— Alerte Canicule'
    alertClass = 'text-orange-700 font-bold'
  } else if (simulatedTemp >= 30) {
    alertBadge = '— Vigilance'
    alertClass = 'text-amber-700 font-semibold'
  }

  return (
    <>
      {/* Top Editorial Sticky Header */}
      <header className="w-full border-b surf-bd surf/90 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-3.5 flex flex-wrap items-center justify-between gap-3">
          
          {/* Masthead Lockup */}
          <div className="flex items-baseline gap-3">
            <span className="font-serif-editorial italic text-xl ink leading-none">Paris</span>
            <span className="w-px h-4 surf-bd border-r self-center"></span>
            <span className="font-mono-data text-[10.5px] ink-mute uppercase tracking-[0.15em] leading-none hidden sm:inline">
              Climate Refuge Index
            </span>
          </div>

          {/* Heatwave Ambient Temperature Simulator */}
          <div className="flex items-center gap-3 font-mono-data text-xs">
            <span className="ink-mute uppercase text-[10px] tracking-wide hidden md:inline">
              Température simulée
            </span>
            <input
              id="heat-slider"
              type="range"
              min="25"
              max="42"
              value={simulatedTemp}
              onChange={(e) => setSimulatedTemp(Number(e.target.value))}
              aria-label="Température simulée"
              className="w-24 sm:w-28 h-[3px] bg-[#DCD7C8] rounded-full appearance-none cursor-pointer acc-accent"
            />
            <span className="tabular-nums">
              <span id="temp-display-val" className="font-bold ink">{simulatedTemp}°C</span>
              <span id="temp-alert-badge" className={`ml-1 uppercase text-[10px] ${alertClass}`}>
                {alertBadge}
              </span>
            </span>
          </div>
        </div>
      </header>

      {/* Editorial Title & Context Block */}
      <section className="max-w-6xl mx-auto px-4 sm:px-8 pt-10 pb-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="font-mono-data text-xs acc-text tracking-widest uppercase flex items-center gap-2.5">
              <span className="kicker-mark"></span>
              Rapport Data Spécial : Vagues de Chaleur & Refuges Municipaux
            </div>
            <h1 className="font-serif-editorial text-4xl sm:text-6xl lg:text-7xl ink leading-[1.05] tracking-tight">
              Trouver un endroit frais à Paris <br />
              <span className="italic font-light ink-soft">quand le climat s'enflamme.</span>
            </h1>
          </div>

          {/* Emergency Assistant Button */}
          <button
            id="btn-open-wizard"
            onClick={() => setWizardOpen(true)}
            className="px-5 py-3.5 acc-gradient text-slate-950 font-bold font-mono-data text-xs rounded-lg transition-all hover:brightness-110 flex items-center gap-3 cursor-pointer shadow-lg"
          >
            <svg className="w-4 h-4 text-slate-950" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span>MODE URGENCE CANICULE (ASSISTANT RAPIDE)</span>
          </button>
        </div>

        <p className="ink-soft max-w-3xl text-sm sm:text-base font-normal leading-relaxed">
          Une cartographie interactive associant <strong>172 ans d'anomalies de température à Paris (1850–2022)</strong> ("Warming Stripes") au réseau Open Data de la Ville de Paris : fontaines d'eau potable, parcs et canopées ombragées, établissements climatisés et zones de baignade.
        </p>
      </section>
    </>
  )
}
