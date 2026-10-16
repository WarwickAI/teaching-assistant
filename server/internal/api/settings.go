package api

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"

	"teaching-assistant/server/internal/db"
	"teaching-assistant/server/internal/lesson"
)

type settings struct {
	LessonName     string            `json:"lessonName"`
	SpendingCapUSD float64           `json:"spendingCapUsd"`
	Resources      []lesson.Resource `json:"resources"`
}

func (s *server) getSettings(w http.ResponseWriter, r *http.Request) {
	row, err := s.queries.GetSettings(r.Context())
	if err != nil {
		internalError(w, "settings", err)
		return
	}
	body := settings{LessonName: row.LessonName, SpendingCapUSD: row.SpendingCapUsd}
	if err := json.Unmarshal(row.Resources, &body.Resources); err != nil {
		internalError(w, "settings", err)
		return
	}
	writeJSON(w, http.StatusOK, body)
}

func (s *server) updateSettings(w http.ResponseWriter, r *http.Request) {
	var body settings
	if json.NewDecoder(r.Body).Decode(&body) != nil || body.SpendingCapUSD < 0 {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	resources, err := json.Marshal(body.Resources)
	if err == nil {
		err = s.queries.UpdateSettings(r.Context(), db.UpdateSettingsParams{
			LessonName: body.LessonName, SpendingCapUsd: body.SpendingCapUSD, Resources: resources,
		})
	}
	if err != nil {
		internalError(w, "update settings", err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// listContextFiles returns the names of the uploaded lesson material.
func (s *server) listContextFiles(w http.ResponseWriter, r *http.Request) {
	names, err := s.queries.ListContextFileNames(r.Context())
	if err != nil {
		internalError(w, "context files", err)
		return
	}
	writeJSON(w, http.StatusOK, names)
}

// putContextFile adds a Markdown file, or replaces the one with the same name.
func (s *server) putContextFile(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("name")
	content, err := io.ReadAll(r.Body)
	if err != nil || !strings.HasSuffix(strings.ToLower(name), ".md") {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	if err := s.queries.PutContextFile(r.Context(), db.PutContextFileParams{Name: name, Content: string(content)}); err != nil {
		internalError(w, "put context file", err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *server) deleteContextFile(w http.ResponseWriter, r *http.Request) {
	if err := s.queries.DeleteContextFile(r.Context(), r.PathValue("name")); err != nil {
		internalError(w, "delete context file", err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
