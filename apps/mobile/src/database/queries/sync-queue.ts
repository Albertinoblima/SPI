// Sync Queue Management
import { generateLocalId } from '@political-research/shared-utils';

export interface SyncQueueItem {
    id: string;
    type: 'response' | 'media';
    entity_id: string;
    payload: string;
    status: 'pending' | 'syncing' | 'synced' | 'error';
    retry_count: number;
    last_error?: string;
    created_at: string;
    updated_at: string;
}

export interface SyncQueueRepository {
    add(type: SyncQueueItem['type'], entityId: string, payload: unknown): Promise<SyncQueueItem>;
    getAll(): Promise<SyncQueueItem[]>;
    getPending(): Promise<SyncQueueItem[]>;
    updateStatus(id: string, status: SyncQueueItem['status'], error?: string): Promise<void>;
    incrementRetry(id: string): Promise<void>;
    remove(id: string): Promise<void>;
    clearCompleted(): Promise<void>;
}

// TODO: Implement with expo-sqlite
export class SQLiteSyncQueueRepository implements SyncQueueRepository {
    async add(type: SyncQueueItem['type'], entityId: string, payload: unknown): Promise<SyncQueueItem> {
        const now = new Date().toISOString();
        const item: SyncQueueItem = {
            id: generateLocalId(),
            type,
            entity_id: entityId,
            payload: JSON.stringify(payload),
            status: 'pending',
            retry_count: 0,
            created_at: now,
            updated_at: now,
        };

        // TODO: Insert into SQLite
        return item;
    }

    async getAll(): Promise<SyncQueueItem[]> {
        return [];
    }

    async getPending(): Promise<SyncQueueItem[]> {
        return [];
    }

    async updateStatus(id: string, status: SyncQueueItem['status'], error?: string): Promise<void> {
        // TODO: Update in SQLite
    }

    async incrementRetry(id: string): Promise<void> {
        // TODO: Update in SQLite
    }

    async remove(id: string): Promise<void> {
        // TODO: Delete from SQLite
    }

    async clearCompleted(): Promise<void> {
        // TODO: Delete synced items from SQLite
    }
}
