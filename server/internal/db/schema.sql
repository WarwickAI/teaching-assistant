CREATE TABLE IF NOT EXISTS lesson_sessions (
    started_at timestamptz PRIMARY KEY DEFAULT date_trunc('milliseconds', now()),
    ended_at   timestamptz CHECK (ended_at > started_at)
);

-- When the teacher last asked the class for feedback.
ALTER TABLE lesson_sessions ADD COLUMN IF NOT EXISTS feedback_requested_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS one_open_session
    ON lesson_sessions ((true)) WHERE ended_at IS NULL;

CREATE TABLE IF NOT EXISTS messages (
    id                 bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    session_started_at timestamptz NOT NULL REFERENCES lesson_sessions (started_at),
    student_id         text        NOT NULL,
    role               text        NOT NULL CHECK (role IN ('user', 'assistant')),
    content            text        NOT NULL,
    created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS messages_by_student
    ON messages (session_started_at, student_id, id);

CREATE TABLE IF NOT EXISTS feedback (
    session_started_at timestamptz NOT NULL REFERENCES lesson_sessions (started_at),
    student_id         text        NOT NULL,
    rating             smallint    NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment            text,
    created_at         timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (session_started_at, student_id)
);

CREATE TABLE IF NOT EXISTS struggles (
    id                 bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    session_started_at timestamptz NOT NULL REFERENCES lesson_sessions (started_at),
    student_id         text        NOT NULL,
    topic              text        NOT NULL,
    details            text        NOT NULL,
    created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS api_usage (
    id                 bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    session_started_at timestamptz NOT NULL REFERENCES lesson_sessions (started_at),
    student_id         text        NOT NULL,
    model              text        NOT NULL,
    input_tokens       bigint      NOT NULL,
    output_tokens      bigint      NOT NULL,
    cache_read_tokens  bigint      NOT NULL,
    cache_write_tokens bigint      NOT NULL,
    cost_micros        bigint      NOT NULL,
    created_at         timestamptz NOT NULL DEFAULT now()
);

-- The lesson settings the teacher edits from the dashboard; there is only ever one row.
CREATE TABLE IF NOT EXISTS settings (
    id               boolean          PRIMARY KEY DEFAULT true CHECK (id),
    lesson_name      text             NOT NULL DEFAULT '',
    spending_cap_usd double precision NOT NULL DEFAULT 10 CHECK (spending_cap_usd >= 0),
    resources        jsonb            NOT NULL DEFAULT '[]' -- [{"title": ..., "url": ...}]
);

INSERT INTO settings DEFAULT VALUES ON CONFLICT DO NOTHING;

-- Markdown lesson material the teacher uploads, which goes into the assistant's system prompt.
CREATE TABLE IF NOT EXISTS context_files (
    name       text        PRIMARY KEY,
    content    text        NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
);
