package storage

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/dhiamokchaha/projet-paris/api/internal/domain"
	"github.com/go-sql-driver/mysql"
)

// ErrUnknownSpot is returned when a report names a spot that does not exist.
var ErrUnknownSpot = errors.New("unknown spot")

// mysqlErrNoReferencedRow is the FK-violation code for a child row whose parent
// is missing (ER_NO_REFERENCED_ROW_2).
const mysqlErrNoReferencedRow = 1452

// CreateReport stores a citizen report and returns it as persisted.
func (r *Repository) CreateReport(ctx context.Context, in domain.NewReport) (domain.Report, error) {
	var comment any
	if in.Comment != "" {
		comment = in.Comment
	}

	const q = `INSERT INTO citizen_reports (spot_id, kind, comment) VALUES (?, ?, ?)`
	result, err := r.db.ExecContext(ctx, q, in.SpotID, in.Kind, comment)
	if err != nil {
		// The foreign key is the existence check: doing a SELECT first would be
		// a second round trip and still race with the pipeline's sweep.
		var mysqlErr *mysql.MySQLError
		if errors.As(err, &mysqlErr) && mysqlErr.Number == mysqlErrNoReferencedRow {
			return domain.Report{}, ErrUnknownSpot
		}
		return domain.Report{}, fmt.Errorf("insert report: %w", err)
	}

	id, err := result.LastInsertId()
	if err != nil {
		return domain.Report{}, fmt.Errorf("report id: %w", err)
	}

	return r.GetReport(ctx, id)
}

// GetReport loads one report by id.
func (r *Repository) GetReport(ctx context.Context, id int64) (domain.Report, error) {
	const q = `
		SELECT id, spot_id, kind, comment, reported_at, status
		FROM citizen_reports WHERE id = ?`

	report, err := scanReport(r.db.QueryRowContext(ctx, q, id))
	if errors.Is(err, sql.ErrNoRows) {
		return report, ErrNotFound
	}
	return report, err
}

// ListReportsForSpot returns a spot's reports, newest first.
func (r *Repository) ListReportsForSpot(ctx context.Context, spotID string, limit int) ([]domain.Report, error) {
	const q = `
		SELECT id, spot_id, kind, comment, reported_at, status
		FROM citizen_reports
		WHERE spot_id = ?
		ORDER BY reported_at DESC, id DESC
		LIMIT ?`

	rows, err := r.db.QueryContext(ctx, q, spotID, limit)
	if err != nil {
		return nil, fmt.Errorf("list reports: %w", err)
	}
	defer rows.Close()

	reports := []domain.Report{}
	for rows.Next() {
		report, err := scanReport(rows)
		if err != nil {
			return nil, err
		}
		reports = append(reports, report)
	}
	return reports, rows.Err()
}

func scanReport(s scanner) (domain.Report, error) {
	var (
		report     domain.Report
		comment    sql.NullString
		reportedAt time.Time
	)

	err := s.Scan(&report.ID, &report.SpotID, &report.Kind, &comment, &reportedAt, &report.Status)
	if err != nil {
		return report, err
	}

	if comment.Valid {
		report.Comment = &comment.String
	}
	report.ReportedAt = reportedAt.UTC().Format(time.RFC3339)

	return report, nil
}

// PendingReportCounts returns the number of pending reports per spot, for the
// spots that have any. The dashboard uses it to flag spots worth double-checking
// before walking there.
func (r *Repository) PendingReportCounts(ctx context.Context) (map[string]int, error) {
	const q = `
		SELECT spot_id, COUNT(*) FROM citizen_reports
		WHERE status = 'pending'
		GROUP BY spot_id`

	rows, err := r.db.QueryContext(ctx, q)
	if err != nil {
		return nil, fmt.Errorf("pending report counts: %w", err)
	}
	defer rows.Close()

	counts := map[string]int{}
	for rows.Next() {
		var (
			spotID string
			total  int
		)
		if err := rows.Scan(&spotID, &total); err != nil {
			return nil, err
		}
		counts[spotID] = total
	}
	return counts, rows.Err()
}
