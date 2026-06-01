// Master Sync Orchestrator - Production Grade
import { supabase } from '../supabase';
import { ImageCompressor } from '../compression/imageCompressor';
import { syncQueueRepository } from '@/database/queries/sync-queue';
import { responseRepository } from '@/database/queries/responses';
import NetInfo from '@react-native-community/netinfo';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import type { SyncQueueItem } from '@/database/queries/sync-queue';

const SYNC_TASK_NAME = 'background-sync';
const MAX_RETRIES = 5;
const BATCH_SIZE = 50;

let instance: SyncEngine | null = null;

export class SyncEngine {
    private isOnline: boolean = false;
    private isSyncing: boolean = false;
    private isStarted: boolean = false;

    private constructor() {
        // Private constructor for singleton
    }

    static getInstance(): SyncEngine {
        if (!instance) {
            instance = new SyncEngine();
        }
        return instance;
    }

    /**
     * Start the sync engine (registers listeners and background tasks).
     * Safe to call multiple times.
     */
    start() {
        if (this.isStarted) return;
        this.isStarted = true;
        this.initNetworkListener();
        this.registerBackgroundTask();
    }

    stop() {
        this.isStarted = false;
        // Note: Background tasks and NetInfo listeners are harder to fully stop in RN.
        // For now we just mark as stopped.
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
     * Download active surveys and questions from Supabase and persist locally for offline use.
     * Core of the offline-first strategy.
     */
    private async downloadServerData() {
        const { data: surveys, error } = await supabase
            .from('surveys')
            .select('*, questions(*)')
            .in('status', ['active', 'published'])
            .is('deleted_at', null)
            .order('created_at', { ascending: false });

        if (error) {
            console.warn('[SyncEngine] downloadServerData failed (non-fatal for offline mode)', error);
            return; // graceful degradation - user can still use cached data
        }
        if (!surveys || surveys.length === 0) return;

        // Import once outside the loop
        const { getDatabase } = await import('@/database/db');
        const { surveys: surveysTable } = await import('@/database/schema');
        const db = getDatabase();

        for (const survey of surveys) {
            try {
                const questionsJson = JSON.stringify(survey.questions || []);

                await db
                    .insert(surveysTable)
                    .values({
                        id: survey.id,
                        tenant_id: survey.tenant_id,
                        title: survey.title,
                        description: survey.description ?? null,
                        status: survey.status,
                        questions_json: questionsJson,
                        requires_geolocation: survey.requires_geolocation ?? true,
                        requires_photo: survey.requires_photo ?? false,
                        requires_signature: survey.requires_signature ?? false,
                        server_updated_at: survey.updated_at,
                        local_updated_at: new Date().toISOString(),
                        synced: true,
                    })
                    .onConflictDoUpdate({
                        target: surveysTable.id,
                        set: {
                            title: survey.title,
                            description: survey.description ?? null,
                            status: survey.status,
                            questions_json: questionsJson,
                            server_updated_at: survey.updated_at,
                            local_updated_at: new Date().toISOString(),
                        },
                    });

                // Structured log (F6-05): in production replace with proper logger + correlation if available
                console.log(`[SyncEngine] Persisted survey ${survey.id} (${survey.questions?.length || 0} questions) for offline use`);
            } catch (e) {
                console.warn(`[SyncEngine] Failed to persist survey ${survey.id} locally`, e);
            }
        }
    }

    /**
     * Upload pending responses in batches
     */
    private async uploadPendingResponses(): Promise<{ count: number; failed: number }> {
        const pendingResponses = await syncQueueRepository.getNextBatch(BATCH_SIZE * 2, 'response');

        let successCount = 0;
        let failedCount = 0;

        for (const item of pendingResponses) {
            try {
                await syncQueueRepository.updateStatus(item.id, 'syncing');

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
                        (payload.answers as Record<string, unknown>[]).map((a) => ({
                            ...a,
                            response_id: data.id,
                        })),
                        { onConflict: 'response_id,question_id' },
                    );
                }

                await syncQueueRepository.remove(item.id);
                successCount++;
            } catch (error: unknown) {
                const err = error as { code?: string };
                if (err.code === '23505') {
                    await this.resolveConflict(item);
                } else {
                    const nextRetry = this.calculateNextRetry(item.retry_count);
                    await syncQueueRepository.incrementRetry(item.id, nextRetry);
                    failedCount++;
                }
            }
        }

        return { count: successCount, failed: failedCount };
    }

    private calculateNextRetry(retryCount: number): string | null {
        if (retryCount >= MAX_RETRIES) return null;

        const delayMinutes = Math.pow(2, retryCount) * 5; // Exponential backoff: 5, 10, 20, 40, 80 min
        const next = new Date(Date.now() + delayMinutes * 60 * 1000);
        return next.toISOString();
    }

    /**
     * Upload media files (photos, signatures) with compression
     */
    private async uploadPendingMedia() {
        const pendingMedia = await syncQueueRepository.getNextBatch(BATCH_SIZE * 2, 'media');

        for (const item of pendingMedia) {
            try {
                await syncQueueRepository.updateStatus(item.id, 'syncing');

                const { file_path, file_type, response_id, answer_id } = JSON.parse(item.payload);

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
                    } as unknown as Blob);

                if (error) throw error;

                // Update response_answer with media URL
                if (answer_id) {
                    await supabase
                        .from('response_answers')
                        .update({ media_url: data.path })
                        .eq('id', answer_id);
                }

                await syncQueueRepository.remove(item.id);
            } catch (error: unknown) {
                const nextRetry = this.calculateNextRetry(item.retry_count);
                await syncQueueRepository.incrementRetry(item.id, nextRetry);
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

        if (!serverVersion) {
            await syncQueueRepository.remove(item.id);
            return;
        }

        const localTimestamp = new Date(payload.updated_at || 0).getTime();
        const serverTimestamp = new Date(serverVersion.updated_at || 0).getTime();

        if (localTimestamp > serverTimestamp) {
            // Local wins
            await supabase
                .from('responses')
                .update({
                    ...payload,
                    sync_version: (serverVersion.sync_version || 0) + 1,
                })
                .eq('id', serverVersion.id);
        } else {
            // Server wins — we should ideally pull the server version into local DB here
            // For now we just discard the local change
        }

        await syncQueueRepository.remove(item.id);
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
