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
  gradient: string
  svgGlyph: React.ReactNode
}

const SLIDES: SlideData[] = [
  {
    title: 'Espaces Verts & Canopées',
    desc: 'Plus de 500 parcs publics, jardins historiques et sanctuaires ombragés nocturnes recensés dans les 20 arrondissements.',
    stat: '520+ Parcs Recensés',
    cat: 'green_space',
    accent: '#10B981',
    accentRgb: '16 185 129',
    gradient: 'linear-gradient(to bottom right, #064e3b, #052e16, #02130b)',
    svgGlyph: (
      <svg className="w-full h-full text-emerald-400 opacity-90" viewBox="0 0 200 200" fill="none" stroke="currentColor">
        <circle cx="100" cy="100" r="85" strokeWidth="1" strokeDasharray="4 4" className="opacity-40" />
        <circle cx="100" cy="85" r="45" strokeWidth="2" fill="currentColor" fillOpacity="0.15" />
        <path d="M100 130v40M80 170h40" strokeWidth="3" strokeLinecap="round" />
        <path d="M60 90 Q100 40 140 90" strokeWidth="2.5" fill="none" />
        <path d="M75 110 Q100 70 125 110" strokeWidth="2" fill="none" />
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
    gradient: 'linear-gradient(to bottom right, #1e3a8a, #172554, #090d16)',
    svgGlyph: (
      <svg className="w-full h-full text-blue-400 opacity-90" viewBox="0 0 200 200" fill="none" stroke="currentColor">
        <circle cx="100" cy="100" r="85" strokeWidth="1" strokeDasharray="4 4" className="opacity-40" />
        <path d="M100 35 C100 35 150 100 150 130 A50 50 0 0 1 50 130 C50 100 100 35 100 35 Z" strokeWidth="2.5" fill="currentColor" fillOpacity="0.15" />
        <circle cx="100" cy="130" r="20" strokeWidth="2" />
        <line x1="100" y1="70" x2="100" y2="150" strokeWidth="1.5" strokeDasharray="3 3" />
      </svg>
    ),
  },
  {
    title: 'Lieux Climatisés',
    desc: "Musées, médiathèques, équipements culturels et espaces fraîcheur maintenus à 21°C pour s'abriter durant les pics de chaleur.",
    stat: '60+ Équipements',
    cat: 'indoor',
    accent: '#F59E0B',
    accentRgb: '245 158 11',
    gradient: 'linear-gradient(to bottom right, #78350f, #451a03, #180901)',
    svgGlyph: (
      <svg className="w-full h-full text-amber-400 opacity-90" viewBox="0 0 200 200" fill="none" stroke="currentColor">
        <circle cx="100" cy="100" r="85" strokeWidth="1" strokeDasharray="4 4" className="opacity-40" />
        <rect x="50" y="60" width="100" height="80" rx="8" strokeWidth="2.5" fill="currentColor" fillOpacity="0.15" />
        <line x1="70" y1="100" x2="130" y2="100" strokeWidth="2" strokeLinecap="round" />
        <path d="M75 120 C85 135 95 135 105 120 C115 135 125 135 135 120" strokeWidth="2" fill="none" strokeLinecap="round" />
      </svg>
    ),
  },
]

export function HeroSlider() {
  const [activeIdx, setActiveIdx] = useState(0)
  const [animating, setAnimating] = useState(false)
  const setFilter = useCoolSpotStore((s) => s.setFilter)
  const currentSlide: SlideData = SLIDES[activeIdx] ?? SLIDES[0]!
  const ticksRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--accent', currentSlide.accent)
    root.style.setProperty('--accent-rgb', currentSlide.accentRgb)
  }, [currentSlide])

  useEffect(() => {
    if (!ticksRef.current) return
    const container = ticksRef.current
    container.innerHTML = ''
    const count = 36
    for (let i = 0; i < count; i++) {
      const bar = document.createElement('div')
      bar.className = 'tick w-[3px] rounded-t-sm'
      const h = Math.floor(Math.random() * 85) + 15
      bar.style.height = `${h}%`
      bar.style.backgroundColor = i > 28 ? '#EF4444' : i > 18 ? '#F59E0B' : '#10B981'
      container.appendChild(bar)
    }
  }, [activeIdx])

  const goToSlide = (idx: number) => {
    if (idx === activeIdx || animating) return
    setAnimating(true)
    setActiveIdx(idx)
    setTimeout(() => setAnimating(false), 400)
  }

  const applyCategoryFilter = () => {
    setFilter('category', currentSlide.cat)
    const tableEl = document.getElementById('table-body') || document.getElementById('functional-dashboard')
    tableEl?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div
      id="oasis-slider"
      className="relative w-full min-h-[500px] sm:min-h-[550px] rounded-3xl overflow-hidden p-8 sm:p-12 flex flex-col justify-between text-white shadow-2xl border border-white/10 my-4 transition-all duration-700"
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

      {/* Header / Navigation Bar inside Hero */}
      <div className="relative z-10 flex justify-between items-center">
        <span className="font-mono-data text-xs tracking-widest acc-text uppercase px-3.5 py-1.5 rounded-md bg-black/40 border border-white/10 flex items-center gap-2.5">
          <span className="kicker-mark"></span>
          Paris Climate Refuge Navigator
        </span>
        <button
          onClick={() => {
            const input = document.getElementById('search-input')
            input?.focus()
            input?.scrollIntoView({ behavior: 'smooth' })
          }}
          className="px-5 py-2 rounded-md bg-white/[0.06] hover:bg-white/[0.12] border border-white/15 text-xs font-mono-data tracking-wider transition-colors cursor-pointer"
        >
          Explorer la Table ↓
        </button>
      </div>

      {/* Main Hero Content (2-Column Grid) */}
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 items-center gap-8 lg:gap-12 my-auto py-6">
        {/* Left Column: Text & Action */}
        <div className={`space-y-4 max-w-xl transition-all duration-500 ${animating ? 'opacity-0 translateY-2' : 'opacity-100 translateY-0'}`}>
          <div className="overflow-hidden py-1">
            <h2 id="slide-title" className="font-serif-editorial text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-none text-white">
              {currentSlide.title}
            </h2>
          </div>
          <p id="slide-desc" className="text-slate-200/90 text-sm sm:text-base font-light leading-relaxed">
            {currentSlide.desc}
          </p>
          <div className="pt-2 flex flex-wrap items-center gap-4">
            <span id="slide-stat" className="font-mono-data text-xs px-3.5 py-1.5 rounded-lg bg-white/10 border border-white/15 acc-text font-semibold tabular-nums">
              {currentSlide.stat}
            </span>
            <button
              id="apply-filter-btn"
              onClick={applyCategoryFilter}
              className="px-6 py-2.5 rounded-md bg-white hover:bg-slate-100 text-black font-bold font-mono-data text-xs tracking-wider uppercase transition-colors cursor-pointer"
            >
              Filtrer le Tableau ↓
            </button>
          </div>
        </div>

        {/* Right Column: Technical SVG Graphic */}
        <div className="relative flex items-center justify-center h-56 sm:h-72">
          <div id="hero-graphic" className={`relative z-10 w-48 h-48 sm:w-64 sm:h-64 select-none transition-all duration-500 ${animating ? 'scale-90 opacity-0' : 'scale-100 opacity-100'}`} aria-hidden="true">
            {currentSlide.svgGlyph}
          </div>
          <div
            id="graphic-glow"
            className="absolute w-64 h-64 rounded-full blur-3xl pointer-events-none transition-colors duration-700"
            style={{ background: `rgb(${currentSlide.accentRgb} / 0.25)` }}
          />
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
                  ? 'bg-white/10 border border-white/20 opacity-100'
                  : 'bg-white/5 border border-white/5 opacity-60 hover:opacity-100'
              }`}
            >
              <span className="font-mono-data text-[10px] text-slate-400 tabular-nums">0{idx + 1}</span>
              <span className="text-xs font-mono-data font-medium">{slide.title.split('&')[0]}</span>
              {isActive && <div className="active-indicator absolute bottom-0 left-0 right-0 h-[2px] acc-bg rounded-b-xl" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
