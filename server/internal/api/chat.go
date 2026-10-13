package api

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"math"
	"net/http"
	"strings"
	"time"

	"github.com/anthropics/anthropic-sdk-go"
	"github.com/jackc/pgx/v5"

	"teaching-assistant/server/internal/db"
	"teaching-assistant/server/internal/lesson"
)

// price is in US dollars per million tokens, which is the same as micro-dollars per token.
type price struct {
	in, out, cacheRead float64
	longPrompt         float64 // multiplier for prompts over 100K tokens
}

var prices = map[string]price{
	"claude-haiku-5-5":  {in: 0.10, out: 0.50, cacheRead: 0.01, longPrompt: 5},
	"claude-sonnet-5-5": {in: 2, out: 10, cacheRead: 0.20, longPrompt: 1},
	"claude-opus-5-5":   {in: 4, out: 20, cacheRead: 0.20, longPrompt: 1},
}

const webSearchMicros = 10_000 // $10 per 1,000 searches

func (p price) costMicros(u anthropic.Usage) int64 {
	scale := 1.0
	if u.InputTokens+u.CacheReadInputTokens+u.CacheCreationInputTokens > 100_000 {
		scale = p.longPrompt
	}
	cost := p.in*float64(u.InputTokens) + p.in*1.25*float64(u.CacheCreationInputTokens) +
		p.cacheRead*float64(u.CacheReadInputTokens) + p.out*float64(u.OutputTokens)
	return int64(math.Round(cost*scale)) + webSearchMicros*u.ServerToolUse.WebSearchRequests
}

// maxToolRounds caps the API calls one student message can make.
const maxToolRounds = 5

var tools = []anthropic.ToolUnionParam{
	{OfWebSearchTool20250305: &anthropic.WebSearchTool20250305Param{MaxUses: anthropic.Int(2)}},
	{OfCodeExecutionTool20260120: &anthropic.CodeExecutionTool20260120Param{}},
	{OfTool: &anthropic.ToolParam{
		Name:        "report_struggle",
		Description: anthropic.String("Tell the teacher a student is still stuck on a topic after your first explanation, which suggests a gap in the lesson material."),
		Strict:      anthropic.Bool(true),
		InputSchema: anthropic.ToolInputSchemaParam{
			Properties: map[string]any{
				"topic":   map[string]any{"type": "string", "description": "The idea or exercise, in a few words"},
				"details": map[string]any{"type": "string", "description": "What the student finds confusing, and what might fix it in the material"},
			},
			Required:    []string{"topic", "details"},
			ExtraFields: map[string]any{"additionalProperties": false},
		},
	}},
}

