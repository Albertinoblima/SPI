import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import type { Survey } from '@political-research/shared-types';

export default function SurveyDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const [survey, setSurvey] = useState<Survey | null>(null);

    useEffect(() => {
        // TODO: Load survey from local DB or API
    }, [id]);

    if (!survey) {
        return (
            <View style={styles.loading}>
                <Text>Carregando pesquisa...</Text>
            </View>
        );
    }

    return (
        <ScrollView style={styles.container}>
            <Text style={styles.title}>{survey.title}</Text>
            <Text style={styles.description}>{survey.description}</Text>

            <View style={styles.infoCard}>
                <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Status</Text>
                    <Text style={styles.infoValue}>{survey.status}</Text>
                </View>
                <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Perguntas</Text>
                    <Text style={styles.infoValue}>{survey.questions?.length ?? 0}</Text>
                </View>
            </View>

            <TouchableOpacity
                style={styles.startButton}
                onPress={() => router.push({ pathname: '/survey/response', params: { surveyId: id } })}
            >
                <Text style={styles.startButtonText}>Iniciar Coleta</Text>
            </TouchableOpacity>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
        padding: 16,
    },
    loading: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1a365d',
        marginBottom: 8,
    },
    description: {
        fontSize: 16,
        color: '#475569',
        marginBottom: 24,
    },
    infoCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 24,
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    infoLabel: {
        fontSize: 14,
        color: '#64748b',
    },
    infoValue: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1e293b',
    },
    startButton: {
        backgroundColor: '#16a34a',
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
