'use client';

import { useEffect, useRef } from 'react';

type ReportPayload = {
    errorCode: string;
    errorMessage: string;
    severity?: 'low' | 'medium' | 'high' | 'critical';
    httpStatusCode?: number;
    metadata?: Record<string, unknown>;
};

export default function GlobalErrorMonitor() {
    const guardRef = useRef(new Map<string, number>());

    useEffect(() => {
        const originalFetch = window.fetch.bind(window);

        const shouldSend = (fingerprint: string) => {
            const now = Date.now();
            const last = guardRef.current.get(fingerprint) ?? 0;
            if (now - last < 30000) {
                return false;
            }
            guardRef.current.set(fingerprint, now);
            return true;
        };

        const report = async (payload: ReportPayload) => {
            const fingerprint = `${payload.errorCode}:${payload.errorMessage}`;
            if (!shouldSend(fingerprint)) {
                return;
            }

            try {
                await originalFetch('/api/system/errors/ingest', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ...payload,
                        metadata: {
                            ...(payload.metadata ?? {}),
                            href: window.location.href,
                            pathname: window.location.pathname,
                        },
                    }),
                    keepalive: true,
                });
            } catch {
                // Silencioso para nao interferir na UX.
            }
        };

        const onRuntimeError = (event: ErrorEvent) => {
            void report({
                errorCode: 'CLIENT_RUNTIME_ERROR',
                errorMessage: event.message || 'Erro de runtime no cliente',
                severity: 'medium',
                metadata: {
                    filename: event.filename,
                    lineno: event.lineno,
                    colno: event.colno,
                },
            });
        };

        const onUnhandledRejection = (event: PromiseRejectionEvent) => {
            const reason = event.reason;
            void report({
                errorCode: 'CLIENT_RUNTIME_ERROR',
                errorMessage:
                    reason instanceof Error ? reason.message : 'Promise rejection sem tratamento',
                severity: 'high',
                metadata: {
                    reason:
                        reason instanceof Error
                            ? { name: reason.name, stack: reason.stack }
                            : reason,
                },
            });
        };

        window.fetch = async (...args: Parameters<typeof fetch>) => {
            const target = typeof args[0] === 'string' ? args[0] : args[0]?.toString();

            if (target?.includes('/api/system/errors/ingest')) {
                return originalFetch(...args);
            }

            try {
                const response = await originalFetch(...args);

                if (response.status >= 500) {
                    void report({
                        errorCode: 'API_HTTP_5XX',
                        errorMessage: `Endpoint retornou ${response.status}`,
                        severity: 'high',
                        httpStatusCode: response.status,
                        metadata: {
                            target,
                            statusText: response.statusText,
                        },
                    });
                }

                return response;
            } catch (error) {
                void report({
                    errorCode: 'NETWORK_FETCH_FAILED',
                    errorMessage:
                        error instanceof Error ? error.message : 'Falha de rede em fetch',
                    severity: 'high',
                    metadata: {
                        target,
                    },
                });

                throw error;
            }
        };

        window.addEventListener('error', onRuntimeError);
        window.addEventListener('unhandledrejection', onUnhandledRejection);

        return () => {
            window.fetch = originalFetch;
            window.removeEventListener('error', onRuntimeError);
            window.removeEventListener('unhandledrejection', onUnhandledRejection);
        };
    }, []);

    return null;
}
