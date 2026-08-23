// Package httpapi wires the repository to HTTP.
package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/dhiamokchaha/projet-paris/api/internal/domain"
	"github.com/dhiamokchaha/projet-paris/api/internal/storage"
)

// Server holds the handler dependencies.
type Server struct {
	repo *storage.Repository
	log  *slog.Logger
}

// New builds a Server.
func New(repo *storage.Repository, log *slog.Logger) *Server {
	return &Server{repo: repo, log: log}
}

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
