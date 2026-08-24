package domain

import (
	"strings"
	"testing"
)

func TestNewReportValidatesAGoodPayload(t *testing.T) {
	n := &NewReport{SpotID: "  fountain:1325 ", Kind: "out_of_service", Comment: "  Pas d'eau. "}
	if err := n.Validate(); err != nil {
		t.Fatalf("expected valid, got %v", err)
	}
	if n.SpotID != "fountain:1325" {
		t.Errorf("SpotID = %q, want it trimmed", n.SpotID)
	}
	if n.Comment != "Pas d'eau." {
		t.Errorf("Comment = %q, want it trimmed", n.Comment)
	}
}

func TestNewReportDefaultsKindToOther(t *testing.T) {
	n := &NewReport{SpotID: "green:42"}
	if err := n.Validate(); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if n.Kind != "other" {
		t.Errorf("Kind = %q, want \"other\"", n.Kind)
	}
}

func TestNewReportRejectsBadSpotIDs(t *testing.T) {
	cases := map[string]string{
		"empty":             "",
		"no namespace":      "1325",
		"unknown namespace": "pool:12",
		"sql-ish":           "fountain:1'; DROP TABLE cool_spots--",
		"too long":          "fountain:" + strings.Repeat("9", 100),
		"trailing space id": "green: 42",
	}
	for name, id := range cases {
		t.Run(name, func(t *testing.T) {
			n := &NewReport{SpotID: id, Kind: "other"}
			if err := n.Validate(); err == nil {
				t.Fatalf("expected %q to be rejected", id)
			}
		})
	}
}

func TestNewReportRejectsUnknownKind(t *testing.T) {
	n := &NewReport{SpotID: "green:42", Kind: "on_fire"}
	if err := n.Validate(); err == nil {
		t.Fatal("expected an unknown kind to be rejected")
	}
}

func TestNewReportRejectsOverlongComment(t *testing.T) {
	n := &NewReport{SpotID: "green:42", Kind: "other", Comment: strings.Repeat("a", MaxCommentLength+1)}
	if err := n.Validate(); err == nil {
		t.Fatal("expected an overlong comment to be rejected")
	}
}

func TestNewReportMeasuresCommentInRunes(t *testing.T) {
	// 1000 accented characters is 2000 bytes but exactly at the limit.
	n := &NewReport{SpotID: "green:42", Kind: "other", Comment: strings.Repeat("é", MaxCommentLength)}
	if err := n.Validate(); err != nil {
		t.Fatalf("a 1000-rune comment must be accepted, got %v", err)
	}
}

func TestValidateReturnsBadRequestError(t *testing.T) {
	n := &NewReport{SpotID: "nope"}
	err := n.Validate()
	if _, ok := err.(BadRequestError); !ok {
		t.Fatalf("error is %T, want BadRequestError so the handler answers 400", err)
	}
}
