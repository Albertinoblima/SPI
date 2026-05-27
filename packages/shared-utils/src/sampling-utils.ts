// Funções utilitárias para cálculo amostral extraídas do Step3SampleSize

/**
 * Retorna a mensagem metodológica para o tipo de pesquisa.
 */
export function getMethodologyHint(surveyType: string): string {
    // ATENÇÃO: shouldUseStatisticalSampling deve ser injetada pelo app principal.
    // if (shouldUseStatisticalSampling && shouldUseStatisticalSampling(surveyType)) {
    //     return 'Pesquisa quantitativa amostral: utilize margem de erro e intervalo de confiança para dimensionar entrevistas.';
    // }
    if (surveyType === 'censo') {
        return 'Levantamento censitário: cobertura total do universo. A quantidade por localidade deve ser definida manualmente.';
    }
    if (surveyType === 'qualitativa_grupo_focal' || surveyType === 'qualitativa_profundidade') {
        return 'Pesquisa qualitativa: não utiliza margem de erro estatística. Defina metas de entrevistas por critério técnico na etapa de localidades.';
    }
    if (surveyType === 'quali_quanti') {
        return 'Pesquisa mista: use amostragem apenas na fase quantitativa. Metas qualitativas devem ser definidas manualmente.';
    }
    return 'Defina o tipo para habilitar recomendações metodológicas e regras automáticas de amostragem.';
}

/**
 * Retorna o valor Z para o intervalo de confiança.
 */
export function getZ(ci: number): number {
    if (ci === 90) return 1.645;
    if (ci === 99) return 2.576;
    return 1.96;
}

/**
 * Calcula o número de entrevistas necessárias para a amostra.
 */
export function calcInterviews(population: number, marginError: number, confidenceInterval: number, useInfinitePopulation = false): number {
    if (marginError <= 0) return 0;
    const z = getZ(confidenceInterval);
    const e = marginError / 100;
    const n0 = (z * z * 0.25) / (e * e);
    if (useInfinitePopulation) return Math.ceil(n0);
    if (population <= 0) return 0;
    const n = n0 / (1 + (n0 - 1) / population);
    return Math.ceil(n);
}

/**
 * Determina se a localidade deve ser tratada como população infinita.
 */
export function localityIsInfinite(
    loc: { population?: number },
    mode: 'force_all' | 'auto_threshold' | 'national_only',
    threshold: number,
    isNational: boolean,
): boolean {
    if (mode === 'force_all') return true;
    if (mode === 'auto_threshold') return (loc.population ?? 0) >= threshold;
    return isNational; // national_only
}

// ATENÇÃO: A função shouldUseStatisticalSampling deve ser importada do local correto no app principal.
// Aqui está apenas como referência de dependência externa.
// import { shouldUseStatisticalSampling } from '...';
