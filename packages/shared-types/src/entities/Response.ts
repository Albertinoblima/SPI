// Response Entity Types

export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'error';

export interface GeoLocation {
    latitude: number;
    longitude: number;
    accuracy: number;
    timestamp: string;
}

export interface ResponseAnswer {
    id: string;
    response_id: string;
    question_id: string;
    answer_text?: string;
    answer_number?: number;
    answer_date?: string;
    answer_json?: unknown;
    media_url?: string;
    created_at: string;
}

export interface SurveyResponse {
    id: string;
    survey_id: string;
    interviewer_id: string;
    tenant_id: string;
    respondent_name?: string;
    respondent_phone?: string;
    respondent_document?: string;
    location?: GeoLocation;
    address_street?: string;
    address_city?: string;
    address_state?: string;
    address_zip?: string;
    started_at: string;
    completed_at?: string;
    sync_status: SyncStatus;
    device_id?: string;
    local_id?: string;
    sync_version: number;
    answers?: ResponseAnswer[];
    created_at: string;
    updated_at: string;
}

export interface CreateResponseDTO {
    survey_id: string;
    respondent_name?: string;
    respondent_phone?: string;
    respondent_document?: string;
    location?: GeoLocation;
    address_street?: string;
    address_city?: string;
    address_state?: string;
    address_zip?: string;
    started_at: string;
    completed_at?: string;
    device_id?: string;
    local_id?: string;
    answers: Omit<ResponseAnswer, 'id' | 'response_id' | 'created_at'>[];
}
