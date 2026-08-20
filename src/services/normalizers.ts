import type { CoolSpot, GeoCoordinates } from '../types/coolspot'
import type {
  CoolFacilityDTO,
  FountainDTO,
  GreenSpaceDTO,
  OpenDataGeoPoint,
} from '../types/opendata'

/* -------------------------------------------------------------------------- */
/* Shared field-level helpers                                                 */
/* -------------------------------------------------------------------------- */

const PARIS_ARRONDISSEMENTS = new Set(
  Array.from({ length: 20 }, (_, i) => `750${String(i + 1).padStart(2, '0')}`),
)

/**
 * Returns `75001`..`75020`, or `null` when nothing recognizable is present.
 *
 * The three datasets each encode the arrondissement differently — a postal code
 * (`75017`), a sentence (`PARIS 14EME ARRONDISSEMENT`), or nothing at all — so
 * candidates are tried in order of reliability.
 */
export function normalizeArrondissement(
  ...candidates: (string | number | null | undefined)[]
): string | null {
  for (const candidate of candidates) {
    if (candidate === null || candidate === undefined) continue
    const raw = String(candidate).trim()
    if (!raw) continue

    // 1. A Paris postal code, possibly embedded in a longer string.
    const postal = raw.match(/\b(75[0-1]\d{2})\b/)
    if (postal?.[1]) {
      // `75116` is the alternate postal code for the 16th arrondissement.
      if (postal[1] === '75116') return '75016'
      if (PARIS_ARRONDISSEMENTS.has(postal[1])) return postal[1]
    }

    // 2. Textual forms: `PARIS 14EME ARRONDISSEMENT`, `11e`, `1er`, bare number.
    const ordinal = raw.match(/\b(\d{1,2})\s*(?:ER|E|EME|ÈME)?\b/i)
    if (ordinal?.[1]) {
      const n = Number(ordinal[1])
      if (n >= 1 && n <= 20) return `750${String(n).padStart(2, '0')}`
    }
  }
  return null
}

export function toCoordinates(point: OpenDataGeoPoint | null | undefined): GeoCoordinates | null {
  if (!point || typeof point.lat !== 'number' || typeof point.lon !== 'number') return null
  if (Number.isNaN(point.lat) || Number.isNaN(point.lon)) return null
  return { lat: point.lat, lon: point.lon }
}

/** Collapses whitespace and drops empty / placeholder values. */
function clean(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  const text = String(value).trim().replace(/\s+/g, ' ')
  return text === 'null' || text === '-' ? '' : text
}

function joinAddress(...parts: (string | number | null | undefined)[]): string {
  const joined = parts
    .map(clean)
    // `0` is Open Data Paris' placeholder for "no street number", not a real one.
    .filter((part) => part !== '' && part !== '0')
    .join(' ')
  return joined || 'Adresse non renseignée'
}

/**
 * True for values that are internal references rather than names, e.g. the
 * `00-03` / `17-05b` / `31-09_j` codes `espaces_verts` uses for périphérique
 * plantings. Fewer than three letters means there is no real word in there.
 */
function isCodeLike(value: string): boolean {
  if (value === '') return false
  return (value.match(/\p{L}/gu) ?? []).length < 3
}

/** Title-cases the SCREAMING-CASE labels Open Data Paris frequently returns. */
function toTitleCase(value: string): string {
  if (value !== value.toUpperCase()) return value // already human-cased, leave it alone
  return value
    .toLowerCase()
    .replace(/(^|[\s'’(-])(\p{L})/gu, (_, sep: string, char: string) => sep + char.toUpperCase())
}

/* -------------------------------------------------------------------------- */
/* Per-dataset adapters                                                       */
/* -------------------------------------------------------------------------- */

export function adaptFountain(dto: FountainDTO, index: number): CoolSpot {
  const model = clean(dto.modele) || clean(dto.type_objet).replace(/_/g, ' ') || 'Fontaine à boire'
  const outOfService = clean(dto.dispo).toUpperCase() === 'NON'
  const reason = clean(dto.motif_ind)

  return {
    id: `fountain:${clean(dto.gid) || index}`,
    name: toTitleCase(model),
    category: 'fountain',
    arrondissement: normalizeArrondissement(dto.commune),
    address: joinAddress(dto.no_voirie_pair || dto.no_voirie_impair, dto.voie),
    isFree: true, // Municipal drinking fountains are always free.
    coordinates: toCoordinates(dto.geo_point_2d),
    // `dispo`/`motif_ind` carry availability, which is what a user in a heat wave
    // actually needs from this column.
    openingHours: outOfService
      ? `Hors service${reason ? ` — ${toTitleCase(reason)}` : ''}`
      : 'Accès libre',
    source: 'fontaines-a-boire',
  }
}

export function adaptGreenSpace(dto: GreenSpaceDTO, index: number): CoolSpot {
  const kind = clean(dto.type_ev) || clean(dto.categorie)
  const hours = clean(dto.ouvert_ferme)

  // Some records (périphérique plantings) carry an internal code like `00-03`
  // as their name — fall back to the type so the row stays readable.
  const rawName = clean(dto.nom_ev)
  const name = isCodeLike(rawName) ? kind || 'Espace vert' : rawName || kind || 'Espace vert'

  return {
    id: `green:${clean(dto.nsq_espace_vert) || index}`,
    name: toTitleCase(name),
    category: 'green_space',
    // This dataset has no arrondissement column — the postal code is the only signal.
    arrondissement: normalizeArrondissement(dto.adresse_codepostal),
    address: joinAddress(dto.adresse_numero, dto.adresse_typevoie, dto.adresse_libellevoie),
    isFree: true, // Municipal parks and gardens have free access.
    coordinates: toCoordinates(dto.geom_x_y),
    openingHours: hours ? toTitleCase(hours) : kind ? toTitleCase(kind) : null,
    source: 'espaces_verts',
  }
}

export function adaptCoolFacility(dto: CoolFacilityDTO, index: number): CoolSpot {
  const paying = clean(dto.payant).toUpperCase()
  const kind = clean(dto.type)

  return {
    id: `facility:${clean(dto.identifiant) || index}`,
    name: toTitleCase(clean(dto.nom) || kind || 'Lieu frais'),
    category: 'indoor',
    arrondissement: normalizeArrondissement(dto.arrondissement, dto.adresse),
    address: joinAddress(dto.adresse),
    // Only an explicit `Non` counts as free, so the "free only" filter never over-promises.
    isFree: paying === 'NON',
    coordinates: toCoordinates(dto.geo_point_2d),
    // `statut_ouverture` is a bare `Oui`/`Non` flag, useless as displayed text —
    // fall back to the venue type instead.
    openingHours: clean(dto.horaires_periode) || kind || null,
    source: 'ilots-de-fraicheur-equipements-activites',
  }
}
