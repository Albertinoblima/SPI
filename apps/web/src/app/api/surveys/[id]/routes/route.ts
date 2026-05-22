import { NextRequest } from 'next/server';
import { apiError, apiSuccess, handleApiUnhandledError } from '@/lib/api-middleware';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSurveyAuthContext, surveyBelongsToTenant } from '@/lib/surveys/auth-context';

interface RouteParams {
    params: { id: string };
}

type InputLocality = { locality_id: string; ordem: number };
type InputRoute = { numero: number; nome?: string; localidades: InputLocality[] };
type InputZonePayload = { zona: 'urban' | 'rural' | 'mixed'; rotas: InputRoute[] };

function isZone(value: string): value is 'urban' | 'rural' | 'mixed' {
    return value === 'urban' || value === 'rural' || value === 'mixed';
}

export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const ctx = await getSurveyAuthContext();
        if (!ctx) return apiError('Nao autenticado', 401);

        const survey = await surveyBelongsToTenant(params.id, ctx.tenantId);
        if (!survey) return apiError('Pesquisa nao encontrada', 404);

        const admin = createAdminClient();
        const { data: routes, error } = await admin
            .from('survey_routes')
            .select('id, zone, route_number, route_name, survey_route_localities(locality_id, order_index)')
            .eq('survey_id', params.id)
            .eq('tenant_id', ctx.tenantId)
            .order('zone', { ascending: true })
            .order('route_number', { ascending: true });

        if (error) return apiError(`Falha ao carregar rotas: ${error.message}`, 500);

        return apiSuccess({ routes: routes ?? [] });
    } catch (error) {
        return handleApiUnhandledError(request, error, {
            errorCode: 'API_UNHANDLED_EXCEPTION',
            metadata: { route: '/api/surveys/[id]/routes', operation: 'GET', surveyId: params.id },
        });
    }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        const ctx = await getSurveyAuthContext();
        if (!ctx) return apiError('Nao autenticado', 401);

        const survey = await surveyBelongsToTenant(params.id, ctx.tenantId);
        if (!survey) return apiError('Pesquisa nao encontrada', 404);

        const body = await request.json();
        const zones: InputZonePayload[] = Array.isArray(body?.zonas)
            ? body.zonas
            : body?.zona_id
                ? [{ zona: body.zona_id, rotas: body.rotas ?? [] }]
                : [];

        if (zones.length === 0) {
            return apiError('Corpo invalido. Use { zonas: [{ zona, rotas: [...] }] }', 400);
        }

        for (const zonePayload of zones) {
            if (!isZone(String(zonePayload.zona))) {
                return apiError(`Zona invalida: ${String(zonePayload.zona)}`, 400);
            }
            if (!Array.isArray(zonePayload.rotas) || zonePayload.rotas.length === 0) {
                return apiError(`A zona ${zonePayload.zona} precisa ter ao menos uma rota`, 400);
            }
            if (zonePayload.rotas.some((r) => !Array.isArray(r.localidades) || r.localidades.length === 0)) {
                return apiError(`Nenhuma rota da zona ${zonePayload.zona} pode ficar vazia`, 400);
            }
        }

        const admin = createAdminClient();

        const { data: localities } = await admin
            .from('survey_localities')
            .select('id, zone')
            .eq('survey_id', params.id)
            .eq('tenant_id', ctx.tenantId);

        const localitySet = new Set((localities ?? []).map((l) => l.id));
        const allAssigned = new Set<string>();

        for (const zonePayload of zones) {
            for (const route of zonePayload.rotas) {
                for (const locality of route.localidades) {
                    if (!localitySet.has(locality.locality_id)) {
                        return apiError(`Localidade invalida na rota ${route.numero}`, 400);
                    }
                    allAssigned.add(locality.locality_id);
                }
            }
        }

        if ((localities ?? []).length > 0 && allAssigned.size !== (localities ?? []).length) {
            return apiError('Todas as localidades devem ser alocadas em alguma rota antes de avancar', 400);
        }

        const { data: existingRoutes } = await admin
            .from('survey_routes')
            .select('id')
            .eq('survey_id', params.id)
            .eq('tenant_id', ctx.tenantId);

        const existingRouteIds = (existingRoutes ?? []).map((r) => r.id);

        if (existingRouteIds.length > 0) {
            await admin.from('survey_route_localities').delete().in('route_id', existingRouteIds);
            await admin.from('survey_routes').delete().in('id', existingRouteIds);
        }

        const insertedSummary: Array<{ zone: string; route_number: number; localities: number }> = [];

        for (const zonePayload of zones) {
            for (const route of zonePayload.rotas) {
                const { data: createdRoute, error: routeError } = await admin
                    .from('survey_routes')
                    .insert({
                        survey_id: params.id,
                        tenant_id: ctx.tenantId,
                        zone: zonePayload.zona,
                        route_number: route.numero,
                        route_name: route.nome?.trim() || null,
                    })
                    .select('id')
                    .single();

                if (routeError || !createdRoute) {
                    return apiError(`Erro ao criar rota ${route.numero}: ${routeError?.message ?? 'desconhecido'}`, 500);
                }

                const rows = route.localidades
                    .sort((a, b) => a.ordem - b.ordem)
                    .map((locality, idx) => ({
                        route_id: createdRoute.id,
                        tenant_id: ctx.tenantId,
                        locality_id: locality.locality_id,
                        order_index: idx + 1,
                    }));

                const { error: linkError } = await admin.from('survey_route_localities').insert(rows);
                if (linkError) {
                    return apiError(`Erro ao salvar localidades da rota ${route.numero}: ${linkError.message}`, 500);
                }

                insertedSummary.push({
                    zone: zonePayload.zona,
                    route_number: route.numero,
                    localities: rows.length,
                });
            }
        }

        return apiSuccess({ routes: insertedSummary });
    } catch (error) {
        return handleApiUnhandledError(request, error, {
            errorCode: 'API_UNHANDLED_EXCEPTION',
            metadata: { route: '/api/surveys/[id]/routes', operation: 'POST', surveyId: params.id },
        });
    }
}
