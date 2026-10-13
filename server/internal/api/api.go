// Package api serves the HTTP API that the SvelteKit app calls.
package api

import (
	"encoding/json"
	"log/slog"
	"net/http"

	"github.com/anthropics/anthropic-sdk-go"

	"teaching-assistant/server/internal/db"
)

type server struct {
	queries *db.Queries
	claude  anthropic.Client
}

// New returns the API's routes. Everything except /healthz requires the internal token.
func New(queries *db.Queries, claude anthropic.Client, internalToken string) http.Handler {
	s := &server{queries: queries, claude: claude}

	api := http.NewServeMux()
	api.HandleFunc("GET /sessions/current", s.getCurrentSession)
	api.HandleFunc("POST /sessions", s.startSession)
	api.HandleFunc("POST /sessions/current/end", s.endSession)
	api.HandleFunc("POST /join", s.join)
	api.HandleFunc("POST /chat", s.chat)
	api.HandleFunc("POST /feedback", s.saveFeedback)
	api.HandleFunc("GET /dashboard", s.getDashboard)

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) { w.Write([]byte("ok")) })
	mux.Handle("/", requireInternal(internalToken, api))
	return mux
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

// internalError logs the real error and gives the client a generic one.
func internalError(w http.ResponseWriter, msg string, err error) {
	slog.Error(msg, "err", err)
	http.Error(w, "internal error", http.StatusInternalServerError)
}
