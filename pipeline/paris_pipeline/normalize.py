"""Normalization of raw Open Data Paris records into the CoolSpot contract.

This is a deliberate port of ``frontend/src/services/normalizers.ts``. The
dashboard used to normalize in the browser; moving the same rules server-side
means the API, the warehouse and the UI all agree on one definition of a spot.

The rules are kept faithful to the TypeScript original -- including
``hash_score``'s Java-style 32-bit hash -- so migrating a spot from the old
client-side path to the API does not silently change its id or its score.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any, Iterable, Literal

Category = Literal["fountain", "green_space", "indoor", "mist"]

PARIS_ARRONDISSEMENTS = {f"750{n:02d}" for n in range(1, 21)}

_POSTAL_RE = re.compile(r"\b(75[0-1]\d{2})\b")
_ORDINAL_RE = re.compile(r"\b(\d{1,2})\s*(?:ER|E|EME|ÈME)?\b", re.IGNORECASE)
_WHITESPACE_RE = re.compile(r"\s+")
_LETTER_RE = re.compile(r"[^\W\d_]", re.UNICODE)
_TITLE_BOUNDARY_RE = re.compile(r"(^|[\s'’(-])([^\W\d_])", re.UNICODE)


@dataclass(frozen=True, slots=True)
class CoolSpot:
    """One normalized cool spot, field-for-field with the TypeScript type."""

    id: str
    name: str
    category: Category
    arrondissement: str | None
    address: str
    is_free: bool
    price: Literal["FREE", "MUNICIPAL"]
    lat: float | None
    lon: float | None
    opening_hours: str | None
    is_open_now: bool
    canopy_score: int
    water_access: bool
    shade_level: str
    features: tuple[str, ...] = field(default=())
    source: str = ""


# --------------------------------------------------------------------------- #
#  Field-level helpers                                                        #
# --------------------------------------------------------------------------- #


def normalize_arrondissement(*candidates: Any) -> str | None:
    """Resolve the first candidate that looks like a Paris arrondissement.

    Accepts a postal code (``75011``) or an ordinal (``11e``). ``75116`` is the
    Passy half of the 16th and is folded into ``75016``.
    """
    for candidate in candidates:
        if candidate is None:
            continue
        raw = str(candidate).strip()
        if not raw:
            continue

        postal = _POSTAL_RE.search(raw)
        if postal:
            code = postal.group(1)
            if code == "75116":
                return "75016"
            if code in PARIS_ARRONDISSEMENTS:
                return code

        ordinal = _ORDINAL_RE.search(raw)
        if ordinal:
            n = int(ordinal.group(1))
            if 1 <= n <= 20:
                return f"750{n:02d}"
    return None


def to_coordinates(point: Any) -> tuple[float | None, float | None]:
    """Extract ``(lat, lon)`` from an Open Data geo point, or ``(None, None)``."""
    if not isinstance(point, dict):
        return None, None
    lat, lon = point.get("lat"), point.get("lon")
    if not isinstance(lat, (int, float)) or not isinstance(lon, (int, float)):
        return None, None
    if isinstance(lat, bool) or isinstance(lon, bool):
        return None, None
    # NaN is the one float that is not equal to itself.
    if lat != lat or lon != lon:
        return None, None
    return float(lat), float(lon)


def clean(value: Any) -> str:
    """Collapse whitespace and treat the dataset's null placeholders as empty."""
    if value is None:
        return ""
    text = _WHITESPACE_RE.sub(" ", str(value).strip())
    return "" if text in ("null", "-") else text


def join_address(*parts: Any) -> str:
    """Join address fragments, dropping empties and bare zeroes."""
    joined = " ".join(p for p in (clean(x) for x in parts) if p not in ("", "0"))
    return joined or "Adresse non renseignée"


def is_code_like(value: str) -> bool:
    """True when a name is really an internal code (fewer than 3 letters)."""
    if not value:
        return False
    return len(_LETTER_RE.findall(value)) < 3


def to_title_case(value: str) -> str:
    """Title-case SHOUTED source values, leaving already-cased text alone."""
    if value != value.upper():
        return value
    lowered = value.lower()
    return _TITLE_BOUNDARY_RE.sub(lambda m: m.group(1) + m.group(2).upper(), lowered)


def hash_score(identifier: str, minimum: int, maximum: int) -> int:
    """Deterministic score in ``[minimum, maximum]`` derived from an id.

    Reproduces JavaScript's ``(hash << 5) - hash + code | 0`` exactly, including
    the wrap to a signed 32-bit integer, so ids scored in the old browser path
    keep the same value after the move to the pipeline.
    """
    hashed = 0
    for char in identifier:
        hashed = (hashed << 5) - hashed + ord(char)
        # Mask to 32 bits, then reinterpret as signed -- JS's `| 0`.
        hashed &= 0xFFFFFFFF
        if hashed >= 0x80000000:
            hashed -= 0x100000000
    span = maximum - minimum + 1
    return minimum + abs(hashed) % span


# --------------------------------------------------------------------------- #
#  Per-dataset adapters                                                       #
# --------------------------------------------------------------------------- #


