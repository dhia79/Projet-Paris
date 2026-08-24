"""Tests for tree-density canopy scoring.

The distances here are checked against hand-computed metre offsets rather than
against the implementation, so a change to the projection constants fails the
test instead of silently moving every score in the city.
"""

from __future__ import annotations

import math

import pytest

from paris_pipeline.canopy import (
    CATEGORY_BASELINE,
    M_PER_DEG_LAT,
    M_PER_DEG_LON,
    RADIUS_M,
    Tree,
    TreeIndex,
    adapt_tree,
    apply_canopy,
    percentile,
    score,
)
from paris_pipeline.normalize import CoolSpot

NOTRE_DAME = (48.8530, 2.3499)


def tree_at(lat: float, lon: float, arr: str | None = "75004") -> Tree:
    return Tree(lat, lon, arr)


def offset(lat: float, lon: float, north_m: float, east_m: float) -> tuple[float, float]:
    """Move a point by a known number of metres."""
    return (lat + north_m / M_PER_DEG_LAT, lon + east_m / M_PER_DEG_LON)


def spot(
    spot_id: str,
    category: str = "green_space",
    lat: float | None = NOTRE_DAME[0],
    lon: float | None = NOTRE_DAME[1],
    arrondissement: str | None = "75004",
) -> CoolSpot:
    return CoolSpot(
        id=spot_id,
        name=spot_id,
        category=category,  # type: ignore[arg-type]
        arrondissement=arrondissement,
        address="",
        is_free=True,
        price="FREE",
        lat=lat,
        lon=lon,
        opening_hours=None,
        is_open_now=True,
        canopy_score=0,
        water_access=False,
        shade_level="",
        features=(),
        source="espaces_verts",
    )


class TestAdaptTree:
    def test_reads_point_and_arrondissement(self):
        tree = adapt_tree(
            {"geo_point_2d": {"lat": 48.85, "lon": 2.35}, "arrondissement": "PARIS 12E ARRDT"}
        )
        assert tree == Tree(48.85, 2.35, "75012")

    def test_tolerates_a_missing_arrondissement(self):
        tree = adapt_tree({"geo_point_2d": {"lat": 48.85, "lon": 2.35}})
        assert tree is not None
        assert tree.arrondissement is None

    @pytest.mark.parametrize(
        "dto",
        [
            {},
            {"geo_point_2d": None},
            {"geo_point_2d": {"lat": 48.85}},
            {"geo_point_2d": {"lat": "48.85", "lon": "2.35"}},
            {"geo_point_2d": {"lat": True, "lon": False}},
            {"geo_point_2d": {"lat": float("nan"), "lon": 2.35}},
        ],
    )
    def test_rejects_unusable_records(self, dto):
        assert adapt_tree(dto) is None


class TestTreeIndex:
    def test_counts_only_trees_inside_the_radius(self):
        lat, lon = NOTRE_DAME
        trees = [
            tree_at(*offset(lat, lon, 0, 0)),        # dead centre
            tree_at(*offset(lat, lon, 100, 0)),      # 100 m north
            tree_at(*offset(lat, lon, 0, 250)),      # 250 m east
            tree_at(*offset(lat, lon, 400, 0)),      # 400 m north - outside
            tree_at(*offset(lat, lon, 0, -1000)),    # a kilometre west - outside
        ]
        assert TreeIndex(trees).count_within(lat, lon) == 3

    def test_finds_trees_across_a_cell_boundary(self):
        # A point placed just inside one cell must still see trees sitting in
        # the neighbouring cell; this is what the 3x3 sweep exists for.
        lat, lon = NOTRE_DAME
        neighbour = offset(lat, lon, RADIUS_M - 10, 0)
        assert TreeIndex([tree_at(*neighbour)]).count_within(lat, lon) == 1

    def test_east_west_is_not_stretched(self):
        # 400 m east is outside the radius. If the longitude scale were wrong
        # (using the latitude constant), this point would wrongly measure ~263 m
        # and be counted.
        lat, lon = NOTRE_DAME
        far_east = offset(lat, lon, 0, 400)
        assert TreeIndex([tree_at(*far_east)]).count_within(lat, lon) == 0

    def test_longitude_scale_matches_the_latitude(self):
        expected = M_PER_DEG_LAT * math.cos(math.radians(48.8566))
        assert pytest.approx(expected) == M_PER_DEG_LON

    def test_reports_its_size(self):
        assert TreeIndex([tree_at(*NOTRE_DAME)] * 7).size == 7

    def test_empty_index_counts_nothing(self):
        assert TreeIndex([]).count_within(*NOTRE_DAME) == 0


