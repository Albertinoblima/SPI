// Offline-first data hook
import { useState, useEffect, useCallback } from 'react';
import { useNetworkStatus } from './useNetworkStatus';

interface UseOfflineFirstOptions<T> {
    fetchFromLocal: () => Promise<T>;
    fetchFromRemote: () => Promise<T>;
    saveToLocal: (data: T) => Promise<void>;
}

export function useOfflineFirst<T>({
    fetchFromLocal,
    fetchFromRemote,
    saveToLocal,
}: UseOfflineFirstOptions<T>) {
    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const { isConnected } = useNetworkStatus();

    const refresh = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            // Always try local first
            const localData = await fetchFromLocal();
            setData(localData);

            // If online, fetch remote and update local
            if (isConnected) {
                try {
                    const remoteData = await fetchFromRemote();
                    await saveToLocal(remoteData);
                    setData(remoteData);
                } catch {
                    // Keep local data if remote fails
                }
            }
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Unknown error'));
        } finally {
            setLoading(false);
        }
    }, [isConnected, fetchFromLocal, fetchFromRemote, saveToLocal]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    return { data, loading, error, refresh };
}
