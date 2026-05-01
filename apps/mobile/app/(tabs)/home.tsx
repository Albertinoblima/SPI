import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useSyncStatus } from '@/hooks/useSyncStatus';

export default function HomeScreen() {
    const { isConnected } = useNetworkStatus();
    const { pendingCount } = useSyncStatus();

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>SPI - Sistema de Pesquisa Inteligente</Text>
                <View style={[styles.statusBadge, isConnected ? styles.online : styles.offline]}>
                    <Text style={styles.statusText}>
                        {isConnected ? '● Online' : '● Offline'}
                    </Text>
                </View>
            </View>

            {pendingCount > 0 && (
                <TouchableOpacity
                    style={styles.syncBanner}
                    onPress={() => router.push('/(tabs)/sync')}
                >
                    <Text style={styles.syncText}>
                        {pendingCount} resposta(s) pendente(s) de sincronização
                    </Text>
                </TouchableOpacity>
            )}

            <View style={styles.statsContainer}>
                <View style={styles.statCard}>
                    <Text style={styles.statNumber}>0</Text>
                    <Text style={styles.statLabel}>Pesquisas Ativas</Text>
                </View>
                <View style={styles.statCard}>
                    <Text style={styles.statNumber}>0</Text>
                    <Text style={styles.statLabel}>Respostas Hoje</Text>
                </View>
            </View>

            <TouchableOpacity
                style={styles.startButton}
                onPress={() => router.push('/(tabs)/surveys')}
            >
                <Text style={styles.startButtonText}>Iniciar Pesquisa</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
        padding: 16,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
        paddingTop: 8,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1a365d',
    },
    statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
    },
    online: {
        backgroundColor: '#dcfce7',
    },
    offline: {
        backgroundColor: '#fef2f2',
    },
    statusText: {
        fontSize: 12,
        fontWeight: '600',
    },
    syncBanner: {
        backgroundColor: '#fef3c7',
        padding: 12,
        borderRadius: 8,
        marginBottom: 16,
    },
    syncText: {
        color: '#92400e',
        fontWeight: '500',
        textAlign: 'center',
    },
    statsContainer: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 24,
    },
    statCard: {
        flex: 1,
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 20,
        alignItems: 'center',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    statNumber: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#1a365d',
    },
    statLabel: {
        fontSize: 14,
        color: '#64748b',
        marginTop: 4,
    },
    startButton: {
        backgroundColor: '#2563eb',
        borderRadius: 12,
        padding: 18,
        alignItems: 'center',
    },
    startButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
    },
});
