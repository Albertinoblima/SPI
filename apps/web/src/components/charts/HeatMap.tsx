'use client';

import React from 'react';

interface HeatMapProps {
    data?: Array<{
        latitude: number;
        longitude: number;
        intensity: number;
    }>;
}

export function HeatMap({ data = [] }: HeatMapProps) {
    // TODO: Integrate Leaflet heatmap plugin
    return (
        <div className="bg-slate-100 rounded-xl border border-slate-200 h-[400px] flex items-center justify-center">
            <div className="text-center text-slate-400">
                <p className="text-lg font-medium mb-2">Mapa de Calor</p>
                <p className="text-sm">{data.length} pontos de dados</p>
            </div>
        </div>
    );
}
