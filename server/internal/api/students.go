package api

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5"

	"teaching-assistant/server/internal/db"
)

// join returns the student's conversation so far in the open lesson.
func (s *server) join(w http.ResponseWriter, r *http.Request) {
	student, ok := studentID(r)
	if !ok {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	session, err := s.queries.CurrentSession(r.Context())
	if errors.Is(err, pgx.ErrNoRows) {
		http.Error(w, "no lesson in progress", http.StatusNotFound)
		return
	}
	if err != nil {
		internalError(w, "join", err)
		return
	}
	key := db.ListStudentMessagesParams{SessionStartedAt: session.StartedAt, StudentID: student}
	messages, err := s.queries.ListStudentMessages(r.Context(), key)
	if err != nil {
		internalError(w, "join", err)
		return
	}
	writeJSON(w, http.StatusOK, messages)
}

// saveFeedback attaches feedback to the latest lesson.
func (s *server) saveFeedback(w http.ResponseWriter, r *http.Request) {
	student, ok := studentID(r)
	var body struct {
		Rating  int16
		Comment string
	}
	if !ok || json.NewDecoder(r.Body).Decode(&body) != nil || body.Rating < 1 || body.Rating > 5 {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	session, err := s.queries.LatestSession(r.Context())
	if errors.Is(err, pgx.ErrNoRows) {
		http.Error(w, "no lesson yet", http.StatusNotFound)
		return
	}
	var comment *string
	if c := strings.TrimSpace(body.Comment); c != "" {
		comment = &c
	}
	if err == nil {
		err = s.queries.SaveFeedback(r.Context(), db.SaveFeedbackParams{
			SessionStartedAt: session.StartedAt, StudentID: student, Rating: body.Rating, Comment: comment,
		})
	}
	if err != nil {
		internalError(w, "feedback", err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