class TestPercentile:
    def test_nearest_rank(self):
        assert percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.5) == 5.0
        assert percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.95) == 10.0

    def test_empty_input(self):
        assert percentile([], 0.95) == 0.0

    def test_single_value(self):
        assert percentile([42], 0.95) == 42.0


class TestScore:
    def test_no_trees_leaves_only_the_baseline_share(self):
        # green_space: baseline 55, tree weight 0.6 -> 0.4 * 55 = 22
        assert score("green_space", 0, saturation=100) == 22

    def test_saturated_reaches_the_top_of_the_band(self):
        # 0.4 * 55 + 0.6 * 100 = 82
        assert score("green_space", 500, saturation=100) == 82

    def test_indoor_barely_moves_with_trees(self):
        bare = score("indoor", 0, saturation=100)
        shaded = score("indoor", 100, saturation=100)
        assert shaded - bare == 25, "indoor weight is 0.25, so the span is 25 points"

    def test_fountains_depend_most_on_trees(self):
        fountain_span = score("fountain", 100, 100) - score("fountain", 0, 100)
        indoor_span = score("indoor", 100, 100) - score("indoor", 0, 100)
        assert fountain_span > indoor_span

    def test_stays_inside_0_100(self):
        assert 0 <= score("green_space", 10_000, saturation=1) <= 100

    def test_zero_saturation_is_not_a_division_by_zero(self):
        assert score("fountain", 5, saturation=0) == round(0.3 * CATEGORY_BASELINE["fountain"])


class TestApplyCanopy:
    def test_a_shaded_spot_outscores_a_bare_one(self):
        lat, lon = NOTRE_DAME
        far = offset(lat, lon, 5_000, 0)

        trees = [tree_at(*offset(lat, lon, i, 0)) for i in range(0, 250, 10)]
        spots = [spot("green:shaded"), spot("green:bare", lat=far[0], lon=far[1])]

        rescored, _ = apply_canopy(spots, trees)
        by_id = {s.id: s.canopy_score for s in rescored}

        assert by_id["green:shaded"] > by_id["green:bare"]

    def test_returns_the_tree_census_per_arrondissement(self):
        trees = [
            tree_at(*NOTRE_DAME, arr="75004"),
            tree_at(*NOTRE_DAME, arr="75004"),
            tree_at(*NOTRE_DAME, arr="75011"),
            tree_at(*NOTRE_DAME, arr=None),
        ]
        _, census = apply_canopy([spot("green:1")], trees)
        assert census == {"75004": 2, "75011": 1}

    def test_a_spot_without_coordinates_inherits_its_arrondissement(self):
        lat, lon = NOTRE_DAME
        trees = [tree_at(*offset(lat, lon, i, 0)) for i in range(0, 200, 10)]
        located = spot("green:located")
        floating = spot("green:floating", lat=None, lon=None)

        rescored, _ = apply_canopy([located, floating], trees)
        by_id = {s.id: s.canopy_score for s in rescored}

        assert by_id["green:floating"] == by_id["green:located"]

    def test_an_unplaceable_spot_falls_back_to_its_baseline(self):
        floating = spot("indoor:nowhere", category="indoor", lat=None, lon=None, arrondissement=None)
        rescored, _ = apply_canopy([floating], [tree_at(*NOTRE_DAME)])
        assert rescored[0].canopy_score == CATEGORY_BASELINE["indoor"]

    def test_it_refuses_to_rescore_without_trees(self):
        # A failed tree download must not quietly flatten every score in the
        # serving table to its category baseline.
        with pytest.raises(ValueError, match="tree index is empty"):
            apply_canopy([spot("green:1")], [])

    def test_every_spot_is_returned_exactly_once(self):
        spots = [spot(f"green:{i}") for i in range(10)]
        rescored, _ = apply_canopy(spots, [tree_at(*NOTRE_DAME)])
        assert [s.id for s in rescored] == [s.id for s in spots]
