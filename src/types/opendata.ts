/**
 * Raw DTOs for the Open Data Paris Explore API v2.1.
 *
 * These mirror the wire format exactly — including its inconsistent casing,
 * per-dataset geo-point field names and pervasive nullability — and are consumed
 * only by the adapters in `src/services/normalizers.ts`.
 *
 * Verified against the live API (August 2026). Every field is optional on
 * purpose: Open Data Paris ships schema changes without notice, and a missing
 * column must degrade a single record, never crash the page.
 */

export interface OpenDataGeoPoint {
  lon: number
  lat: number
}

export interface OpenDataResponse<TRecord> {
  total_count: number
  results: TRecord[]
}

/**
 * Dataset: `fontaines-a-boire` (~1 325 records).
 * Geo point field: `geo_point_2d`.
 */
export interface FountainDTO {
  gid?: string | number | null
  /** e.g. `BORNE_FONTAINE`, `FONTAINE_ARCEAU`. */
  type_objet?: string | null
  /** e.g. `GHM Ville de Paris`, `Wallace`. */
  modele?: string | null
  no_voirie_pair?: string | number | null
  no_voirie_impair?: string | number | null
  voie?: string | null
  /** e.g. `PARIS 14EME ARRONDISSEMENT`. */
  commune?: string | null
  /** Availability: `OUI` / `NON`. `NON` means currently out of service. */
  dispo?: string | null
  /** Reason for unavailability, e.g. `APP A REPARER`. */
  motif_ind?: string | null
  geo_point_2d?: OpenDataGeoPoint | null
}

/**
 * Dataset: `espaces_verts` (~2 534 records).
 * NOTE: the geo point is `geom_x_y`, *not* `geo_point_2d`, and there is no
 * `arrondissement` column — the postal code lives in `adresse_codepostal`.
 * The `geom` MultiPolygon column is deliberately excluded via `select`.
 */
export interface GreenSpaceDTO {
  nsq_espace_vert?: string | number | null
  nom_ev?: string | null
  /** e.g. `Jardin`, `Square`, `Promenade ouverte`. */
  type_ev?: string | null
  /** e.g. `Jardiniere`, `Bois`. */
  categorie?: string | null
  adresse_numero?: string | number | null
  adresse_typevoie?: string | null
  adresse_libellevoie?: string | null
  /** e.g. `75020`. */
  adresse_codepostal?: string | null
  /** Free text such as `Ouvert 24h` — frequently null. */
  ouvert_ferme?: string | null
  annee_ouverture?: string | null
  geom_x_y?: OpenDataGeoPoint | null
}

/**
 * Dataset: `ilots-de-fraicheur-equipements-activites` (~531 records) — the
 * City of Paris' own curated list of cool indoor spots (churches, museums,
 * libraries, pools). Geo point field: `geo_point_2d`.
 */
export interface CoolFacilityDTO {
  identifiant?: string | null
  nom?: string | null
  /** e.g. `Lieux de culte`, `Musée`, `Bibliothèque`. */
  type?: string | null
  /** `Oui` / `Non`. */
  payant?: string | null
  adresse?: string | null
  /** Already a postal code, e.g. `75017`. */
  arrondissement?: string | null
  statut_ouverture?: string | null
  horaires_periode?: string | null
  geo_point_2d?: OpenDataGeoPoint | null
}
