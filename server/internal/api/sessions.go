package api

import (
	"errors"
	"log/slog"
	"net/http"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

func (s *server) getCurrentSession(w http.ResponseWriter, r *http.Request) {
	session, err := s.queries.CurrentSession(r.Context())
	if errors.Is(err, pgx.ErrNoRows) {
		http.Error(w, "no lesson in progress", http.StatusNotFound)
		return
	}
	if err != nil {
		internalError(w, "current session", err)
		return
	}
	writeJSON(w, http.StatusOK, session)
}

func (s *server) startSession(w http.ResponseWriter, r *http.Request) {
	session, err := s.queries.StartSession(r.Context())
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.ConstraintName == "one_open_session" {
		http.Error(w, "a lesson is already in progress", http.StatusConflict)
		return
	}
	if err != nil {
		internalError(w, "start session", err)
		return
	}
	slog.Info("lesson started", "started_at", session.StartedAt)
	writeJSON(w, http.StatusCreated, session)
}

func (s *server) endSession(w http.ResponseWriter, r *http.Request) {
	ended, err := s.queries.EndSession(r.Context())
	if err != nil {
		internalError(w, "end session", err)
		return
	}
	if ended == 0 {
		http.Error(w, "no lesson in progress", http.StatusConflict)
		return
	}
	slog.Info("lesson ended")
	w.WriteHeader(http.StatusNoContent)
}
