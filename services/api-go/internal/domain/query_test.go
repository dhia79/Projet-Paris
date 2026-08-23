package domain

import (
	"net/url"
	"strings"
	"testing"
)

func values(pairs ...string) url.Values {
	v := url.Values{}
	for i := 0; i+1 < len(pairs); i += 2 {
		v.Set(pairs[i], pairs[i+1])
	}
	return v
}

func TestParseSpotQueryDefaults(t *testing.T) {
	q, err := ParseSpotQuery(url.Values{})
	if err != nil {
		t.Fatalf("empty query should be valid, got %v", err)
	}
	if q.Page != 1 || q.PageSize != DefaultPageSize {
		t.Errorf("pagination = %d/%d, want 1/%d", q.Page, q.PageSize, DefaultPageSize)
	}
	if q.SortColumn != DefaultSortColumn || q.SortDir != DefaultSortDir {
		t.Errorf("sort = %s %s, want %s %s", q.SortColumn, q.SortDir, DefaultSortColumn, DefaultSortDir)
	}
}

func TestParseSpotQueryTreatsAllAsNoConstraint(t *testing.T) {
	q, err := ParseSpotQuery(values("category", "all", "arrondissement", "all", "price", "ALL"))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if q.Category != "" || q.Arrondissement != "" || q.Price != "" {
		t.Errorf(`"all" must clear the filter, got %+v`, q)
	}
}

func TestParseSpotQueryRejectsBadInput(t *testing.T) {
	cases := map[string]url.Values{
		"category":       values("category", "swimming"),
		"arrondissement": values("arrondissement", "99"),
		"availability":   values("availability", "SOMETIMES"),
		"price":          values("price", "CHEAP"),
		"sort":           values("sort", "canopy_score"),
	}
	for name, v := range cases {
		t.Run(name, func(t *testing.T) {
			if _, err := ParseSpotQuery(v); err == nil {
				t.Fatalf("expected a BadRequestError for %v", v)
			}
		})
	}
}

func TestParseSpotQueryClampsPageSize(t *testing.T) {
	q, _ := ParseSpotQuery(values("pageSize", "100000"))
	if q.PageSize != MaxPageSize {
		t.Errorf("pageSize = %d, want it clamped to %d", q.PageSize, MaxPageSize)
	}
}

func TestParseSpotQueryIgnoresUnparseablePagination(t *testing.T) {
	q, err := ParseSpotQuery(values("page", "abc", "pageSize", "-5"))
	if err != nil {
		t.Fatalf("bad pagination should fall back, not fail: %v", err)
	}
	if q.Page != 1 || q.PageSize != DefaultPageSize {
		t.Errorf("got %d/%d, want defaults", q.Page, q.PageSize)
	}
}

func TestSortSQLIsWhitelisted(t *testing.T) {
	q := SpotQuery{SortColumn: "name", SortDir: "asc"}
	got := q.SortSQL()
	if !strings.Contains(got, "s.name ASC") {
		t.Errorf("SortSQL() = %q, want it to sort by s.name ASC", got)
	}

	// An unknown column can only arrive by bypassing ParseSpotQuery; it must
	// still degrade to the default rather than reach ORDER BY verbatim.
	injected := SpotQuery{SortColumn: "id; DROP TABLE cool_spots", SortDir: "desc"}
	if strings.Contains(injected.SortSQL(), "DROP") {
		t.Errorf("SortSQL() leaked an unwhitelisted column: %q", injected.SortSQL())
	}
}

func TestOffset(t *testing.T) {
	q := SpotQuery{Page: 3, PageSize: 25}
	if got := q.Offset(); got != 50 {
		t.Errorf("Offset() = %d, want 50", got)
	}
}
