// Package httpapi wires the repository to HTTP.
package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"time"

	"github.com/dhiamokchaha/projet-paris/api/internal/domain"
	"github.com/dhiamokchaha/projet-paris/api/internal/storage"
)

// How many reports one client may file, and how many may arrive back to back.
const (
	reportsPerMinute = 10
	reportsBurst     = 5
)

// A report body is a few hundred bytes; anything larger is not a mistake.
const maxReportBody = 8 << 10

// Server holds the handler dependencies.
type Server struct {
	repo       *storage.Repository
	log        *slog.Logger
	reportRate *rateLimiter
	trustProxy bool
	done       chan struct{}
}

// New builds a Server. Call Close to stop its background sweeper.
func New(repo *storage.Repository, log *slog.Logger, trustProxy bool) *Server {
	s := &Server{
		repo:       repo,
		log:        log,
		reportRate: newRateLimiter(reportsPerMinute, reportsBurst),
		trustProxy: trustProxy,
		done:       make(chan struct{}),
	}
	s.reportRate.startSweeper(5*time.Minute, 15*time.Minute, s.done)
	return s
}

// Close stops the rate limiter's sweeper goroutine.
func (s *Server) Close() { close(s.done) }

// Routes returns the fully wrapped handler for the service.
func (s *Server) Routes(allowedOrigins []string) http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /healthz", s.handleHealth)
	mux.HandleFunc("GET /readyz", s.handleReady)
	mux.HandleFunc("GET /api/v1/coolspots", s.handleListSpots)
	mux.HandleFunc("GET /api/v1/coolspots/{id}", s.handleGetSpot)
	mux.HandleFunc("GET /api/v1/stats/arrondissements", s.handleArrondissementStats)
	mux.HandleFunc("GET /api/v1/meta/arrondissements", s.handleAvailableArrondissements)
	mux.HandleFunc("GET /api/v1/meta/ingestion", s.handleIngestionReports)
	mux.HandleFunc("GET /api/v1/coolspots/{id}/reports", s.handleListReports)
	mux.HandleFunc("GET /api/v1/reports/pending", s.handlePendingReportCounts)

	// The only anonymous write in the service, and so the only route that is
	// rate limited.
	mux.Handle("POST /api/v1/reports",
		withRateLimit(s.reportRate, s.trustProxy, http.HandlerFunc(s.handleCreateReport)))

	var h http.Handler = mux
	h = withSecurityHeaders(h)
	h = withCORS(allowedOrigins, h)
	h = withLogging(s.log, h)
	h = withRecovery(s.log, h)
	return h
}

func (s *Server) handleHealth(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *Server) handleReady(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
	defer cancel()
	if err := s.repo.Ping(ctx); err != nil {
		s.log.Error("readiness probe failed", "error", err)
		writeError(w, http.StatusServiceUnavailable, "database unreachable")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ready"})
}

func (s *Server) handleListSpots(w http.ResponseWriter, r *http.Request) {
	q, err := domain.ParseSpotQuery(r.URL.Query())
	if err != nil {
		var bad domain.BadRequestError
		if errors.As(err, &bad) {
			writeError(w, http.StatusBadRequest, bad.Msg)
			return
		}
		s.fail(w, "parse query", err)
		return
	}

	page, err := s.repo.ListSpots(r.Context(), q)
	if err != nil {
		s.fail(w, "list spots", err)
		return
	}
	writeJSON(w, http.StatusOK, page)
}

func (s *Server) handleGetSpot(w http.ResponseWriter, r *http.Request) {
	spot, err := s.repo.GetSpot(r.Context(), r.PathValue("id"))
	if errors.Is(err, storage.ErrNotFound) {
		writeError(w, http.StatusNotFound, "no spot with that id")
		return
	}
	if err != nil {
		s.fail(w, "get spot", err)
		return
	}
	writeJSON(w, http.StatusOK, spot)
}

func (s *Server) handleArrondissementStats(w http.ResponseWriter, r *http.Request) {
	stats, err := s.repo.ArrondissementStats(r.Context())
	if err != nil {
		s.fail(w, "arrondissement stats", err)
		return
	}
	writeJSON(w, http.StatusOK, stats)
}

func (s *Server) handleAvailableArrondissements(w http.ResponseWriter, r *http.Request) {
	codes, err := s.repo.AvailableArrondissements(r.Context())
	if err != nil {
		s.fail(w, "available arrondissements", err)
		return
	}
	writeJSON(w, http.StatusOK, codes)
}

func (s *Server) handleIngestionReports(w http.ResponseWriter, r *http.Request) {
	reports, err := s.repo.LatestIngestionReports(r.Context())
	if err != nil {
		s.fail(w, "ingestion reports", err)
		return
	}
	writeJSON(w, http.StatusOK, reports)
}

func (s *Server) handleCreateReport(w http.ResponseWriter, r *http.Request) {
	var in domain.NewReport

	decoder := json.NewDecoder(io.LimitReader(r.Body, maxReportBody))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&in); err != nil {
		writeError(w, http.StatusBadRequest, "request body must be a JSON report object")
		return
	}
	if err := in.Validate(); err != nil {
		var bad domain.BadRequestError
		if errors.As(err, &bad) {
			writeError(w, http.StatusBadRequest, bad.Msg)
			return
		}
		s.fail(w, "validate report", err)
		return
	}

	report, err := s.repo.CreateReport(r.Context(), in)
	if errors.Is(err, storage.ErrUnknownSpot) {
		writeError(w, http.StatusUnprocessableEntity, "no spot with that id")
		return
	}
	if err != nil {
		s.fail(w, "create report", err)
		return
	}

	writeJSON(w, http.StatusCreated, report)
}

func (s *Server) handleListReports(w http.ResponseWriter, r *http.Request) {
	spotID := r.PathValue("id")
	if !domain.IsValidSpotID(spotID) {
		writeError(w, http.StatusBadRequest, "malformed spot id")
		return
	}

	reports, err := s.repo.ListReportsForSpot(r.Context(), spotID, 50)
	if err != nil {
		s.fail(w, "list reports", err)
		return
	}
	writeJSON(w, http.StatusOK, reports)
}

func (s *Server) handlePendingReportCounts(w http.ResponseWriter, r *http.Request) {
	counts, err := s.repo.PendingReportCounts(r.Context())
	if err != nil {
		s.fail(w, "pending report counts", err)
		return
	}
	writeJSON(w, http.StatusOK, counts)
}

// fail logs the real cause and returns a generic message: SQL errors can carry
// schema details that do not belong in a public response body.
func (s *Server) fail(w http.ResponseWriter, op string, err error) {
	s.log.Error(op+" failed", "error", err)
	writeError(w, http.StatusInternalServerError, "internal error")
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	// The header is already sent, so a late encode failure can only be logged
	// by the caller's recovery middleware; nothing useful is left to do here.
	_ = json.NewEncoder(w).Encode(payload)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}
