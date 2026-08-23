// Package storage is the MySQL read/write layer behind the HTTP API.
package storage

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/dhiamokchaha/projet-paris/api/internal/domain"
	_ "github.com/go-sql-driver/mysql"
)

// ErrNotFound is returned when a lookup by id matches no row.
var ErrNotFound = errors.New("not found")

// Repository owns the connection pool and every query the API issues.
type Repository struct {
	db *sql.DB
}

// Open dials MySQL and verifies the connection before returning.
func Open(ctx context.Context, dsn string, maxOpen, maxIdle int, maxLifetime time.Duration) (*Repository, error) {
	db, err := sql.Open("mysql", dsn)
	if err != nil {
		return nil, fmt.Errorf("open mysql: %w", err)
	}
	db.SetMaxOpenConns(maxOpen)
	db.SetMaxIdleConns(maxIdle)
	db.SetConnMaxLifetime(maxLifetime)

	pingCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	if err := db.PingContext(pingCtx); err != nil {
		db.Close()
		return nil, fmt.Errorf("ping mysql: %w", err)
	}
	return &Repository{db: db}, nil
}

// Close releases the pool.
func (r *Repository) Close() error { return r.db.Close() }

// Ping backs the readiness probe.
func (r *Repository) Ping(ctx context.Context) error { return r.db.PingContext(ctx) }

const spotColumns = `
  s.id, s.name, s.category, s.arrondissement, s.address, s.is_free, s.price,
  s.lat, s.lon, s.opening_hours, s.is_open_now, s.canopy_score, s.water_access,
  s.shade_level, s.features, s.source`

// where builds the shared predicate for both the count and the page query, so
// the two can never drift apart.
func where(q domain.SpotQuery) (string, []any) {
	var clauses []string
	var args []any

	if q.Search != "" {
		// LIKE rather than MATCH...AGAINST: the UI searches as you type, and a
		// two-character prefix is below the fulltext minimum token length.
		clauses = append(clauses, "(s.name LIKE ? OR s.address LIKE ?)")
		pattern := "%" + escapeLike(q.Search) + "%"
		args = append(args, pattern, pattern)
	}
	if q.Category != "" {
		clauses = append(clauses, "s.category = ?")
		args = append(args, q.Category)
	}
	if q.Arrondissement != "" {
		clauses = append(clauses, "s.arrondissement = ?")
		args = append(args, q.Arrondissement)
	}
	if q.Source != "" {
		clauses = append(clauses, "s.source = ?")
		args = append(args, q.Source)
	}
	if q.Price != "" {
		clauses = append(clauses, "s.price = ?")
		args = append(args, q.Price)
	}
	switch q.Availability {
	case "OPEN_NOW":
		clauses = append(clauses, "s.is_open_now = 1")
	case "247":
		clauses = append(clauses, "s.opening_hours LIKE '%24h%'")
	}

	if len(clauses) == 0 {
		return "", nil
	}
	return "WHERE " + strings.Join(clauses, " AND "), args
}

