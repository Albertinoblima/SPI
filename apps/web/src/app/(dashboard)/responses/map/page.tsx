'use client';

export default function ResponseMapPage() {
    return (
        <div className="p-4 sm:p-6">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mb-4 sm:mb-6">
                Mapa de Respostas
            </h1>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden h-[clamp(320px,60dvh,600px)]">
                {/* TODO: Integrate Leaflet/Mapbox map */}
                <div className="flex items-center justify-center h-full text-slate-400">
                    Mapa de geolocalização será exibido aqui
                </div>
            </div>
        </div>
    );
}
