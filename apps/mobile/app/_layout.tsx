import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
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
