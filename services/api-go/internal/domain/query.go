package domain

import (
	"fmt"
	"net/url"
	"strconv"
	"strings"
)

// Sort columns accepted by the list endpoint, mapped to their SQL column.
// A whitelist rather than string interpolation: the sort key reaches ORDER BY,
// where a bind parameter is not allowed.
var sortColumns = map[string]string{
	"name":           "s.name",
	"category":       "s.category",
	"arrondissement": "s.arrondissement",
	"address":        "s.address",
	"canopyScore":    "s.canopy_score",
}

// Defaults mirror the initial state of the Zustand store.
const (
	DefaultSortColumn = "canopyScore"
	DefaultSortDir    = "desc"
	DefaultPageSize   = 25
	MaxPageSize       = 500
)

// SpotQuery is the parsed, validated form of a list request.
type SpotQuery struct {
	Search         string
	Category       string // "" means no constraint
	Arrondissement string // "" means no constraint
	Source         string // "" means no constraint
	Availability   string // "", "OPEN_NOW" or "247"
	Price          string // "", "FREE" or "MUNICIPAL"
	SortColumn     string
	SortDir        string
	Page           int
	PageSize       int
}

// SortSQL returns the safe `ORDER BY` fragment for this query.
func (q SpotQuery) SortSQL() string {
	col, ok := sortColumns[q.SortColumn]
	if !ok {
		col = sortColumns[DefaultSortColumn]
	}
	dir := "DESC"
	if q.SortDir == "asc" {
		dir = "ASC"
	}
	// `s.id` breaks ties so pagination is stable across requests.
	return fmt.Sprintf("ORDER BY %s %s, s.id ASC", col, dir)
}

// Offset is the SQL offset for the requested page.
func (q SpotQuery) Offset() int { return (q.Page - 1) * q.PageSize }

// BadRequestError marks a query the caller must fix, as opposed to a server fault.
type BadRequestError struct{ Msg string }

func (e BadRequestError) Error() string { return e.Msg }

// ParseSpotQuery validates raw query-string values into a SpotQuery.
// Unknown or empty parameters fall back to defaults; only actively invalid
// values are rejected, so a stale bookmark still renders a page.
func ParseSpotQuery(v url.Values) (SpotQuery, error) {
	q := SpotQuery{
		Search:     strings.TrimSpace(v.Get("query")),
		SortColumn: DefaultSortColumn,
		SortDir:    DefaultSortDir,
		Page:       1,
		PageSize:   DefaultPageSize,
	}

	if c := v.Get("category"); c != "" && c != "all" {
		if !IsValidCategory(c) {
			return q, BadRequestError{Msg: "unknown category: " + c}
		}
		q.Category = c
	}

	if a := v.Get("arrondissement"); a != "" && a != "all" {
		if len(a) != 5 || !strings.HasPrefix(a, "750") {
			return q, BadRequestError{Msg: "arrondissement must look like 75011"}
		}
		q.Arrondissement = a
	}

	if s := v.Get("source"); s != "" && s != "all" {
		q.Source = s
	}

	switch av := v.Get("availability"); av {
	case "", "ALL":
	case "OPEN_NOW", "247":
		q.Availability = av
	default:
		return q, BadRequestError{Msg: "availability must be ALL, OPEN_NOW or 247"}
	}

	switch p := v.Get("price"); p {
	case "", "ALL":
	case "FREE", "MUNICIPAL":
		q.Price = p
	default:
		return q, BadRequestError{Msg: "price must be ALL, FREE or MUNICIPAL"}
	}

	if s := v.Get("sort"); s != "" {
		if _, ok := sortColumns[s]; !ok {
			return q, BadRequestError{Msg: "unknown sort column: " + s}
		}
		q.SortColumn = s
	}
	if d := v.Get("dir"); d == "asc" || d == "desc" {
		q.SortDir = d
	}

	if p, err := strconv.Atoi(v.Get("page")); err == nil && p > 0 {
		q.Page = p
	}
	if ps, err := strconv.Atoi(v.Get("pageSize")); err == nil && ps > 0 {
		if ps > MaxPageSize {
			ps = MaxPageSize
		}
		q.PageSize = ps
	}

	return q, nil
}
