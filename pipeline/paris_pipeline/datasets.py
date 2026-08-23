"""Declarative registry of the Open Data Paris datasets we ingest.

Adding a source is a single entry here plus an adapter in ``normalize`` -- the
same shape the front-end registry used, so the two stay comparable.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable, Sequence

from .normalize import CoolSpot, adapt_cool_facility, adapt_fountain, adapt_green_space


@dataclass(frozen=True, slots=True)
class Dataset:
    slug: str
    label: str
    max_records: int
    adapt: Callable[[dict[str, Any], int], CoolSpot]
    required: bool
    # Server-side projection. Critical for espaces_verts, whose `geom`
    # MultiPolygon column alone is several hundred KB per page.
    select: Sequence[str] | None = None


FOUNTAINS = Dataset(
    slug="fontaines-a-boire",
    label="Fontaines a boire",
    max_records=1_400,  # slightly above the current total_count (~1 325)
    adapt=adapt_fountain,
    required=True,
)

GREEN_SPACES = Dataset(
    slug="espaces_verts",
    label="Espaces verts",
    max_records=2_600,  # slightly above the current total_count (~2 534)
    adapt=adapt_green_space,
    required=True,
    select=(
        "nsq_espace_vert",
        "nom_ev",
        "type_ev",
        "categorie",
        "adresse_numero",
        "adresse_typevoie",
        "adresse_libellevoie",
        "adresse_codepostal",
        "ouvert_ferme",
        "geom_x_y",
    ),
)

COOL_FACILITIES = Dataset(
    slug="ilots-de-fraicheur-equipements-activites",
    label="Equipements et activites",
    max_records=600,
    adapt=adapt_cool_facility,
    required=False,
)

ALL_DATASETS: tuple[Dataset, ...] = (FOUNTAINS, GREEN_SPACES, COOL_FACILITIES)

BY_SLUG: dict[str, Dataset] = {d.slug: d for d in ALL_DATASETS}
