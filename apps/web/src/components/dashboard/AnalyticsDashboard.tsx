import React, { useState, useEffect } from 'react';
import { MapPin, Users, FileText, TrendingUp, Download, Filter } from 'lucide-react';

// Simulação de dados (em produção viriam do Supabase)
const MOCK_DATA = {
    surveys: [
        { id: '1', title: 'Pesquisa Eleitoral 2026', responses: 1247 },
        { id: '2', title: 'Avaliação de Serviços Públicos', responses: 892 },
        { id: '3', title: 'Intenção de Voto - Regional', responses: 2103 },
    ],
    responses: [
        { id: '1', lat: -5.8352, lng: -35.2044, city: 'Natal', interviewer: 'João Silva', date: '2025-01-20' },
        { id: '2', lat: -5.8400, lng: -35.2100, city: 'Natal', interviewer: 'Maria Santos', date: '2025-01-21' },
        { id: '3', lat: -5.8300, lng: -35.2000, city: 'Natal', interviewer: 'Pedro Oliveira', date: '2025-01-22' },
        { id: '4', lat: -5.8450, lng: -35.2150, city: 'Natal', interviewer: 'Ana Costa', date: '2025-01-23' },
        { id: '5', lat: -5.8250, lng: -35.1950, city: 'Natal', interviewer: 'Carlos Lima', date: '2025-01-24' },
    ],
    stats: {
        totalResponses: 4242,
        totalInterviewers: 23,
        totalSurveys: 8,
        avgResponsesPerDay: 187,
    },
    byRegion: [
        { region: 'Zona Norte', count: 1250, percentage: 29.5 },
        { region: 'Zona Sul', count: 1100, percentage: 25.9 },
        { region: 'Zona Leste', count: 980, percentage: 23.1 },
        { region: 'Zona Oeste', count: 912, percentage: 21.5 },
    ],
    timeline: [
        { date: '2025-01-20', responses: 145 },
        { date: '2025-01-21', responses: 178 },
        { date: '2025-01-22', responses: 203 },
        { date: '2025-01-23', responses: 189 },
        { date: '2025-01-24', responses: 225 },
        { date: '2025-01-25', responses: 198 },
        { date: '2025-01-26', responses: 167 },
    ],
};

