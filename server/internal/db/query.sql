-- Lesson sessions

-- name: StartSession :one
INSERT INTO lesson_sessions DEFAULT VALUES
RETURNING *;

-- name: CurrentSession :one
SELECT * FROM lesson_sessions
WHERE ended_at IS NULL;

-- name: LatestSession :one
SELECT * FROM lesson_sessions
ORDER BY started_at DESC
LIMIT 1;

-- name: EndSession :execrows
UPDATE lesson_sessions SET ended_at = now()
WHERE ended_at IS NULL;

-- Students

-- name: InsertMessage :exec
INSERT INTO messages (session_started_at, student_id, role, content)
VALUES ($1, $2, $3, $4);

-- name: ListStudentMessages :many
SELECT * FROM messages
WHERE session_started_at = $1 AND student_id = $2
ORDER BY id;

-- name: SaveFeedback :exec
INSERT INTO feedback (session_started_at, student_id, rating, comment)
VALUES ($1, $2, $3, $4)
ON CONFLICT (session_started_at, student_id)
DO UPDATE SET rating = EXCLUDED.rating, comment = EXCLUDED.comment, created_at = now();

-- name: InsertStruggle :exec
INSERT INTO struggles (session_started_at, student_id, topic, details)
VALUES ($1, $2, $3, $4);

-- Spending

-- name: InsertUsage :exec
INSERT INTO api_usage (
    session_started_at, student_id, model,
    input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, cost_micros
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8);

-- name: SessionSpendMicros :one
SELECT COALESCE(SUM(cost_micros), 0)::bigint AS total
FROM api_usage
WHERE session_started_at = $1;

-- Dashboard

-- name: SessionFeedback :many
SELECT * FROM feedback
WHERE session_started_at = $1
ORDER BY created_at DESC;

-- name: SessionStruggles :many
SELECT * FROM struggles
WHERE session_started_at = $1
ORDER BY id DESC;

-- name: SessionUsage :many
SELECT created_at,
       (input_tokens + output_tokens + cache_read_tokens + cache_write_tokens)::bigint AS tokens,
       cost_micros
FROM api_usage
WHERE session_started_at = $1
ORDER BY id;

-- Lesson settings

-- name: GetSettings :one
SELECT * FROM settings;

-- name: UpdateSettings :exec
UPDATE settings SET lesson_name = $1, spending_cap_usd = $2, resources = $3;

-- name: ListContextFiles :many
SELECT * FROM context_files
ORDER BY name;

-- name: ListContextFileNames :many
SELECT name FROM context_files
ORDER BY name;

-- name: PutContextFile :exec
INSERT INTO context_files (name, content)
VALUES ($1, $2)
ON CONFLICT (name) DO UPDATE SET content = EXCLUDED.content, updated_at = now();

-- name: DeleteContextFile :exec
DELETE FROM context_files
WHERE name = $1;
