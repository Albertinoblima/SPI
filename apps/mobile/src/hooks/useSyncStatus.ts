// Sync Status Hook
import { useState, useEffect } from 'react';
import { useSyncStore } from '@/store/syncStore';

export function useSyncStatus() {
    const syncQueue = useSyncStore((state) => state.syncQueue);
    const syncing = useSyncStore((state) => state.syncing);

    const pendingCount = syncQueue.filter((item) => item.status === 'pending').length;
    const errorCount = syncQueue.filter((item) => item.status === 'error').length;
    const syncedCount = syncQueue.filter((item) => item.status === 'synced').length;

    return {
        syncQueue,
        syncing,
        pendingCount,
        errorCount,
        syncedCount,
        totalCount: syncQueue.length,
    };
}
