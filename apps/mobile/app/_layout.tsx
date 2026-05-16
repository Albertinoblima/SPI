import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { initializeAuthSession, useAuthStore } from '@/store/authStore';

export default function RootLayout() {
    const router = useRouter();
    const segments = useSegments();
    const session = useAuthStore((state) => state.session);
    const loading = useAuthStore((state) => state.loading);

    useEffect(() => {
        let unsubscribe: undefined | (() => void);
        let isMounted = true;

        initializeAuthSession().then((cleanup) => {
            if (isMounted) {
                unsubscribe = cleanup;
                return;
            }

            cleanup();
        });

        return () => {
            isMounted = false;
            unsubscribe?.();
        };
    }, []);

    useEffect(() => {
        if (loading) {
            return;
        }

        const inAuthGroup = segments[0] === '(auth)';

        if (!session && !inAuthGroup) {
            router.replace('/(auth)/login');
            return;
        }

        if (session && inAuthGroup) {
            router.replace('/(tabs)/home');
        }
    }, [loading, router, segments, session]);

    if (loading) {
        return (
            <>
                <StatusBar style="auto" />
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#1a365d" />
                </View>
            </>
        );
    }

    return (
        <>
            <StatusBar style="auto" />
            <Stack>
                <Stack.Screen name="(auth)" options={{ headerShown: false }} />
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen
                    name="survey/[id]"
                    options={{ title: 'Detalhes da Pesquisa' }}
                />
                <Stack.Screen
                    name="survey/response"
                    options={{ title: 'Registrar Resposta' }}
                />
            </Stack>
        </>
    );
}

const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f8fafc',
    },
});
