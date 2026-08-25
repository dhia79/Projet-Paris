"""Canopy scoring from the Paris tree register.

The dashboard's ``canopyScore`` used to be a hash of the record id -- stable and
plausible-looking, but it measured nothing, so anything computed on top of it
(the vulnerability index, the k-means clusters) was decorative.

This module replaces it with a measurement: how many registered trees stand
within ``RADIUS_M`` of the spot, taken from the city's ``les-arbres`` dataset
(~200k trees). A shaded square in the 12th and a bare plaza in the 8th now score
differently because they *are* different, not because their ids hash apart.

The score is deliberately relative to Paris rather than absolute: the busiest
300 m circle in the city defines 100. An absolute trees-per-hectare figure would
be more portable but far less readable on a dashboard.

One correction is load-bearing. The register covers trees the City *manages* --
street alignments, gardens, cemeteries -- and does not inventory the woodland of
the Bois de Boulogne and the Bois de Vincennes. Measured naively, the two
coolest places in Paris score near zero: a probe at the lac Daumesnil finds 49
registered trees against 1 774 at the Champ de Mars. So spots falling inside
either Bois are treated as fully shaded, from the two woodland polygons the
`espaces_verts` dataset does publish.
"""

from __future__ import annotations

import logging
import math
from collections import defaultdict
from collections.abc import Iterable, Sequence
from dataclasses import replace
from typing import Any, NamedTuple

from .normalize import Category, CoolSpot, normalize_arrondissement

log = logging.getLogger(__name__)

#: Roughly a four-minute walk -- the distance over which nearby shade actually
#: changes how a place feels.
RADIUS_M = 300

#: Metres per degree of latitude. Constant enough anywhere on Earth.
M_PER_DEG_LAT = 111_320.0

#: Paris sits at ~48.86N; a degree of longitude is much shorter than a degree of
#: latitude here. Using one figure for both would stretch the search east-west
#: by a third.
PARIS_LAT = 48.8566
M_PER_DEG_LON = M_PER_DEG_LAT * math.cos(math.radians(PARIS_LAT))

#: What a spot is worth before any trees are counted. An air-conditioned library
#: is cool whether or not the street outside is planted; a fountain on bare
#: asphalt is not.
CATEGORY_BASELINE: dict[Category, int] = {
    "fountain": 30,
    "green_space": 55,
    "indoor": 60,
    "mist": 50,
}

#: How much of the final score the surrounding trees decide. Low for indoor
#: spots, where shade is beside the point.
CATEGORY_TREE_WEIGHT: dict[Category, float] = {
    "fountain": 0.70,
    "green_space": 0.60,
    "indoor": 0.25,
    "mist": 0.50,
}

#: The 95th percentile of tree counts defines a full score, not the maximum:
#: one freak circle inside the Bois de Vincennes would otherwise flatten every
#: other spot in the city to single digits.
SATURATION_PERCENTILE = 0.95


class Tree(NamedTuple):
    """One row of the tree register, reduced to what scoring needs."""

    lat: float
    lon: float
    #: Normalized `750xx`, or None when the register's own value is unusable.
    arrondissement: str | None


