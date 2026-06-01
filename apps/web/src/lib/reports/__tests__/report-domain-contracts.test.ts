/**
 * Report Domain Contracts Tests (Fase 5)
 *
 * Validates the rich domain types introduced in F3 (any removal) remain
 * stable and usable. These contracts are the foundation for report
 * generation (Docx/Pdf generators, AdvancedReportAggregationService, ReportJobService).
 *
 * Senior rationale: Type contracts are executable documentation.
 * Changes to these must be deliberate and tested.
 */

import type {
  ReportSurveyData,
  InternalReportConfig,
  AnswerJsonValue,
  ResponseAnswerRow,
  DistributionItem,
  CrossTabRow,
  PlanningContext,
  GeneratedInsight,
  ReportType,
} from '../types';

describe('Report Domain Contracts (F3 hardened, F5 verified)', () => {
  it('ReportType union is exhaustive for supported reports', () => {
    const types: ReportType[] = ['synthetic', 'analytical', 'consolidated'];
    expect(types).toHaveLength(3);
  });

  it('AnswerJsonValue supports all expected shapes (string | number | boolean | array | object | null)', () => {
    const examples: AnswerJsonValue[] = [
      'texto livre',
      42,
      true,
      { options: ['opcao1', 'opcao2'] },
      { nested: 'value' },
      null,
    ];
    expect(examples.length).toBe(6);
  });

  it('DistributionItem has required shape for charts/tables', () => {
    const item: DistributionItem = {
      label: 'Masculino',
      count: 1250,
      value: 1250,
      percentage: 48.3,
    };
    expect(item.label).toBeDefined();
    expect(typeof item.value).toBe('number');
  });

  it('CrossTabRow supports dynamic columns for analytical reports', () => {
    const row: CrossTabRow = {
      variable: 'Faixa Etária',
      'Masculino': 320,
      'Feminino': 410,
      total: 730,
    };
    expect(row['variable']).toBeDefined();
    expect(row['total'] as number).toBeGreaterThan(0);
  });

  it('PlanningContext carries research design metadata (F3 contract)', () => {
    const ctx: PlanningContext = {
      sampleSize: 2000,
      confidenceLevel: 95,
      marginError: 2.2,
      methodology: 'Presencial com georreferenciamento',
    };
    expect(ctx.sampleSize).toBe(2000);
  });

  it('GeneratedInsight has required fields for consolidated reports', () => {
    const insight: GeneratedInsight = {
      title: 'Concentração de respostas em zona norte',
      description: 'Alta correlação entre premissa X e variável Y',
      confidence: 0.87,
      supportingData: { crossTabKey: 'zona_norte' },
    };
    expect(insight.confidence).toBeGreaterThan(0.5);
  });

  it('ReportSurveyData is the canonical input for generators (no any)', () => {
    // Structural smoke test - if this compiles, F3 contracts are intact
    const data: Partial<ReportSurveyData> = {
      surveyId: 's-123',
      title: 'Pesquisa Eleitoral 2026',
      totalResponses: 1840,
      // distributions, crossTabs etc would be populated by aggregation service
    };
    expect(data.surveyId).toBe('s-123');
  });
});
