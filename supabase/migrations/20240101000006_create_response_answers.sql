-- ============================================================================
-- MIGRATION: 20240101000006_create_response_answers.sql
-- ============================================================================

CREATE TABLE response_answers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
    response_id UUID NOT NULL REFERENCES responses (id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES questions (id) ON DELETE CASCADE,

    -- Answer value (polymorphic storage)
    answer_text TEXT,
    answer_number NUMERIC,
    answer_date DATE,
    answer_json JSONB, -- For multiple choice, ratings, etc.

    -- Media attachments
    photo_url TEXT, -- Supabase Storage URL
    signature_url TEXT,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),

    UNIQUE (response_id, question_id)
);

CREATE INDEX idx_answers_tenant ON response_answers (tenant_id);
CREATE INDEX idx_answers_response ON response_answers (response_id);
CREATE INDEX idx_answers_question ON response_answers (question_id);
