import React, { useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useSurveyStore } from '@/store/surveyStore';

export default function SurveysScreen() {
    const { surveys, fetchSurveys, loading } = useSurveyStore();

    useEffect(() => {
        fetchSurveys();
    }, []);

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Pesquisas Disponíveis</Text>

            <FlatList
                data={surveys}
                keyExtractor={(item) => item.id}
                refreshing={loading}
                onRefresh={fetchSurveys}
                renderItem={({ item }) => (
                    <TouchableOpacity
                        style={styles.card}
                        onPress={() => router.push(`/survey/${item.id}`)}
                    >
                        <Text style={styles.cardTitle}>{item.title}</Text>
                        <Text style={styles.cardDescription}>{item.description}</Text>
                        <View style={styles.cardFooter}>
                            <View
                                style={[
                                    styles.statusBadge,
                                    item.status === 'active' && styles.activeBadge,
                                    item.status === 'draft' && styles.draftBadge,
                                ]}
                            >
                                <Text style={styles.statusText}>{item.status}</Text>
                            </View>
                        </View>
                    </TouchableOpacity>
                )}
                ListEmptyComponent={
                    <View style={styles.empty}>
                        <Text style={styles.emptyText}>
                            Nenhuma pesquisa disponível
                        </Text>
                    </View>
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
    card: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1e293b',
        marginBottom: 4,
    },
    cardDescription: {
        fontSize: 14,
        color: '#64748b',
        marginBottom: 12,
    },
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    statusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        backgroundColor: '#e2e8f0',
    },
    activeBadge: {
        backgroundColor: '#dcfce7',
    },
    draftBadge: {
        backgroundColor: '#fef3c7',
    },
    statusText: {
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'capitalize',
    },
    empty: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 48,
    },
    emptyText: {
        fontSize: 16,
        color: '#94a3b8',
    },
});
