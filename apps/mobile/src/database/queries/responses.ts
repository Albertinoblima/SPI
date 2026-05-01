// CRUD operations for offline responses
import type { SurveyResponse, CreateResponseDTO } from '@political-research/shared-types';
import { generateLocalId } from '@political-research/shared-utils';

export interface ResponseRepository {
    create(dto: CreateResponseDTO, interviewerId: string, tenantId: string): Promise<SurveyResponse>;
    getById(id: string): Promise<SurveyResponse | null>;
    getByStatus(status: string): Promise<SurveyResponse[]>;
    getBySurveyId(surveyId: string): Promise<SurveyResponse[]>;
    updateSyncStatus(id: string, status: string, error?: string): Promise<void>;
    getPendingSync(): Promise<SurveyResponse[]>;
}

// TODO: Implement with expo-sqlite
export class SQLiteResponseRepository implements ResponseRepository {
    async create(dto: CreateResponseDTO, interviewerId: string, tenantId: string): Promise<SurveyResponse> {
        const id = generateLocalId();
        const now = new Date().toISOString();

        const response: SurveyResponse = {
            id,
            survey_id: dto.survey_id,
            interviewer_id: interviewerId,
            tenant_id: tenantId,
            respondent_name: dto.respondent_name,
            respondent_phone: dto.respondent_phone,
            respondent_document: dto.respondent_document,
            location: dto.location,
            address_street: dto.address_street,
            address_city: dto.address_city,
            address_state: dto.address_state,
            address_zip: dto.address_zip,
            started_at: dto.started_at,
            completed_at: dto.completed_at,
            sync_status: 'pending',
            device_id: dto.device_id,
            local_id: id,
            sync_version: 1,
            created_at: now,
            updated_at: now,
        };

        // TODO: Insert into SQLite
        return response;
    }

    async getById(id: string): Promise<SurveyResponse | null> {
        // TODO: Query SQLite
        return null;
    }

    async getByStatus(status: string): Promise<SurveyResponse[]> {
        // TODO: Query SQLite
        return [];
    }

    async getBySurveyId(surveyId: string): Promise<SurveyResponse[]> {
        // TODO: Query SQLite
        return [];
    }

    async updateSyncStatus(id: string, status: string, error?: string): Promise<void> {
        // TODO: Update in SQLite
    }

    async getPendingSync(): Promise<SurveyResponse[]> {
        return this.getByStatus('pending');
    }
}
