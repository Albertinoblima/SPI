'use client';

export default function ResponseMapPage() {
    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold text-slate-900 mb-6">
                Mapa de Respostas
            </h1>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden" style={{ height: '600px' }}>
                {/* TODO: Integrate Leaflet/Mapbox map */}
                <div className="flex items-center justify-center h-full text-slate-400">
                    Mapa de geolocalização será exibido aqui
                </div>
            </div>
        </div>
    );
}
