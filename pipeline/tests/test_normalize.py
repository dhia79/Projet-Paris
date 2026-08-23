"""Tests for the normalization rules ported from the TypeScript adapters.

The expected ``hash_score`` values below were produced by the original
JavaScript implementation. They are the regression guard for the port: if the
port drifts, ids keep their identity but their scores silently change, and the
dashboard's ranking changes with them.
"""

from __future__ import annotations

import pytest

from paris_pipeline.normalize import (
    adapt_cool_facility,
    adapt_fountain,
    adapt_green_space,
    clean,
    dedupe,
    hash_score,
    is_code_like,
    join_address,
    normalize_arrondissement,
    to_coordinates,
    to_title_case,
)


class TestNormalizeArrondissement:
    @pytest.mark.parametrize(
        "raw,expected",
        [
            ("75011", "75011"),
            ("PARIS 75011", "75011"),
            ("75116", "75016"),  # Passy folds into the 16th
            ("11e", "75011"),
            ("1er", "75001"),
            ("20EME", "75020"),
            ("75021", None),  # out of range
            ("", None),
            (None, None),
            (75011, "75011"),
        ],
    )
    def test_variants(self, raw, expected):
        assert normalize_arrondissement(raw) == expected

    def test_first_usable_candidate_wins(self):
        assert normalize_arrondissement(None, "", "75012", "75001") == "75012"


class TestCoordinates:
    def test_valid_point(self):
        assert to_coordinates({"lat": 48.85, "lon": 2.35}) == (48.85, 2.35)

    @pytest.mark.parametrize(
        "point",
        [None, {}, {"lat": 48.85}, {"lat": "48.85", "lon": "2.35"}, {"lat": float("nan"), "lon": 2.35}],
    )
    def test_rejects_unusable_points(self, point):
        assert to_coordinates(point) == (None, None)

    def test_booleans_are_not_numbers(self):
        # bool is an int subclass in Python; a naive isinstance check would let
        # `True` through as latitude 1.0.
        assert to_coordinates({"lat": True, "lon": False}) == (None, None)


class TestTextHelpers:
    @pytest.mark.parametrize(
        "raw,expected",
        [("  a   b ", "a b"), ("null", ""), ("-", ""), (None, ""), (42, "42")],
    )
    def test_clean(self, raw, expected):
        assert clean(raw) == expected

    def test_join_address_drops_empties_and_zero(self):
        assert join_address("0", None, "rue", "de Rivoli") == "rue de Rivoli"

    def test_join_address_falls_back(self):
        assert join_address(None, "", "0") == "Adresse non renseignée"

    def test_title_case_only_rewrites_shouted_text(self):
        assert to_title_case("PARC DE BELLEVILLE") == "Parc De Belleville"
        assert to_title_case("Parc de Belleville") == "Parc de Belleville"

    def test_title_case_handles_french_separators(self):
        assert to_title_case("SQUARE D'ANVERS") == "Square D'Anvers"

    @pytest.mark.parametrize("value,expected", [("EV-12", True), ("Parc", False), ("", False)])
    def test_is_code_like(self, value, expected):
        assert is_code_like(value) is expected


class TestHashScore:
    def test_matches_the_javascript_implementation(self):
        # Golden values from the original TS `hashScore`.
        assert hash_score("fountain:1", 35, 55) == 43
        assert hash_score("green:100", 80, 98) == 96
        assert hash_score("facility:abc", 65, 90) == 80

    def test_is_deterministic(self):
        assert hash_score("green:42", 80, 98) == hash_score("green:42", 80, 98)

    @pytest.mark.parametrize("identifier", ["", "a", "fountain:999999", "é" * 50])
    def test_always_lands_inside_the_range(self, identifier):
        assert 35 <= hash_score(identifier, 35, 55) <= 55


class TestAdapters:
    def test_fountain_in_service(self):
        spot = adapt_fountain(
            {
                "gid": "1",
                "modele": "FONTAINE WALLACE",
                "commune": "PARIS 11EME",
                "no_voirie_pair": "12",
                "voie": "RUE OBERKAMPF",
                "dispo": "OUI",
                "geo_point_2d": {"lat": 48.86, "lon": 2.37},
            },
            0,
        )
        assert spot.id == "fountain:1"
        assert spot.name == "Fontaine Wallace"
        assert spot.category == "fountain"
        assert spot.arrondissement == "75011"
        assert spot.address == "12 RUE OBERKAMPF"
        assert spot.is_open_now is True
        assert spot.opening_hours == "Accessible 24h/24"
        assert spot.price == "FREE"
        assert (spot.lat, spot.lon) == (48.86, 2.37)

    def test_fountain_out_of_service_carries_the_reason(self):
        spot = adapt_fountain({"gid": "2", "dispo": "NON", "motif_ind": "TRAVAUX"}, 0)
        assert spot.is_open_now is False
        assert spot.opening_hours == "Hors service — Travaux"

    def test_fountain_falls_back_to_the_index_for_its_id(self):
        assert adapt_fountain({}, 7).id == "fountain:7"

    def test_green_space_uses_the_kind_when_the_name_is_a_code(self):
        spot = adapt_green_space(
            {
                "nsq_espace_vert": "50",
                "nom_ev": "EV-9",
                "type_ev": "PARC",
                "adresse_codepostal": "75019",
                "ouvert_ferme": "OUVERT 24H",
            },
            0,
        )
        assert spot.name == "Parc"
        assert spot.arrondissement == "75019"
        assert "Ouvert la nuit" in spot.features
        assert 80 <= spot.canopy_score <= 98

    def test_facility_swimming_is_categorized_as_mist(self):
        spot = adapt_cool_facility(
            {"identifiant": "9", "nom": "PISCINE PONTOISE", "type": "Baignade", "payant": "OUI",
             "arrondissement": "75005"},
            0,
        )
        assert spot.category == "mist"
        assert spot.is_free is False
        assert spot.price == "MUNICIPAL"
        assert spot.water_access is True
        assert "Tarif municipal" in spot.features

    def test_facility_defaults_to_indoor_and_free(self):
        spot = adapt_cool_facility({"identifiant": "3", "nom": "Bibliotheque", "payant": "NON"}, 0)
        assert spot.category == "indoor"
        assert spot.is_free is True
        assert spot.shade_level == "Climatisation 21°C"


class TestDedupe:
    def test_keeps_the_first_occurrence(self):
        a = adapt_fountain({"gid": "1", "modele": "FIRST"}, 0)
        b = adapt_fountain({"gid": "1", "modele": "SECOND"}, 1)
        result = dedupe([a, b])
        assert len(result) == 1
        assert result[0].name == "First"

    def test_preserves_order(self):
        spots = [adapt_fountain({"gid": str(i)}, i) for i in range(5)]
        assert [s.id for s in dedupe(spots)] == [s.id for s in spots]
