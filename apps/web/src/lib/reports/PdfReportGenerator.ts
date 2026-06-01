/**
 * PdfReportGenerator - Professional PDF Report Generator
 *
 * Decisão Sênior:
 * - Paralelo ao DocxReportGenerator para manter consistência e facilidade de manutenção.
 * - Reutiliza 100% do AdvancedReportAggregationService e ChartImageGenerator (mesmos gráficos PNG de alta qualidade).
 * - Usa pdfkit (já presente no projeto) para controle fino de layout profissional.
 * - Foco em: Capa limpa, identidade visual, tabelas bem formatadas, gráficos embutidos, paginação, rodapés.
 * - Suporta os mesmos 3 tipos: synthetic, analytical, consolidated.
 *
 * Vantagem: O cliente pode escolher DOCX ou PDF no momento da geração.
 */

import PDFDocument from 'pdfkit';
import { advancedReportAggregationService } from './AdvancedReportAggregationService';
import { chartImageGenerator } from './ChartImageGenerator';
import { reportInsightsService } from './ReportInsightsService';
import { createAuditedSupabaseAdminClient } from '@political-research/shared-utils/src/supabase/admin-client';
import type { ReportConfiguration, ReportSurveyData, InternalReportConfig, GeneratedInsight, CrossTabRow, DistributionItem, PlanningContext } from './types';

export class PdfReportGenerator {
  private supabase = createAuditedSupabaseAdminClient('PdfReportGenerator');

