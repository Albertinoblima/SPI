import { NextRequest } from 'next/server';
import { apiError, apiSuccess, handleApiUnhandledError, requireTenantAdmin } from '@/lib/api-middleware';

type Params = { params: { id: string } };

export async function GET(request: NextRequest, { params }: Params) {
    const auth = await requireTenantAdmin(request);
    if (!auth.isAuthorized) {
        return apiError(auth.error ?? 'Não autorizado', auth.status ?? 401);
    }
    try {
        const { id } = params;
        const ibgeId = parseInt(id, 10);

        if (isNaN(ibgeId)) {
            return apiError('ID IBGE inválido.', 400);
        }

        // Busca dados do municipio + resumo na view
        const [municipioRes, localidadesRes, ingestaoRes] = await Promise.all([
            auth.supabase
                .from('vw_municipio_resumo')
                .select('*')
                .eq('id_ibge', ibgeId)
                .single(),

            auth.supabase
                .from('vw_consulta_localidades')
                .select(
                    'localidade_id, localidade, tipo_localidade, zona, total_habitantes, ' +
                    'total_eleitores, percentual_eleitores_populacao, metodo_vinculo_eleitoral, ' +
                    'fonte, ibge_id'
                )
                .eq('municipio_id', ibgeId)
                .order('tipo_localidade', { ascending: true })
                .order('localidade', { ascending: true })
                .limit(500),

            auth.supabase
                .from('geo_ingestao_log')
                .select('operacao, status, registros_total, registros_novos, registros_erro, concluido_em')
                .eq('municipio_id', ibgeId)
                .order('iniciado_em', { ascending: false })
                .limit(10),
        ]);

        if (municipioRes.error || !municipioRes.data) {
            return apiError('Município não encontrado.', 404);
        }

        // Estatisticas calculadas pelo backend
        const localidades = localidadesRes.data ?? [];

        const stats = {
            total_localidades: localidades.length,
            localidades_urbanas: localidades.filter((l) => l.zona === 'URBANA').length,
            localidades_rurais: localidades.filter((l) => l.zona === 'RURAL').length,
            com_dados_demograficos: localidades.filter((l) => l.total_habitantes > 0).length,
            com_dados_eleitorais: localidades.filter((l) => l.total_eleitores > 0).length,
            por_tipo: localidades.reduce<Record<string, number>>((acc, l) => {
                const t = l.tipo_localidade as string;
                acc[t] = (acc[t] ?? 0) + 1;
                return acc;
            }, {}),
        };

        return apiSuccess({
            municipio: municipioRes.data,
            localidades,
            stats,
            historico_ingestao: ingestaoRes.data ?? [],
        });
    } catch (error) {
        return handleApiUnhandledError(request, error, {
            errorCode: 'API_UNHANDLED_EXCEPTION',
            userId: auth.user.id,
            metadata: { route: '/api/geo/municipios/[id]' },
        });
    }
}
