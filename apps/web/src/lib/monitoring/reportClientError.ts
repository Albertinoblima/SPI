import type { ErrorSeverity } from './error-codes';

type ReportClientErrorOptions = {
    errorCode: string;
    errorMessage: string;
    severity?: ErrorSeverity;
    metadata?: Record<string, unknown>;
};

/**
 * Reports a client-side error to the central monitoring system.
 * This ensures errors from the Planning module (and others) appear in /admin/system/errors.
 */
export async function reportClientError({
    errorCode,
    errorMessage,
    severity = 'medium',
    metadata = {},
}: ReportClientErrorOptions): Promise<void> {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        await fetch('/api/system/errors/ingest', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                errorCode,
                errorMessage,
                severity,
                metadata: {
                    ...metadata,
                    href: typeof window !== 'undefined' ? window.location.href : undefined,
                    pathname: typeof window !== 'undefined' ? window.location.pathname : undefined,
                    timestamp: new Date().toISOString(),
                },
            }),
            keepalive: true,
            signal: controller.signal,
        });

        clearTimeout(timeoutId);
    } catch (err) {
        // Never let error reporting break the app
        console.error('[reportClientError] Failed to report error:', err);
    }
}
