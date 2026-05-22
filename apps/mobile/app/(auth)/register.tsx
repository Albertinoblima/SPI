import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { router } from 'expo-router';

export default function RegisterScreen() {
    return (
        <View style={styles.container}>
            <Image
                source={require('../../assets/branding/idialog-logo.png')}
                style={styles.logo}
                resizeMode="contain"
            />
            <Text style={styles.title}>Cadastro indisponível no app</Text>
            <Text style={styles.subtitle}>
                O aplicativo móvel é exclusivo para entrevistadores de campo já cadastrados pela equipe gestora.
            </Text>

            <TouchableOpacity onPress={() => router.back()}>
                <Text style={styles.link}>Voltar para login</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        padding: 24,
        backgroundColor: '#f8fafc',
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#1a365d',
        textAlign: 'center',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 14,
        lineHeight: 22,
        color: '#64748b',
        textAlign: 'center',
        marginBottom: 24,
    },
    logo: {
        width: 220,
        height: 70,
        alignSelf: 'center',
        marginBottom: 12,
    },
    link: {
        color: '#2563eb',
        textAlign: 'center',
        marginTop: 16,
        fontSize: 14,
    },
});
