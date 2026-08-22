import { useEffect } from 'react'
import { useCoolSpotStore, INITIAL_FILTER } from '../store/useCoolSpotStore'
import { selectActiveFiltersCount } from '../store/selectors'

const TEMP_MIN = 25
const TEMP_MAX = 42
const TEMP_DEFAULT = 32

/** Smoothly bring an element into view, tolerating a missing target. */
function scrollToId(id: string, focus = false) {
  const el = document.getElementById(id)
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  if (focus) (el as HTMLElement).focus({ preventScroll: true })
}

export function Header() {
  const simulatedTemp = useCoolSpotStore((s) => s.simulatedTemp)
  const setSimulatedTemp = useCoolSpotStore((s) => s.setSimulatedTemp)
  const setWizardOpen = useCoolSpotStore((s) => s.setWizardOpen)
  const filters = useCoolSpotStore((s) => s.filters)
  const setFilter = useCoolSpotStore((s) => s.setFilter)
  const resetFilters = useCoolSpotStore((s) => s.resetFilters)
  const favorites = useCoolSpotStore((s) => s.favorites)
  const items = useCoolSpotStore((s) => s.items)
  const loading = useCoolSpotStore((s) => s.loading)

  const activeFilterCount = selectActiveFiltersCount(filters, INITIAL_FILTER)

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

  // Keyboard shortcuts: "/" focuses search, "u" opens the urgency assistant.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const typing =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT' ||
        target?.isContentEditable
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return

      if (e.key === '/') {
        e.preventDefault()
        scrollToId('search-input', true)
      } else if (e.key.toLowerCase() === 'u') {
        e.preventDefault()
        setWizardOpen(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [setWizardOpen])

  let alertBadge = '— Modéré'
  let alertClass = 'text-emerald-700'
  let alertTitle = 'Conditions modérées — ouvrir l’assistant canicule'
  if (simulatedTemp >= 38) {
    alertBadge = '— Urgence Canicule'
    alertClass = 'text-red-700 font-bold animate-pulse'
    alertTitle = 'Urgence canicule — ouvrir l’assistant rapide'
  } else if (simulatedTemp >= 34) {
    alertBadge = '— Alerte Canicule'
    alertClass = 'text-orange-700 font-bold'
    alertTitle = 'Alerte canicule — ouvrir l’assistant rapide'
  } else if (simulatedTemp >= 30) {
    alertBadge = '— Vigilance'
    alertClass = 'text-amber-700 font-semibold'
    alertTitle = 'Vigilance chaleur — ouvrir l’assistant rapide'
  }

  // Percentage of the slider track that should read as "filled".
  const fillPct = ((simulatedTemp - TEMP_MIN) / (TEMP_MAX - TEMP_MIN)) * 100

  const favoritesActive = filters.favoritesOnly

  const toggleFavorites = () => {
    setFilter('favoritesOnly', !favoritesActive)
    scrollToId('functional-dashboard')
  }

  return (
    <>
      {/* Top Editorial Sticky Header */}
      <header className="w-full border-b surf-bd surf/90 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-3.5 flex flex-wrap items-center justify-between gap-3">

          {/* Masthead Lockup — returns to the top of the report */}
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            title="Retour en haut"
            className="flex items-baseline gap-3 cursor-pointer group rounded-md -mx-1 px-1 py-0.5 hover-surf transition-colors"
          >
            <span className="font-serif-editorial italic text-xl ink leading-none group-hover:acc-text transition-colors">
              Paris
            </span>
            <span className="w-px h-4 surf-bd border-r self-center"></span>
            <span className="font-mono-data text-[10.5px] ink-mute uppercase tracking-[0.15em] leading-none hidden sm:inline">
              Climate Refuge Index
            </span>
          </button>

          {/* Live index status, quick filters & heat simulator */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 font-mono-data text-xs">

            {/* Dataset counter — jumps to the table */}
            <button
              type="button"
              onClick={() => scrollToId('functional-dashboard')}
              title="Aller à la table des refuges"
              className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-md surf-chip border surf-bd acc-hover-bd-40 transition-colors cursor-pointer tabular-nums"
            >
              <span className={`w-1.5 h-1.5 rounded-full ${loading ? 'bg-amber-500 animate-pulse' : 'acc-bg'}`} />
              <span className="ink font-semibold">{loading ? '—' : items.length.toLocaleString('fr-FR')}</span>
              <span className="ink-mute uppercase text-[10px]">refuges</span>
            </button>

            {/* Favorites quick filter */}
            <button
              type="button"
              onClick={toggleFavorites}
              aria-pressed={favoritesActive}
              title={favoritesActive ? 'Afficher tous les refuges' : 'Afficher uniquement mes favoris'}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border transition-colors cursor-pointer tabular-nums ${
                favoritesActive
                  ? 'acc-bg-10 acc-bd-40 ink font-semibold'
                  : 'surf-chip surf-bd ink-soft acc-hover-bd-40'
              }`}
            >
              <span className={favoritesActive ? 'acc-text' : 'ink-mute'}>{favoritesActive ? '★' : '☆'}</span>
              <span>{favorites.length}</span>
            </button>

            {/* Reset all active filters */}
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={resetFilters}
                title="Réinitialiser tous les filtres"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md surf-chip border surf-bd ink-soft hover:text-red-700 hover:border-red-300 transition-colors cursor-pointer"
              >
                <span className="uppercase text-[10px]">Filtres</span>
                <span className="acc-bg text-white rounded-full px-1.5 text-[10px] font-bold tabular-nums">
                  {activeFilterCount}
                </span>
                <span aria-hidden>×</span>
              </button>
            )}

            {/* Heatwave Ambient Temperature Simulator */}
            <div className="flex items-center gap-2.5">
              <span className="ink-mute uppercase text-[10px] tracking-wide hidden md:inline">
                Température simulée
              </span>
              <input
                id="heat-slider"
                type="range"
                min={TEMP_MIN}
                max={TEMP_MAX}
                value={simulatedTemp}
                onChange={(e) => setSimulatedTemp(Number(e.target.value))}
                onDoubleClick={() => setSimulatedTemp(TEMP_DEFAULT)}
                aria-label="Température simulée"
                aria-valuetext={`${simulatedTemp} degrés Celsius, ${alertBadge.replace('— ', '')}`}
                title="Glisser pour simuler la température · double-clic pour réinitialiser"
                className="heat-range w-24 sm:w-28 cursor-pointer"
                style={{ ['--fill-pct' as string]: `${fillPct}%` }}
              />
              <span className="tabular-nums flex items-center gap-1">
                <span id="temp-display-val" className="font-bold ink">{simulatedTemp}°C</span>
                <button
                  type="button"
                  id="temp-alert-badge"
                  onClick={() => setWizardOpen(true)}
                  title={alertTitle}
                  className={`uppercase text-[10px] cursor-pointer rounded px-1 -mx-0.5 hover:underline transition-colors ${alertClass}`}
                >
                  {alertBadge}
                </button>
              </span>
              {simulatedTemp !== TEMP_DEFAULT && (
                <button
                  type="button"
                  onClick={() => setSimulatedTemp(TEMP_DEFAULT)}
                  title={`Réinitialiser à ${TEMP_DEFAULT}°C`}
                  aria-label={`Réinitialiser la température à ${TEMP_DEFAULT}°C`}
                  className="ink-mute hover:ink text-[11px] leading-none px-1 rounded transition-colors cursor-pointer"
                >
                  ↺
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Editorial Title & Context Block */}
      <section className="max-w-6xl mx-auto px-4 sm:px-8 pt-10 pb-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="font-mono-data text-xs acc-text font-bold tracking-widest uppercase flex items-center gap-2.5">
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
