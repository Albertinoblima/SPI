// Sync Queue Management - Production Implementation with Drizzle
import { eq, and, lt, desc } from 'drizzle-orm';
import { getDatabase } from '../db';
import { sync_queue } from '../schema';
import { generateLocalId } from '@political-research/shared-utils';

export interface SyncQueueItem {
    id: string;
    entity_type: 'response' | 'media';
    entity_id: string;
    payload: string;
    status: 'pending' | 'syncing' | 'synced' | 'error';
    retry_count: number;
    max_retries: number;
    next_retry_at: string | null;
    last_error: string | null;
    priority: number;
    created_at: string;
    updated_at: string;
}

export interface SyncQueueRepository {
    add(type: SyncQueueItem['entity_type'], entityId: string, payload: unknown, priority?: number): Promise<SyncQueueItem>;
    getAll(): Promise<SyncQueueItem[]>;
    getPending(limit?: number): Promise<SyncQueueItem[]>;
    getNextBatch(batchSize: number): Promise<SyncQueueItem[]>;
    updateStatus(id: string, status: SyncQueueItem['status'], error?: string): Promise<void>;
    incrementRetry(id: string, nextRetryAt: string | null): Promise<void>;
    remove(id: string): Promise<void>;
    clearCompleted(): Promise<void>;
}

export class SQLiteSyncQueueRepository implements SyncQueueRepository {
    private get db() {
        return getDatabase();
    }

    async add(
        type: SyncQueueItem['entity_type'],
        entityId: string,
        payload: unknown,
        priority: number = 10
    ): Promise<SyncQueueItem> {
        const now = new Date().toISOString();
        const id = generateLocalId();

        const item = {
            id,
            entity_type: type,
            entity_id: entityId,
            payload: JSON.stringify(payload),
            status: 'pending' as const,
            retry_count: 0,
            max_retries: 5,
            next_retry_at: null,
            last_error: null,
            priority,
            created_at: now,
            updated_at: now,
        };

        await this.db.insert(sync_queue).values(item);

        return item;
    }

    async getAll(): Promise<SyncQueueItem[]> {
        const result = await this.db
            .select()
            .from(sync_queue)
            .orderBy(desc(sync_queue.created_at));

        return result as SyncQueueItem[];
    }

    async getPending(limit: number = 100): Promise<SyncQueueItem[]> {
        const result = await this.db
            .select()
            .from(sync_queue)
            .where(eq(sync_queue.status, 'pending'))
            .orderBy(desc(sync_queue.priority), sync_queue.created_at)
            .limit(limit);

        return result as SyncQueueItem[];
    }

    async getNextBatch(batchSize: number, entityType?: 'response' | 'media'): Promise<SyncQueueItem[]> {
        let baseQuery = this.db
            .select()
            .from(sync_queue)
            .where(eq(sync_queue.status, 'pending'))
            .orderBy(desc(sync_queue.priority), sync_queue.created_at)
            .limit(batchSize);

        const result = await baseQuery;

        const filtered = entityType
            ? result.filter((r) => r.entity_type === entityType)
            : result;

        return filtered as SyncQueueItem[];
    }

    async updateStatus(id: string, status: SyncQueueItem['status'], error?: string): Promise<void> {
        const now = new Date().toISOString();

        await this.db
            .update(sync_queue)
            .set({
                status,
                last_error: error ?? null,
                updated_at: now,
            })
            .where(eq(sync_queue.id, id));
    }

    async incrementRetry(id: string, nextRetryAt: string | null): Promise<void> {
        const now = new Date().toISOString();

        // Fetch current retry count (safe, explicit)
        const current = await this.db
            .select({ retry_count: sync_queue.retry_count })
            .from(sync_queue)
            .where(eq(sync_queue.id, id))
            .limit(1);

        const newRetryCount = (current[0]?.retry_count ?? 0) + 1;

        await this.db
            .update(sync_queue)
            .set({
                retry_count: newRetryCount,
                next_retry_at: nextRetryAt,
                status: 'pending',
                updated_at: now,
            })
            .where(eq(sync_queue.id, id));
    }

    async remove(id: string): Promise<void> {
        await this.db.delete(sync_queue).where(eq(sync_queue.id, id));
    }

    async clearCompleted(): Promise<void> {
        await this.db
            .delete(sync_queue)
            .where(eq(sync_queue.status, 'synced'));
    }
}

// Singleton instance for convenience
export const syncQueueRepository = new SQLiteSyncQueueRepository();

