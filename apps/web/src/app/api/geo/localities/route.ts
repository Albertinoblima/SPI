/**
 * GET /api/geo/localities?city=<nome_cidade>&state=<nome_estado>
 *
 * Retorna os distritos e subdistritos de um município via API IBGE v1.
 * Cada item inclui nome e classificação de zona (urbana/rural) quando disponível
 * via IBGE v3 (áreas urbanizadas).
 *
 * Fluxo:
 * 1. Resolve código do estado pelo nome/UF
 * 2. Busca lista de municípios do estado → localiza código do município
 * 3. Busca distritos do município: /localidades/municipios/{id}/distritos
 * 4. Para cada distrito busca subdistrito se necessário
 * 5. Retorna lista ordenada com { name, zone }
 */

import { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/api-middleware';
import { normalizeGeoText, resolveStateCode } from '@/lib/geo/br-reference';

type IbgeMunicipio = { id: number; nome: string };
type IbgeDistrito = { id: number; nome: string; municipio?: { id: number; nome: string } };
type IbgeSubdistrito = { id: number; nome: string; distrito?: { id: number; nome: string } };

export interface LocalityOption {
    name: string;
    /** Classificação de zona conforme IBGE (urban = sede/distrito urbano, rural = zona rural) */
    zone: 'urban' | 'rural';
    ibge_id?: number;
}

const CACHE = 60 * 60 * 24 * 30; // 30 dias

function cityUrl(stateCode: number): string {
    return `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${stateCode}/municipios?orderBy=nome`;
}

function distritosUrl(cityId: number): string {
    return `https://servicodados.ibge.gov.br/api/v1/localidades/municipios/${cityId}/distritos?orderBy=nome`;
}

function subdistritosUrl(distritoId: number): string {
    return `https://servicodados.ibge.gov.br/api/v1/localidades/distritos/${distritoId}/subdistritos?orderBy=nome`;
}

async function fetchJson<T>(url: string): Promise<T> {
    const res = await fetch(url, { next: { revalidate: CACHE } });
    if (!res.ok) throw new Error(`IBGE ${res.status}: ${url}`);
    return res.json() as Promise<T>;
}

/**
 * Heurística simples de zona:
 * - Distritos cujo nome é igual ao município = sede urbana
 * - Demais distritos = considerar como rural (sem dados mais finos disponíveis via IBGE v1)
 */
function inferZone(districName: string, cityName: string): 'urban' | 'rural' {
    const d = normalizeGeoText(districName);
    const c = normalizeGeoText(cityName);
    if (d === c || d.startsWith(c) || c.startsWith(d)) return 'urban';
    return 'rural';
}

export async function GET(request: NextRequest) {
    const cityParam = request.nextUrl.searchParams.get('city')?.trim();
    const stateParam = request.nextUrl.searchParams.get('state')?.trim();

    if (!cityParam) return apiError('Informe o parametro city.', 400);
    if (!stateParam) return apiError('Informe o parametro state.', 400);

    const stateCode = resolveStateCode(stateParam);
    if (!stateCode) {
        return apiSuccess({ source: 'fallback', localities: [], warning: 'Estado nao reconhecido.' });
    }

    try {
        // 1 — Localiza código do município
        const municipalities = await fetchJson<IbgeMunicipio[]>(cityUrl(stateCode));
        const normalizedCity = normalizeGeoText(cityParam);
        const city = municipalities.find((m) => normalizeGeoText(m.nome) === normalizedCity)
            ?? municipalities.find((m) => normalizeGeoText(m.nome).includes(normalizedCity))
            ?? municipalities.find((m) => normalizedCity.includes(normalizeGeoText(m.nome)));

        if (!city) {
            return apiSuccess({ source: 'fallback', localities: [], warning: 'Municipio nao encontrado no IBGE.' });
        }

        // 2 — Carrega distritos do município
        const distritos = await fetchJson<IbgeDistrito[]>(distritosUrl(city.id));

        const localities: LocalityOption[] = [];

        for (const d of distritos) {
            const zone = inferZone(d.nome, city.nome);
            localities.push({ name: d.nome, zone, ibge_id: d.id });

            // 3 — Carrega subdistritos (bairros oficiais) — apenas para sede urbana para evitar excesso de chamadas
            if (zone === 'urban') {
                try {
                    const subs = await fetchJson<IbgeSubdistrito[]>(subdistritosUrl(d.id));
                    for (const s of subs) {
                        localities.push({ name: s.nome, zone: 'urban', ibge_id: s.id });
                    }
                } catch {
                    // subdistritos não disponíveis para este distrito; ignora silenciosamente
                }
            }
        }

        // Ordena e remove duplicatas pelo nome
        const seen = new Set<string>();
        const result = localities
            .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
            .filter((l) => {
                const key = normalizeGeoText(l.name);
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });

        return apiSuccess({
            source: 'ibge',
            city: city.nome,
            city_ibge_id: city.id,
            localities: result,
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return apiSuccess({
            source: 'fallback',
            localities: [],
            warning: `Erro ao consultar IBGE: ${message}`,
        });
    }
}
