export function Footer() {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <footer className="max-w-7xl mx-auto px-4 sm:px-8 pt-10 pb-14">
      <div data-reveal className="border-t surf-bd pt-8 grid grid-cols-1 sm:grid-cols-3 gap-8 font-mono-data text-xs ink-mute">
        <div className="space-y-2">
          <div className="flex items-center gap-2.5 acc-text uppercase tracking-wider font-semibold">
            <span className="kicker-mark"></span>
            <span>Méthodologie</span>
          </div>
          <p className="ink-soft leading-relaxed">
            L'indice de fraîcheur combine couverture arborée, présence de points d'eau et exposition solaire déclarée par site. Les 172 années de warming stripes utilisent une anomalie relative à la référence 1850 à des fins d'illustration.
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2.5 acc-text uppercase tracking-wider font-semibold">
            <span className="kicker-mark"></span>
            <span>Sources</span>
          </div>
          <p className="ink-soft leading-relaxed">
            Open Data Paris — jeux de données « Îlots de fraîcheur, équipements & activités », « Fontaines à boire » et « Espaces verts ».
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2.5 acc-text uppercase tracking-wider font-semibold">
            <span className="kicker-mark"></span>
            <span>À propos</span>
          </div>
          <p className="ink-soft leading-relaxed">
            Rapport indépendant réalisé à titre éditorial. Vérifiez les horaires en période de canicule, certains sites adaptent leurs accès.
          </p>
        </div>
      </div>

      <div className="border-t surf-bd mt-8 pt-5 flex flex-wrap items-center justify-between gap-3 font-mono-data text-[11px] ink-mute">
        <span>Paris Climate Refuge Index — édition 2026</span>
        <button onClick={scrollToTop} className="acc-hover-text transition-colors cursor-pointer">
          Retour en haut ↑
        </button>
      </div>
    </footer>
  )
}
