import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Image,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { mobileLoginSchema } from '@/utils/auth';

export default function LoginScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const signIn = useAuthStore((state) => state.signIn);

    const handleLogin = async () => {
        setError('');

        const parsedCredentials = mobileLoginSchema.safeParse({ email, password });

        if (!parsedCredentials.success) {
            setError(parsedCredentials.error.issues[0]?.message ?? 'Revise os campos e tente novamente.');
            return;
        }

        setLoading(true);
        try {
            await signIn(parsedCredentials.data.email, parsedCredentials.data.password);
            router.replace('/(tabs)/home');
        } catch (error: any) {
            const message = error?.message ?? 'Não foi possível fazer login';
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <View style={styles.card}>
                <Image
                    source={require('../../assets/branding/idialog-logo.png')}
                    style={styles.logo}
                    resizeMode="contain"
                />
                <Text style={styles.title}>Acesso profissional</Text>
                <Text style={styles.subtitle}>Entre com sua conta para continuar a operação com sessão segura.</Text>

                {error ? <Text style={styles.errorBanner}>{error}</Text> : null}

                <View style={styles.fieldGroup}>
                    <Text style={styles.label}>Email</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="seu@email.com"
                        placeholderTextColor="#94a3b8"
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                        editable={!loading}
                    />
                </View>

                <View style={styles.fieldGroup}>
                    <View style={styles.passwordHeader}>
                        <Text style={styles.label}>Senha</Text>
                        <TouchableOpacity onPress={() => setShowPassword((currentValue) => !currentValue)}>
                            <Text style={styles.toggleText}>{showPassword ? 'Ocultar' : 'Mostrar'}</Text>
                        </TouchableOpacity>
                    </View>
                    <TextInput
                        style={styles.input}
                        placeholder="Sua senha"
                        placeholderTextColor="#94a3b8"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry={!showPassword}
                        autoCapitalize="none"
                        autoCorrect={false}
                        editable={!loading}
                    />
                </View>

                <TouchableOpacity
                    style={[styles.button, loading && styles.buttonDisabled]}
                    onPress={handleLogin}
                    disabled={loading}
                >
                    <Text style={styles.buttonText}>
                        {loading ? 'Entrando...' : 'Entrar na plataforma'}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
                    <Text style={styles.link}>Não tem conta? Cadastre-se</Text>
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        padding: 24,
        backgroundColor: '#e2e8f0',
    },
    card: {
        borderRadius: 24,
        backgroundColor: '#ffffff',
        paddingHorizontal: 24,
        paddingVertical: 28,
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 18 },
        shadowOpacity: 0.08,
        shadowRadius: 24,
        elevation: 6,
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        color: '#0f172a',
        textAlign: 'center',
        marginBottom: 8,
    },
    logo: {
        width: 220,
        height: 70,
        alignSelf: 'center',
        marginBottom: 12,
    },
    subtitle: {
        fontSize: 15,
        color: '#64748b',
        textAlign: 'center',
        marginBottom: 32,
        lineHeight: 22,
    },
    errorBanner: {
        marginBottom: 16,
        borderRadius: 14,
        backgroundColor: '#fef2f2',
        color: '#b91c1c',
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 14,
        lineHeight: 20,
    },
    fieldGroup: {
        marginBottom: 16,
    },
    label: {
        marginBottom: 8,
        fontSize: 14,
        fontWeight: '600',
        color: '#334155',
    },
    passwordHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    toggleText: {
        color: '#2563eb',
        fontSize: 13,
        fontWeight: '600',
    },
    input: {
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 14,
        padding: 16,
        fontSize: 16,
        color: '#0f172a',
    },
    button: {
        backgroundColor: '#0f172a',
        borderRadius: 14,
        padding: 16,
        alignItems: 'center',
        marginTop: 8,
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    link: {
        color: '#2563eb',
        textAlign: 'center',
        marginTop: 20,
        fontSize: 14,
        fontWeight: '600',
    },
});
