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

-- name: RecordAttendance :exec
INSERT INTO attendance (session_started_at, student_id)
VALUES ($1, $2)
ON CONFLICT DO NOTHING;

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

-- name: RecentAttendance :many
SELECT s.started_at, count(a.student_id) AS students
FROM lesson_sessions s
LEFT JOIN attendance a ON a.session_started_at = s.started_at
GROUP BY s.started_at
ORDER BY s.started_at DESC
LIMIT 5;

-- name: SessionStudents :many
SELECT a.student_id,
       (SELECT count(*) FROM attendance x WHERE x.student_id = a.student_id) AS sessions_attended
FROM attendance a
WHERE a.session_started_at = $1
ORDER BY a.joined_at;

-- name: SessionMessages :many
SELECT * FROM messages
WHERE session_started_at = $1
ORDER BY id;

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
