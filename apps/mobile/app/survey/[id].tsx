import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import type { Survey } from '@political-research/shared-types';
import { useSurveyStore } from '@/store/surveyStore';

export default function SurveyDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const [survey, setSurvey] = useState<Survey | null>(null);
    const fetchSurveyById = useSurveyStore((state) => state.fetchSurveyById);
    const currentSurvey = useSurveyStore((state) => state.currentSurvey);

    useEffect(() => {
        if (!id) return;

        fetchSurveyById(id).catch(() => {
            setSurvey(null);
        });
    }, [fetchSurveyById, id]);

    useEffect(() => {
        if (!currentSurvey) return;
        if (currentSurvey.id === id) {
            setSurvey(currentSurvey);
        }
    }, [currentSurvey, id]);

    if (!survey) {
        return (
            <View style={styles.loading}>
                <Text>Carregando pesquisa...</Text>
            </View>
        );
    }

    // Cotas atribuídas a este entrevistador (vindas do backend via fetchSurveyBundle)
    const myQuotas: any[] = (survey as any).quotas || [];

    const totalMyQuota = myQuotas.reduce((sum: number, q: any) => sum + (q.quota_total || 0), 0);

    return (
        <ScrollView style={styles.container}>
            <Text style={styles.title}>{survey.title}</Text>
            <Text style={styles.description}>{survey.description}</Text>

            {/* Cota pessoal do entrevistador - fecha o loop do planejamento ponta a ponta */}
            {myQuotas.length > 0 ? (
                <View style={styles.quotaCard}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={styles.quotaTitle}>Sua Missão de Campo</Text>
                        <Text style={styles.quotaTotal}>{totalMyQuota}</Text>
                    </View>
                    <Text style={styles.quotaHint}>Entrevistas atribuídas a você. Colete apenas dentro destas cotas.</Text>

                    <View style={{ marginTop: 14 }}>
                        {myQuotas.slice(0, 5).map((q: any, idx: number) => {
                            const planned = q.quota_total || 0;
                            // Real backend count (interviews table) + session optimism handled in response screen
                            const collected = q.collected_count ?? 0;
                            const progress = planned > 0 ? Math.min((collected / planned) * 100, 100) : 0;

                            return (
                                <View key={idx} style={styles.quotaItem}>
                                    <View style={styles.quotaHeader}>
                                        <Text style={styles.quotaLocality} numberOfLines={1}>
                                            {q.survey_localities?.name || q.locality_id || 'Localidade'}
                                        </Text>
                                        <Text style={styles.quotaNumbers}>
                                            {collected}/{planned}
                                        </Text>
                                    </View>
                                    <View style={styles.progressBarBg}>
                                        <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
                                    </View>
                                </View>
                            );
                        })}
                        {myQuotas.length > 5 && (
                            <Text style={styles.quotaMore}>+ {myQuotas.length - 5} outras localidades atribuídas</Text>
                        )}
                    </View>

                    <View style={styles.quotaFooter}>
                        <Text style={styles.quotaFooterText}>
                            Coletadas no backend (entrevistas sincronizadas) + progresso desta sessão. Respeite sua distribuição.
                        </Text>
                    </View>
                </View>
            ) : (
                <View style={styles.noQuotaCard}>
                    <Text style={styles.noQuotaTitle}>Nenhuma cota específica atribuída</Text>
                    <Text style={styles.noQuotaText}>
                        O coordenador ainda não distribuiu entrevistas por entrevistador. Quando ele aplicar a distribuição no planejamento, você verá aqui sua missão exata por localidade.
                    </Text>
                </View>
            )}

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

            {myQuotas.length === 0 && (
                <Text style={styles.noQuotaNote}>
                    Nenhuma cota específica atribuída a você ainda. O coordenador pode estar finalizando o planejamento.
                </Text>
            )}
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
    // Estilos para exibição de cota por entrevistador (integração com planejamento ponta a ponta)
    quotaCard: {
        backgroundColor: '#ecfdf5',
        borderRadius: 12,
        padding: 16,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#a7f3d0',
    },
    quotaTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#166534',
        marginBottom: 4,
    },
    quotaTotal: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#166534',
    },
    quotaHint: {
        fontSize: 12,
        color: '#4ade80',
        marginTop: 2,
    },
    quotaRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 4,
        borderBottomWidth: 1,
        borderBottomColor: '#d1fae5',
    },
    quotaLocality: {
        fontSize: 13,
        color: '#166534',
    },
    quotaValue: {
        fontSize: 13,
        fontWeight: '600',
        color: '#166534',
    },
    quotaMore: {
        fontSize: 11,
        color: '#4ade80',
        marginTop: 6,
        fontStyle: 'italic',
    },
    noQuotaNote: {
        fontSize: 12,
        color: '#64748b',
        textAlign: 'center',
        marginTop: 12,
        fontStyle: 'italic',
    },
    // Estilos melhorados para cotas (UX profissional)
    quotaItem: {
        marginBottom: 10,
    },
    quotaHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    quotaNumbers: {
        fontSize: 13,
        fontWeight: '600',
        color: '#166534',
    },
    progressBarBg: {
        height: 6,
        backgroundColor: '#d1fae5',
        borderRadius: 3,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: 6,
        backgroundColor: '#16a34a',
        borderRadius: 3,
    },
    quotaFooter: {
        marginTop: 12,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#a7f3d0',
    },
    quotaFooterText: {
        fontSize: 11,
        color: '#4ade80',
        textAlign: 'center',
    },
    noQuotaCard: {
        backgroundColor: '#fefce8',
        borderRadius: 12,
        padding: 16,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#fde047',
    },
    noQuotaTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#854d0e',
        marginBottom: 6,
    },
    noQuotaText: {
        fontSize: 13,
        color: '#a16207',
        lineHeight: 18,
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
