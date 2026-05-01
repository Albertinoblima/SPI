// Master Sync Orchestrator
import { supabase } from '../supabase';
import { ImageCompressor } from '../compression/imageCompressor';
import NetInfo from '@react-native-community/netinfo';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import type { SyncQueueItem } from '@/database/queries/sync-queue';

const SYNC_TASK_NAME = 'background-sync';
const MAX_RETRIES = 5;
const BATCH_SIZE = 50;

export class SyncEngine {
    private isOnline: boolean = false;
    private isSyncing: boolean = false;

    constructor() {
        this.initNetworkListener();
        this.registerBackgroundTask();
    }

    /**
     * Monitor network status and trigger sync on reconnect
     */
    private initNetworkListener() {
        NetInfo.addEventListener((state) => {
            const wasOffline = !this.isOnline;
            this.isOnline = state.isConnected ?? false;

            if (wasOffline && this.isOnline) {
                this.triggerSync();
            }
        });
    }

    /**
     * Register background task for periodic sync
     */
    private async registerBackgroundTask() {
        TaskManager.defineTask(SYNC_TASK_NAME, async () => {
            try {
                await this.triggerSync();
                return BackgroundFetch.BackgroundFetchResult.NewData;
            } catch {
                return BackgroundFetch.BackgroundFetchResult.Failed;
            }
        });

        await BackgroundFetch.registerTaskAsync(SYNC_TASK_NAME, {
            minimumInterval: 15 * 60, // 15 minutes
            stopOnTerminate: false,
            startOnBoot: true,
        });
    }

    /**
     * Main sync orchestrator
     */
    public async triggerSync(): Promise<SyncResult> {
        if (this.isSyncing) {
            return { success: false, message: 'Sync in progress' };
        }

        if (!this.isOnline) {
            return { success: false, message: 'Offline' };
        }

        this.isSyncing = true;

        try {
            await this.downloadServerData();
            const uploadResult = await this.uploadPendingResponses();
            await this.uploadPendingMedia();

            return {
                success: true,
                uploaded: uploadResult.count,
                failed: uploadResult.failed,
            };
        } catch (error) {
            return { success: false, error };
        } finally {
            this.isSyncing = false;
        }
    }

    /**
     * Download active surveys and questions from Supabase
     */
    private async downloadServerData() {
        const { data: surveys, error } = await supabase
            .from('surveys')
            .select('*, questions(*)')
            .eq('status', 'active')
            .is('deleted_at', null)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // TODO: Upsert to local SQLite via expo-sqlite
        // for (const survey of surveys || []) { ... }
    }

    /**
     * Upload pending responses in batches
     */
    private async uploadPendingResponses(): Promise<{ count: number; failed: number }> {
        // TODO: Query from SQLite sync_queue
        // const pendingResponses = await db query for entity_type='response', retry_count < MAX_RETRIES, limit BATCH_SIZE
        const pendingResponses: SyncQueueItem[] = [];

        let successCount = 0;
        let failedCount = 0;

        for (const item of pendingResponses) {
            try {
                const payload = JSON.parse(item.payload);

                const { data, error } = await supabase
                    .from('responses')
                    .upsert(
                        {
                            ...payload,
                            local_id: item.entity_id,
                            sync_status: 'synced',
                        },
                        { onConflict: 'local_id' },
                    )
                    .select('id')
                    .single();

                if (error) throw error;

                // Upload response_answers separately
                if (data && payload.answers?.length > 0) {
                    await supabase.from('response_answers').upsert(
                        payload.answers.map((a: any) => ({
                            ...a,
                            response_id: data.id,
                        })),
                        { onConflict: 'response_id,question_id' },
                    );
                }

                // TODO: Remove from sync_queue and update local record
                successCount++;
            } catch (error: any) {
                if (error.code === '23505') {
                    // Unique constraint violation — resolve conflict
                    await this.resolveConflict(item);
                } else {
                    // TODO: Increment retry_count in sync_queue
                    failedCount++;
                }
            }
        }

        return { count: successCount, failed: failedCount };
    }

    /**
     * Upload media files (photos, signatures) with compression
     */
    private async uploadPendingMedia() {
        // TODO: Query from SQLite sync_queue for entity_type='media'
        const pendingMedia: SyncQueueItem[] = [];

        for (const item of pendingMedia) {
            try {
                const { file_path, file_type, response_id, answer_id } = JSON.parse(
                    item.payload,
                );

                let fileToUpload = file_path;
                if (file_type === 'image') {
                    const result = await ImageCompressor.compressImage(file_path, {
                        maxWidth: 1920,
                        maxHeight: 1080,
                        quality: 0.7,
                    });
                    fileToUpload = result.uri;
                }

                const fileName = `${response_id}/${Date.now()}_${file_type}`;
                const { data, error } = await supabase.storage
                    .from('response-media')
                    .upload(fileName, {
                        uri: fileToUpload,
                        type: file_type === 'image' ? 'image/jpeg' : 'image/png',
                    } as any);

                if (error) throw error;

                // Update response_answer with media URL
                await supabase
                    .from('response_answers')
                    .update({ media_url: data.path })
                    .eq('id', answer_id);

                // TODO: Remove from sync_queue
            } catch {
                // TODO: Increment retry_count in sync_queue
            }
        }
    }

    /**
     * Conflict resolution: Last-Write-Wins (LWW) based on updated_at
     */
    private async resolveConflict(item: SyncQueueItem) {
        const payload = JSON.parse(item.payload);

        const { data: serverVersion } = await supabase
            .from('responses')
            .select('*, response_answers(*)')
            .eq('local_id', item.entity_id)
            .single();

        if (!serverVersion) return;

        const localTimestamp = new Date(payload.updated_at).getTime();
        const serverTimestamp = new Date(serverVersion.updated_at).getTime();

        if (localTimestamp > serverTimestamp) {
            // Local is newer — force update
            await supabase
                .from('responses')
                .update({
                    ...payload,
                    sync_version: serverVersion.sync_version + 1,
                })
                .eq('id', serverVersion.id);
        } else {
            // Server is newer — discard local changes
            // TODO: Update local SQLite with server version
        }

        // TODO: Remove from sync_queue
    }

    /**
     * Get current sync status
     */
    public async getSyncStatus(): Promise<SyncStatus> {
        // TODO: Query from SQLite sync_queue
        return {
            pending: 0,
            failed: 0,
            isOnline: this.isOnline,
            lastSyncAt: null,
        };
    }
}

interface SyncResult {
    success: boolean;
    uploaded?: number;
    failed?: number;
    message?: string;
    error?: unknown;
}

interface SyncStatus {
    pending: number;
    failed: number;
    isOnline: boolean;
    lastSyncAt: string | null;
}
