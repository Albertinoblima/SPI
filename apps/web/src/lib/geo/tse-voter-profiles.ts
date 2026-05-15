/**
 * Tipos e funções de lookup para dados do eleitorado TSE.
 *
 * Os dados reais são gerados pelo script:
 *   powershell -ExecutionPolicy Bypass -File .\scripts\generate-tse-voters.ps1
 * e ficam em tse-voter-data.json (importado abaixo).
 *
 * Campos de contagem por faixa etária:
 *   a16 = 15-17 anos  |  a18 = 18-24  |  a25 = 25-34
 *   a35 = 35-44       |  a45 = 45-59  |  a60 = 60-69
 *   a70 = 70-79       |  a80 = 80+
 */

export type TseVoterCity = {
    uf: string;
    code: string;
    name: string;
    total: number;
    m: number;
    f: number;
    n: number;
    a16: number;
    a18: number;
    a25: number;
    a35: number;
    a45: number;
    a60: number;
    a70: number;
    a80: number;
};

export type TseVoterProportions = {
    sex: { m: number; f: number; n: number };
    age: {
        a16: number;
        a18: number;
        a25: number;
        a35: number;
        a45: number;
        a60: number;
        a70: number;
        a80: number;
    };
};

/** Labels legíveis para exibição */
export const TSE_AGE_LABELS: Record<string, string> = {
    a16: '15–17 anos',
    a18: '18–24 anos',
    a25: '25–34 anos',
    a35: '35–44 anos',
    a45: '45–59 anos',
    a60: '60–69 anos',
    a70: '70–79 anos',
    a80: '80+ anos',
};

/** Calcula proporções (0-100, 1 decimal) a partir dos contadores brutos */
export function computeProportions(city: TseVoterCity): TseVoterProportions {
    const t = city.total || 1;
    const pct = (n: number) => Math.round((n / t) * 1000) / 10;

    return {
        sex: { m: pct(city.m), f: pct(city.f), n: pct(city.n) },
        age: {
            a16: pct(city.a16),
            a18: pct(city.a18),
            a25: pct(city.a25),
            a35: pct(city.a35),
            a45: pct(city.a45),
            a60: pct(city.a60),
            a70: pct(city.a70),
            a80: pct(city.a80),
        },
    };
}

// --------------------------------------------------------------------------
// Índice carregado em runtime (JSON gerado pelo script)
// --------------------------------------------------------------------------

let _index: Record<string, TseVoterCity> | null = null;
let _list: TseVoterCity[] | null = null;

function loadIndex(): Record<string, TseVoterCity> {
    if (_index) return _index;
    try {
        _index = require('./tse-voter-data.json') as Record<string, TseVoterCity>; // dynamic require needed for JSON data file
        _list = Object.values(_index);
    } catch {
        _index = {};
        _list = [];
    }
    return _index;
}

export function getTseVoterList(): TseVoterCity[] {
    loadIndex();
    return _list ?? [];
}

export function getTseVoterByKey(key: string): TseVoterCity | undefined {
    return loadIndex()[key];
}

/** Retorna true se os dados foram carregados com pelo menos um município */
export function hasTseData(): boolean {
    return getTseVoterList().length > 0;
}
