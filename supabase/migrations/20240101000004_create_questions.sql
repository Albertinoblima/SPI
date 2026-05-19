-- ============================================================================
-- MIGRATION: 20240101000004_create_questions.sql
-- ============================================================================

CREATE TYPE question_type AS ENUM (
    'text',
    'number',
    'single_choice',
    'multiple_choice',
    'rating',
    'date',
    'photo',
    'signature',
    'geolocation'
);

CREATE TABLE questions (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    survey_id uuid NOT NULL REFERENCES surveys (id) ON DELETE CASCADE,
    tenant_id uuid NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,

    -- Question details
    question_text text NOT NULL,
    question_type question_type NOT NULL,
    is_required boolean DEFAULT FALSE,

    -- Order and logic
    order_index integer NOT NULL,
    parent_question_id uuid REFERENCES questions (id), -- Conditional questions
    show_if_answer jsonb, -- {"parent_answer": "value"}

    -- Options (for choice questions)
    options jsonb, -- [{"value": "A", "label": "Option A"}, ...]

    -- Validation
    validation_rules jsonb, -- {"min": 1, "max": 5, "regex": "..."}

    -- Metadata
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),

    UNIQUE (survey_id, order_index)
);

CREATE INDEX idx_questions_survey ON questions (survey_id, order_index);
CREATE INDEX idx_questions_tenant ON questions (tenant_id);
CREATE INDEX idx_questions_parent ON questions (parent_question_id);
