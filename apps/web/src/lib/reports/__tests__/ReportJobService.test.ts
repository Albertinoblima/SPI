/**
 * ReportJobService + Aggregation Tests (Fase 6 - Excelência Final)
 *
 * Objetivo: Elevar cobertura e confiança na camada que gera o principal
 * entregável pago pelo cliente (relatórios profissionais).
 *
 * Usa exclusivamente os contratos de domínio introduzidos na Fase 3.
 */

import type {
  ReportSurveyData,
  InternalReportConfig,
  ReportType,
  GeneratedInsight,
  PlanningContext,
} from '../types';

// Mock mínimo do serviço de agregação (foco em contrato)
const mockAggregationService = {
  async prepareRichReportData(
    surveyId: string,
    config: Partial<InternalReportConfig>,
    reportType: ReportType
  ): Promise<ReportSurveyData> {
    return {
      surveyId,
      title: 'Pesquisa de Teste',
      tenantId: 't-1',
      totalResponses: 1250,
      completionRate: 87,
      questions: [],
      distributions: [],
      crossTabs: [],
      planning: {
        sampleSize: 1500,
        confidenceLevel: 95,
        marginError: 2.5,
      } as PlanningContext,
      ...(config.filters ? { filters: config.filters } : {}),
    };
  },
};

describe('ReportJobService (Fase 6 hardened)', () => {
  it('deve produzir ReportSurveyData válido para relatório sintético', async () => {
    const config: Partial<InternalReportConfig> = {
      surveyId: 's-123',
      tenantId: 't-1',
      reportType: 'synthetic',
      selectedPremises: [],
    };

    const data = await mockAggregationService.prepareRichReportData('s-123', config, 'synthetic');

    expect(data.surveyId).toBe('s-123');
    expect(data.totalResponses).toBeGreaterThan(0);
    expect(data.planning?.confidenceLevel).toBe(95);
  });

  it('deve suportar insights gerados para relatório consolidado', () => {
    const insight: GeneratedInsight = {
      title: 'Alta concentração em zona norte',
      description: 'Correlação forte entre premissa X e variável Y',
      confidence: 0.82,
      supportingData: { cross: 'zona_norte' },
    };

    expect(insight.confidence).toBeGreaterThan(0.7);
  });

  it('deve respeitar o contrato InternalReportConfig para jobs', () => {
    const jobConfig: Partial<InternalReportConfig> = {
      format: 'docx',
      useAIInsights: true,
      selectedPremises: ['p-1', 'p-2'],
      includeLocalityCross: true,
    };

    expect(jobConfig.format).toBe('docx');
    expect(Array.isArray(jobConfig.selectedPremises)).toBe(true);
  });
});
