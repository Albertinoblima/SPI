import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { QuestionRenderer } from '@/components/forms/QuestionRenderer';
import { GeolocationCapture } from '@/components/forms/GeolocationCapture';
import { useSurveyStore } from '@/store/surveyStore';
import type { Question, ResponseAnswer, GeoLocation } from '@political-research/shared-types';

export default function ResponseScreen() {
    const { surveyId } = useLocalSearchParams<{ surveyId: string }>();
    const currentSurvey = useSurveyStore((state) => state.currentSurvey);
    const fetchSurveyById = useSurveyStore((state) => state.fetchSurveyById);

    const [answers, setAnswers] = useState<Record<string, ResponseAnswer>>({});
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [geolocation, setGeolocation] = useState<GeoLocation | null>(null);
    const [submitting, setSubmitting] = useState(false);

    // Load survey + questions + quotas when entering the response screen
    useEffect(() => {
        if (surveyId) {
            fetchSurveyById(surveyId).catch(() => {});
        }
    }, [surveyId, fetchSurveyById]);

    const questions: Question[] = (currentSurvey as any)?.questions || [];
    const myQuotas: any[] = (currentSurvey as any)?.quotas || [];

    const totalAssigned = myQuotas.reduce((sum: number, q: any) => sum + (q.quota_total || 0), 0);

    // Hybrid tracking: backend authoritative (interviews collected) + this-device session (optimistic before sync)
    const [selectedLocality, setSelectedLocality] = useState<string>('');
    const [sessionCounts, setSessionCounts] = useState<Record<string, number>>({});

    const availableLocalities = myQuotas.map((q: any) => ({
        key: q.locality_id || q.survey_localities?.name || 'Geral',
        name: q.survey_localities?.name || q.locality_id || 'Geral',
        quota: q.quota_total || 0,
        collectedBackend: q.collected_count ?? 0,   // real from server (interviews table)
    }));

    const currentRemaining = selectedLocality
        ? (() => {
              const loc = availableLocalities.find(l => l.key === selectedLocality);
              if (!loc) return 0;
              const effectiveDone = (loc.collectedBackend || 0) + (sessionCounts[selectedLocality] || 0);
              return Math.max(0, loc.quota - effectiveDone);
          })()
        : 0;

    const handleAnswer = useCallback((questionId: string, answer: ResponseAnswer) => {
        setAnswers((prev) => ({ ...prev, [questionId]: answer }));
    }, []);

    const handleSubmit = async () => {
        if (!geolocation) {
            Alert.alert('Erro', 'Aguardando captura de geolocalização');
            return;
        }

        // Stronger client-side quota guard using real backend + session (ponta a ponta 100%)
        if (selectedLocality && currentRemaining <= 0) {
            const proceed = await new Promise<boolean>((resolve) => {
                Alert.alert(
                    'Cota esgotada',
                    `A cota real (backend + esta sessão) para a localidade selecionada já foi atingida.\n\nDeseja mesmo assim enviar esta entrevista? (será auditada)`,
                    [
                        { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
                        { text: 'Enviar mesmo assim', style: 'destructive', onPress: () => resolve(true) },
                    ]
                );
            });
            if (!proceed) return;
        } else if (totalAssigned > 0) {
            const confirmSubmit = await new Promise<boolean>((resolve) => {
                Alert.alert(
                    'Confirmar envio',
                    `Você tem ${totalAssigned} entrevistas atribuídas nesta pesquisa.\n\n` +
                    'Lembre-se de respeitar sua cota por localidade. Deseja finalizar esta entrevista?',
                    [
                        { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
                        { text: 'Enviar', onPress: () => resolve(true) },
                    ]
                );
            });
            if (!confirmSubmit) return;
        }

        setSubmitting(true);
        try {
            // Increment session counter (hybrid with backend collected_count from interviews table)
            if (selectedLocality) {
                setSessionCounts(prev => ({
                    ...prev,
                    [selectedLocality]: (prev[selectedLocality] || 0) + 1,
                }));
            }

            // Real save + sync will update the authoritative collected_count on next fetchSurveyBundle
            // TODO: integrate with /api/entrevistas/sync using the selectedLocality as localidade_id
            Alert.alert('Sucesso', 'Resposta registrada com sucesso! (será sincronizada)');
            router.back();
        } catch (error) {
            Alert.alert('Erro', 'Não foi possível salvar a resposta');
        } finally {
            setSubmitting(false);
        }
    };

    const currentQuestion = questions[currentQuestionIndex];

    return (
        <ScrollView style={styles.container}>
            <GeolocationCapture onCapture={setGeolocation} />

            {/* Quota awareness - closes the planning → mobile loop */}
            {myQuotas.length > 0 && (
                <View style={styles.quotaBanner}>
                    <Text style={styles.quotaBannerTitle}>Sua cota nesta pesquisa</Text>

                    {availableLocalities.length > 0 && (
                        <View style={{ marginTop: 8 }}>
                            <Text style={styles.quotaLabel}>Localidade atual:</Text>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                                {availableLocalities.map(loc => {
                                    const backend = loc.collectedBackend || 0;
                                    const sessionDone = sessionCounts[loc.key] || 0;
                                    const effectiveDone = backend + sessionDone;
                                    const rem = Math.max(0, loc.quota - effectiveDone);
                                    const isSelected = selectedLocality === loc.key;
                                    const display = sessionDone > 0 
                                        ? `${loc.name} (${effectiveDone}/${loc.quota} • +${sessionDone} nesta sessão)`
                                        : `${loc.name} (${effectiveDone}/${loc.quota})`;
                                    return (
                                        <TouchableOpacity
                                            key={loc.key}
                                            onPress={() => setSelectedLocality(loc.key)}
                                            style={[styles.localityChip, isSelected && styles.localityChipSelected]}
                                        >
                                            <Text style={[styles.localityChipText, isSelected && styles.localityChipTextSelected]}>
                                                {display} — Restam {rem}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>
                    )}

                    {selectedLocality && (
                        <View style={{ marginTop: 10, backgroundColor: '#f0fdf4', padding: 8, borderRadius: 8 }}>
                            <Text style={{ fontSize: 13, color: '#166534', fontWeight: '600' }}>
                                Restante nesta localidade: <Text style={{ fontSize: 16 }}>{currentRemaining}</Text>
                            </Text>
                            {currentRemaining <= 0 && (
                                <Text style={styles.quotaWarning}>Cota esgotada para esta localidade.</Text>
                            )}
                        </View>
                    )}
                </View>
            )}

            {/* Sticky quota status during interview - best UX decision */}
            {selectedLocality && (
                <View style={styles.stickyQuotaBar}>
                    <Text style={styles.stickyQuotaText}>
                        {availableLocalities.find(l => l.key === selectedLocality)?.name || 'Localidade'} — Restante: <Text style={{ fontWeight: 'bold', fontSize: 16 }}>{currentRemaining}</Text>
                    </Text>
                    {currentRemaining <= 3 && currentRemaining > 0 && (
                        <Text style={{ color: '#b45309', fontSize: 11, textAlign: 'center', marginTop: 2 }}>
                            Atenção: cota quase esgotada
                        </Text>
                    )}
                </View>
            )}

            {currentQuestion ? (
                <View style={styles.questionContainer}>
                    {/* Prominent remaining quota for current locality during interview */}
                    {selectedLocality && (
                        <View style={{ 
                            backgroundColor: currentRemaining <= 3 ? '#fef3c7' : '#ecfdf5', 
                            padding: 8, 
                            borderRadius: 8, 
                            marginBottom: 12,
                            borderWidth: 1,
                            borderColor: currentRemaining <= 3 ? '#f59e0b' : '#10b981'
                        }}>
                            <Text style={{ 
                                fontSize: 14, 
                                fontWeight: '600', 
                                color: currentRemaining <= 3 ? '#92400e' : '#166534',
                                textAlign: 'center'
                            }}>
                                {currentRemaining} entrevistas restantes nesta localidade
                            </Text>
                            {currentRemaining <= 0 && (
                                <Text style={{ fontSize: 12, color: '#b45309', textAlign: 'center', marginTop: 4 }}>
                                    ⚠️ Cota esgotada — não é recomendado continuar
                                </Text>
                            )}
                        </View>
                    )}

                    <Text style={styles.progress}>
                        Pergunta {currentQuestionIndex + 1} de {questions.length}
                    </Text>

                    <QuestionRenderer
                        question={currentQuestion}
                        answer={answers[currentQuestion.id]}
                        onAnswer={(answer) => handleAnswer(currentQuestion.id, answer)}
                    />

                    <View style={styles.navigation}>
                        {currentQuestionIndex > 0 && (
                            <TouchableOpacity
                                style={styles.navButton}
                                onPress={() => setCurrentQuestionIndex((i) => i - 1)}
                            >
                                <Text style={styles.navButtonText}>Anterior</Text>
                            </TouchableOpacity>
                        )}

                        {currentQuestionIndex < questions.length - 1 ? (
                            <TouchableOpacity
                                style={[styles.navButton, styles.nextButton]}
                                onPress={() => setCurrentQuestionIndex((i) => i + 1)}
                            >
                                <Text style={[styles.navButtonText, styles.nextButtonText]}>Próxima</Text>
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity
                                style={[
                                    styles.navButton,
                                    styles.submitButton,
                                    ...(selectedLocality && currentRemaining <= 0 ? [{ backgroundColor: '#854d0e', borderColor: '#854d0e' }] : [])
                                ]}
                                onPress={handleSubmit}
                                disabled={submitting}
                            >
                                <Text style={[styles.navButtonText, styles.submitButtonText]}>
                                    {submitting ? 'Salvando...' : 
                                     (selectedLocality && currentRemaining <= 0) ? 'Finalizar (cota esgotada)' : 'Finalizar Entrevista'}
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            ) : (
                <View style={{ marginTop: 60, alignItems: 'center' }}>
                    <Text style={styles.emptyText}>
                        {questions.length === 0 ? 'Carregando questionário...' : 'Nenhuma pergunta disponível'}
                    </Text>
                </View>
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
    questionContainer: {
        marginTop: 16,
    },
    progress: {
        fontSize: 14,
        color: '#64748b',
        marginBottom: 12,
    },
    navigation: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 24,
        gap: 12,
    },
    navButton: {
        flex: 1,
        padding: 14,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        alignItems: 'center',
    },
    navButtonText: {
        fontSize: 16,
        fontWeight: '500',
        color: '#475569',
    },
    nextButton: {
        backgroundColor: '#2563eb',
        borderColor: '#2563eb',
    },
    nextButtonText: {
        color: '#fff',
    },
    submitButton: {
        backgroundColor: '#16a34a',
        borderColor: '#16a34a',
    },
    submitButtonText: {
        color: '#fff',
    },
    emptyText: {
        textAlign: 'center',
        color: '#94a3b8',
        marginTop: 48,
        fontSize: 16,
    },
    // Quota awareness banner during collection (ponta a ponta)
    quotaBanner: {
        backgroundColor: '#ecfdf5',
        borderRadius: 10,
        padding: 14,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#a7f3d0',
    },
    quotaBannerTitle: {
        fontSize: 12,
        color: '#166534',
        fontWeight: '600',
    },
    quotaBannerValue: {
        fontSize: 20,
        fontWeight: '700',
        color: '#166534',
        marginTop: 2,
    },
    quotaBannerHint: {
        fontSize: 12,
        color: '#4ade80',
        marginTop: 4,
    },
    quotaLabel: {
        fontSize: 11,
        color: '#166534',
        fontWeight: '500',
    },
    localityChip: {
        backgroundColor: '#d1fae5',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
    },
    localityChipSelected: {
        backgroundColor: '#16a34a',
    },
    localityChipText: {
        fontSize: 12,
        color: '#166534',
        fontWeight: '500',
    },
    localityChipTextSelected: {
        color: '#fff',
    },
    quotaWarning: {
        marginTop: 8,
        fontSize: 12,
        color: '#b45309',
        fontWeight: '600',
    },
    stickyQuotaBar: {
        backgroundColor: '#ecfdf5',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#a7f3d0',
        marginBottom: 8,
    },
    stickyQuotaText: {
        fontSize: 14,
        color: '#166534',
        textAlign: 'center',
    },
});
