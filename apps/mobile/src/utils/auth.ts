import { z } from 'zod';

export const mobileLoginSchema = z.object({
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

export function normalizeMobileAuthErrorMessage(message?: string): string {
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
        return 'Falha de conexão. Verifique sua internet e tente novamente.';
    }

    return 'Não foi possível concluir o login agora. Tente novamente.';
}