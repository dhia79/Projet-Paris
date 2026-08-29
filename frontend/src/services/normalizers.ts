import type { CoolSpot, CoolSpotCategory, GeoCoordinates } from '../types/coolspot'
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

export function normalizeArrondissement(
  ...candidates: (string | number | null | undefined)[]
): string | null {
  for (const candidate of candidates) {
    if (candidate === null || candidate === undefined) continue
    const raw = String(candidate).trim()
    if (!raw) continue

    const postal = raw.match(/\b(75[0-1]\d{2})\b/)
    if (postal?.[1]) {
      if (postal[1] === '75116') return '75016'
      if (PARIS_ARRONDISSEMENTS.has(postal[1])) return postal[1]
    }

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

function clean(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  const text = String(value).trim().replace(/\s+/g, ' ')
  return text === 'null' || text === '-' ? '' : text
}

function joinAddress(...parts: (string | number | null | undefined)[]): string {
  const joined = parts
    .map(clean)
    .filter((part) => part !== '' && part !== '0')
    .join(' ')
  return joined || 'Adresse non renseignée'
}

function isCodeLike(value: string): boolean {
  if (value === '') return false
  return (value.match(/\p{L}/gu) ?? []).length < 3
}

function toTitleCase(value: string): string {
  if (value !== value.toUpperCase()) return value
  return value
    .toLowerCase()
    .replace(/(^|[\s'’(-])(\p{L})/gu, (_, sep: string, char: string) => sep + char.toUpperCase())
}

/** Generates a reproducible integer score (30..98) based on string ID hash */
function hashScore(id: string, min: number, max: number): number {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i)
    hash |= 0
  }
  const norm = Math.abs(hash) % (max - min + 1)
  return min + norm
}

/* -------------------------------------------------------------------------- */
/* Per-dataset adapters                                                       */
/* -------------------------------------------------------------------------- */

export function adaptFountain(dto: FountainDTO, index: number): CoolSpot {
  const model = clean(dto.modele) || clean(dto.type_objet).replace(/_/g, ' ') || 'Fontaine à boire'
  const outOfService = clean(dto.dispo).toUpperCase() === 'NON'
  const reason = clean(dto.motif_ind)
  const id = `fountain:${clean(dto.gid) || index}`

  return {
    id,
    name: toTitleCase(model),
    category: 'fountain',
    arrondissement: normalizeArrondissement(dto.commune),
    address: joinAddress(dto.no_voirie_pair || dto.no_voirie_impair, dto.voie),
    isFree: true,
    price: 'FREE',
    coordinates: toCoordinates(dto.geo_point_2d),
    openingHours: outOfService
      ? `Hors service${reason ? ` — ${toTitleCase(reason)}` : ''}`
      : 'Accessible 24h/24',
    isOpenNow: !outOfService,
    canopyScore: hashScore(id, 35, 55),
    waterAccess: true,
    shadeLevel: "Point d'eau fraîche continuous",
    features: ['Eau potable testée', 'Accès libre 24h', 'Point d\'eau gratuit'],
    source: 'fontaines-a-boire',
  }
}

/** `ouvert_ferme` is an Oui/Non 24h flag, not a schedule: never surface it raw. */
function greenSpaceHours(raw: string): string {
  const value = raw.trim().toLowerCase()
  if (!value) return 'Horaires municipaux'
  if (value === 'oui') return 'Ouvert 24h/24'
  if (value === 'non') return 'Fermeture nocturne (horaires municipaux)'
  return toTitleCase(raw)
}

export function adaptGreenSpace(dto: GreenSpaceDTO, index: number): CoolSpot {
  const kind = clean(dto.type_ev) || clean(dto.categorie)
  const hours = clean(dto.ouvert_ferme)
  const rawName = clean(dto.nom_ev)
  const name = isCodeLike(rawName) ? kind || 'Espace vert' : rawName || kind || 'Espace vert'
  const id = `green:${clean(dto.nsq_espace_vert) || index}`
  const isNightOpen = hours.toLowerCase().includes('24h') || hours.toLowerCase().includes('nuit')

  return {
    id,
    name: toTitleCase(name),
    category: 'green_space',
    arrondissement: normalizeArrondissement(dto.adresse_codepostal),
    address: joinAddress(dto.adresse_numero, dto.adresse_typevoie, dto.adresse_libellevoie),
    isFree: true,
    price: 'FREE',
    coordinates: toCoordinates(dto.geom_x_y),
    openingHours: greenSpaceHours(hours),
    isOpenNow: true,
    canopyScore: hashScore(id, 80, 98),
    waterAccess: true,
    shadeLevel: 'Canopée végétale dense & ombre',
    features: [
      'Bancs ombragés',
      'Arbres majeurs centenaires',
      isNightOpen ? 'Ouvert la nuit' : 'Pelouses fraîches',
      'Zone végétale',
    ],
    source: 'espaces_verts',
  }
}

export function adaptCoolFacility(dto: CoolFacilityDTO, index: number): CoolSpot {
  const paying = clean(dto.payant).toUpperCase()
  const kind = clean(dto.type)
  const kindLower = kind.toLowerCase()
  const id = `facility:${clean(dto.identifiant) || index}`

  let category: CoolSpotCategory = 'indoor'
  if (kindLower.includes('baignade') || kindLower.includes('piscine') || kindLower.includes('brumisateur')) {
    category = 'mist'
  }

  const isFree = paying === 'NON'
  const price: 'FREE' | 'MUNICIPAL' = isFree ? 'FREE' : 'MUNICIPAL'

  return {
    id,
    name: toTitleCase(clean(dto.nom) || kind || 'Lieu frais'),
    category,
    arrondissement: normalizeArrondissement(dto.arrondissement, dto.adresse),
    address: joinAddress(dto.adresse),
    isFree,
    price,
    coordinates: toCoordinates(dto.geo_point_2d),
    openingHours: clean(dto.horaires_periode) || kind || 'Horaires d\'ouverture variables',
    isOpenNow: true,
    canopyScore: category === 'mist' ? hashScore(id, 75, 96) : hashScore(id, 65, 90),
    waterAccess: category === 'mist' || kindLower.includes('eau'),
    shadeLevel: category === 'mist' ? 'Bassin & brumisation haute pression' : 'Climatisation 21°C',
    features: [
      category === 'mist' ? 'Bassin / Jeux d\'eau' : 'Espace climatisé',
      isFree ? 'Accès libre gratuit' : 'Tarif municipal',
      'Accès PMR',
    ],
    source: 'ilots-de-fraicheur-equipements-activites',
  }
}
