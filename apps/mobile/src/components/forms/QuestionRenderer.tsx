import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import type { Question, ResponseAnswer } from '@political-research/shared-types';

interface QuestionRendererProps {
    question: Question;
    answer?: ResponseAnswer;
    onAnswer: (answer: ResponseAnswer) => void;
}

export function QuestionRenderer({ question, answer, onAnswer }: QuestionRendererProps) {
    const handleTextChange = (value: string) => {
        onAnswer({
            question_id: question.id,
            answer_text: value,
            response_id: '',
            id: '',
            created_at: new Date().toISOString(),
        });
    };

    switch (question.question_type) {
        case 'text':
            return (
                <View style={styles.container}>
                    <Text style={styles.label}>{question.question_text}</Text>
                    <TextInput
                        style={styles.textInput}
                        value={answer?.answer_text ?? ''}
                        onChangeText={handleTextChange}
                        placeholder="Digite sua resposta..."
                        multiline
                    />
                </View>
            );

        case 'number':
            return (
                <View style={styles.container}>
                    <Text style={styles.label}>{question.question_text}</Text>
                    <TextInput
                        style={styles.textInput}
                        value={String(answer?.answer_number ?? '')}
                        onChangeText={handleTextChange}
                        keyboardType="numeric"
                        placeholder="Digite um número..."
                    />
                </View>
            );

        case 'single_choice':
        case 'multiple_choice':
            return (
                <View style={styles.container}>
                    <Text style={styles.label}>{question.question_text}</Text>
                    {question.options?.map((option) => (
                        <View key={option.id} style={styles.optionItem}>
                            <Text style={styles.optionText}>{option.label}</Text>
                        </View>
                    ))}
                </View>
            );

        default:
            return (
                <View style={styles.container}>
                    <Text style={styles.label}>{question.question_text}</Text>
                    <Text style={styles.unsupported}>
                        Tipo de pergunta não suportado: {question.question_type}
                    </Text>
                </View>
            );
    }
}

const styles = StyleSheet.create({
    container: {
        marginBottom: 16,
    },
    label: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1e293b',
        marginBottom: 8,
    },
    description: {
        fontSize: 14,
        color: '#64748b',
        marginBottom: 8,
    },
    textInput: {
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 8,
        padding: 14,
        fontSize: 16,
        minHeight: 48,
    },
    optionItem: {
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 8,
        padding: 14,
        marginBottom: 8,
    },
    optionText: {
        fontSize: 16,
        color: '#1e293b',
    },
    unsupported: {
        color: '#94a3b8',
        fontStyle: 'italic',
    },
});
