package api

import (
	"errors"
	"net/http"
	"slices"
	"time"

	"github.com/jackc/pgx/v5"

	"teaching-assistant/server/internal/db"
	"teaching-assistant/server/internal/lesson"
)

type dashboard struct {
	Attendance     []db.RecentAttendanceRow `json:"attendance"` // oldest first
	Students       []student                `json:"students"`
	Feedback       []db.Feedback            `json:"feedback"`
	Struggles      []db.Struggle            `json:"struggles"`
	Spending       []spendPoint             `json:"spending"` // cumulative
	TokensUsed     int64                    `json:"tokensUsed"`
	SpentUSD       float64                  `json:"spentUsd"`
	SpendingCapUSD float64                  `json:"spendingCapUsd"`
}

type student struct {
	db.SessionStudentsRow
	Messages []db.Message `json:"messages"`
}

type spendPoint struct {
	At  time.Time `json:"at"`
	USD float64   `json:"usd"`
}

// getDashboard summarises the latest lesson for the teacher.
func (s *server) getDashboard(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	cfg, err := lesson.ReadConfig()
	attendance, attErr := s.queries.RecentAttendance(ctx)
	session, sessErr := s.queries.LatestSession(ctx)
	if errors.Is(sessErr, pgx.ErrNoRows) {
		sessErr = nil
	}
	if err = errors.Join(err, attErr, sessErr); err != nil {
		internalError(w, "dashboard", err)
		return
	}
	slices.Reverse(attendance)
	d := dashboard{
		Attendance: attendance, Students: []student{}, Feedback: []db.Feedback{}, Struggles: []db.Struggle{},
		Spending: []spendPoint{}, SpendingCapUSD: cfg.SpendingCapUSD,
	}
	if session.StartedAt.IsZero() {
		writeJSON(w, http.StatusOK, d)
		return
	}

	students, err1 := s.queries.SessionStudents(ctx, session.StartedAt)
	messages, err2 := s.queries.SessionMessages(ctx, session.StartedAt)
	d.Feedback, err = s.queries.SessionFeedback(ctx, session.StartedAt)
	usage, err3 := s.queries.SessionUsage(ctx, session.StartedAt)
	struggles, err4 := s.queries.SessionStruggles(ctx, session.StartedAt)
	if err = errors.Join(err, err1, err2, err3, err4); err != nil {
		internalError(w, "dashboard", err)
		return
	}
	d.Struggles = struggles
	for _, st := range students {
		mine := slices.DeleteFunc(slices.Clone(messages), func(m db.Message) bool { return m.StudentID != st.StudentID })
		d.Students = append(d.Students, student{st, mine})
	}
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
