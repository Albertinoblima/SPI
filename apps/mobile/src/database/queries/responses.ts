// CRUD operations for offline responses - Production Implementation with Drizzle
import { eq, and, desc } from 'drizzle-orm';
import { getDatabase } from '../db';
import { responses, response_answers } from '../schema';
import type { SurveyResponse, CreateResponseDTO, ResponseAnswer } from '@political-research/shared-types';
import { generateLocalId } from '@political-research/shared-utils';

export interface ResponseRepository {
    create(dto: CreateResponseDTO, interviewerId: string, tenantId: string): Promise<SurveyResponse>;
    getById(id: string): Promise<SurveyResponse | null>;
    getBySurveyId(surveyId: string): Promise<SurveyResponse[]>;
    getPendingSync(limit?: number): Promise<SurveyResponse[]>;
    markAsSynced(localId: string, serverId: string): Promise<void>;
    updateSyncError(localId: string, error: string): Promise<void>;
    incrementSyncAttempts(localId: string): Promise<void>;
}

export class SQLiteResponseRepository implements ResponseRepository {
    private get db() {
        return getDatabase();
    }

    async create(dto: CreateResponseDTO, interviewerId: string, tenantId: string): Promise<SurveyResponse> {
        const localId = generateLocalId();
        const now = new Date().toISOString();

        const responseRecord = {
            id: localId,
            survey_id: dto.survey_id,
            interviewer_id: interviewerId,
            tenant_id: tenantId,
            respondent_name: dto.respondent_name ?? null,
            respondent_phone: dto.respondent_phone ?? null,
            respondent_email: null,
            location_lat: dto.location?.latitude ?? null,
            location_lng: dto.location?.longitude ?? null,
            location_accuracy: dto.location?.accuracy ?? null,
            address_street: dto.address_street ?? null,
            address_city: dto.address_city ?? null,
            address_state: dto.address_state ?? null,
            device_id: dto.device_id ?? 'unknown',
            is_complete: !!dto.completed_at,
            created_at: now,
            updated_at: now,
            completed_at: dto.completed_at ?? null,
            synced: false,
            sync_attempts: 0,
            last_sync_error: null,
        };

        await this.db.insert(responses).values(responseRecord);

        if (dto.answers && dto.answers.length > 0) {
            const answerRecords = dto.answers.map((answer: Record<string, unknown>) => ({
                id: generateLocalId(),
                response_id: localId,
                question_id: String(answer.question_id ?? ''),
                answer_text: (answer.answer_text as string | null) ?? null,
                answer_number: (answer.answer_number as number | null) ?? null,
                answer_date: (answer.answer_date as string | null) ?? null,
                answer_json: answer.answer_json ? JSON.stringify(answer.answer_json) : null,
                created_at: now,
                updated_at: now,
            }));

            await this.db.insert(response_answers).values(answerRecords);
        }

        return this.mapToSurveyResponse(responseRecord, dto.answers || []);
    }

    async getById(id: string): Promise<SurveyResponse | null> {
        const result = await this.db.select().from(responses).where(eq(responses.id, id)).limit(1);
        if (result.length === 0) return null;

        const answers = await this.getAnswersForResponse(id);
        return this.mapToSurveyResponse(result[0], answers);
    }

    async getBySurveyId(surveyId: string): Promise<SurveyResponse[]> {
        const result = await this.db
            .select()
            .from(responses)
            .where(eq(responses.survey_id, surveyId))
            .orderBy(desc(responses.created_at));

        return Promise.all(
            result.map(async (r) => {
                const answers = await this.getAnswersForResponse(r.id);
                return this.mapToSurveyResponse(r, answers);
            })
        );
    }

    async getPendingSync(limit: number = 50): Promise<SurveyResponse[]> {
        const result = await this.db
            .select()
            .from(responses)
            .where(and(eq(responses.synced, false), eq(responses.is_complete, true)))
            .orderBy(responses.created_at)
            .limit(limit);

        return Promise.all(
            result.map(async (r) => {
                const answers = await this.getAnswersForResponse(r.id);
                return this.mapToSurveyResponse(r, answers);
            })
        );
    }

    async markAsSynced(localId: string, serverId: string): Promise<void> {
        const now = new Date().toISOString();
        await this.db
            .update(responses)
            .set({ server_id: serverId, synced: true, updated_at: now, last_sync_error: null })
            .where(eq(responses.id, localId));
    }

    async updateSyncError(localId: string, error: string): Promise<void> {
        await this.db
            .update(responses)
            .set({ last_sync_error: error.slice(0, 500), updated_at: new Date().toISOString() })
            .where(eq(responses.id, localId));
    }

    async incrementSyncAttempts(localId: string): Promise<void> {
        const current = await this.db
            .select({ sync_attempts: responses.sync_attempts })
            .from(responses)
            .where(eq(responses.id, localId))
            .limit(1);

        const newAttempts = (current[0]?.sync_attempts ?? 0) + 1;

        await this.db
            .update(responses)
            .set({ sync_attempts: newAttempts, updated_at: new Date().toISOString() })
            .where(eq(responses.id, localId));
    }

    private async getAnswersForResponse(responseId: string) {
        const result = await this.db.select().from(response_answers).where(eq(response_answers.response_id, responseId));
        return result.map((a) => ({
            ...a,
            answer_json: a.answer_json ? JSON.parse(a.answer_json) : undefined,
        }));
    }

    private mapToSurveyResponse(row: Record<string, unknown>, answers: unknown[]): SurveyResponse {
        const result: SurveyResponse = {
            id: String(row.id ?? ''),
            survey_id: String(row.survey_id ?? ''),
            interviewer_id: String(row.interviewer_id ?? ''),
            tenant_id: String(row.tenant_id ?? ''),
            respondent_name: (row.respondent_name as string | undefined) ?? undefined,
            respondent_phone: (row.respondent_phone as string | undefined) ?? undefined,
            respondent_document: undefined,
            location: row.location_lat
                ? {
                      latitude: Number(row.location_lat),
                      longitude: Number(row.location_lng),
                      accuracy: (row.location_accuracy as number | undefined) ?? undefined,
                      timestamp: String(row.created_at ?? ''),
                  }
                : undefined,
            address_street: (row.address_street as string | undefined) ?? undefined,
            address_city: (row.address_city as string | undefined) ?? undefined,
            address_state: (row.address_state as string | undefined) ?? undefined,
            started_at: String(row.created_at ?? ''),
            completed_at: (row.completed_at as string | undefined) ?? undefined,
            sync_status: row.synced ? 'synced' : 'pending',
            device_id: String(row.device_id ?? 'unknown'),
            local_id: String(row.id ?? ''),
            sync_version: ((row.sync_attempts as number | undefined) || 0) + 1,
            answers: answers as ResponseAnswer[], // local rows map to ResponseAnswer shape (parsed JSON)
            created_at: String(row.created_at ?? ''),
            updated_at: String(row.updated_at ?? ''),
        };
        return result;
    }
}

export const responseRepository = new SQLiteResponseRepository();
