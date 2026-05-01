import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import { useSyncStore } from '@/store/syncStore';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

export default function SyncScreen() {
    const { syncQueue, syncAll, syncing } = useSyncStore();
    const { isConnected } = useNetworkStatus();

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Sincronização</Text>

            <View style={styles.statusCard}>
                <Text style={styles.statusLabel}>Status da Conexão</Text>
                <Text style={[styles.statusValue, isConnected ? styles.online : styles.offline]}>
                    {isConnected ? 'Online' : 'Offline'}
                </Text>
            </View>

            <View style={styles.statusCard}>
                <Text style={styles.statusLabel}>Pendentes</Text>
                <Text style={styles.statusValue}>{syncQueue.length} item(s)</Text>
            </View>

            <TouchableOpacity
                style={[styles.syncButton, (!isConnected || syncing) && styles.syncButtonDisabled]}
                onPress={syncAll}
                disabled={!isConnected || syncing || syncQueue.length === 0}
            >
                <Text style={styles.syncButtonText}>
                    {syncing ? 'Sincronizando...' : 'Sincronizar Tudo'}
                </Text>
            </TouchableOpacity>

            <Text style={styles.queueTitle}>Fila de Sincronização</Text>

            <FlatList
                data={syncQueue}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                    <View style={styles.queueItem}>
                        <View>
                            <Text style={styles.queueItemTitle}>{item.type}</Text>
                            <Text style={styles.queueItemDate}>{item.created_at}</Text>
                        </View>
                        <View style={[styles.queueItemStatus, styles[`status_${item.status}`]]}>
                            <Text style={styles.queueItemStatusText}>{item.status}</Text>
                        </View>
                    </View>
                )}
                ListEmptyComponent={
                    <Text style={styles.emptyText}>Nenhum item na fila</Text>
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
        padding: 16,
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#1a365d',
        marginBottom: 16,
    },
    statusCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        backgroundColor: '#fff',
        borderRadius: 8,
        padding: 16,
        marginBottom: 12,
        elevation: 1,
    },
    statusLabel: {
        fontSize: 16,
        color: '#475569',
    },
    statusValue: {
        fontSize: 16,
        fontWeight: '600',
    },
    online: { color: '#16a34a' },
    offline: { color: '#dc2626' },
    syncButton: {
        backgroundColor: '#2563eb',
        borderRadius: 8,
        padding: 16,
        alignItems: 'center',
        marginVertical: 16,
    },
    syncButtonDisabled: {
        opacity: 0.5,
    },
    syncButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    queueTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1e293b',
        marginBottom: 12,
    },
    queueItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 8,
        padding: 12,
        marginBottom: 8,
    },
    queueItemTitle: {
        fontSize: 14,
        fontWeight: '500',
    },
    queueItemDate: {
        fontSize: 12,
        color: '#94a3b8',
    },
    queueItemStatus: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    queueItemStatusText: {
        fontSize: 12,
        fontWeight: '600',
    },
    status_pending: { backgroundColor: '#fef3c7' },
    status_syncing: { backgroundColor: '#dbeafe' },
    status_synced: { backgroundColor: '#dcfce7' },
    status_error: { backgroundColor: '#fef2f2' },
    emptyText: {
        textAlign: 'center',
        color: '#94a3b8',
        marginTop: 24,
    },
});
