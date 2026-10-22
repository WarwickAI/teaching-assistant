// Package api serves the HTTP API that the SvelteKit app calls.
package api

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"sync"

	"github.com/anthropics/anthropic-sdk-go"

	"teaching-assistant/server/internal/db"
)

type server struct {
	queries *db.Queries
	claude  anthropic.Client
	model   string
	// chatting holds the IDs of students whose message is being answered, so each gets one reply at a time.
	chatting sync.Map
}

// New returns the API's routes. Only SvelteKit can reach them: the API listens on the private network.
func New(queries *db.Queries, claude anthropic.Client, model string) (http.Handler, error) {
	if _, ok := prices[model]; !ok {
		return nil, fmt.Errorf("no price for model %q", model)
	}
	s := &server{queries: queries, claude: claude, model: model}

	api := http.NewServeMux()
	api.HandleFunc("GET /sessions/latest", s.getLatestSession)
	api.HandleFunc("POST /sessions", s.startSession)
	api.HandleFunc("POST /sessions/current/end", s.endSession)
	api.HandleFunc("POST /sessions/current/request-feedback", s.requestFeedback)
	api.HandleFunc("POST /join", s.join)
	api.HandleFunc("POST /chat", s.chat)
	api.HandleFunc("POST /feedback", s.saveFeedback)
	api.HandleFunc("GET /dashboard", s.getDashboard)
	api.HandleFunc("GET /settings", s.getSettings)
	api.HandleFunc("PUT /settings", s.updateSettings)
	api.HandleFunc("GET /context-files", s.listContextFiles)
	api.HandleFunc("PUT /context-files/{name}", s.putContextFile)
	api.HandleFunc("DELETE /context-files/{name}", s.deleteContextFile)

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) { w.Write([]byte("ok")) })
	mux.Handle("/", api)
	return mux, nil
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
