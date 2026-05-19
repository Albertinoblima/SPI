import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
    ErrorSeverity,
    getErrorCodeDefinition,
    isImmediateNotificationCode,
} from '@/lib/monitoring/error-codes';

interface CaptureSystemErrorInput {
    request?: NextRequest;
    errorCode: string;
    error?: unknown;
    errorMessage?: string;
    severity?: ErrorSeverity;
    tenantId?: string | null;
    userId?: string | null;
    httpStatusCode?: number | null;
    httpPath?: string | null;
    httpMethod?: string | null;
    correlationId?: string;
    metadata?: Record<string, unknown>;
}

function derivePathFromTarget(target: unknown): string | null {
    if (typeof target !== 'string' || target.trim().length === 0) {
        return null;
    }

    const value = target.trim();

    if (value.startsWith('/')) {
        return value;
    }

    try {
        const parsed = new URL(value);
        return parsed.pathname || null;
    } catch {
        return null;
    }
}

function safeJson(value: unknown): string {
    try {
        return JSON.stringify(value);
    } catch {
        return '"[unserializable]"';
    }
}

function buildCorrelationId(input?: string): string {
    if (input && input.trim().length > 0) {
        return input.trim();
    }

    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function extractErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }

    if (typeof error === 'string') {
        return error;
    }

    return safeJson(error);
}

function extractErrorStack(error: unknown): string | null {
    if (!(error instanceof Error)) {
        return null;
    }

    return error.stack?.split('\n').slice(0, 25).join('\n') ?? null;
}

export async function captureSystemError(input: CaptureSystemErrorInput): Promise<{
    correlationId: string;
    errorId?: string;
}> {
    const definition = getErrorCodeDefinition(input.errorCode);
    const correlationId = buildCorrelationId(
        input.correlationId ?? input.request?.headers.get('x-correlation-id') ?? undefined
    );

    const effectiveSeverity = input.severity ?? definition.severity;
    const effectiveMessage =
        input.errorMessage?.trim() ||
        extractErrorMessage(input.error) ||
        definition.userMessage;

    const request = input.request;
    const requestPath = request ? request.nextUrl.pathname : null;

    const pathFromTarget = derivePathFromTarget(input.metadata?.target);
    const inferredPath =
        requestPath === '/api/system/errors/ingest' && pathFromTarget
            ? pathFromTarget
            : requestPath;

    const httpMethod = input.httpMethod ?? request?.method ?? null;
    const httpPath = input.httpPath ?? inferredPath;

    const userAgent = request?.headers.get('user-agent') ?? null;
    const forwardedFor = request?.headers.get('x-forwarded-for') ?? null;
    const ip = forwardedFor?.split(',')[0]?.trim() ?? null;

    const payload = {
        code_title: definition.title,
        resolution_steps: definition.resolutionSteps,
        metadata: input.metadata ?? {},
        raw_stack: extractErrorStack(input.error),
    };

    try {
        const admin = createAdminClient();

        const { data, error } = await admin
            .from('error_logs')
            .insert({
                tenant_id: input.tenantId ?? null,
                user_id: input.userId ?? null,
                error_code: input.errorCode,
                error_message: effectiveMessage,
                error_stack: safeJson(payload).slice(0, 12000),
                http_method: httpMethod,
                http_path: httpPath,
                http_status_code: input.httpStatusCode ?? null,
                severity: effectiveSeverity,
                correlation_id: correlationId,
                user_agent: userAgent,
                ip_address: ip,
            })
            .select('id')
            .single();

        if (error) {
            console.error('[monitoring] falha ao inserir error_logs', error);
            return { correlationId };
        }

        if (isImmediateNotificationCode(input.errorCode) || effectiveSeverity === 'critical') {
            await admin.from('audit_log').insert({
                user_id: input.userId ?? null,
                tenant_id: input.tenantId ?? null,
                action: 'system_error_alert',
                entity_type: 'error_log',
                entity_id: data.id,
                changes_description: `Alerta imediato: ${input.errorCode} (${effectiveSeverity})`,
                new_values: {
                    code: input.errorCode,
                    correlation_id: correlationId,
                    path: httpPath,
                    status: input.httpStatusCode,
                },
                is_critical: effectiveSeverity === 'critical' || definition.notifyImmediately,
            });
        }

        return { correlationId, errorId: data.id };
    } catch (error) {
        console.error('[monitoring] falha inesperada ao capturar erro', error);
        return { correlationId };
    }
}
