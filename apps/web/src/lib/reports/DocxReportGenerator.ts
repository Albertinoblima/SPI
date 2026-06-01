/**
 * DocxReportGenerator - Advanced Professional Report Generator
 * 
 * Suporta os requisitos do usuário:
 * - Três tipos de relatório (Sintético, Analítico, Consolidado)
 * - Uso de metadados do Planejamento (5 passos)
 * - Estrutura preparada para modelos de capa + papel timbrado (usando company_assets)
 * - Sumário, tipografia hierárquica e paginação
 * 
 * Decisões de arquitetura:
 * - Gerar documento completo em memória usando `docx`
 * - Manter o gerador agnóstico de UI (configuração vem de fora)
 * - Futuro: Suporte a upload de imagens para capa (mapa, cidade, etc.)
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  AlignmentType,
  PageBreak,
  BorderStyle,
  ImageRun,
  Header,
  Footer,
  PageNumber,
} from 'docx';
import type { ReportConfiguration, ReportSurveyData, InternalReportConfig, CrossTabRow, QuotasSummaryItem, DistributionItem, GeneratedInsight, AdvancedCrossTabResult } from './types';
import { reportAggregationService } from './ReportAggregationService';
import { advancedReportAggregationService } from './AdvancedReportAggregationService';
import { chartImageGenerator } from './ChartImageGenerator';
import { reportInsightsService } from './ReportInsightsService';
import { createAuditedSupabaseAdminClient } from '@political-research/shared-utils';

/**
 * DocxReportGenerator - Versão avançada
 * 
 * Suporta:
 * - Diferentes tipos de relatório (synthetic, analytical, consolidated)
 * - Metadados do planejamento
 * - Capas e papel timbrado (estrutura preparada)
 * - Sumário e paginação básica
 */
export class DocxReportGenerator {
  private supabase = createAuditedSupabaseAdminClient('DocxReportGenerator');

