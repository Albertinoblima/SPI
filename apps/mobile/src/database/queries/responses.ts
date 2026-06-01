// CRUD operations for offline responses - Production Implementation with Drizzle
import { eq, and, desc } from 'drizzle-orm';
import { getDatabase } from '../db';
import { responses, response_answers } from '../schema';
import type { SurveyResponse, CreateResponseDTO, ResponseAnswer } from '@political-research/shared-types';
import { generateLocalId } from '@political-research/shared-utils';

type ResponseRow = typeof responses.$inferSelect;
type ResponseAnswerRow = typeof response_answers.$inferSelect;

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
            const answerRecords = dto.answers.map((answer: CreateResponseDTO['answers'][number]) => ({
                id: generateLocalId(),
                response_id: localId,
                question_id: String(answer.question_id ?? ''),
                answer_text: answer.answer_text ?? null,
                answer_number: answer.answer_number ?? null,
                answer_date: answer.answer_date ?? null,
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
        const row = result[0];
        if (!row) return null;

        const answers = await this.getAnswersForResponse(id);
        return this.mapToSurveyResponse(row, answers);
    }

    async getBySurveyId(surveyId: string): Promise<SurveyResponse[]> {
        const result = await this.db
            .select()
            .from(responses)
            .where(eq(responses.survey_id, surveyId))
            .orderBy(desc(responses.created_at));

        return Promise.all(
            result.map(async (r: ResponseRow) => {
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
            result.map(async (r: ResponseRow) => {
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

    private async getAnswersForResponse(responseId: string): Promise<ResponseAnswer[]> {
        const result = await this.db.select().from(response_answers).where(eq(response_answers.response_id, responseId));
        return result.map((answer: ResponseAnswerRow) => ({
            id: answer.id,
            response_id: answer.response_id,
            question_id: answer.question_id,
            ...(answer.answer_text !== null ? { answer_text: answer.answer_text } : {}),
            ...(answer.answer_number !== null ? { answer_number: answer.answer_number } : {}),
            ...(answer.answer_date !== null ? { answer_date: answer.answer_date } : {}),
            ...(answer.answer_json ? { answer_json: JSON.parse(answer.answer_json) } : {}),
            created_at: answer.created_at ?? new Date().toISOString(),
        }));
    }

    private mapToSurveyResponse(row: ResponseRow, answers: ResponseAnswer[]): SurveyResponse {
        const result: SurveyResponse = {
            id: row.id,
            survey_id: row.survey_id,
            interviewer_id: row.interviewer_id,
            tenant_id: row.tenant_id,
            ...(row.respondent_name !== null ? { respondent_name: row.respondent_name } : {}),
            ...(row.respondent_phone !== null ? { respondent_phone: row.respondent_phone } : {}),
            ...((row.location_lat !== null && row.location_lng !== null)
                ? {
                    location: {
                        latitude: Number(row.location_lat),
                        longitude: Number(row.location_lng),
                        accuracy: Number(row.location_accuracy ?? 0),
                        timestamp: row.created_at ?? new Date().toISOString(),
                    },
                }
                : {}),
            ...(row.address_street !== null ? { address_street: row.address_street } : {}),
            ...(row.address_city !== null ? { address_city: row.address_city } : {}),
            ...(row.address_state !== null ? { address_state: row.address_state } : {}),
            started_at: row.created_at ?? new Date().toISOString(),
            ...(row.completed_at !== null ? { completed_at: row.completed_at } : {}),
            sync_status: row.synced ? 'synced' : 'pending',
            ...(row.device_id ? { device_id: row.device_id } : {}),
            local_id: row.id,
            sync_version: (row.sync_attempts ?? 0) + 1,
            ...(answers.length > 0 ? { answers } : {}),
            created_at: row.created_at ?? new Date().toISOString(),
            updated_at: row.updated_at ?? new Date().toISOString(),
        };
        return result;
    }
}

export const responseRepository = new SQLiteResponseRepository();
