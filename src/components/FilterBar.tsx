import type {
  AvailabilityFilter,
  CoolSpotCategory,
  CoolSpotFilter,
  PriceFilter,
  SortableColumn,
  SortState,
} from '../types/coolspot'

export interface FilterBarProps {
  filters: CoolSpotFilter
  sort: SortState
  favoritesCount: number
  availableArrondissements: readonly string[]
  disabled: boolean
  onFilterChange: <K extends keyof CoolSpotFilter>(key: K, value: CoolSpotFilter[K]) => void
  onSortChange: (column: SortableColumn) => void
  onReset: () => void
}

const CATEGORY_PILLS: { label: string; cat: CoolSpotCategory | 'all' }[] = [
  { label: 'Tous les Refuges', cat: 'all' },
  { label: 'Parcs & Canopée', cat: 'green_space' },
  { label: "Fontaines d'Eau Potable", cat: 'fountain' },
  { label: 'Lieux Climatisés', cat: 'indoor' },
  { label: 'Baignade & Brumisateur', cat: 'mist' },
]

export function FilterBar({
  filters,
  sort,
  favoritesCount,
  availableArrondissements,
  disabled,
  onFilterChange,
  onSortChange,
  onReset,
}: FilterBarProps) {
  return (
    <div className="surf border surf-bd rounded-lg p-6 sm:p-8 space-y-6 shadow-sm">
      {/* Top Row: Search & Dropdowns */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-end justify-between gap-5 pb-6 border-b surf-bd">
        {/* Search input */}
        <div className="relative flex-1 max-w-md">
          <label htmlFor="search-input" className="sr-only">
            Rechercher un îlot de fraîcheur
          </label>
          <input
            id="search-input"
            type="text"
            value={filters.query}
            disabled={disabled}
            onChange={(e) => onFilterChange('query', e.target.value)}
            placeholder="Rechercher un nom, une rue, un arrondissement…"
            className="w-full pb-2 bg-transparent border-b surf-bd focus:acc-bd rounded-none text-sm ink placeholder:ink-mute focus:outline-none transition-colors"
          />
        </div>

        {/* Filter Selectors */}
        <div className="flex flex-wrap items-end gap-6 font-mono-data text-[11px] ink-mute uppercase tracking-wide">
          {/* Arrondissement Select */}
          <div className="flex flex-col">
            <span className="text-[9px] mb-1">Arrondissement</span>
            <select
              id="arr-select"
              value={filters.arrondissement}
              disabled={disabled}
              onChange={(e) => onFilterChange('arrondissement', e.target.value)}
              className="pb-2 bg-transparent border-b surf-bd focus:acc-bd rounded-none ink-soft focus:outline-none transition-colors cursor-pointer"
            >
              <option value="all">Tous les arrondissements</option>
              {availableArrondissements.map((arr) => {
                const n = Number(arr.slice(-2))
                return (
                  <option key={arr} value={arr}>
                    {arr} — Paris {n === 1 ? '1er' : `${n}e`}
                  </option>
                )
              })}
            </select>
          </div>

          {/* Availability Select */}
          <div className="flex flex-col">
            <span className="text-[9px] mb-1">Disponibilité</span>
            <select
              id="avail-select"
              value={filters.availability}
              disabled={disabled}
              onChange={(e) => onFilterChange('availability', e.target.value as AvailabilityFilter)}
              className="pb-2 bg-transparent border-b surf-bd focus:acc-bd rounded-none ink-soft focus:outline-none transition-colors cursor-pointer"
            >
              <option value="ALL">Tous les horaires</option>
              <option value="OPEN_NOW">Ouvert actuellement</option>
              <option value="247">Accessible 24h/24</option>
            </select>
          </div>

          {/* Price Select */}
          <div className="flex flex-col">
            <span className="text-[9px] mb-1">Tarif</span>
            <select
              id="price-select"
              value={filters.price}
              disabled={disabled}
              onChange={(e) => onFilterChange('price', e.target.value as PriceFilter)}
              className="pb-2 bg-transparent border-b surf-bd focus:acc-bd rounded-none ink-soft focus:outline-none transition-colors cursor-pointer"
            >
              <option value="ALL">Tous les tarifs</option>
              <option value="FREE">100% Gratuit</option>
              <option value="MUNICIPAL">Tarif Municipal / Payant</option>
            </select>
          </div>

          {/* Favorites-only Toggle */}
          <button
            id="btn-favorites-only"
            disabled={disabled}
            onClick={() => onFilterChange('favoritesOnly', !filters.favoritesOnly)}
            className={`pb-2 transition-colors cursor-pointer ${
              filters.favoritesOnly ? 'acc-text font-bold border-b-2 acc-bd' : 'ink-mute hover:ink'
            }`}
          >
            ★ Favoris {favoritesCount > 0 ? `(${favoritesCount})` : ''}
          </button>

          {/* Reset button */}
          <button
            id="btn-reset"
            disabled={disabled}
            onClick={onReset}
            className="pb-2 ink-mute hover:ink transition-colors cursor-pointer"
          >
            Réinitialiser
          </button>
        </div>
      </div>

      {/* Bottom Row: Category Pills & Sort Dropdown */}
      <div className="flex flex-wrap items-center justify-between gap-5">
        <div id="category-pills" className="flex flex-wrap items-center gap-x-6 gap-y-2 font-mono-data text-xs">
          {CATEGORY_PILLS.map((pill) => {
            const isActive = filters.category === pill.cat
            return (
              <button
                key={pill.cat}
                onClick={() => onFilterChange('category', pill.cat)}
                className={`pill-btn pb-1 border-b-2 transition-colors cursor-pointer ${
                  isActive ? 'acc-bd acc-text font-bold' : 'border-transparent ink-mute hover:ink'
                }`}
              >
                {pill.label}
              </button>
            )
          })}
        </div>

        {/* Sort dropdown */}
        <div className="flex items-center gap-2 text-xs font-mono-data ink-mute">
          <span className="uppercase tracking-wide">Trier par</span>
          <select
            id="sort-select"
            value={sort.column}
            onChange={(e) => onSortChange(e.target.value as SortableColumn)}
            className="bg-transparent ink-soft focus:outline-none cursor-pointer"
          >
            <option value="canopyScore">Indice de Fraîcheur</option>
            <option value="name">Nom (A → Z)</option>
            <option value="arrondissement">Arrondissement</option>
          </select>
        </div>
      </div>
    </div>
  )
}
