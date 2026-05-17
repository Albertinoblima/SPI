'use client';

import { useEffect } from 'react';

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        void fetch('/api/system/errors/ingest', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                errorCode: 'CLIENT_RUNTIME_ERROR',
                errorMessage: error.message,
                severity: 'critical',
                metadata: {
                    digest: error.digest,
                    stack: error.stack,
                },
            }),
            keepalive: true,
        }).catch(() => {
            // Evita loop de erro no fallback.
        });
    }, [error]);

    return (
        <html lang="pt-BR">
            <body className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
                <div className="max-w-xl w-full rounded-2xl border border-slate-800 bg-slate-900/80 p-8">
                    <h1 className="text-2xl font-bold mb-3">Falha inesperada no sistema</h1>
                    <p className="text-slate-300 mb-6">
                        O incidente foi registrado automaticamente para o time tecnico.
                    </p>
                    <button
                        onClick={reset}
                        className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium"
                    >
                        Tentar novamente
                    </button>
                </div>
            </body>
        </html>
    );
}
