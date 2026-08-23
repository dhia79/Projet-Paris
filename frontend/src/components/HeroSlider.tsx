import { useState, useEffect, useRef } from 'react'
import { useCoolSpotStore } from '../store/useCoolSpotStore'
import type { CoolSpotCategory } from '../types/coolspot'

interface SlideData {
  title: string
  desc: string
  stat: string
  cat: CoolSpotCategory | 'all'
  accent: string
  accentRgb: string
  accentText: string
  heroTagText: string
  washA: string
  washB: string
  bgCarbon: string
  borderCard: string
  chipBg: string
  hoverSurface: string
  gradient: string
  svgGlyph: React.ReactNode
}

const TICK_COUNT = 36
/** Must outlast the longest transition layer (the 1.3s page sweep). */
const SWEEP_MS = 1400

const SLIDES: SlideData[] = [
  {
    title: 'Espaces Verts & Canopées',
    desc: 'Plus de 500 parcs publics, jardins historiques et sanctuaires ombragés nocturnes recensés dans les 20 arrondissements.',
    stat: '520+ Parcs Recensés',
    cat: 'green_space',
    accent: '#10B981',
    accentRgb: '16 185 129',
    accentText: '#047857',
    heroTagText: 'text-emerald-300',
    washA: 'rgb(6 78 59 / 0.55)',
    washB: 'rgb(2 19 11 / 0.35)',
    bgCarbon: '#F4F9F6',
    borderCard: '#D1E7DD',
    chipBg: '#E6F3EC',
    hoverSurface: '#DCEFE4',
    gradient: 'linear-gradient(to bottom right, #064e3b, #052e16, #02130b)',
    svgGlyph: (
      <svg className="w-full h-full text-emerald-400 drop-shadow-[0_10px_25px_rgba(16,185,129,0.4)]" viewBox="0 0 200 200" fill="none">
        {/* Sun Behind Tree */}
        <circle cx="145" cy="65" r="28" fill="#F59E0B" fillOpacity="0.85" />
        <circle cx="145" cy="65" r="38" stroke="#F59E0B" strokeWidth="1.5" strokeDasharray="4 4" className="opacity-60" />

        {/* Tree Canopy Layer 1 (Back Dark Green) */}
        <path d="M100 45 C70 45 50 70 50 95 C50 105 54 115 60 122 C55 128 52 136 52 145 C52 160 64 172 80 172 L120 172 L120 185 L80 185 L80 192 L120 192 L120 185 L125 185 L125 172 L145 172 C160 172 172 160 172 145 C172 136 168 128 162 122 C168 115 172 105 172 95 C172 70 150 45 120 45 Z" fill="#047857" fillOpacity="0.4" />

        {/* Tree Canopy Layer 2 (Main Emerald) */}
        <circle cx="100" cy="85" r="38" fill="#10B981" fillOpacity="0.9" stroke="#34D399" strokeWidth="2" />
        <circle cx="72" cy="115" r="28" fill="#059669" fillOpacity="0.9" stroke="#34D399" strokeWidth="2" />
        <circle cx="128" cy="115" r="28" fill="#10B981" fillOpacity="0.9" stroke="#34D399" strokeWidth="2" />

        {/* Tree Trunk */}
        <path d="M94 135 L94 185 C94 188 97 190 100 190 L104 190 C107 190 110 188 110 185 L110 135 Z" fill="#D97706" />

        {/* Leaves Accents */}
        <path d="M90 70 Q105 55 110 75 Z" fill="#A7F3D0" />
        <path d="M120 95 Q135 80 140 100 Z" fill="#A7F3D0" />

        {/* Ground Grass Line */}
        <path d="M40 190 Q100 184 160 190" stroke="#34D399" strokeWidth="3" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: "Fontaines d'Eau Potable",
    desc: "Un réseau municipal de plus de 1 200 fontaines d'eau potable gratuites et testées, en accès libre 24h/24.",
    stat: '1 300+ Fontaines',
    cat: 'fountain',
    accent: '#3B82F6',
    accentRgb: '59 130 246',
    accentText: '#1D4ED8',
    heroTagText: 'text-blue-300',
    washA: 'rgb(30 58 138 / 0.55)',
    washB: 'rgb(15 23 42 / 0.35)',
    bgCarbon: '#F0F5FA',
    borderCard: '#D0E1FD',
    chipBg: '#E2EDFD',
    hoverSurface: '#D5E4FC',
    gradient: 'linear-gradient(to bottom right, #1e3a8a, #172554, #090d16)',
    svgGlyph: (
      <svg className="w-full h-full text-blue-400 drop-shadow-[0_10px_25px_rgba(59,130,246,0.4)]" viewBox="0 0 200 200" fill="none">
        {/* Fountain Base Pedestal */}
        <path d="M60 175 L140 175 L130 160 L70 160 Z" fill="#1E40AF" stroke="#60A5FA" strokeWidth="2" />
        <rect x="85" y="105" width="30" height="55" rx="3" fill="#1D4ED8" stroke="#60A5FA" strokeWidth="2" />

        {/* Fountain Basin Bowl */}
        <ellipse cx="100" cy="105" rx="48" ry="14" fill="#2563EB" stroke="#93C5FD" strokeWidth="2.5" />
        <ellipse cx="100" cy="105" rx="38" ry="8" fill="#60A5FA" fillOpacity="0.6" />

        {/* Fountain Spout Arch & Water Flow Stream */}
        <path d="M100 105 L100 60 C100 45 125 45 125 70 L125 105" stroke="#93C5FD" strokeWidth="4" strokeLinecap="round" />
        <path d="M125 70 C125 90 120 105 120 120" stroke="#BFDBFE" strokeWidth="2.5" strokeDasharray="3 3" />

        {/* Floating Water Droplet Symbol */}
        <path d="M100 25 C100 25 122 55 122 70 A22 22 0 0 1 78 70 C78 55 100 25 100 25 Z" fill="#3B82F6" fillOpacity="0.85" stroke="#93C5FD" strokeWidth="2" />
        <circle cx="94" cy="62" r="4" fill="#FFFFFF" fillOpacity="0.7" />

        {/* Water Splash Ripples */}
        <ellipse cx="100" cy="145" rx="55" ry="10" stroke="#60A5FA" strokeWidth="1.5" strokeDasharray="4 4" className="opacity-70" />
      </svg>
    ),
  },
  {
    title: 'Lieux Climatisés',
    desc: "Musées, médiathèques, équipements culturels et espaces fraîcheur maintenus à 21°C pour s'abriter durant les pics de chaleur.",
    stat: '60+ Équipements',
    cat: 'indoor',
    accent: '#64748B',
    accentRgb: '100 116 139',
    accentText: '#334155',
    heroTagText: 'text-slate-200',
    washA: 'rgb(100 116 139 / 0.45)',
    washB: 'rgb(51 65 85 / 0.3)',
    bgCarbon: '#F8F9FA',
    borderCard: '#E5E8EB',
    chipBg: '#F1F2F4',
    hoverSurface: '#EAECEF',
    gradient: 'linear-gradient(135deg, #94A3B8, #64748b, #334155)',
    svgGlyph: (
      <svg className="w-full h-full text-slate-200 drop-shadow-[0_10px_25px_rgba(203,213,225,0.5)]" viewBox="0 0 200 200" fill="none">
        {/* Air Conditioner Unit Enclosure */}
        <rect x="35" y="45" width="130" height="65" rx="10" fill="#64748B" fillOpacity="0.85" stroke="#E2E8F0" strokeWidth="2.5" />
        <rect x="45" y="55" width="110" height="20" rx="4" fill="#475569" stroke="#CBD5E1" strokeWidth="1.5" />

        {/* AC Vents & Status Indicator Light */}
        <line x1="52" y1="65" x2="135" y2="65" stroke="#F1F5F9" strokeWidth="2" strokeLinecap="round" />
        <circle cx="146" cy="65" r="3" fill="#10B981" />

        {/* Snowflake Cooling Icon on Unit */}
        <path d="M100 82 L100 98 M92 90 L108 90 M94 84 L106 96 M106 84 L94 96" stroke="#F8FAFC" strokeWidth="2" strokeLinecap="round" />

        {/* Cool Air Breeze Flow Waves Drifting Downward */}
        <path d="M50 120 C70 135 85 135 105 120 C125 105 140 105 160 120" stroke="#E2E8F0" strokeWidth="3" strokeLinecap="round" fill="none" />
        <path d="M60 145 C80 160 95 160 115 145 C135 130 150 130 170 145" stroke="#CBD5E1" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.8" />
        <path d="M45 170 C65 185 80 185 100 170 C120 155 135 155 155 170" stroke="#F1F5F9" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.6" />
      </svg>
    ),
  },
]

export function HeroSlider() {
  const [activeIdx, setActiveIdx] = useState(0)
  const [sweeping, setSweeping] = useState(false)
  /** Gradient of the slide being replaced — painted on the retreating wipe layer. */
  const [prevGradient, setPrevGradient] = useState<string | null>(null)
  const setFilter = useCoolSpotStore((s) => s.setFilter)
  const currentSlide: SlideData = SLIDES[activeIdx] ?? SLIDES[0]!
  const ticksRef = useRef<HTMLDivElement>(null)
  const touchStartRef = useRef<number | null>(null)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  // Never leave a pending sweep timer behind on unmount.
  useEffect(() => () => timersRef.current.forEach(clearTimeout), [])

  // Dynamically repaint the entire application's root CSS properties on theme change
  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--accent', currentSlide.accent)
    root.style.setProperty('--accent-rgb', currentSlide.accentRgb)
    root.style.setProperty('--accent-text', currentSlide.accentText)
    root.style.setProperty('--theme-wash-a', currentSlide.washA)
    root.style.setProperty('--theme-wash-b', currentSlide.washB)
    root.style.setProperty('--bg-carbon', currentSlide.bgCarbon)
    root.style.setProperty('--border-card', currentSlide.borderCard)
    root.style.setProperty('--chip-bg', currentSlide.chipBg)
    root.style.setProperty('--hover-surface', currentSlide.hoverSurface)
  }, [currentSlide])

  // Build the sensor ticks once — heights stay put so only colour animates.
  useEffect(() => {
    const container = ticksRef.current
    if (!container) return
    container.innerHTML = ''
    for (let i = 0; i < TICK_COUNT; i++) {
      const bar = document.createElement('div')
      bar.className = 'tick w-[3px] rounded-t-sm'
      bar.style.height = `${Math.floor(Math.random() * 85) + 15}%`
      container.appendChild(bar)
    }
  }, [])

  // Recolour the ticks as a left → right cascade, matching the wipe direction.
  useEffect(() => {
    const container = ticksRef.current
    if (!container) return
    const bars = container.children
    for (let i = 0; i < bars.length; i++) {
      const bar = bars[i] as HTMLElement
      bar.style.transitionDelay = `${i * 18}ms`
      bar.style.backgroundColor = i > 28 ? '#EF4444' : i > 18 ? '#F59E0B' : currentSlide.accent
    }
  }, [currentSlide])

  const goToSlide = (idx: number) => {
    if (idx === activeIdx) return
    // Restart cleanly if a previous sweep is still in flight, so rapid clicks
    // retarget the transition instead of being swallowed or stacking overlays.
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []

    setSweeping(true)
    setPrevGradient(currentSlide.gradient)
    setActiveIdx(idx)
    setFilter('category', SLIDES[idx]?.cat ?? 'all')

    timersRef.current.push(
      setTimeout(() => {
        setSweeping(false)
        setPrevGradient(null)
      }, SWEEP_MS),
    )
  }

  // Swipe gesture support for mobile & touchpad
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = e.touches[0]?.clientX ?? null
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartRef.current === null) return
    const touchEnd = e.changedTouches[0]?.clientX ?? touchStartRef.current
    const diff = touchStartRef.current - touchEnd
    if (Math.abs(diff) > 40) {
      if (diff > 0) {
        goToSlide((activeIdx + 1) % SLIDES.length)
      } else {
        goToSlide((activeIdx - 1 + SLIDES.length) % SLIDES.length)
      }
    }
    touchStartRef.current = null
  }

  const applyCategoryFilter = () => {
    setFilter('category', currentSlide.cat)
    const tableEl = document.getElementById('table-body') || document.getElementById('functional-dashboard')
    tableEl?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div
      id="oasis-slider"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="relative w-full min-h-[520px] sm:min-h-[560px] rounded-3xl overflow-hidden p-8 sm:p-12 flex flex-col justify-between text-white shadow-2xl border border-white/10 my-4 transition-[box-shadow] duration-700 ease-[cubic-bezier(0.4,0,0.15,1)]"
      style={{ background: currentSlide.gradient }}
    >
      {/* Ambient Sensor-Tick Layer */}
      <div id="particles-layer" className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <div
          ref={ticksRef}
          id="tick-field"
          className="absolute bottom-0 right-0 w-1/2 h-2/3 flex items-end justify-end gap-[3px] pr-8 pb-8 opacity-[0.15]"
        />
      </div>

      {/* Directional theme transition: the outgoing gradient retreats to the
          right, uncovering the new theme, chased by a bright leading edge. */}
      {sweeping && prevGradient && (
        <>
          <div
            key={`wipe-${activeIdx}`}
            className="theme-wipe absolute inset-0 z-20"
            style={{ background: prevGradient }}
          />
          <div key={`edge-${activeIdx}`} className="theme-edge z-30" />
          <div key={`page-${activeIdx}`} className="theme-page-sweep" />
        </>
      )}

      {/* Header / Navigation Bar inside Hero */}
      <div className="relative z-10 flex justify-between items-center">
        <span className={`font-mono-data text-xs tracking-widest ${currentSlide.heroTagText} uppercase px-3.5 py-1.5 rounded-md bg-black/40 border border-white/10 flex items-center gap-2.5`}>
          <span className="kicker-mark"></span>
          Paris Climate Refuge Navigator
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => goToSlide((activeIdx - 1 + SLIDES.length) % SLIDES.length)}
            aria-label="Thème précédent"
            className="px-3 py-1.5 rounded-md bg-white/[0.06] hover:bg-white/[0.15] border border-white/15 text-xs font-mono-data transition-colors cursor-pointer"
          >
            ←
          </button>
          <button
            onClick={() => goToSlide((activeIdx + 1) % SLIDES.length)}
            aria-label="Thème suivant"
            className="px-3 py-1.5 rounded-md bg-white/[0.06] hover:bg-white/[0.15] border border-white/15 text-xs font-mono-data transition-colors cursor-pointer"
          >
            →
          </button>
          <button
            onClick={() => {
              const input = document.getElementById('search-input')
              input?.focus()
              input?.scrollIntoView({ behavior: 'smooth' })
            }}
            className="px-4 py-1.5 rounded-md bg-white/[0.06] hover:bg-white/[0.12] border border-white/15 text-xs font-mono-data tracking-wider transition-colors cursor-pointer hidden sm:inline"
          >
            Explorer la Table ↓
          </button>
        </div>
      </div>

      {/* Main Hero Content (2-Column Grid) */}
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 items-center gap-8 lg:gap-12 my-auto py-6">
        {/* Left Column: Text & Action */}
        {/* Each block enters from the left, staggered, so the reveal tracks
            the wipe as it crosses the hero. */}
        <div className="space-y-4 max-w-xl">
          <div key={`title-${activeIdx}`} className="enter-l overflow-hidden py-1" style={{ ['--d' as string]: '0.2s' }}>
            <h2 id="slide-title" className="font-serif-editorial text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-none text-white">
              {currentSlide.title}
            </h2>
          </div>
          <p
            key={`desc-${activeIdx}`}
            id="slide-desc"
            className="enter-l text-slate-200/90 text-sm sm:text-base font-light leading-relaxed"
            style={{ ['--d' as string]: '0.34s' }}
          >
            {currentSlide.desc}
          </p>
          <div
            key={`cta-${activeIdx}`}
            className="enter-l pt-2 flex flex-wrap items-center gap-4"
            style={{ ['--d' as string]: '0.48s' }}
          >
            <span id="slide-stat" className={`font-mono-data text-xs px-3.5 py-1.5 rounded-lg bg-white/10 border border-white/15 ${currentSlide.heroTagText} font-semibold tabular-nums`}>
              {currentSlide.stat}
            </span>
            <button
              id="apply-filter-btn"
              onClick={applyCategoryFilter}
              className="px-6 py-2.5 rounded-md bg-white hover:bg-slate-100 text-black font-bold font-mono-data text-xs tracking-wider uppercase transition-colors cursor-pointer shadow-lg hover:shadow-xl"
            >
              Filtrer le Tableau ↓
            </button>
          </div>
        </div>

        {/* Right Column: Icon Graphic Symbol with Motion */}
        <div className="relative flex items-center justify-center h-64 sm:h-80">
          {/* Radial Aura Glow Pulsing Behind Graphic */}
          <div
            id="graphic-glow"
            className="absolute w-72 h-72 rounded-full blur-3xl pointer-events-none animate-pulse-glow transition-all duration-700"
            style={{ background: `rgb(${currentSlide.accentRgb} / 0.35)` }}
          />

          {/* Glassmorphic Container — enters last, being furthest right */}
          <div
            key={`glyph-${activeIdx}`}
            className="enter-l relative z-10 w-60 h-60 sm:w-72 sm:h-72 rounded-3xl p-6 border border-white/20 bg-black/20 backdrop-blur-xl shadow-2xl flex items-center justify-center animate-float-orb"
            style={{
              ['--d' as string]: '0.64s',
              boxShadow: `0 25px 50px -12px rgb(${currentSlide.accentRgb} / 0.4), inset 0 0 25px 2px rgb(${currentSlide.accentRgb} / 0.15)`,
            }}
          >
            {/* Clear, Recognizable Vector Theme Icon */}
            {currentSlide.svgGlyph}
          </div>
        </div>
      </div>

      {/* Bottom Thumbnail Selector Bar */}
      <div className="relative z-10 flex flex-wrap items-center gap-3 pt-6 border-t border-white/10">
        {SLIDES.map((slide, idx) => {
          const isActive = idx === activeIdx
          return (
            <button
              key={idx}
              onClick={() => goToSlide(idx)}
              className={`thumb-btn relative flex items-center gap-3 px-4 py-2.5 rounded-lg cursor-pointer transition-all ${
                isActive
                  ? 'bg-white/15 border border-white/30 opacity-100 shadow-md scale-105'
                  : 'bg-white/5 border border-white/5 opacity-60 hover:opacity-100'
              }`}
            >
              <span className="font-mono-data text-[10px] text-slate-300 tabular-nums">0{idx + 1}</span>
              <span className="text-xs font-mono-data font-medium">{slide.title.split('&')[0]}</span>
              {isActive && <div className="active-indicator absolute bottom-0 left-0 right-0 h-[2.5px] acc-bg rounded-b-xl" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