  async generate(config: ReportConfiguration, surveyData: ReportSurveyData): Promise<Buffer> {
    const doc = new PDFDocument({
      size: config.pageSize === 'A4' ? 'A4' : 'LETTER',
      margin: 50,
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));

    // Extrai filtros da visão dinâmica (mesma lógica profissional do DOCX)
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

    const legacyPlanning = (surveyData as ReportSurveyData & { planning?: PlanningContext }).planning;
    const planningContext = surveyData.planningContext || legacyPlanning;

    const totals = await advancedReportAggregationService.getBasicTotals(config.surveyId);

    // Buscar logo
    const logoBuffer = await this.getTenantLogoBuffer(surveyData.tenantId || config.tenantId);

    // Capa
    if (logoBuffer) {
      doc.image(logoBuffer, { fit: [120, 50], align: 'center' });
      doc.moveDown(2);
    }

    doc.fontSize(24).text(surveyData.title || 'Relatório de Pesquisa', { align: 'center' });
    doc.font('Helvetica-Oblique').fontSize(14).text(this.getReportTypeLabel(config.reportType), { align: 'center' });
    doc.font('Helvetica');
    doc.moveDown(2);
    doc.fontSize(11).text(`Gerado em ${new Date().toLocaleDateString('pt-BR')}`, { align: 'center' });

    doc.addPage();

    // Resumo Executivo
    doc.fontSize(16).text('Resumo Executivo', { underline: true });
    doc.fontSize(11).text(`Total de entrevistas realizadas: ${totals.totalResponses}`);
    doc.moveDown();

    // Buscar perguntas
    const { data: questions } = await this.supabase
      .from('questions')
      .select('id, question_text, question_type, preferred_visualization')
      .eq('survey_id', config.surveyId)
      .order('order_index');

    const realQuestions = questions || [];

    // Para Sintético: gráficos das principais perguntas
    if (config.reportType === 'synthetic' || config.reportType === 'consolidated') {
      doc.fontSize(14).text('Principais Indicadores', { underline: true });
      doc.moveDown(0.5);

      for (const q of realQuestions.slice(0, 5)) {
        const dist = await advancedReportAggregationService.getQuestionDistributionWithFilters(config.surveyId, q.id, reportFilters);

        doc.font('Helvetica-Bold').fontSize(12).text(q.question_text);
        doc.font('Helvetica');
        doc.fontSize(10).text(`Total de respostas: ${dist.total}`);

        if (dist.values.length > 0) {
          try {
            const chartBuffer = await chartImageGenerator.generateBestChartForQuestion(
              dist.values,
              q.question_type,
              q.preferred_visualization,
              { width: 480, height: 280, dpi: 120 }
            );
            doc.image(chartBuffer, { fit: [450, 260] });
          } catch {
            dist.values.slice(0, 4).forEach((v: DistributionItem) => {
              doc.text(`• ${v.label}: ${v.count} (${v.percentage}%)`);
            });
          }
        }
        doc.moveDown(0.8);
      }
    }

    // Para Analítico e Consolidado: cruzamentos com premissas
    if (['analytical', 'consolidated'].includes(config.reportType)) {
      doc.addPage();
      doc.fontSize(14).text('Análise Cruzada', { underline: true });
      doc.moveDown();

      if (totals.totalResponses === 0) {
        doc.font('Helvetica-Oblique').fillColor('#666666').fontSize(10).text('Esta pesquisa ainda não possui respostas coletadas. Os dados e cruzamentos ficarão disponíveis após a coleta.');
        doc.font('Helvetica').fillColor('black');
        doc.moveDown(0.5);
      }

      const { data: premises } = await this.supabase
        .from('survey_premises')
        .select('category, label, mapped_question_id')
        .eq('survey_id', config.surveyId)
        .not('mapped_question_id', 'is', null);

      const crossablePremises = (premises || []).filter((p: { mapped_question_id?: string | null }) => p.mapped_question_id);

      for (const q of realQuestions.slice(0, 6)) {
        const dist = await advancedReportAggregationService.getQuestionDistributionWithFilters(config.surveyId, q.id, reportFilters);

        doc.font('Helvetica-Bold').fontSize(12).text(q.question_text);
        doc.font('Helvetica');
        doc.fontSize(10).text(`Total: ${dist.total}`);

        for (const premise of crossablePremises.slice(0, 2)) {
          try {
            const cross = await advancedReportAggregationService.getCrossTabWithFilters(
              config.surveyId,
              q.id,
              { type: 'premise', category: premise.category },
              reportFilters
            );

            if (cross.rows.length > 0) {
              doc.fontSize(10).text(`Cruzamento: ${premise.label}`);
              cross.rows.slice(0, 5).forEach((row: CrossTabRow) => {
                const values = Object.values(row);
                doc.text(`  ${values[0]} × ${values[1]} → ${values[2]} (${values[3]}%)`);
              });
            }
          } catch { }
        }
        doc.moveDown(0.6);
      }
    }

    // === SEÇÃO DE INSIGHTS (Fase 3 + Governança de IA) ===
    doc.addPage();
    doc.fontSize(14).text('Insights e Interpretações', { underline: true });

    // Preferir dados injetados pelo JobService (rastreamento exato de custo/tokens)
    const preInsights = surveyData.insights || [];
    const aiUsage = surveyData.aiUsage || null;
    const useAI = (config as InternalReportConfig).useAIInsights === true;

    let insightsToRender = preInsights;

    if (insightsToRender.length === 0 && realQuestions.length > 0) {
      try {
        const result = await reportInsightsService.generateInsightsForSurvey(
          config.surveyId,
          realQuestions,
          planningContext,
          { useAI }
        );
        insightsToRender = result.insights;
      } catch (e) {
        console.error('[PdfReportGenerator] Erro no fallback de insights:', e);
      }
    }

    if (aiUsage?.enabled) {
      doc.font('Helvetica-Oblique').fillColor('#854d0e').fontSize(9).text(`Análises por IA • ${aiUsage.modelUsed || 'LLM'} • ${aiUsage.tokensUsed || '?'} tokens • $${(aiUsage.costUsd || 0).toFixed(4)}`);
      doc.font('Helvetica').fillColor('black');
    } else {
      doc.font('Helvetica-Oblique').fillColor('#666666').fontSize(9).text('Análises automáticas (sem IA)');
      doc.font('Helvetica').fillColor('black');
    }
    doc.moveDown(0.4);

    // Transparência quando filtros da visão dinâmica estão ativos
    const hasDynamicFilters = (surveyData.filters && (surveyData.filters.localityIds || surveyData.filters.premises));
    if (hasDynamicFilters) {
      doc.font('Helvetica-Oblique').fillColor('#666666').fontSize(8).text('(Filtros de premissas e/ou localidade aplicados conforme seleção na análise dinâmica)');
      doc.font('Helvetica').fillColor('black');
      doc.moveDown(0.3);
    }

    if (insightsToRender.length > 0) {
      doc.font('Helvetica-Bold').fontSize(11).text('Principais interpretações dos dados:');
      doc.font('Helvetica');
      doc.moveDown(0.3);

      insightsToRender.forEach((insight: GeneratedInsight, index: number) => {
        const sourceLabel = insight.source === 'ai' ? ' (IA)' : ' (automático)';
        doc.font('Helvetica-Bold').fillColor('#1e3a8a').fontSize(10).text(`${index + 1}. ${insight.questionText || insight.title || 'Insight'}${sourceLabel}`);
        doc.font('Helvetica').fillColor('black').fontSize(9).text(insight.summary || insight.description || '');
        (insight.keyFindings || []).forEach((finding: string) => {
          doc.fontSize(9).text(`   • ${finding}`);
        });
        if (insight.strategicImplications) {
          doc.font('Helvetica-Oblique').fillColor('#374151').fontSize(8).text(`   Implicação: ${insight.strategicImplications}`);
          doc.font('Helvetica').fillColor('black');
        }
        doc.moveDown(0.3);
      });
    } else {
      doc.font('Helvetica-Oblique').fontSize(9).text('Nenhum insight gerado para esta pesquisa.');
      doc.font('Helvetica');
    }

    // Rodapé simples
    doc.fontSize(9).text(`Relatório gerado pelo iDialog Pesquisa • ${new Date().toLocaleDateString('pt-BR')}`, {
      align: 'center',
    });

    doc.end();

    return new Promise((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }

  private async getTenantLogoBuffer(tenantId?: string): Promise<Buffer | null> {
    if (!tenantId) return null;
    try {
      const { data: asset } = await this.supabase
        .from('company_assets')
        .select('file_url, storage_path')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .limit(1)
        .single();

      if (asset?.storage_path) {
        const { data: fileData } = await this.supabase.storage.from('company-assets').download(asset.storage_path);
        if (fileData) return Buffer.from(await fileData.arrayBuffer());
      }
      if (asset?.file_url) {
        const res = await fetch(asset.file_url);
        if (res.ok) return Buffer.from(await res.arrayBuffer());
      }
      return null;
    } catch {
      return null;
    }
  }

  private getReportTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      synthetic: 'Relatório Sintético',
      analytical: 'Relatório Analítico (Cruzamentos)',
      consolidated: 'Relatório Consolidado',
    };
    return labels[type] || type;
  }
}

export const pdfReportGenerator = new PdfReportGenerator();