def adapt_fountain(dto: dict[str, Any], index: int) -> CoolSpot:
    """Adapt one ``fontaines-a-boire`` record."""
    model = (
        clean(dto.get("modele"))
        or clean(dto.get("type_objet")).replace("_", " ")
        or "Fontaine à boire"
    )
    out_of_service = clean(dto.get("dispo")).upper() == "NON"
    reason = clean(dto.get("motif_ind"))
    spot_id = f"fountain:{clean(dto.get('gid')) or index}"
    lat, lon = to_coordinates(dto.get("geo_point_2d"))

    if out_of_service:
        hours = "Hors service" + (f" — {to_title_case(reason)}" if reason else "")
    else:
        hours = "Accessible 24h/24"

    return CoolSpot(
        id=spot_id,
        name=to_title_case(model),
        category="fountain",
        arrondissement=normalize_arrondissement(dto.get("commune")),
        address=join_address(
            dto.get("no_voirie_pair") or dto.get("no_voirie_impair"), dto.get("voie")
        ),
        is_free=True,
        price="FREE",
        lat=lat,
        lon=lon,
        opening_hours=hours,
        is_open_now=not out_of_service,
        canopy_score=hash_score(spot_id, 35, 55),
        water_access=True,
        shade_level="Point d'eau fraîche continuous",
        features=("Eau potable testée", "Accès libre 24h", "Point d'eau gratuit"),
        source="fontaines-a-boire",
    )


def adapt_green_space(dto: dict[str, Any], index: int) -> CoolSpot:
    """Adapt one ``espaces_verts`` record."""
    kind = clean(dto.get("type_ev")) or clean(dto.get("categorie"))
    hours = clean(dto.get("ouvert_ferme"))
    raw_name = clean(dto.get("nom_ev"))
    name = kind or "Espace vert" if is_code_like(raw_name) else (raw_name or kind or "Espace vert")
    spot_id = f"green:{clean(dto.get('nsq_espace_vert')) or index}"
    lat, lon = to_coordinates(dto.get("geom_x_y"))
    night_open = "24h" in hours.lower() or "nuit" in hours.lower()

    return CoolSpot(
        id=spot_id,
        name=to_title_case(name),
        category="green_space",
        arrondissement=normalize_arrondissement(dto.get("adresse_codepostal")),
        address=join_address(
            dto.get("adresse_numero"),
            dto.get("adresse_typevoie"),
            dto.get("adresse_libellevoie"),
        ),
        is_free=True,
        price="FREE",
        lat=lat,
        lon=lon,
        opening_hours=to_title_case(hours) if hours else "Horaires municipaux",
        is_open_now=True,
        canopy_score=hash_score(spot_id, 80, 98),
        water_access=True,
        shade_level="Canopée végétale dense & ombre",
        features=(
            "Bancs ombragés",
            "Arbres majeurs centenaires",
            "Ouvert la nuit" if night_open else "Pelouses fraîches",
            "Zone végétale",
        ),
        source="espaces_verts",
    )


def adapt_cool_facility(dto: dict[str, Any], index: int) -> CoolSpot:
    """Adapt one ``ilots-de-fraicheur-equipements-activites`` record."""
    paying = clean(dto.get("payant")).upper()
    kind = clean(dto.get("type"))
    kind_lower = kind.lower()
    spot_id = f"facility:{clean(dto.get('identifiant')) or index}"
    lat, lon = to_coordinates(dto.get("geo_point_2d"))

    category: Category = "indoor"
    if any(k in kind_lower for k in ("baignade", "piscine", "brumisateur")):
        category = "mist"

    is_free = paying == "NON"

    return CoolSpot(
        id=spot_id,
        name=to_title_case(clean(dto.get("nom")) or kind or "Lieu frais"),
        category=category,
        arrondissement=normalize_arrondissement(dto.get("arrondissement"), dto.get("adresse")),
        address=join_address(dto.get("adresse")),
        is_free=is_free,
        price="FREE" if is_free else "MUNICIPAL",
        lat=lat,
        lon=lon,
        opening_hours=clean(dto.get("horaires_periode")) or kind or "Horaires d'ouverture variables",
        is_open_now=True,
        canopy_score=(
            hash_score(spot_id, 75, 96) if category == "mist" else hash_score(spot_id, 65, 90)
        ),
        water_access=category == "mist" or "eau" in kind_lower,
        shade_level=(
            "Bassin & brumisation haute pression"
            if category == "mist"
            else "Climatisation 21°C"
        ),
        features=(
            "Bassin / Jeux d'eau" if category == "mist" else "Espace climatisé",
            "Accès libre gratuit" if is_free else "Tarif municipal",
            "Accès PMR",
        ),
        source="ilots-de-fraicheur-equipements-activites",
    )


def dedupe(spots: Iterable[CoolSpot]) -> list[CoolSpot]:
    """Keep the first spot per id. Ids are namespaced, so collisions are
    intra-dataset only -- a genuine duplicate in the source."""
    by_id: dict[str, CoolSpot] = {}
    for spot in spots:
        by_id.setdefault(spot.id, spot)
    return list(by_id.values())