// chat answers a student's message, streamed in the AI SDK's UI message stream format.
func (s *server) chat(w http.ResponseWriter, r *http.Request) {
	student, ok := studentID(r)
	var body struct{ Text string }
	if !ok || json.NewDecoder(r.Body).Decode(&body) != nil || strings.TrimSpace(body.Text) == "" {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	// Finish and record the reply even if the student closes the page mid-stream.
	ctx := context.WithoutCancel(r.Context())

	session, err := s.queries.CurrentSession(ctx)
	if errors.Is(err, pgx.ErrNoRows) {
		http.Error(w, "There's no lesson in progress.", http.StatusConflict)
		return
	}
	cfg, cfgErr := lesson.ReadConfig()
	if err = errors.Join(err, cfgErr); err != nil {
		internalError(w, "chat setup", err)
		return
	}
	p, ok := prices[cfg.Model]
	if !ok {
		internalError(w, "chat setup", fmt.Errorf("no price for model %q", cfg.Model))
		return
	}
	spent, err := s.queries.SessionSpendMicros(ctx, session.StartedAt)
	if err != nil {
		internalError(w, "session spend", err)
		return
	}
	if float64(spent)/1e6 >= cfg.SpendingCapUSD {
		http.Error(w, "The class has reached its spending limit for this lesson.", http.StatusTooManyRequests)
		return
	}

	system, err := lesson.SystemPrompt(cfg)
	key := db.ListStudentMessagesParams{SessionStartedAt: session.StartedAt, StudentID: student}
	history, histErr := s.queries.ListStudentMessages(ctx, key)
	if err = errors.Join(err, histErr); err != nil {
		internalError(w, "chat setup", err)
		return
	}
	messages := make([]anthropic.MessageParam, 0, len(history)+1)
	for _, m := range history {
		block := anthropic.NewTextBlock(m.Content)
		if m.Role == "user" {
			messages = append(messages, anthropic.NewUserMessage(block))
		} else {
			messages = append(messages, anthropic.NewAssistantMessage(block))
		}
	}
	messages = append(messages, anthropic.NewUserMessage(anthropic.NewTextBlock(body.Text)))
	if err := s.saveMessage(ctx, key, "user", body.Text); err != nil {
		internalError(w, "save message", err)
		return
	}

	h := w.Header()
	h.Set("Content-Type", "text/event-stream")
	h.Set("Cache-Control", "no-cache")
	h.Set("X-Vercel-AI-UI-Message-Stream", "v1")
	rc := http.NewResponseController(w)
	send := func(chunk map[string]string) {
		data, _ := json.Marshal(chunk)
		fmt.Fprintf(w, "data: %s\n\n", data)
		rc.Flush()
	}
	send(map[string]string{"type": "start"})
	send(map[string]string{"type": "text-start", "id": "text"})
	// Whenever no text is arriving (before the first word, while thinking or using tools), the student sees a status instead of a silent pause.
	working := false
	setWorking := func(on bool) {
		if on != working {
			working = on
			status := ""
			if on {
				status = "Thinking it through…"
			}
			send(map[string]string{"type": "data-status", "id": "status", "data": status})
		}
	}
	setWorking(true)

	params := anthropic.MessageNewParams{
		Model:        cfg.Model,
		MaxTokens:    16000,
		System:       []anthropic.TextBlockParam{{Text: system}},
		Messages:     messages,
		Tools:        tools,
		CacheControl: anthropic.NewCacheControlEphemeralParam(), // caches the prompt up to the latest message
		OutputConfig: anthropic.OutputConfigParam{Effort: anthropic.OutputConfigEffortLow},
	}
	var reply strings.Builder
	var message anthropic.Message
	var streamErr error
	// Each pass streams one response; tool calls and paused server tools need another pass.
	for range maxToolRounds {
		message = anthropic.Message{}
		separate := reply.Len() > 0 // keep text from separate passes apart
		stream := s.claude.Messages.NewStreaming(ctx, params)
		for stream.Next() {
			event := stream.Current()
			if err := message.Accumulate(event); err != nil {
				slog.Error("accumulate", "err", err)
			}
			if start, ok := event.AsAny().(anthropic.ContentBlockStartEvent); ok && start.ContentBlock.Type != "text" {
				setWorking(true)
			}
			if delta, ok := event.AsAny().(anthropic.ContentBlockDeltaEvent); ok {
				if text, ok := delta.Delta.AsAny().(anthropic.TextDelta); ok {
					setWorking(false)
					if separate {
						text.Text = "\n\n" + text.Text
						separate = false
					}
					reply.WriteString(text.Text)
					send(map[string]string{"type": "text-delta", "id": "text", "delta": text.Text})
				}
			}
		}
		streamErr = stream.Err()
		stream.Close()
		if message.ID != "" {
			s.saveUsage(ctx, session.StartedAt, student, cfg.Model, p, message.Usage)
		}
		if streamErr != nil || (message.StopReason != anthropic.StopReasonToolUse && message.StopReason != anthropic.StopReasonPauseTurn) {
			break
		}
		params.Messages = append(params.Messages, message.ToParam())
		if message.StopReason == anthropic.StopReasonToolUse {
			params.Messages = append(params.Messages, anthropic.NewUserMessage(s.runTools(ctx, key, message)...))
		}
	}
	setWorking(false)
	if streamErr != nil {
		slog.Error("claude", "err", streamErr)
		send(map[string]string{"type": "error", "errorText": "Sorry, something went wrong. Please try again."})
	} else if message.StopReason == anthropic.StopReasonRefusal && reply.Len() == 0 {
		const refusal = "Sorry, I can't help with that."
		reply.WriteString(refusal)
		send(map[string]string{"type": "text-delta", "id": "text", "delta": refusal})
	}
	send(map[string]string{"type": "text-end", "id": "text"})
	send(map[string]string{"type": "finish"})
	fmt.Fprint(w, "data: [DONE]\n\n")
	rc.Flush()

	if reply.Len() > 0 {
		if err := s.saveMessage(ctx, key, "assistant", reply.String()); err != nil {
			slog.Error("save reply", "err", err)
		}
	}
}

// runTools runs the client-side tools Claude called; web search and code execution run on Anthropic's servers.
func (s *server) runTools(ctx context.Context, key db.ListStudentMessagesParams, message anthropic.Message) []anthropic.ContentBlockParamUnion {
	var results []anthropic.ContentBlockParamUnion
	for _, block := range message.Content {
		use, ok := block.AsAny().(anthropic.ToolUseBlock)
		if !ok {
			continue
		}
		var in struct{ Topic, Details string }
		err := json.Unmarshal([]byte(use.JSON.Input.Raw()), &in)
		if err == nil && use.Name == "report_struggle" {
			err = s.queries.InsertStruggle(ctx, db.InsertStruggleParams{
				SessionStartedAt: key.SessionStartedAt, StudentID: key.StudentID, Topic: in.Topic, Details: in.Details,
			})
		} else if err == nil {
			err = fmt.Errorf("unknown tool %q", use.Name)
		}
		if err != nil {
			slog.Error("tool", "name", use.Name, "err", err)
			results = append(results, anthropic.NewToolResultBlock(use.ID, "Couldn't record the report.", true))
		} else {
			results = append(results, anthropic.NewToolResultBlock(use.ID, "Reported to the teacher.", false))
		}
	}
	return results
}

func (s *server) saveUsage(ctx context.Context, sessionStartedAt time.Time, student, model string, p price, u anthropic.Usage) {
	err := s.queries.InsertUsage(ctx, db.InsertUsageParams{
		SessionStartedAt: sessionStartedAt, StudentID: student, Model: model,
		InputTokens: u.InputTokens, OutputTokens: u.OutputTokens,
		CacheReadTokens: u.CacheReadInputTokens, CacheWriteTokens: u.CacheCreationInputTokens,
		CostMicros: p.costMicros(u),
	})
	if err != nil {
		slog.Error("save usage", "err", err)
	}
}

func (s *server) saveMessage(ctx context.Context, key db.ListStudentMessagesParams, role, content string) error {
	return s.queries.InsertMessage(ctx, db.InsertMessageParams{
		SessionStartedAt: key.SessionStartedAt, StudentID: key.StudentID, Role: role, Content: content,
	})
}
