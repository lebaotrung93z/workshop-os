CREATE TABLE workspaces (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE templates (
    id UUID PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    key VARCHAR(64) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (workspace_id, key)
);

CREATE TABLE step_defs (
    id UUID PRIMARY KEY,
    template_id UUID NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
    step_order INT NOT NULL,
    type VARCHAR(32) NOT NULL,
    title VARCHAR(255) NOT NULL,
    instructions TEXT,
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    timer_seconds INT,
    UNIQUE (template_id, step_order)
);

CREATE TABLE step_groups (
    id UUID PRIMARY KEY,
    step_def_id UUID NOT NULL REFERENCES step_defs(id) ON DELETE CASCADE,
    group_order INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    UNIQUE (step_def_id, group_order)
);

CREATE TABLE sessions (
    id UUID PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    template_id UUID NOT NULL REFERENCES templates(id),
    code VARCHAR(6) NOT NULL UNIQUE,
    title VARCHAR(255) NOT NULL,
    status VARCHAR(32) NOT NULL,
    current_step_id UUID,
    host_token_hash VARCHAR(128) NOT NULL,
    timer_ends_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE session_steps (
    id UUID PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    step_def_id UUID REFERENCES step_defs(id),
    step_order INT NOT NULL,
    type VARCHAR(32) NOT NULL,
    title VARCHAR(255) NOT NULL,
    instructions TEXT,
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    UNIQUE (session_id, step_order)
);

ALTER TABLE sessions
    ADD CONSTRAINT fk_sessions_current_step
    FOREIGN KEY (current_step_id) REFERENCES session_steps(id);

CREATE TABLE session_step_groups (
    id UUID PRIMARY KEY,
    session_step_id UUID NOT NULL REFERENCES session_steps(id) ON DELETE CASCADE,
    group_order INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    UNIQUE (session_step_id, group_order)
);

CREATE TABLE participants (
    id UUID PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    display_name VARCHAR(120) NOT NULL,
    join_token_hash VARCHAR(128) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE input_entries (
    id UUID PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    session_step_id UUID NOT NULL REFERENCES session_steps(id) ON DELETE CASCADE,
    group_id UUID REFERENCES session_step_groups(id),
    content TEXT NOT NULL,
    author_id UUID REFERENCES participants(id),
    hidden BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE votes (
    id UUID PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    session_step_id UUID NOT NULL REFERENCES session_steps(id) ON DELETE CASCADE,
    entry_id UUID NOT NULL REFERENCES input_entries(id) ON DELETE CASCADE,
    participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (entry_id, participant_id)
);

CREATE TABLE action_items (
    id UUID PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    owner TEXT,
    due_date DATE,
    source_entry_id UUID REFERENCES input_entries(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ai_summaries (
    id UUID PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    provider VARCHAR(64) NOT NULL,
    model VARCHAR(128),
    insights_json TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sessions_code ON sessions(code);
CREATE INDEX idx_input_entries_step ON input_entries(session_step_id);
CREATE INDEX idx_votes_step ON votes(session_step_id);
CREATE INDEX idx_participants_session ON participants(session_id);