// escapeLike neutralizes the wildcards a user can type into the search box.
func escapeLike(s string) string {
	r := strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`)
	return r.Replace(s)
}

// ListSpots returns one page of spots plus the total matching count.
func (r *Repository) ListSpots(ctx context.Context, q domain.SpotQuery) (domain.Page[domain.CoolSpot], error) {
	page := domain.Page[domain.CoolSpot]{
		Items:    []domain.CoolSpot{},
		Page:     q.Page,
		PageSize: q.PageSize,
	}

	predicate, args := where(q)

	countSQL := "SELECT COUNT(*) FROM cool_spots s " + predicate
	if err := r.db.QueryRowContext(ctx, countSQL, args...).Scan(&page.Total); err != nil {
		return page, fmt.Errorf("count spots: %w", err)
	}

	page.PageCount = 1
	if page.Total > 0 {
		page.PageCount = (page.Total + q.PageSize - 1) / q.PageSize
	}
	if q.Page > page.PageCount {
		// Past the end: an empty page beats an error for a stale bookmark.
		return page, nil
	}

	listSQL := fmt.Sprintf("SELECT %s FROM cool_spots s %s %s LIMIT ? OFFSET ?",
		spotColumns, predicate, q.SortSQL())
	rows, err := r.db.QueryContext(ctx, listSQL, append(args, q.PageSize, q.Offset())...)
	if err != nil {
		return page, fmt.Errorf("list spots: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		spot, err := scanSpot(rows)
		if err != nil {
			return page, err
		}
		page.Items = append(page.Items, spot)
	}
	return page, rows.Err()
}

// GetSpot loads a single spot by its namespaced id.
func (r *Repository) GetSpot(ctx context.Context, id string) (domain.CoolSpot, error) {
	q := fmt.Sprintf("SELECT %s FROM cool_spots s WHERE s.id = ?", spotColumns)
	spot, err := scanSpot(r.db.QueryRowContext(ctx, q, id))
	if errors.Is(err, sql.ErrNoRows) {
		return spot, ErrNotFound
	}
	return spot, err
}

// scanner is satisfied by both *sql.Row and *sql.Rows.
type scanner interface{ Scan(dest ...any) error }

func scanSpot(s scanner) (domain.CoolSpot, error) {
	var (
		spot     domain.CoolSpot
		arr      sql.NullString
		lat, lon sql.NullFloat64
		hours    sql.NullString
		features []byte
	)

	err := s.Scan(
		&spot.ID, &spot.Name, &spot.Category, &arr, &spot.Address, &spot.IsFree,
		&spot.Price, &lat, &lon, &hours, &spot.IsOpenNow, &spot.CanopyScore,
		&spot.WaterAccess, &spot.ShadeLevel, &features, &spot.Source,
	)
	if err != nil {
		return spot, err
	}

	if arr.Valid {
		spot.Arrondissement = &arr.String
	}
	if hours.Valid {
		spot.OpeningHours = &hours.String
	}
	// The schema's ck_spot_coords check keeps these two in lockstep.
	if lat.Valid && lon.Valid {
		spot.Coordinates = &domain.Coordinates{Lat: lat.Float64, Lon: lon.Float64}
	}

	spot.Features = []string{}
	if len(features) > 0 {
		if err := json.Unmarshal(features, &spot.Features); err != nil {
			return spot, fmt.Errorf("decode features for %s: %w", spot.ID, err)
		}
	}
	return spot, nil
}

// ArrondissementStats returns one row per arrondissement, including those with
// no spots at all, so the chart keeps a stable 20-bar x-axis.
func (r *Repository) ArrondissementStats(ctx context.Context) ([]domain.ArrondissementStat, error) {
	const q = `
		SELECT code, label, total, fountain, green_space, indoor, mist
		FROM v_arrondissement_stats
		ORDER BY code`

	rows, err := r.db.QueryContext(ctx, q)
	if err != nil {
		return nil, fmt.Errorf("arrondissement stats: %w", err)
	}
	defer rows.Close()

	stats := []domain.ArrondissementStat{}
	for rows.Next() {
		var s domain.ArrondissementStat
		if err := rows.Scan(&s.Code, &s.Label, &s.Total, &s.Fountain, &s.GreenSpace, &s.Indoor, &s.Mist); err != nil {
			return nil, err
		}
		stats = append(stats, s)
	}
	return stats, rows.Err()
}

// LatestIngestionReports returns the most recent run per source, which is what
// the dashboard footer renders as data-freshness information.
func (r *Repository) LatestIngestionReports(ctx context.Context) ([]domain.DatasetLoadReport, error) {
	const q = `
		SELECT src.slug, src.label, r.status, r.raw_count, r.normalized_count,
		       COALESCE(r.error, '')
		FROM sources src
		LEFT JOIN ingestion_runs r
		  ON r.id = (
		       SELECT id FROM ingestion_runs
		       WHERE source = src.slug
		       ORDER BY started_at DESC, id DESC
		       LIMIT 1
		     )
		ORDER BY src.is_required DESC, src.slug`

	rows, err := r.db.QueryContext(ctx, q)
	if err != nil {
		return nil, fmt.Errorf("ingestion reports: %w", err)
	}
	defer rows.Close()

	reports := []domain.DatasetLoadReport{}
	for rows.Next() {
		var (
			rep      domain.DatasetLoadReport
			status   sql.NullString
			raw, nrm sql.NullInt64
			errMsg   sql.NullString
		)
		if err := rows.Scan(&rep.Slug, &rep.Label, &status, &raw, &nrm, &errMsg); err != nil {
			return nil, err
		}
		// A source that has never been ingested reports as failed rather than
		// silently as "ok with zero rows".
		rep.Status = "failed"
		if status.Valid {
			rep.Status = status.String
		} else {
			rep.Error = "never ingested"
		}
		rep.RawCount = int(raw.Int64)
		rep.NormalizedCount = int(nrm.Int64)
		if errMsg.Valid && errMsg.String != "" {
			rep.Error = errMsg.String
		}
		reports = append(reports, rep)
	}
	return reports, rows.Err()
}

// AvailableArrondissements lists the arrondissement codes that actually have
// spots, for the filter dropdown.
func (r *Repository) AvailableArrondissements(ctx context.Context) ([]string, error) {
	const q = `
		SELECT DISTINCT arrondissement FROM cool_spots
		WHERE arrondissement IS NOT NULL
		ORDER BY arrondissement`

	rows, err := r.db.QueryContext(ctx, q)
	if err != nil {
		return nil, fmt.Errorf("available arrondissements: %w", err)
	}
	defer rows.Close()

	codes := []string{}
	for rows.Next() {
		var code string
		if err := rows.Scan(&code); err != nil {
			return nil, err
		}
		codes = append(codes, code)
	}
	return codes, rows.Err()
}
