'use client';

import React from 'react';

interface ResponseMapProps {
    responses?: Array<{
        id: string;
        latitude: number;
        longitude: number;
        survey_title: string;
    }>;
}

export function ResponseMap({ responses = [] }: ResponseMapProps) {
    // TODO: Integrate Leaflet/Mapbox
    return (
        <div className="bg-slate-100 rounded-xl border border-slate-200 h-[500px] flex items-center justify-center">
            <div className="text-center text-slate-400">
                <p className="text-lg font-medium mb-2">Mapa de Respostas</p>
                <p className="text-sm">{responses.length} respostas geolocalizadas</p>
                <p className="text-xs mt-2">Integração com Leaflet/Mapbox pendente</p>
            </div>
        </div>
    );
}