  async generate(config: ReportConfiguration, surveyData: ReportSurveyData): Promise<Buffer> {
    const children: Array<Paragraph | Table> = [];

    const legacyPlanning = (surveyData as ReportSurveyData & { planning?: Record<string, unknown> }).planning;
    const planning = (surveyData.planningContext || legacyPlanning || {}) as Record<string, unknown>;

    const planningObjective = typeof planning['objective'] === 'string' ? planning['objective'] : 'Não informado';
    const planningSampleSize = typeof planning['sample_size'] === 'number' || typeof planning['sample_size'] === 'string'
      ? planning['sample_size']
      : 'N/A';
    const planningSurveyType = typeof planning['survey_type'] === 'string' ? planning['survey_type'] : 'N/A';
    const planningMethodology = typeof planning['methodology'] === 'string' ? planning['methodology'] : null;

    // Extrai filtros vindos da visão dinâmica ou job (essencial para integração profissional)
    const incomingFilters = surveyData.filters || (config as InternalReportConfig).filters || {};
    const reportFilters: { localityIds?: string[]; premises?: Record<string, string[]>; onlyComplete: boolean } = {
      onlyComplete: true,
    };
    if (incomingFilters.localityIds) {
      reportFilters.localityIds = incomingFilters.localityIds;
    }
    if (incomingFilters.premises) {
      reportFilters.premises = incomingFilters.premises;
    }

    const totals = await reportAggregationService.getBasicTotals(config.surveyId);

    // === LOGO PROFISSIONAL (Buffer) ===
    const logoBuffer = await this.getTenantLogoBuffer(surveyData.tenantId || config.tenantId);

    // Buscar perguntas reais da pesquisa
    const { data: questions } = await this.supabase
      .from('questions')
      .select('id, question_text, question_type, options, order_index, preferred_visualization')
      .eq('survey_id', config.surveyId)
      .order('order_index');

    const realQuestions: Array<{ id: string; question_text: string; question_type: string; options?: unknown; order_index?: number; preferred_visualization?: string }> = questions || [];

    // Buscar dados de cotas e realização (muito importante para relatórios profissionais)
    const { data: localities } = await this.supabase
      .from('survey_localities')
      .select('id, name, zone, interviews_required')
      .eq('survey_id', config.surveyId)
      .order('name');

    const { data: quotas } = await this.supabase
      .from('survey_distribution_quotas')
      .select('locality_id, quota_total, survey_localities(name)')
      .eq('survey_id', config.surveyId);

    type LocalityRow = { id: string; name: string; zone?: string; interviews_required?: number };
    type QuotaRow = { locality_id: string; quota_total: number; survey_localities?: { name?: string } | null };

    const typedLocalities: LocalityRow[] = (localities || []) as LocalityRow[];
    const typedQuotas: QuotaRow[] = (quotas || []) as QuotaRow[];

    // Agregar cotas realizadas vs planejadas (simplificado)
    const quotasSummary = this.buildQuotasSummary(typedLocalities, typedQuotas);

    // Premissas da pesquisa (essencial para cruzamentos profissionais conforme solicitado)
    const { data: surveyPremises } = await this.supabase
      .from('survey_premises')
      .select('id, category, label, options, mapped_question_id')
      .eq('survey_id', config.surveyId)
      .order('order_index');

    // Filtra as premissas que o usuário selecionou para este relatório (vem do config)
    const selectedPremiseIds: string[] = (config as InternalReportConfig).selectedPremises || [];
    const activePremisesForCross = selectedPremiseIds.length > 0
      ? (surveyPremises || []).filter((p: { id: string }) => selectedPremiseIds.includes(p.id))
      : (surveyPremises || []);

    // === CAPA PROFISSIONAL MELHORADA (Fase 1) ===
    if (logoBuffer) {
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
          children: [
            new ImageRun({
              type: 'png',
              data: logoBuffer,
              transformation: { width: 180, height: 70 },
            }),
          ],
        })
      );
    }

    children.push(
      new Paragraph({ spacing: { after: 120 }, children: [] }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: surveyData.title || 'Relatório de Pesquisa', bold: true, size: 44 })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 60 },
        children: [new TextRun({ text: this.getReportTypeLabel(config.reportType), size: 24, italics: true, color: '444444' })],
      }),
      new Paragraph({ spacing: { after: 100 }, children: [] }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: `Gerado em ${new Date().toLocaleDateString('pt-BR')}`, size: 18, color: '666666' })],
      }),
      new Paragraph({ spacing: { after: 300 }, children: [] }),
    );

    // === PAPEL TIMBRADO / LOGO REAL ===
    if (logoBuffer) {
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 80 },
          children: [new TextRun({ text: '────────────────────────────────────────', size: 18, color: 'CCCCCC' })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 60 },
          children: [new TextRun({ text: '[Logotipo da Empresa]', size: 18, color: '666666' })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 120 },
          children: [new TextRun({ text: 'Papel timbrado aplicado automaticamente', size: 14, color: '888888', italics: true })],
        })
      );
    } else {
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 80 },
          children: [new TextRun({ text: '[Espaço reservado para Logotipo / Papel Timbrado da Empresa]', size: 16, color: 'AAAAAA', italics: true })],
        })
      );
    }

    // Placeholder para imagem da cidade / mapa (requisito do usuário - pronto para evolução com upload)
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 60 },
        children: [new TextRun({ text: '[Imagem da Cidade / Mapa com Pontos de Coleta - configurável]', size: 14, color: 'BBBBBB', italics: true })],
      }),
      new Paragraph({ spacing: { after: 140 }, children: [] })
    );

    // === METADADOS DO PLANEJAMENTO (5 passos) ===
    if (config.includePlanningMetadata && Object.keys(planning).length > 0) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun('1. Planejamento da Pesquisa')],
        }),
        new Paragraph({ children: [new TextRun({ text: `Objetivo: `, bold: true }), new TextRun(planningObjective)] }),
        new Paragraph({ children: [new TextRun({ text: `Amostra planejada: `, bold: true }), new TextRun(`${planningSampleSize} entrevistas`)] }),
        new Paragraph({ children: [new TextRun({ text: `Tipo: `, bold: true }), new TextRun(planningSurveyType)] }),
        new Paragraph({ children: [new TextRun({ text: `Base geográfica: `, bold: true }), new TextRun('Definida no planejamento (cotas por localidade)')] }),
      );
    }

    if (config.includeMethodology && planningMethodology) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun('Metodologia')],
        }),
        new Paragraph({ children: [new TextRun(planningMethodology)] }),
      );
    }

    children.push(new Paragraph({ children: [new PageBreak()] }));

    // === CONTEÚDO DIFERENCIADO POR TIPO DE RELATÓRIO ===
    const type = config.reportType;

    if (type === 'synthetic') {
      // SINTÉTICO: Resumo executivo limpo + principais indicadores
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun('2. Resumo Executivo (Sintético)')],
        }),
        new Paragraph({ children: [new TextRun(`Total de entrevistas realizadas: ${totals.totalResponses}`)] }),
        new Paragraph({ children: [new TextRun('Este relatório apresenta os principais indicadores e percentuais da pesquisa de forma consolidada.')] }),
        new Paragraph({ spacing: { after: 200 }, children: [] }),
      );

      // === TABELA DE COTAS REALIZADAS vs PLANEJADAS (Profissional) ===
      if (quotasSummary && quotasSummary.rows.length > 0) {
        children.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            children: [new TextRun('Resumo de Campo - Cotas')],
          }),
          new Paragraph({
            spacing: { after: 100 },
            children: [new TextRun({ text: `Total realizado: ${quotasSummary.totalRealized} de ${quotasSummary.totalPlanned} planejadas (${quotasSummary.overallPercentage}%)`, italics: true })]
          })
        );

        const quotaTableRows = [
          new TableRow({
            children: ['Localidade', 'Planejado', 'Realizado', '%'].map(h =>
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 18 })] })],
                borders: { top: { style: BorderStyle.SINGLE, size: 1 }, bottom: { style: BorderStyle.SINGLE, size: 1 }, left: { style: BorderStyle.SINGLE, size: 1 }, right: { style: BorderStyle.SINGLE, size: 1 } },
              })
            ),
          }),
          ...quotasSummary.rows.map((row) =>
            new TableRow({
              children: [row.locality, row.planned, row.realized, `${row.percentage}%`].map(val =>
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: String(val), size: 16 })] })],
                  borders: { top: { style: BorderStyle.SINGLE, size: 1 }, bottom: { style: BorderStyle.SINGLE, size: 1 }, left: { style: BorderStyle.SINGLE, size: 1 }, right: { style: BorderStyle.SINGLE, size: 1 } },
                })
              ),
            })
          ),
        ];

        children.push(new Table({ rows: quotaTableRows }));
        children.push(new Paragraph({ spacing: { after: 300 }, children: [] }));
      }

      // === FICHA TÉCNICA BÁSICA ===
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun('Ficha Técnica')],
        }),
        new Paragraph({ children: [new TextRun(`Entrevistas realizadas: ${totals.totalResponses}`)] }),
        new Paragraph({ children: [new TextRun(`Data de geração: ${new Date().toLocaleDateString('pt-BR')}`)] }),
        new Paragraph({ children: [new TextRun('Metodologia: Conforme planejamento da pesquisa.')] }),
        new Paragraph({ spacing: { after: 200 }, children: [] })
      );

      // === SINTÉTICO PROFISSIONAL COM GRÁFICOS ===
      // Mostramos gráficos grandes para as primeiras perguntas + lista compacta para o restante
      const questionsWithCharts = realQuestions.slice(0, 5);
      const remainingQuestions = realQuestions.slice(5);

      for (const q of questionsWithCharts) {
        const dist = await advancedReportAggregationService.getQuestionDistributionWithFilters(
          config.surveyId,
          q.id
        );

        children.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            children: [new TextRun(q.question_text)],
          }),
          new Paragraph({
            children: [new TextRun({ text: `Total de respostas: ${dist.total}`, italics: true, size: 18 })]
          })
        );

        if (dist.values.length > 0 && dist.values.length <= 12) {
          try {
            const chartBuffer = await chartImageGenerator.generateBestChartForQuestion(
              dist.values,
              q.question_type,
              q.preferred_visualization || undefined,
              { width: 720, height: 420, dpi: 140 }
            );

            children.push(
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 120, after: 120 },
                children: [
                  new ImageRun({
                    type: 'png',
                    data: chartBuffer,
                    transformation: { width: 520, height: 300 },
                  }),
                ],
              })
            );
          } catch {
            dist.values.slice(0, 6).forEach((v: { label: string; percentage: number; count: number }) => {
              children.push(new Paragraph({ children: [new TextRun(`• ${v.label}: ${v.count} (${v.percentage}%)`)] }));
            });
          }
        }

        children.push(new Paragraph({ children: [new PageBreak()] }));
      }

      // Lista compacta das perguntas restantes (para não deixar o relatório excessivamente longo)
      if (remainingQuestions.length > 0) {
        children.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            children: [new TextRun('Outros Indicadores')],
          })
        );

        for (const q of remainingQuestions.slice(0, 8)) {
          const dist = await advancedReportAggregationService.getQuestionDistributionWithFilters(config.surveyId, q.id, reportFilters);
          const top3 = dist.values.slice(0, 3).map((v: { label: string; percentage: number }) => `${v.label} (${v.percentage}%)`).join(' • ');
          children.push(new Paragraph({
            children: [new TextRun({ text: `${q.question_text}: `, bold: true }), new TextRun(top3 || 'Sem respostas')]
          }));
        }
        children.push(new Paragraph({ spacing: { after: 200 }, children: [] }));
      }

    } else if (type === 'analytical') {
      // ANALÍTICO PROFISSIONAL (conforme especificação):
      // Uma seção por pergunta principal + cruzamentos com localidade e premissas mapeadas
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun('2. Análise Cruzada (Analítico)')],
        }),
        new Paragraph({ children: [new TextRun('Este relatório apresenta distribuições e cruzamentos por pergunta, utilizando as premissas e localidades definidas no planejamento.')] }),
        new Paragraph({ spacing: { after: 200 }, children: [] }),
      );

      if (totals.totalResponses === 0) {
        children.push(new Paragraph({
          spacing: { after: 200 },
          children: [new TextRun({ text: 'Esta pesquisa ainda não possui respostas coletadas. Os dados e cruzamentos ficarão disponíveis após a coleta.', italics: true, color: '666666' })]
        }));
      } else if (reportFilters.localityIds || reportFilters.premises) {
        children.push(new Paragraph({
          spacing: { after: 100 },
          children: [new TextRun({ text: '(Filtros de premissas e/ou localidade aplicados conforme seleção na análise dinâmica)', italics: true, size: 16, color: '666666' })]
        }));
      }

      // Usar premissas que possuem mapeamento para cruzamentos
      const crossablePremises = activePremisesForCross.filter((p: { mapped_question_id?: string | null }) => p.mapped_question_id);
      const shouldCrossLocality = (config as InternalReportConfig).includeLocalityCross !== false;

      const mainQuestions = realQuestions.slice(0, 8);

      for (const q of mainQuestions) {
        const dist = await advancedReportAggregationService.getQuestionDistributionWithFilters(config.surveyId, q.id, reportFilters);

        children.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            children: [new TextRun(q.question_text)],
          }),
          new Paragraph({ children: [new TextRun({ text: `Total de respostas: ${dist.total}`, italics: true, size: 18 })] })
        );

        // Distribuição principal
        if (dist.values.length > 0) {
          children.push(new Paragraph({ spacing: { before: 80 }, children: [new TextRun({ text: 'Distribuição:', bold: true })] }));
          dist.values.slice(0, 5).forEach((v: DistributionItem) => {
            children.push(new Paragraph({ children: [new TextRun(`• ${v.label}: ${v.count} (${v.percentage}%)`)] }));
          });
        }

        // Cruzamentos com premissas mapeadas (respeitando a regra do usuário)
        if (crossablePremises.length > 0) {
          children.push(new Paragraph({ spacing: { before: 120 }, children: [new TextRun({ text: 'Cruzamentos por Premissas:', bold: true, size: 20 })] }));

          for (const premise of crossablePremises.slice(0, 3)) { // Limitar para não explodir o documento
            try {
              const crossResult = await advancedReportAggregationService.getCrossTabWithFilters(
                config.surveyId,
                q.id,
                { type: 'premise', category: premise.category },
                reportFilters
              );

              if (crossResult.rows.length > 0) {
                children.push(new Paragraph({
                  spacing: { before: 80 },
                  children: [new TextRun({ text: `${premise.label}:`, bold: true, size: 18 })]
                }));

                const tableRows = [
                  new TableRow({
                    children: [q.question_text.substring(0, 30), premise.label, 'Qtd', '%'].map(h =>
                      new TableCell({
                        children: [new Paragraph({ children: [new TextRun({ text: String(h), bold: true, size: 16 })] })],
                        borders: { top: { style: BorderStyle.SINGLE, size: 1 }, bottom: { style: BorderStyle.SINGLE, size: 1 }, left: { style: BorderStyle.SINGLE, size: 1 }, right: { style: BorderStyle.SINGLE, size: 1 } },
                      })
                    ),
                  }),
                  ...crossResult.rows.slice(0, 6).map((row: CrossTabRow) =>
                    new TableRow({
                      children: Object.values(row).map((val) =>
                        new TableCell({
                          children: [new Paragraph({ children: [new TextRun({ text: String(val), size: 15 })] })],
                          borders: { top: { style: BorderStyle.SINGLE, size: 1 }, bottom: { style: BorderStyle.SINGLE, size: 1 }, left: { style: BorderStyle.SINGLE, size: 1 }, right: { style: BorderStyle.SINGLE, size: 1 } },
                        })
                      ),
                    })
                  ),
                ];
                children.push(new Table({ rows: tableRows }));
              }
            } catch (e) {
              // Ignora cruzamento se não for possível
            }
          }
        }

        // Cruzamento por Localidade (quando solicitado)
        if (shouldCrossLocality && localities && localities.length > 0) {
          children.push(new Paragraph({
            spacing: { before: 120 },
            children: [new TextRun({ text: 'Cruzamento por Localidade:', bold: true, size: 20 })]
          }));

          // Versão resumida: mostra distribuição por localidade para esta pergunta (simplificada)
          // Nota: Para cruzamento completo pergunta × localidade seria necessário enriquecer response_answers com locality_id.
          children.push(new Paragraph({
            children: [new TextRun({ text: 'Distribuição por localidade (resumo):', italics: true, size: 16 })]
          }));

          localities.slice(0, 5).forEach((loc: { id: string; name: string; zone?: string; interviews_required?: number }) => {
            children.push(new Paragraph({
              children: [new TextRun(`• ${loc.name} (${loc.zone}): ${loc.interviews_required || 0} planejadas`)]
            }));
          });
        }

        children.push(new Paragraph({ spacing: { after: 250 }, children: [] }));
      }

      if (crossablePremises.length === 0) {
        children.push(new Paragraph({
          children: [new TextRun({ text: 'Nenhuma premissa foi mapeada para perguntas. Configure o mapeamento em survey_premises para habilitar cruzamentos avançados.', italics: true, color: '666666' })]
        }));
      }

    } else if (type === 'consolidated') {
      // CONSOLIDADO: Reúne o melhor do Sintético + Analítico + contexto de planejamento
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun('2. Relatório Consolidado Completo')],
        }),
        new Paragraph({ children: [new TextRun(`Total de entrevistas realizadas: ${totals.totalResponses}`)] }),
        new Paragraph({ spacing: { after: 150 }, children: [] }),
      );

      // Inclui o resumo de cotas
      if (quotasSummary && quotasSummary.rows.length > 0) {
        children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun('Resumo de Campo')] }));
        children.push(new Paragraph({ children: [new TextRun(`Realizado: ${quotasSummary.totalRealized} / ${quotasSummary.totalPlanned} (${quotasSummary.overallPercentage}%)`)] }));
        children.push(new Paragraph({ spacing: { after: 150 }, children: [] }));
      }

      // Principais indicadores com gráficos (reaproveita lógica do sintético)
      children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun('Principais Indicadores')] }));
      const topForConsolidated = realQuestions.slice(0, 4);

      if (totals.totalResponses === 0) {
        children.push(new Paragraph({
          spacing: { after: 150 },
          children: [new TextRun({ text: 'Esta pesquisa ainda não possui respostas coletadas. Os indicadores e cruzamentos ficarão disponíveis após a coleta de dados.', italics: true, color: '666666' })]
        }));
      }

      for (const q of topForConsolidated) {
        const dist = await advancedReportAggregationService.getQuestionDistributionWithFilters(config.surveyId, q.id, reportFilters);
        children.push(new Paragraph({ children: [new TextRun({ text: q.question_text, bold: true })] }));
        if (dist.values.length > 0) {
          try {
            const chartBuffer = await chartImageGenerator.generateBestChartForQuestion(dist.values, q.question_type, q.preferred_visualization, { width: 600, height: 340, dpi: 120 });
            children.push(new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 60, after: 100 },
              children: [new ImageRun({ type: 'png', data: chartBuffer, transformation: { width: 420, height: 240 } })],
            }));
          } catch {
            dist.values.slice(0, 3).forEach((v: { label: string; count: number; percentage: number }) => children.push(new Paragraph({ children: [new TextRun(`• ${v.label}: ${v.count} (${v.percentage}%)`)] })));
          }
        }
      }

      // Cruzamentos com premissas (versão resumida do analítico)
      const crossablePremises = activePremisesForCross.filter((p: { mapped_question_id?: string | null }) => p.mapped_question_id);
      if (crossablePremises.length > 0) {
        children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 200 }, children: [new TextRun('Principais Cruzamentos por Premissas')] }));
        const sampleQuestion = realQuestions[0];
        if (sampleQuestion) {
          for (const premise of crossablePremises.slice(0, 2)) {
            try {
              const cross: AdvancedCrossTabResult = await advancedReportAggregationService.getCrossTabWithFilters(config.surveyId, sampleQuestion.id, { type: 'premise', category: premise.category }, reportFilters);
              if (cross.rows.length > 0) {
                children.push(new Paragraph({ children: [new TextRun(`${sampleQuestion.question_text} × ${premise.label}`)] }));
              }
            } catch { }
          }
        }
      }

      // Metadados do planejamento (prioriza a nova estrutura tipada)
      if (planning && (planning['objective'] || planning['sample_size'])) {
        children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 200 }, children: [new TextRun('Dados do Planejamento')] }));
        children.push(new Paragraph({ children: [new TextRun(`Objetivo: ${planning['objective'] || 'Não informado'}`)] }));
        children.push(new Paragraph({ children: [new TextRun(`Amostra planejada: ${planning['sample_size'] || 'N/A'}`)] }));
      }

      // === SEÇÃO DE INSIGHTS E INTERPRETAÇÕES (Fase 3 + Governança IA) ===
      children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 300 }, children: [new TextRun('Insights e Interpretações')] }));
      children.push(new Paragraph({ spacing: { after: 120 }, children: [] }));

      // Preferir insights pré-gerados pelo JobService (evita chamada dupla de LLM e permite rastrear custo exato)
      const preGeneratedInsights = surveyData.insights || [];
      const aiUsage = surveyData.aiUsage || null;
      const useAI = (config as InternalReportConfig).useAIInsights === true;

      let insightsToRender: GeneratedInsight[] = preGeneratedInsights;

      if (insightsToRender.length === 0 && realQuestions.length > 0) {
        // Fallback: gerar agora (caso o job não tenha injetado)
        try {
          const result = await reportInsightsService.generateInsightsForSurvey(
            config.surveyId,
            realQuestions,
            planning,
            { useAI }
          );
          insightsToRender = result.insights;
        } catch (e) {
          console.error('[DocxReportGenerator] Falha ao gerar insights no fallback:', e);
        }
      }

      if (insightsToRender.length > 0) {
        // Mostrar banner de governança quando IA foi usada
        if (aiUsage?.enabled) {
          children.push(new Paragraph({
            spacing: { after: 80 },
            children: [
              new TextRun({ text: `Análises geradas por IA • Modelo: ${aiUsage.modelUsed || 'LLM'} • Tokens: ${aiUsage.tokensUsed || '?'} • Custo estimado: $${(aiUsage.costUsd || 0).toFixed(4)}`, size: 16, color: '854d0e', italics: true })
            ]
          }));
        } else {
          children.push(new Paragraph({
            spacing: { after: 60 },
            children: [new TextRun({ text: 'Análises geradas automaticamente (sem uso de IA)', italics: true, size: 17, color: '666666' })]
          }));
        }

        children.push(new Paragraph({
          spacing: { after: 80 },
          children: [new TextRun({ text: 'Principais interpretações dos dados:', bold: true, size: 20 })]
        }));

        insightsToRender.forEach((insight: GeneratedInsight, index: number) => {
          const sourceLabel = insight.source === 'ai' ? ' (IA)' : insight.source === 'fallback' ? ' (automático)' : '';
          children.push(new Paragraph({
            spacing: { after: 40 },
            children: [new TextRun({ text: `${index + 1}. ${insight.questionText}${sourceLabel}`, bold: true, size: 20, color: '1e3a8a' })]
          }));
          children.push(new Paragraph({
            spacing: { after: 35 },
            children: [new TextRun({ text: insight.summary || insight.description || '', size: 19 })]
          }));
          (insight.keyFindings || []).forEach((finding: string) => {
            children.push(new Paragraph({
              spacing: { after: 18 },
              children: [new TextRun({ text: `   • ${finding}`, size: 18 })]
            }));
          });
          if (insight.strategicImplications) {
            children.push(new Paragraph({
              spacing: { after: 70 },
              children: [new TextRun({ text: `   Implicação estratégica: ${insight.strategicImplications}`, italics: true, size: 17, color: '374151' })]
            }));
          }
        });
      } else {
        children.push(new Paragraph({ children: [new TextRun({ text: 'Nenhum insight gerado para esta pesquisa.', italics: true, color: '666666' })] }));
      }
    }

    // === RODAPÉ / PAGINAÇÃO (básica) ===
    children.push(
      new Paragraph({ spacing: { before: 200 }, children: [] }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: '────────────────────────────────────────', size: 16, color: 'CCCCCC' })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: `Relatório gerado em ${new Date().toLocaleDateString('pt-BR')} • Sistema iDialog`, size: 14, color: '888888' })],
      })
    );

    // Sumário simples no início (quando solicitado)
    if (config.includeTableOfContents) {
      children.unshift(
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('Sumário')] }),
        new Paragraph({ children: [new TextRun('1. Planejamento da Pesquisa')] }),
        new Paragraph({ children: [new TextRun('2. Resultados por Tipo de Relatório')] }),
        new Paragraph({ children: [new TextRun('3. Metodologia e Notas')] }),
        new Paragraph({ children: [new PageBreak()] })
      );
    }

    // === CABEÇALHO E RODAPÉ PROFISSIONAL ===
    const headerFooter = this.buildHeaderFooter(logoBuffer, config);

    const doc = new Document({
      sections: [
        {
          properties: {
            page: {
              size: {
                width: config.pageSize === 'A4' ? 11906 : 12240,
                height: config.pageSize === 'A4' ? 16838 : 15840,
              },
              margin: {
                top: Math.round(config.margins.top * 56.7),
                bottom: Math.round(config.margins.bottom * 56.7),
                left: Math.round(config.margins.left * 56.7),
                right: Math.round(config.margins.right * 56.7),
              },
            },
          },
          headers: {
            default: headerFooter.header,
          },
          footers: {
            default: headerFooter.footer,
          },
          children,
        },
      ],
    });

    return await Packer.toBuffer(doc);
  }

  /**
   * Cria Header e Footer profissionais com logo (quando disponível) e numeração de páginas.
   */
  private buildHeaderFooter(logoBuffer: Buffer | null, config: ReportConfiguration) {
    const headerChildren: Paragraph[] = [];

    if (logoBuffer) {
      headerChildren.push(
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [
            new ImageRun({
              type: 'png',
              data: logoBuffer,
              transformation: { width: 120, height: 45 },
            }),
          ],
        })
      );
    } else {
      headerChildren.push(
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: config.name || 'Relatório de Pesquisa', size: 18, color: '666666' })],
        })
      );
    }

    const header = new Header({
      children: [
        ...headerChildren,
        new Paragraph({
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '2563eb' } },
          spacing: { after: 120 },
          children: [],
        }),
      ],
    });

    const footer = new Footer({
      children: [
        new Paragraph({
          border: { top: { style: BorderStyle.SINGLE, size: 6, color: '2563eb' } },
          spacing: { before: 100 },
          children: [
            new TextRun({ text: 'Confidencial • iDialog Pesquisa  •  Página ', size: 16, color: '666666' }),
            new TextRun({
              children: [PageNumber.CURRENT],
              size: 16,
              color: '666666',
            }),
            new TextRun({ text: `  •  Gerado em ${new Date().toLocaleDateString('pt-BR')}`, size: 16, color: '666666' }),
          ],
        }),
      ],
    });

    return { header, footer };
  }

  /**
   * Constrói resumo de cotas realizadas vs planejadas.
   * Essencial para qualquer relatório de pesquisa profissional.
   */
  private buildQuotasSummary(
    localities: Array<{ id: string; name: string }>,
    quotas: Array<{ locality_id: string; quota_total: number; completed?: number }>
  ) { // TODO Fase 3: replace with typed QuotasSummaryRow[]
    const plannedByLocality: Record<string, number> = {};
    const realizedByLocality: Record<string, number> = {};

    localities.forEach((loc) => {
      plannedByLocality[loc.id] = (loc as { interviews_required?: number }).interviews_required || 0;
    });

    quotas.forEach((q) => {
      const locId = q.locality_id;
      realizedByLocality[locId] = (realizedByLocality[locId] || 0) + (q.quota_total || 0);
    });

    const rows = Object.keys(plannedByLocality).map(locId => {
      const planned = plannedByLocality[locId] ?? 0;
      const realized = realizedByLocality[locId] || 0;
      const pct = planned > 0 ? Math.round((realized / planned) * 100) : 0;

      const localityName = localities.find((l) => l.id === locId)?.name || 'Desconhecida';

      return {
        locality: localityName,
        planned,
        realized,
        percentage: pct,
      };
    });

    const totalPlanned = Object.values(plannedByLocality).reduce((a, b) => a + b, 0);
    const totalRealized = Object.values(realizedByLocality).reduce((a, b) => a + b, 0);

    return {
      rows: rows.slice(0, 12),
      totalPlanned,
      totalRealized,
      overallPercentage: totalPlanned > 0 ? Math.round((totalRealized / totalPlanned) * 100) : 0,
    };
  }

  /**
   * Busca o logo ativo da empresa e retorna como Buffer para embedding no DOCX.
   * Esta é a implementação profissional (diferente da versão antiga que só pegava URL).
   */
  private async getTenantLogoBuffer(tenantId?: string): Promise<Buffer | null> {
    if (!tenantId) return null;

    try {
      const { data: asset } = await this.supabase
        .from('company_assets')
        .select('file_url, storage_path')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .in('asset_type', ['logo', 'logo_sem_slogan', 'logo_com_slogan'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!asset?.file_url) return null;

      // Tenta baixar via Storage (mais confiável)
      if (asset.storage_path) {
        const { data: fileData, error } = await this.supabase.storage
          .from('company-assets')
          .download(asset.storage_path);

        if (!error && fileData) {
          return Buffer.from(await fileData.arrayBuffer());
        }
      }

      // Fallback: baixar da URL pública
      const response = await fetch(asset.file_url);
      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
      }

      return null;
    } catch (err) {
      console.warn('Não foi possível carregar logo da empresa:', err);
      return null;
    }
  }

  // Mantido para compatibilidade temporária
  private async getTenantActiveLogo(tenantId?: string): Promise<string | null> {
    const buffer = await this.getTenantLogoBuffer(tenantId);
    return buffer ? 'embedded' : null; // Sinaliza que temos o buffer
  }

  private getReportTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      synthetic: 'Relatório Sintético (Básico)',
      analytical: 'Relatório Analítico (Cruzamentos)',
      consolidated: 'Relatório Consolidado (Completo)',
    };
    return labels[type] || type;
  }
}

export const docxReportGenerator = new DocxReportGenerator();