class TreeIndex:
    """Uniform grid over the tree register, for fast radius queries.

    A cell is one search radius across, so every tree within ``RADIUS_M`` of a
    point is guaranteed to sit in that point's cell or one of the eight around
    it. That turns 4 400 x 200 000 distance checks into roughly 4 400 x 60.
    """

    __slots__ = ("_cells", "_cell_lat", "_cell_lon", "size")

    def __init__(self, trees: Iterable[Tree]) -> None:
        self._cell_lat = RADIUS_M / M_PER_DEG_LAT
        self._cell_lon = RADIUS_M / M_PER_DEG_LON
        self._cells: dict[tuple[int, int], list[tuple[float, float]]] = defaultdict(list)

        count = 0
        for tree in trees:
            self._cells[self._key(tree.lat, tree.lon)].append((tree.lat, tree.lon))
            count += 1
        self.size = count

        log.info("tree index: %d tree(s) across %d cell(s)", count, len(self._cells))

    def _key(self, lat: float, lon: float) -> tuple[int, int]:
        return (int(lat // self._cell_lat), int(lon // self._cell_lon))

    def count_within(self, lat: float, lon: float, radius_m: float = RADIUS_M) -> int:
        """Number of trees within ``radius_m`` of the point."""
        base_row, base_col = self._key(lat, lon)
        radius_sq = radius_m * radius_m
        total = 0

        for d_row in (-1, 0, 1):
            for d_col in (-1, 0, 1):
                for tree_lat, tree_lon in self._cells.get((base_row + d_row, base_col + d_col), ()):
                    # Equirectangular approximation. Over 300 m at this latitude
                    # its error against the haversine distance is centimetres.
                    dy = (tree_lat - lat) * M_PER_DEG_LAT
                    dx = (tree_lon - lon) * M_PER_DEG_LON
                    if dx * dx + dy * dy <= radius_sq:
                        total += 1
        return total


def adapt_tree(dto: dict[str, Any]) -> Tree | None:
    """Reduce one ``les-arbres`` record to a :class:`Tree`, or ``None``.

    The register writes its arrondissement as ``PARIS 12E ARRDT``, which is the
    ordinal form ``normalize_arrondissement`` already handles -- the same
    function the spot adapters use, so trees and spots agree on what the 12th is.
    """
    point = dto.get("geo_point_2d")
    if not isinstance(point, dict):
        return None
    lat, lon = point.get("lat"), point.get("lon")
    if not isinstance(lat, (int, float)) or not isinstance(lon, (int, float)):
        return None
    if isinstance(lat, bool) or isinstance(lon, bool):
        return None
    if lat != lat or lon != lon:  # NaN
        return None
    return Tree(float(lat), float(lon), normalize_arrondissement(dto.get("arrondissement")))


class Woodland:
    """Point-in-polygon test over the two Bois.

    Only outer rings are kept. The enclaves inside them (Roland-Garros, the
    hippodromes) are holes we deliberately ignore: they are a rounding error
    against 1 800 hectares, and the cost of getting them wrong is a slightly
    generous score for a tennis stadium in a forest.
    """

    __slots__ = ("_rings",)

    def __init__(self, rings: Iterable[Sequence[tuple[float, float]]]) -> None:
        # Each entry carries its bounding box, so the common case -- a spot
        # nowhere near either Bois -- costs four comparisons.
        self._rings: list[tuple[Sequence[tuple[float, float]], float, float, float, float]] = []
        for ring in rings:
            if len(ring) < 3:
                continue
            lons = [p[0] for p in ring]
            lats = [p[1] for p in ring]
            self._rings.append((ring, min(lons), max(lons), min(lats), max(lats)))

        log.info("woodland: %d outer ring(s)", len(self._rings))

    def __bool__(self) -> bool:
        return bool(self._rings)

    def contains(self, lat: float, lon: float) -> bool:
        for ring, min_lon, max_lon, min_lat, max_lat in self._rings:
            if lon < min_lon or lon > max_lon or lat < min_lat or lat > max_lat:
                continue
            if _point_in_ring(lon, lat, ring):
                return True
        return False


def _point_in_ring(x: float, y: float, ring: Sequence[tuple[float, float]]) -> bool:
    """Ray casting: count crossings of a ray heading east from the point."""
    inside = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i]
        xj, yj = ring[j]
        # Half-open comparison on y, so a vertex exactly on the ray is counted
        # once rather than twice.
        if (yi > y) != (yj > y):
            crossing_x = xi + (y - yi) / (yj - yi) * (xj - xi)
            if x < crossing_x:
                inside = not inside
        j = i
    return inside


def adapt_woodland(dto: dict[str, Any]) -> list[list[tuple[float, float]]]:
    """Extract the outer rings of one `espaces_verts` record's geometry.

    GeoJSON orders coordinates ``[lon, lat]``; they are kept that way here
    because the ray cast works in x/y, not in lat/lon.
    """
    geom = dto.get("geom")
    if isinstance(geom, dict) and "geometry" in geom:
        geom = geom["geometry"]
    if not isinstance(geom, dict):
        return []

    kind = geom.get("type")
    coordinates = geom.get("coordinates")
    if not isinstance(coordinates, list):
        return []

    polygons: list[Any]
    if kind == "Polygon":
        polygons = [coordinates]
    elif kind == "MultiPolygon":
        polygons = coordinates
    else:
        return []

    rings: list[list[tuple[float, float]]] = []
    for polygon in polygons:
        # polygon[0] is the outer ring; the rest are holes.
        if not isinstance(polygon, list) or not polygon:
            continue
        outer = polygon[0]
        if not isinstance(outer, list):
            continue
        ring = [
            (float(p[0]), float(p[1]))
            for p in outer
            if isinstance(p, (list, tuple)) and len(p) >= 2
        ]
        if len(ring) >= 3:
            rings.append(ring)
    return rings


def percentile(values: Sequence[int], fraction: float) -> float:
    """Nearest-rank percentile. Returns 0 for an empty input."""
    if not values:
        return 0.0
    ordered = sorted(values)
    index = min(len(ordered) - 1, max(0, math.ceil(fraction * len(ordered)) - 1))
    return float(ordered[index])


def score(
    category: Category,
    tree_count: int,
    saturation: float,
    in_woodland: bool = False,
) -> int:
    """Blend the category baseline with the measured tree density.

    Inside the Bois the tree signal is unusable -- the woodland is not in the
    register -- so the ratio is pinned to 1 rather than measured.
    """
    baseline = CATEGORY_BASELINE.get(category, 50)
    weight = CATEGORY_TREE_WEIGHT.get(category, 0.5)

    if in_woodland:
        ratio = 1.0
    elif saturation <= 0:
        ratio = 0.0
    else:
        ratio = min(1.0, tree_count / saturation)
    blended = (1.0 - weight) * baseline + weight * 100.0 * ratio

    return max(0, min(100, round(blended)))


def apply_canopy(
    spots: Sequence[CoolSpot],
    trees: Sequence[Tree],
) -> tuple[list[CoolSpot], dict[str, int]]:
    """Rescore every spot from real tree density.

    Returns the rescored spots and the true tree count per arrondissement,
    which the R analytics reads as its own density input.

    A spot with no coordinates keeps a score, but an honest one: the mean of the
    scored spots in its arrondissement, or the bare category baseline when even
    that is unavailable.
    """
    index = TreeIndex(trees)

    if index.size == 0:
        # No tree data is a pipeline failure, not a reason to write zeroes over
        # every score in the serving table.
        raise ValueError("tree index is empty; refusing to rescore every spot to baseline")

    located = [s for s in spots if s.lat is not None and s.lon is not None]
    counts = {s.id: index.count_within(s.lat, s.lon) for s in located}  # type: ignore[arg-type]

    saturation = percentile(list(counts.values()), SATURATION_PERCENTILE)
    log.info(
        "canopy: %d/%d spot(s) located, saturation at %.0f tree(s) within %dm",
        len(located),
        len(spots),
        saturation,
        RADIUS_M,
    )

    scored: dict[str, int] = {
        spot.id: score(spot.category, counts[spot.id], saturation) for spot in located
    }

    # Mean score per arrondissement, for the spots we could not place.
    by_arrondissement: dict[str, list[int]] = defaultdict(list)
    for spot in located:
        if spot.arrondissement:
            by_arrondissement[spot.arrondissement].append(scored[spot.id])
    fallback = {
        code: round(sum(values) / len(values)) for code, values in by_arrondissement.items()
    }

    rescored = [
        replace(
            spot,
            canopy_score=scored.get(
                spot.id,
                fallback.get(spot.arrondissement or "", CATEGORY_BASELINE.get(spot.category, 50)),
            ),
        )
        for spot in spots
    ]

    return rescored, trees_per_arrondissement(trees)


def trees_per_arrondissement(trees: Iterable[Tree]) -> dict[str, int]:
    """Registered trees per arrondissement, straight from the register.

    Counted from each tree's own administrative field rather than from spot
    neighbourhoods, so overlapping search circles cannot double-count and the
    figure is a real census rather than a proxy.
    """
    totals: dict[str, int] = defaultdict(int)
    for tree in trees:
        if tree.arrondissement:
            totals[tree.arrondissement] += 1
    return dict(totals)
