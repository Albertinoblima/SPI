import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { QuestionRenderer } from '@/components/forms/QuestionRenderer';
import { GeolocationCapture } from '@/components/forms/GeolocationCapture';
import type { Question, ResponseAnswer, GeoLocation } from '@political-research/shared-types';

export default function ResponseScreen() {
    const { surveyId } = useLocalSearchParams<{ surveyId: string }>();
    const [answers, setAnswers] = useState<Record<string, ResponseAnswer>>({});
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [geolocation, setGeolocation] = useState<GeoLocation | null>(null);
    const [questions] = useState<Question[]>([]); // TODO: Load from store
    const [submitting, setSubmitting] = useState(false);

    const handleAnswer = useCallback((questionId: string, answer: ResponseAnswer) => {
        setAnswers((prev) => ({ ...prev, [questionId]: answer }));
    }, []);

    const handleSubmit = async () => {
        if (!geolocation) {
            Alert.alert('Erro', 'Aguardando captura de geolocalização');
            return;
        }

        setSubmitting(true);
        try {
            // TODO: Save to local SQLite + add to sync queue
            Alert.alert('Sucesso', 'Resposta registrada com sucesso!');
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

            {currentQuestion ? (
                <View style={styles.questionContainer}>
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
                                style={[styles.navButton, styles.submitButton]}
                                onPress={handleSubmit}
                                disabled={submitting}
                            >
                                <Text style={[styles.navButtonText, styles.submitButtonText]}>
                                    {submitting ? 'Salvando...' : 'Finalizar'}
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            ) : (
                <Text style={styles.emptyText}>Nenhuma pergunta disponível</Text>
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
});
