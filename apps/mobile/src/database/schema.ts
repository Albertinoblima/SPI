// Mobile SQLite Schema — Drizzle ORM

import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// ============================================================================
// TABELA: tenants (cache local)
// ============================================================================
export const tenants = sqliteTable('tenants', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    status: text('status').default('active'),
    max_users: integer('max_users').default(10),
    created_at: text('created_at').default(sql`CURRENT_TIMESTAMP`),
    updated_at: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

// ============================================================================
// TABELA: surveys (offline storage)
// ============================================================================
export const surveys = sqliteTable('surveys', {
    id: text('id').primaryKey(),
    tenant_id: text('tenant_id').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    status: text('status').default('active'),

    // JSON serializado das perguntas
    questions_json: text('questions_json').notNull(),

    requires_geolocation: integer('requires_geolocation', { mode: 'boolean' }).default(true),
    requires_photo: integer('requires_photo', { mode: 'boolean' }).default(false),

    // Sync metadata
    server_updated_at: text('server_updated_at'),
    local_updated_at: text('local_updated_at').default(sql`CURRENT_TIMESTAMP`),
    synced: integer('synced', { mode: 'boolean' }).default(false),
});

// ============================================================================
// TABELA: responses (armazena respostas offline)
// ============================================================================
export const responses = sqliteTable('responses', {
    // Local ID (gerado no dispositivo)
    id: text('id').primaryKey(),

    // Server ID (após sincronização)
    server_id: text('server_id'),

    tenant_id: text('tenant_id').notNull(),
    survey_id: text('survey_id').notNull(),
    interviewer_id: text('interviewer_id').notNull(),

    // Dados do respondente
    respondent_name: text('respondent_name'),
    respondent_phone: text('respondent_phone'),
    respondent_email: text('respondent_email'),

    // Geolocalização (WGS84)
    location_lat: real('location_lat'),
    location_lng: real('location_lng'),
    location_accuracy: real('location_accuracy'),
    address_street: text('address_street'),
    address_city: text('address_city'),
    address_state: text('address_state'),

    // Device info
    device_id: text('device_id').notNull(),

    // Status
    is_complete: integer('is_complete', { mode: 'boolean' }).default(false),

    // Timestamps
    created_at: text('created_at').default(sql`CURRENT_TIMESTAMP`),
    updated_at: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
    completed_at: text('completed_at'),

    // Sync control
    synced: integer('synced', { mode: 'boolean' }).default(false),
    sync_attempts: integer('sync_attempts').default(0),
    last_sync_error: text('last_sync_error'),
});

// ============================================================================
// TABELA: response_answers (respostas individuais)
// ============================================================================
export const response_answers = sqliteTable('response_answers', {
    id: text('id').primaryKey(),
    response_id: text('response_id').notNull(),
    question_id: text('question_id').notNull(),

    // Valores polimórficos
    answer_text: text('answer_text'),
    answer_number: real('answer_number'),
    answer_date: text('answer_date'),
    answer_json: text('answer_json'), // Para arrays, objects

    // Media (caminhos locais)
    photo_local_path: text('photo_local_path'),
    photo_server_url: text('photo_server_url'),
    signature_local_path: text('signature_local_path'),
    signature_server_url: text('signature_server_url'),

    created_at: text('created_at').default(sql`CURRENT_TIMESTAMP`),
    updated_at: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

// ============================================================================
// TABELA: sync_queue (fila de sincronização)
// ============================================================================
export const sync_queue = sqliteTable('sync_queue', {
    id: text('id').primaryKey(),

    // Tipo de entidade a sincronizar
    entity_type: text('entity_type').notNull(), // 'response', 'media'
    entity_id: text('entity_id').notNull(),

    // Payload (JSON serializado)
    payload: text('payload').notNull(),

    // Retry logic
    retry_count: integer('retry_count').default(0),
    max_retries: integer('max_retries').default(5),
    next_retry_at: text('next_retry_at'),
    last_error: text('last_error'),

    // Priority (0 = highest)
    priority: integer('priority').default(10),

    // Timestamps
    created_at: text('created_at').default(sql`CURRENT_TIMESTAMP`),
    updated_at: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

// ============================================================================
// INDICES para performance
// ============================================================================
// CREATE INDEX idx_responses_survey ON responses(survey_id, synced);
// CREATE INDEX idx_responses_sync ON responses(synced, created_at);
// CREATE INDEX idx_sync_queue_priority ON sync_queue(priority, created_at);
// CREATE INDEX idx_sync_queue_retry ON sync_queue(next_retry_at) WHERE next_retry_at IS NOT NULL;
