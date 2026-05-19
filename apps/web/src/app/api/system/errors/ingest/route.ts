import { NextRequest } from 'next/server';
import {
    apiError,
    apiSuccess,
} from '@/lib/api-middleware';
import { captureSystemError } from '@/lib/monitoring/error-monitor';

export async function POST(request: NextRequest) {
    const correlationId = request.headers.get('x-correlation-id') || crypto.randomUUID();

    try {
        const body = await request.json();

        const errorCode =
            typeof body.errorCode === 'string' && body.errorCode.trim().length > 0
                ? body.errorCode.trim()
                : 'UNKNOWN_ERROR';

        const errorMessage =
            typeof body.errorMessage === 'string' && body.errorMessage.trim().length > 0
                ? body.errorMessage.trim()
                : 'Falha reportada pelo cliente';

        const severity =
            body.severity === 'low' ||
                body.severity === 'medium' ||
                body.severity === 'high' ||
                body.severity === 'critical'
                ? body.severity
                : undefined;

        const metadata =
            body.metadata && typeof body.metadata === 'object'
                ? (body.metadata as Record<string, unknown>)
                : undefined;

        const httpMethod =
            typeof metadata?.method === 'string' && metadata.method.trim().length > 0
                ? metadata.method.trim().toUpperCase()
                : undefined;

        const httpPath =
            typeof metadata?.target === 'string' && metadata.target.trim().length > 0
                ? metadata.target.trim()
                : undefined;

        const result = await captureSystemError({
            request,
            errorCode,
            errorMessage,
            severity,
            correlationId,
            httpMethod,
            httpPath,
            httpStatusCode:
                typeof body.httpStatusCode === 'number' ? body.httpStatusCode : undefined,
            metadata,
        });

        return apiSuccess({ accepted: true, correlationId: result.correlationId }, 202);
    } catch (error) {
        console.error(`[errors/ingest] Erro ao processar payload [${correlationId}]:`, error);
        return apiError('Payload de monitoramento inválido', 400);
    }
}