const AnalyticsDashboard = () => {
    const [selectedSurvey, setSelectedSurvey] = useState(MOCK_DATA.surveys[0]);
    const [dateRange, setDateRange] = useState('7d');
    const [mapView, setMapView] = useState<'markers' | 'heatmap'>('markers');

    // Calcula métricas
    const metrics = [
        {
            label: 'Total de Respostas',
            value: MOCK_DATA.stats.totalResponses.toLocaleString(),
            icon: FileText,
            color: 'bg-blue-500',
            change: '+12%',
        },
        {
            label: 'Entrevistadores Ativos',
            value: MOCK_DATA.stats.totalInterviewers,
            icon: Users,
            color: 'bg-green-500',
            change: '+3',
        },
        {
            label: 'Pesquisas Ativas',
            value: MOCK_DATA.stats.totalSurveys,
            icon: MapPin,
            color: 'bg-purple-500',
            change: '+2',
        },
        {
            label: 'Média Diária',
            value: MOCK_DATA.stats.avgResponsesPerDay,
            icon: TrendingUp,
            color: 'bg-orange-500',
            change: '+8%',
        },
    ];

    const handleExportData = () => {
        // Simula exportação
        const data = JSON.stringify(MOCK_DATA, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `relatorio_${selectedSurvey.title}_${new Date().toISOString()}.json`;
        link.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-4xl font-bold text-gray-900 mb-2">
                        Dashboard de Analytics
                    </h1>
                    <p className="text-gray-600">
                        Visualização em tempo real dos dados de pesquisa
                    </p>
                </div>

                {/* Filters */}
                <div className="bg-white rounded-xl shadow-md p-6 mb-6">
                    <div className="flex flex-wrap gap-4 items-center">
                        <div className="flex-1 min-w-[250px]">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Pesquisa
                            </label>
                            <select
                                value={selectedSurvey.id}
                                onChange={(e) =>
                                    setSelectedSurvey(
                                        MOCK_DATA.surveys.find((s) => s.id === e.target.value)!
                                    )
                                }
                                className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-blue-500 outline-none"
                            >
                                {MOCK_DATA.surveys.map((survey) => (
                                    <option key={survey.id} value={survey.id}>
                                        {survey.title} ({survey.responses} respostas)
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Período
                            </label>
                            <select
                                value={dateRange}
                                onChange={(e) => setDateRange(e.target.value)}
                                className="px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-blue-500 outline-none"
                            >
                                <option value="24h">Últimas 24h</option>
                                <option value="7d">Últimos 7 dias</option>
                                <option value="30d">Últimos 30 dias</option>
                                <option value="all">Tudo</option>
                            </select>
                        </div>

                        <div className="ml-auto flex gap-3">
                            <button
                                onClick={handleExportData}
                                className="flex items-center gap-2 bg-green-600 text-white px-5 py-2 rounded-lg hover:bg-green-700 transition shadow-md"
                            >
                                <Download size={18} />
                                Exportar
                            </button>
                            <button className="flex items-center gap-2 bg-gray-600 text-white px-5 py-2 rounded-lg hover:bg-gray-700 transition shadow-md">
                                <Filter size={18} />
                                Filtros Avançados
                            </button>
                        </div>
                    </div>
                </div>

                {/* Metrics Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                    {metrics.map((metric, index) => {
                        const Icon = metric.icon;
                        return (
                            <div
                                key={index}
                                className="bg-white rounded-xl shadow-md p-6 border-l-4 border-blue-500 hover:shadow-lg transition"
                            >
                                <div className="flex items-center justify-between mb-3">
                                    <div
                                        className={`${metric.color} w-12 h-12 rounded-lg flex items-center justify-center`}
                                    >
                                        <Icon size={24} className="text-white" />
                                    </div>
                                    <span className="text-green-600 text-sm font-semibold">
                                        {metric.change}
                                    </span>
                                </div>
                                <div className="text-3xl font-bold text-gray-900 mb-1">
                                    {metric.value}
                                </div>
                                <div className="text-sm text-gray-600">{metric.label}</div>
                            </div>
                        );
                    })}
                </div>

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Map */}
                    <div className="lg:col-span-2 bg-white rounded-xl shadow-md p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold text-gray-900">
                                Mapa de Respostas
                            </h2>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setMapView('markers')}
                                    className={`px-4 py-2 rounded-lg transition ${mapView === 'markers'
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                        }`}
                                >
                                    📍 Marcadores
                                </button>
                                <button
                                    onClick={() => setMapView('heatmap')}
                                    className={`px-4 py-2 rounded-lg transition ${mapView === 'heatmap'
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                        }`}
                                >
                                    🔥 Mapa de Calor
                                </button>
                            </div>
                        </div>

                        {/* Mapa Simulado */}
                        <div className="relative bg-gradient-to-br from-blue-100 to-blue-50 rounded-lg h-96 overflow-hidden border-2 border-blue-200">
                            {mapView === 'markers' ? (
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="text-center">
                                        <div className="text-6xl mb-4">🗺️</div>
                                        <div className="text-gray-700 font-semibold mb-2">
                                            Mapa Interativo
                                        </div>
                                        <div className="text-sm text-gray-600 max-w-md">
                                            Em produção, use Leaflet ou Mapbox para visualizar{' '}
                                            {MOCK_DATA.responses.length} pontos de coleta
                                        </div>
                                        <div className="mt-4 flex justify-center gap-2">
                                            {MOCK_DATA.responses.map((r, i) => (
                                                <div
                                                    key={r.id}
                                                    className="w-3 h-3 bg-red-500 rounded-full animate-pulse"
                                                    style={{
                                                        animationDelay: `${i * 200}ms`,
                                                    }}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="absolute inset-0">
                                    <svg width="100%" height="100%" className="opacity-70">
                                        <defs>
                                            <radialGradient id="heat1">
                                                <stop offset="0%" stopColor="#ff0000" />
                                                <stop offset="100%" stopColor="#ff000000" />
                                            </radialGradient>
                                            <radialGradient id="heat2">
                                                <stop offset="0%" stopColor="#ff6600" />
                                                <stop offset="100%" stopColor="#ff660000" />
                                            </radialGradient>
                                        </defs>
                                        <circle cx="30%" cy="40%" r="80" fill="url(#heat1)" />
                                        <circle cx="60%" cy="60%" r="100" fill="url(#heat2)" />
                                        <circle cx="75%" cy="35%" r="60" fill="url(#heat1)" />
                                    </svg>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="text-center bg-white bg-opacity-90 p-6 rounded-xl">
                                            <div className="text-6xl mb-4">🔥</div>
                                            <div className="text-gray-700 font-semibold mb-2">
                                                Mapa de Calor
                                            </div>
                                            <div className="text-sm text-gray-600 max-w-md">
                                                Densidade de respostas por região. Áreas vermelhas
                                                indicam maior concentração.
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Legenda */}
                        <div className="mt-4 flex items-center justify-between text-sm">
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                                    <span className="text-gray-600">Alta densidade</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                                    <span className="text-gray-600">Média densidade</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                                    <span className="text-gray-600">Baixa densidade</span>
                                </div>
                            </div>
                            <button className="text-blue-600 hover:text-blue-700 font-medium">
                                Ver mapa completo →
                            </button>
                        </div>
                    </div>

                    {/* Regional Distribution */}
                    <div className="bg-white rounded-xl shadow-md p-6">
                        <h2 className="text-xl font-bold text-gray-900 mb-4">
                            Distribuição Regional
                        </h2>
                        <div className="space-y-4">
                            {MOCK_DATA.byRegion.map((region, index) => (
                                <div key={index}>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-medium text-gray-700">
                                            {region.region}
                                        </span>
                                        <span className="text-sm font-bold text-gray-900">
                                            {region.count}
                                        </span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                                        <div
                                            className="bg-gradient-to-r from-blue-500 to-blue-600 h-full rounded-full transition-all duration-500"
                                            style={{ width: `${region.percentage}%` }}
                                        />
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1">
                                        {region.percentage}%
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="mt-6 pt-6 border-t border-gray-200">
                            <div className="text-sm text-gray-600 mb-2">
                                Cobertura Total
                            </div>
                            <div className="flex items-baseline gap-2">
                                <span className="text-3xl font-bold text-gray-900">94.2%</span>
                                <span className="text-sm text-green-600 font-semibold">
                                    +2.3%
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Timeline Chart */}
                <div className="bg-white rounded-xl shadow-md p-6 mt-6">
                    <h2 className="text-xl font-bold text-gray-900 mb-4">
                        Respostas ao Longo do Tempo
                    </h2>
                    <div className="flex items-end justify-between h-64 gap-4">
                        {MOCK_DATA.timeline.map((day, index) => {
                            const maxValue = Math.max(...MOCK_DATA.timeline.map((d) => d.responses));
                            const heightPercent = (day.responses / maxValue) * 100;

                            return (
                                <div key={index} className="flex-1 flex flex-col items-center">
                                    <div className="w-full flex-1 flex items-end">
                                        <div
                                            className="w-full bg-gradient-to-t from-blue-600 to-blue-400 rounded-t-lg hover:from-blue-700 hover:to-blue-500 transition-all cursor-pointer group relative"
                                            style={{ height: `${heightPercent}%` }}
                                        >
                                            <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white px-2 py-1 rounded text-xs font-semibold opacity-0 group-hover:opacity-100 transition whitespace-nowrap">
                                                {day.responses} respostas
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-xs text-gray-600 mt-2 text-center">
                                        {new Date(day.date).toLocaleDateString('pt-BR', {
                                            day: '2-digit',
                                            month: 'short',
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Recent Activity */}
                <div className="bg-white rounded-xl shadow-md p-6 mt-6">
                    <h2 className="text-xl font-bold text-gray-900 mb-4">
                        Atividade Recente
                    </h2>
                    <div className="space-y-3">
                        {MOCK_DATA.responses.map((response) => (
                            <div
                                key={response.id}
                                className="flex items-center gap-4 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
                            >
                                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                                    <MapPin size={20} className="text-blue-600" />
                                </div>
                                <div className="flex-1">
                                    <div className="font-semibold text-gray-900">
                                        {response.interviewer}
                                    </div>
                                    <div className="text-sm text-gray-600">
                                        {response.city} • {response.lat.toFixed(4)},{' '}
                                        {response.lng.toFixed(4)}
                                    </div>
                                </div>
                                <div className="text-sm text-gray-500">{response.date}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AnalyticsDashboard;
