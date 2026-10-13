CREATE TABLE IF NOT EXISTS lesson_sessions (
    started_at timestamptz PRIMARY KEY DEFAULT date_trunc('milliseconds', now()),
    ended_at   timestamptz CHECK (ended_at > started_at)
);

CREATE UNIQUE INDEX IF NOT EXISTS one_open_session
    ON lesson_sessions ((true)) WHERE ended_at IS NULL;

CREATE TABLE IF NOT EXISTS attendance (
    session_started_at timestamptz NOT NULL REFERENCES lesson_sessions (started_at),
    student_id         text        NOT NULL,
    joined_at          timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (session_started_at, student_id)
);

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
