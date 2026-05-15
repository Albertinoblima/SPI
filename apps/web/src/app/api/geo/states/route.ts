import { apiSuccess } from '@/lib/api-middleware';
import { BR_STATES } from '@/lib/geo/br-reference';

type IbgeStateResponse = {
    id: number;
    sigla: string;
    nome: string;
};

const IBGE_STATES_URL = 'https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome';

export async function GET() {
    try {
        const response = await fetch(IBGE_STATES_URL, {
            next: { revalidate: 60 * 60 * 24 * 30 },
        });

        if (!response.ok) {
            throw new Error(`IBGE states request failed with status ${response.status}`);
        }

        const payload = (await response.json()) as IbgeStateResponse[];

        const states = payload
            .map((state) => ({
                code: state.id,
                uf: state.sigla,
                name: state.nome,
            }))
            .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

        return apiSuccess({
            source: 'ibge',
            states,
        });
    } catch {
        const states = BR_STATES.map((state) => ({
            code: state.code,
            uf: state.uf,
            name: state.name,
        })).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

        return apiSuccess({
            source: 'fallback',
            states,
        });
    }
}
