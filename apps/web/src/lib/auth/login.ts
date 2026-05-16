import { z } from 'zod';

export const loginSchema = z.object({
    email: z
        .string()
        .trim()
        .min(1, 'Informe seu email.')
        .email('Informe um email válido.')
        .max(254, 'Informe um email válido.'),
    password: z
        .string()
        .min(1, 'Informe sua senha.')
        .max(128, 'Senha inválida.'),
});

export type LoginFormValues = z.infer<typeof loginSchema>;

export const loginRequestSchema = loginSchema.extend({
    redirect: z.string().trim().optional(),
});

export const forgotPasswordSchema = z.object({
    email: z
        .string()
        .trim()
        .min(1, 'Informe seu email.')
        .email('Informe um email válido.')
        .max(254, 'Informe um email válido.'),
});

export const resetPasswordSchema = z
    .object({
        password: z
            .string()
            .min(8, 'A nova senha deve ter no mínimo 8 caracteres.')
            .max(128, 'Senha inválida.'),
        confirmPassword: z
            .string()
            .min(1, 'Confirme sua nova senha.'),
    })
    .refine((values) => values.password === values.confirmPassword, {
        message: 'As senhas não coincidem.',
        path: ['confirmPassword'],
    });

export function normalizeAuthErrorMessage(message?: string): string {
    const normalizedMessage = (message ?? '').toLowerCase();

    if (
        normalizedMessage.includes('invalid login credentials') ||
        normalizedMessage.includes('invalid_credentials')
    ) {
        return 'Email ou senha incorretos. Revise os dados e tente novamente.';
    }

    if (normalizedMessage.includes('email not confirmed')) {
        return 'Seu email ainda não foi confirmado. Verifique sua caixa de entrada antes de continuar.';
    }

    if (normalizedMessage.includes('too many requests')) {
        return 'Muitas tentativas de login em sequência. Aguarde alguns minutos antes de tentar novamente.';
    }

    if (normalizedMessage.includes('network')) {
        return 'Não foi possível se conectar ao servidor de autenticação. Tente novamente em instantes.';
    }

    return 'Não foi possível concluir o login agora. Tente novamente.';
}

export function getSafeRedirectPath(redirectPath: string | null | undefined, fallbackPath: string): string {
    if (!redirectPath) {
        return fallbackPath;
    }

    const isInternalPath = redirectPath.startsWith('/') && !redirectPath.startsWith('//');
    const isAuthRoute = redirectPath.startsWith('/login') || redirectPath.startsWith('/signup');

    if (!isInternalPath || isAuthRoute) {
        return fallbackPath;
    }

    return redirectPath;
}

export function getAuthSearchMessage(messageCode: string | null): string {
    switch (messageCode) {
        case 'password_reset_success':
            return 'Senha redefinida com sucesso. Faça login com sua nova credencial.';
        case 'recovery_link_sent':
            return 'Se o email existir, enviamos um link seguro para redefinição de senha.';
        default:
            return '';
    }
}

export function getAuthSearchErrorMessage(messageCode: string | null): string {
    switch (messageCode) {
        case 'oauth_callback_failed':
            return 'Não foi possível concluir a autenticação externa. Tente novamente.';
        case 'recovery_session_missing':
            return 'O link de redefinição expirou ou já foi usado. Solicite um novo link.';
        default:
            return '';
    }
}