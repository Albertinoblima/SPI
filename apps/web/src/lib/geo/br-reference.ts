export type BrState = {
    code: number;
    uf: string;
    name: string;
    capital: string;
};

export const BR_STATES: BrState[] = [
    { code: 12, uf: 'AC', name: 'Acre', capital: 'Rio Branco' },
    { code: 27, uf: 'AL', name: 'Alagoas', capital: 'Maceio' },
    { code: 16, uf: 'AP', name: 'Amapa', capital: 'Macapa' },
    { code: 13, uf: 'AM', name: 'Amazonas', capital: 'Manaus' },
    { code: 29, uf: 'BA', name: 'Bahia', capital: 'Salvador' },
    { code: 23, uf: 'CE', name: 'Ceara', capital: 'Fortaleza' },
    { code: 53, uf: 'DF', name: 'Distrito Federal', capital: 'Brasilia' },
    { code: 32, uf: 'ES', name: 'Espirito Santo', capital: 'Vitoria' },
    { code: 52, uf: 'GO', name: 'Goias', capital: 'Goiania' },
    { code: 21, uf: 'MA', name: 'Maranhao', capital: 'Sao Luis' },
    { code: 51, uf: 'MT', name: 'Mato Grosso', capital: 'Cuiaba' },
    { code: 50, uf: 'MS', name: 'Mato Grosso do Sul', capital: 'Campo Grande' },
    { code: 31, uf: 'MG', name: 'Minas Gerais', capital: 'Belo Horizonte' },
    { code: 15, uf: 'PA', name: 'Para', capital: 'Belem' },
    { code: 25, uf: 'PB', name: 'Paraiba', capital: 'Joao Pessoa' },
    { code: 41, uf: 'PR', name: 'Parana', capital: 'Curitiba' },
    { code: 26, uf: 'PE', name: 'Pernambuco', capital: 'Recife' },
    { code: 22, uf: 'PI', name: 'Piaui', capital: 'Teresina' },
    { code: 33, uf: 'RJ', name: 'Rio de Janeiro', capital: 'Rio de Janeiro' },
    { code: 24, uf: 'RN', name: 'Rio Grande do Norte', capital: 'Natal' },
    { code: 43, uf: 'RS', name: 'Rio Grande do Sul', capital: 'Porto Alegre' },
    { code: 11, uf: 'RO', name: 'Rondonia', capital: 'Porto Velho' },
    { code: 14, uf: 'RR', name: 'Roraima', capital: 'Boa Vista' },
    { code: 42, uf: 'SC', name: 'Santa Catarina', capital: 'Florianopolis' },
    { code: 35, uf: 'SP', name: 'Sao Paulo', capital: 'Sao Paulo' },
    { code: 28, uf: 'SE', name: 'Sergipe', capital: 'Aracaju' },
    { code: 17, uf: 'TO', name: 'Tocantins', capital: 'Palmas' },
];

export function normalizeGeoText(value: string): string {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();
}

export function resolveStateCode(input: string): number | null {
    const normalized = normalizeGeoText(input);
    if (!normalized) return null;

    const byCode = BR_STATES.find((state) => String(state.code) === normalized);
    if (byCode) return byCode.code;

    const byUf = BR_STATES.find((state) => state.uf.toLowerCase() === normalized);
    if (byUf) return byUf.code;

    const byName = BR_STATES.find((state) => normalizeGeoText(state.name) === normalized);
    if (byName) return byName.code;

    return null;
}

export function getFallbackCitiesByState(input: string): string[] {
    const code = resolveStateCode(input);
    if (!code) return [];
    const found = BR_STATES.find((state) => state.code === code);
    return found ? [found.capital] : [];
}
