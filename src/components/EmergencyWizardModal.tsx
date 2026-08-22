import { useState, useEffect, useRef } from 'react'
import { useCoolSpotStore } from '../store/useCoolSpotStore'
import type { CoolSpotCategory, PriceFilter } from '../types/coolspot'

export function EmergencyWizardModal() {
  const isWizardOpen = useCoolSpotStore((s) => s.isWizardOpen)
  const setWizardOpen = useCoolSpotStore((s) => s.setWizardOpen)
  const applyWizardChoices = useCoolSpotStore((s) => s.applyWizardChoices)

  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [selectedUsage, setSelectedUsage] = useState<CoolSpotCategory | 'all'>('green_space')
  const [selectedPrice, setSelectedPrice] = useState<PriceFilter>('FREE')

  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isWizardOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setWizardOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isWizardOpen, setWizardOpen])

  if (!isWizardOpen) return null

  const handleNextUsage = (usage: CoolSpotCategory | 'all') => {
    setSelectedUsage(usage)
    setStep(2)
  }

  const handleNextPrice = (price: PriceFilter) => {
    setSelectedPrice(price)
    setStep(3)
  }

  const handleFinish = (arr: string) => {
    applyWizardChoices(selectedUsage, selectedPrice, arr)
  }

  const progressPercent = step === 1 ? 33 : step === 2 ? 66 : 100

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div
        ref={cardRef}
        className="surf border acc-bd-40 rounded-2xl max-w-lg w-full p-6 space-y-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Modal Close Button */}
        <button
          onClick={() => setWizardOpen(false)}
          aria-label="Fermer l'assistant"
          className="absolute top-4 right-4 ink-mute hover:text-[color:var(--ink)] p-1 cursor-pointer"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Wizard Header */}
        <div className="space-y-1">
          <div className="font-mono-data text-[11px] acc-text uppercase font-bold tracking-wider flex items-center gap-2.5">
            <span className="kicker-mark"></span>
            Assistant Express Urgence Canicule
          </div>
          <h2 className="font-serif-editorial text-2xl ink">Trouvez votre endroit frais idéal</h2>
          <p className="text-xs ink-soft">Répondez à 3 questions rapides pour isoler les meilleurs refuges.</p>
        </div>

        {/* Step Progress Bar */}
        <div className="w-full bg-[color:var(--chip-bg)] h-1.5 rounded-full overflow-hidden border surf-bd">
          <div className="h-full acc-gradient transition-all duration-300" style={{ width: `${progressPercent}%` }} />
        </div>

        {/* Wizard Step 1: Need */}
        {step === 1 && (
          <div className="space-y-4">
            <label className="block font-mono-data text-xs ink-soft uppercase font-bold">1. Quel est votre besoin principal ?</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={() => handleNextUsage('fountain')}
                className="p-3 bg-[color:var(--chip-bg)] border surf-bd hover:border-emerald-400 rounded-xl text-left font-mono-data text-xs space-y-1.5 transition-all cursor-pointer"
              >
                <div className="acc-text font-bold flex items-center gap-2">
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3.5c3 4 5 7 5 9.5a5 5 0 0 1-10 0c0-2.5 2-5.5 5-9.5z"/></svg>
                  Boire de l'eau
                </div>
                <div className="text-[10px] ink-mute">Fontaines d'eau potable gratuites</div>
              </button>

              <button
                onClick={() => handleNextUsage('green_space')}
                className="p-3 bg-[color:var(--chip-bg)] border surf-bd hover:border-emerald-400 rounded-xl text-left font-mono-data text-xs space-y-1.5 transition-all cursor-pointer"
              >
                <div className="acc-text font-bold flex items-center gap-2">
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21v-7.5"/><path d="M6.5 13.5a5.5 5.5 0 0 1 11 0z"/><path d="M8 9.5a4 4 0 0 1 8 0"/></svg>
                  Ombre & sieste au parc
                </div>
                <div className="text-[10px] ink-mute">Parcs, pelouses & canopées</div>
              </button>

              <button
                onClick={() => handleNextUsage('indoor')}
                className="p-3 bg-[color:var(--chip-bg)] border surf-bd hover:border-amber-400 rounded-xl text-left font-mono-data text-xs space-y-1.5 transition-all cursor-pointer"
              >
                <div className="text-amber-700 font-bold flex items-center gap-2">
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M4 9h16"/><path d="M6 9v9.5h12V9"/><path d="M12 4 4 9h16z"/><path d="M9.5 12.5v3M12 12.5v3M14.5 12.5v3"/></svg>
                  Climatisation & culture
                </div>
                <div className="text-[10px] ink-mute">Musées & Médiathèques climatisés</div>
              </button>

              <button
                onClick={() => handleNextUsage('mist')}
                className="p-3 bg-[color:var(--chip-bg)] border surf-bd hover:border-cyan-400 rounded-xl text-left font-mono-data text-xs space-y-1.5 transition-all cursor-pointer"
              >
                <div className="text-cyan-700 font-bold flex items-center gap-2">
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="8" rx="6.5" ry="4"/><path d="M5.5 8v6c0 2.2 2.9 4 6.5 4s6.5-1.8 6.5-4V8"/></svg>
                  Baignade & brume
                </div>
                <div className="text-[10px] ink-mute">Piscines & jeux d'eau</div>
              </button>
            </div>
          </div>
        )}

        {/* Wizard Step 2: Price Choice */}
        {step === 2 && (
          <div className="space-y-4">
            <label className="block font-mono-data text-xs ink-soft uppercase font-bold">2. Quel tarif souhaitez-vous ?</label>
            <div className="space-y-3">
              <button
                onClick={() => handleNextPrice('FREE')}
                className="p-3.5 w-full bg-[color:var(--chip-bg)] border surf-bd hover:border-emerald-400 rounded-xl text-left font-mono-data text-xs space-y-1 transition-all cursor-pointer"
              >
                <div className="acc-text font-bold">100% Gratuit (Accès libre)</div>
                <div className="text-[10px] ink-mute">Fontaines, parcs publics, certains musées</div>
              </button>

              <button
                onClick={() => handleNextPrice('ALL')}
                className="p-3.5 w-full bg-[color:var(--chip-bg)] border surf-bd hover:border-slate-400 rounded-xl text-left font-mono-data text-xs space-y-1 transition-all cursor-pointer"
              >
                <div className="ink font-bold">Sans importance / Tarif Municipal</div>
                <div className="text-[10px] ink-mute">Inclut piscines municipales et musées payants</div>
              </button>
            </div>
          </div>
        )}

        {/* Wizard Step 3: Sector */}
        {step === 3 && (
          <div className="space-y-4">
            <label className="block font-mono-data text-xs ink-soft uppercase font-bold">3. Dans quel secteur de Paris ?</label>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => handleFinish('all')} className="p-3 bg-[color:var(--chip-bg)] border surf-bd hover:border-emerald-400 rounded-xl font-mono-data text-xs font-bold ink cursor-pointer">Tous secteurs</button>
              <button onClick={() => handleFinish('75001')} className="p-3 bg-[color:var(--chip-bg)] border surf-bd hover:border-emerald-400 rounded-xl font-mono-data text-xs ink-soft cursor-pointer">75001 - Centre</button>
              <button onClick={() => handleFinish('75006')} className="p-3 bg-[color:var(--chip-bg)] border surf-bd hover:border-emerald-400 rounded-xl font-mono-data text-xs ink-soft cursor-pointer">75006 - Luxembourg</button>
              <button onClick={() => handleFinish('75019')} className="p-3 bg-[color:var(--chip-bg)] border surf-bd hover:border-emerald-400 rounded-xl font-mono-data text-xs ink-soft cursor-pointer">75019 - Buttes-Chaumont</button>
            </div>
          </div>
        )}

        {/* Wizard Footer */}
        <div className="flex items-center justify-between border-t surf-bd pt-4 font-mono-data text-xs">
          <button
            onClick={() => setStep((s) => (s > 1 ? (s - 1 as 1 | 2) : 1))}
            disabled={step === 1}
            className="ink-mute hover:text-[color:var(--ink)] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
          >
            ← Étape précédente
          </button>
          <span className="ink-mute">Étape {step} sur 3</span>
        </div>
      </div>
    </div>
  )
}
