// Survey Entity Types

export type SurveyStatus = 'draft' | 'active' | 'paused' | 'closed';

export interface Survey {
    id: string;
    tenant_id: string;
    title: string;
    description?: string;
    status: SurveyStatus;
    start_date?: string;
    end_date?: string;
    created_by: string;
    requires_geolocation: boolean;
    requires_photo: boolean;
    requires_signature: boolean;
    allow_offline: boolean;
    questions?: Question[];
    created_at: string;
    updated_at: string;
    deleted_at?: string;
}

export interface CreateSurveyDTO {
    title: string;
    description?: string;
    start_date?: string;
    end_date?: string;
    requires_geolocation?: boolean;
    requires_photo?: boolean;
    requires_signature?: boolean;
    allow_offline?: boolean;
}

export interface UpdateSurveyDTO extends Partial<CreateSurveyDTO> {
    status?: SurveyStatus;
}

import type { Question } from './Question';
