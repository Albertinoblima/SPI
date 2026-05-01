'use client';

import React from 'react';

interface ResponseChartProps {
    data?: Array<{ label: string; value: number }>;
    title: string;
    type?: 'bar' | 'pie';
}

export function ResponseChart({ data = [], title, type = 'bar' }: ResponseChartProps) {
    // TODO: Integrate Recharts
    return (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">{title}</h3>
            {data.length > 0 ? (
                <div className="h-64 flex items-center justify-center text-slate-400">
                    Gráfico ({type}) será renderizado aqui
                </div>
            ) : (
                <div className="h-64 flex items-center justify-center text-slate-400">
                    Sem dados para exibir
                </div>
            )}
        </div>
    );
}
