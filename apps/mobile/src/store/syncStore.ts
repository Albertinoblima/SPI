// Sync Store (Zustand)
import { create } from 'zustand';
import { SyncEngine } from '@/services/sync/SyncEngine';
import type { SyncQueueItem } from '@/database/queries/sync-queue';

interface SyncState {
    syncQueue: SyncQueueItem[];
    syncing: boolean;
    lastSyncAt: string | null;
    syncAll: () => Promise<void>;
    addToQueue: (item: SyncQueueItem) => void;
    removeFromQueue: (id: string) => void;
    loadQueue: () => Promise<void>;
}

const syncEngine = new SyncEngine();

export const useSyncStore = create<SyncState>((set, get) => ({
    syncQueue: [],
    syncing: false,
    lastSyncAt: null,

    syncAll: async () => {
        set({ syncing: true });
        try {
            const { syncQueue } = get();

            const result = await syncEngine.triggerSync();
            if (result.uploaded && result.uploaded > 0) {
                set({ lastSyncAt: new Date().toISOString() });
            }

            // Reload queue after sync
            await get().loadQueue();
        } finally {
            set({ syncing: false });
        }
    },

    addToQueue: (item) => {
        set((state) => ({ syncQueue: [...state.syncQueue, item] }));
    },

    removeFromQueue: (id) => {
        set((state) => ({
            syncQueue: state.syncQueue.filter((item) => item.id !== id),
        }));
    },

    loadQueue: async () => {
        // TODO: Load from SQLite
        set({ syncQueue: [] });
    },
}));
