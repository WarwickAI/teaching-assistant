package api

import (
	"errors"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5"

	"teaching-assistant/server/internal/db"
)

type dashboard struct {
	Feedback       []db.Feedback             `json:"feedback"`
	Struggles      []db.Struggle             `json:"struggles"`
	Spending       []spendPoint              `json:"spending"` // cumulative
	TokensUsed     int64                     `json:"tokensUsed"`
	SpentUSD       float64                   `json:"spentUsd"`
	SpendingCapUSD float64                   `json:"spendingCapUsd"`
	Attendance     []db.AttendanceHistoryRow `json:"attendance"` // newest lesson first
}

type spendPoint struct {
	At  time.Time `json:"at"`
	USD float64   `json:"usd"`
}

// getDashboard summarises the latest lesson's feedback and spending for the teacher.
func (s *server) getDashboard(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	settings, err := s.queries.GetSettings(ctx)
	session, sessErr := s.queries.LatestSession(ctx)
	if errors.Is(sessErr, pgx.ErrNoRows) {
		sessErr = nil
	}
	attendance, attErr := s.queries.AttendanceHistory(ctx)
	if err = errors.Join(err, sessErr, attErr); err != nil {
		internalError(w, "dashboard", err)
		return
	}
	d := dashboard{Feedback: []db.Feedback{}, Struggles: []db.Struggle{}, Spending: []spendPoint{}, SpendingCapUSD: settings.SpendingCapUsd, Attendance: attendance}
	if session.StartedAt.IsZero() {
		writeJSON(w, http.StatusOK, d)
		return
	}

	d.Feedback, err = s.queries.SessionFeedback(ctx, session.StartedAt)
	usage, err1 := s.queries.SessionUsage(ctx, session.StartedAt)
	struggles, err2 := s.queries.SessionStruggles(ctx, session.StartedAt)
	if err = errors.Join(err, err1, err2); err != nil {
		internalError(w, "dashboard", err)
		return
	}
	d.Struggles = struggles
	d.Spending = append(d.Spending, spendPoint{At: session.StartedAt})
	var spentMicros int64
	for _, u := range usage {
		d.TokensUsed += u.Tokens
		spentMicros += u.CostMicros
		d.Spending = append(d.Spending, spendPoint{At: u.CreatedAt, USD: float64(spentMicros) / 1e6})
	}
	d.SpentUSD = d.Spending[len(d.Spending)-1].USD
	writeJSON(w, http.StatusOK, d)
}
