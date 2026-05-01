// Conflict Resolution Strategy

export interface ConflictResult {
    resolved: boolean;
    winner: 'local' | 'remote';
    mergedData?: unknown;
}

export class ConflictResolver {
    /**
     * Resolve conflicts using "last write wins" strategy
     * comparing timestamps
     */
    resolve(localData: any, remoteData: any): ConflictResult {
        const localTimestamp = new Date(localData.updated_at).getTime();
        const remoteTimestamp = new Date(remoteData.updated_at).getTime();

        if (localTimestamp >= remoteTimestamp) {
            return { resolved: true, winner: 'local' };
        }

        return { resolved: true, winner: 'remote' };
    }

    /**
     * For responses, local always wins since they are new data
     */
    resolveResponse(localData: any, remoteData: any): ConflictResult {
        return { resolved: true, winner: 'local', mergedData: localData };
    }
}
