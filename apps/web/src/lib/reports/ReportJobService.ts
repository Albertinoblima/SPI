/**
 * ReportJobService
 *
 * Serviço responsável pelo ciclo de vida completo de geração de relatórios.
 *
 * Decisões Sênior (F0.5):
 * - Jobs são a única forma recomendada de gerar relatórios a partir de Fase 1 em diante.
 * - Suporte a geração síncrona para relatórios pequenos (otimização de UX).
 * - Geração assíncrona + upload para Storage + Presigned URLs para relatórios grandes.
 * - Toda geração passa pelo AdvancedReportAggregationService + ChartImageGenerator.
 * - Auditoria completa (status, duração, tamanho, downloads).
 * - Segurança: presigned URLs de curta duração + limite de downloads.
 *
 * Este serviço será o orquestrador central usado por:
 * - API de geração de relatórios
 * - Workers futuros (se usarmos Edge Functions ou background jobs)
 * - UI de acompanhamento de geração
 */

import { createAuditedSupabaseAdminClient } from '@political-research/shared-utils';
import { docxReportGenerator } from './DocxReportGenerator';
import { pdfReportGenerator } from './PdfReportGenerator';
import { advancedReportAggregationService } from './AdvancedReportAggregationService';
import { reportInsightsService } from './ReportInsightsService';
import type { ReportConfiguration, ReportFilters, ProfessionalReportConfiguration, GeneratedInsightsResult, ReportSurveyData, InternalReportConfig } from './types';

interface CreateJobParams {
  surveyId: string;
  tenantId: string;
  reportType: 'synthetic' | 'analytical' | 'consolidated';
  configuration: Partial<ProfessionalReportConfiguration>;
  requestedBy?: string;
  filters?: ReportFilters;
  correlationId?: string; // Fase 6 - full observability
}

interface ProcessJobResult {
  success: boolean;
  jobId: string;
  filePath?: string;
  fileSize?: number;
  error?: string;
}

export class ReportJobService {
  private supabase = createAuditedSupabaseAdminClient('ReportJobService');
  private readonly BUCKET = 'reports-generated';
  private readonly DEFAULT_EXPIRATION_MINUTES = 45;
  private readonly MAX_DOWNLOADS = 8;

  /**
   * Cria um novo job de geração de relatório.
   * O job começa com status 'queued'.
   */
  async createJob(params: CreateJobParams) {
    const { data, error } = await this.supabase
      .from('report_generation_jobs')
      .insert({
        survey_id: params.surveyId,
        tenant_id: params.tenantId,
        report_type: params.reportType,
        requested_by: params.requestedBy || null,
        configuration_snapshot: {
          ...params.configuration,
          filters: params.filters || null,
          correlationId: params.correlationId, // Fase 6 observability
        },
        status: 'queued',
        max_downloads: this.MAX_DOWNLOADS,
        expires_at: new Date(Date.now() + this.DEFAULT_EXPIRATION_MINUTES * 60 * 1000).toISOString(),
      })
      .select()
      .single();

    if (error) throw new Error(`Falha ao criar job de relatório: ${error.message}`);

    return data;
  }

  /**
   * Processa um job (pode ser chamado de forma síncrona ou por worker).
   * Esta é a função que realmente gera o relatório profissional completo.
   *
   * Decisões Sênior:
   * - Para Consolidado + useAIInsights: chama ReportInsightsService e captura governança de custo.
   * - Dados ricos são preparados via AdvancedReportAggregationService.
   * - Persistência explícita de métricas de IA no job para auditoria.
   */
  async processJob(jobId: string): Promise<ProcessJobResult> {
    const overallStart = Date.now();

    // 1. Marcar como processing + log
    await this.supabase
      .from('report_generation_jobs')
      .update({ status: 'processing', started_at: new Date().toISOString() })
      .eq('id', jobId);

    // F6-05: Structured observability note - replace with pino/winston + correlationId in prod
    console.log(`[ReportJobService] Iniciando processamento do job ${jobId}`);

    try {
      // Buscar job completo
      const { data: job } = await this.supabase
        .from('report_generation_jobs')
        .select('*')
        .eq('id', jobId)
        .single();

      if (!job) throw new Error('Job não encontrado');

      const config = (job.configuration_snapshot || {}) as Partial<InternalReportConfig & { format?: string; useAIInsights?: boolean }>;
      const surveyId = job.survey_id;
      const reportType = job.report_type as 'synthetic' | 'analytical' | 'consolidated';

      const format = config.format || 'docx';
      const useAIInsights = config.useAIInsights === true && reportType === 'consolidated';

      if (useAIInsights) {
        console.log(`[ReportJobService] Job ${jobId} → CONSOLIDADO com IA ativada.`);
      }

      // 2. Preparar dados ricos (perguntas reais + agregações + planejamento)
      const reportData = await this.prepareRichReportData(surveyId, config, reportType);

      // 3. Gerar insights com IA (somente Consolidado + flag ligada)
      let insightsResult: GeneratedInsightsResult | null = null;

      if (reportType === 'consolidated') {
        const questionsForInsights = (reportData as any).questions || []; // transitional - prepareRichReportData will return full ReportSurveyData
        const planningCtx = (reportData as any).planning || {};

        insightsResult = await reportInsightsService.generateInsightsForSurvey(
          surveyId,
          questionsForInsights,
          planningCtx,
          { useAI: useAIInsights }
        );

        reportData.insights = insightsResult.insights;
        reportData.aiUsage = insightsResult.usage;
      }

      // 4. Gerar o documento (DOCX ou PDF)
      let buffer: Buffer;
      let fileName: string;
      let contentType: string;

      const generatorConfig = { ...config, useAIInsights } as InternalReportConfig;

      if (format === 'pdf') {
        buffer = await pdfReportGenerator.generate(generatorConfig, reportData);
        fileName = `${reportType}-${Date.now()}.pdf`;
        contentType = 'application/pdf';
      } else {
        buffer = await docxReportGenerator.generate(generatorConfig, reportData);
        fileName = `${reportType}-${Date.now()}.docx`;
        contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      }

      // 5. Upload para Storage (bucket privado)
      const storagePath = `${job.tenant_id}/${jobId}/${fileName}`;

      const { error: uploadError } = await this.supabase.storage
        .from(this.BUCKET)
        .upload(storagePath, buffer, {
          contentType,
          upsert: false,
        });

      if (uploadError) throw new Error(`Falha no upload do relatório: ${uploadError.message}`);

      const fileSize = buffer.length;
      const completedAt = new Date().toISOString();
      const durationSeconds = Math.floor((Date.now() - overallStart) / 1000);

      // 6. Atualizar job como pronto + persistir governança de IA (se aplicável)
      const updatePayload: Record<string, unknown> = {
        status: 'ready',
        file_path: storagePath,
        file_size_bytes: fileSize,
        completed_at: completedAt,
        processing_duration_seconds: durationSeconds,
        mime_type: contentType,
      };

      if (insightsResult?.usage?.enabled) {
        const u = insightsResult.usage;
        updatePayload['ai_insights_enabled'] = true;
        updatePayload['ai_model_used'] = u.modelUsed;
        updatePayload['ai_tokens_used'] = u.tokensUsed;
        updatePayload['ai_cost_usd'] = u.costUsd;
        updatePayload['ai_generation_time_ms'] = u.generationTimeMs;
        updatePayload['insights_generated_at'] = u.generatedAt;
      }

      await this.supabase
        .from('report_generation_jobs')
        .update(updatePayload)
        .eq('id', jobId);

      console.log(`[ReportJobService] Job ${jobId} concluído com sucesso em ${durationSeconds}s. Tamanho: ${(fileSize / 1024).toFixed(1)}KB`);

      return {
        success: true,
        jobId,
        filePath: storagePath,
        fileSize,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      console.error(`[ReportJobService] Falha no job ${jobId}:`, error);

      await this.supabase
        .from('report_generation_jobs')
        .update({
          status: 'failed',
          error_message: errorMessage,
          completed_at: new Date().toISOString(),
        })
        .eq('id', jobId);

      return {
        success: false,
        jobId,
        error: errorMessage,
      };
    }
  }

  /**
   * Gera uma URL assinada segura e de curta duração para download.
   */
  async generateSecureDownloadUrl(jobId: string, tenantId: string) {
    const { data: job } = await this.supabase
      .from('report_generation_jobs')
      .select('file_path, status, expires_at, download_count, max_downloads')
      .eq('id', jobId)
      .eq('tenant_id', tenantId)
      .single();

    if (!job || job.status !== 'ready' || !job.file_path) {
      throw new Error('Relatório não está disponível para download');
    }

    if (job.download_count >= (job.max_downloads || 8)) {
      throw new Error('Limite de downloads atingido para este relatório');
    }

    if (job.expires_at && new Date(job.expires_at) < new Date()) {
      throw new Error('Link de download expirado');
    }

    const { data: signedUrlData, error } = await this.supabase.storage
      .from(this.BUCKET)
      .createSignedUrl(job.file_path, 60 * this.DEFAULT_EXPIRATION_MINUTES); // ex: 45 minutos

    if (error || !signedUrlData) {
      throw new Error('Não foi possível gerar link seguro de download');
    }

    // Incrementar contador de downloads
    await this.supabase
      .from('report_generation_jobs')
      .update({
        download_count: (job.download_count || 0) + 1,
        last_downloaded_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    return {
      url: signedUrlData.signedUrl,
      expiresInMinutes: this.DEFAULT_EXPIRATION_MINUTES,
      remainingDownloads: (job.max_downloads || 8) - ((job.download_count || 0) + 1),
    };
  }

  /**
   * Prepara dados ricos e completos para os geradores (DOCX/PDF).
   * Utiliza AdvancedReportAggregationService para obter distribuições reais com filtros.
   */
  private async prepareRichReportData(surveyId: string, config: Partial<InternalReportConfig & { tenantId?: string }>, reportType: string): Promise<ReportSurveyData> {
    // 1. Dados básicos da pesquisa + planejamento
    const { data: survey } = await this.supabase
      .from('surveys')
      .select(`id, title, description, planning_data(*)`)
      .eq('id', surveyId)
      .single();

    const planning = survey?.planning_data?.[0] || null;

    // 2. Perguntas do questionário (ordenadas)
    const { data: questions } = await this.supabase
      .from('questions')
      .select('id, question_text, question_type, order_index, options, preferred_visualization')
      .eq('survey_id', surveyId)
      .is('deleted_at', null)
      .order('order_index', { ascending: true });

    // 3. Totais básicos (respostas completas, etc)
    const totals = await advancedReportAggregationService.getBasicTotals(surveyId);

    // 4. Para relatórios analíticos/consolidados: preparar dados de cruzamento básicos
    // (os geradores podem chamar métodos mais específicos do Advanced service diretamente também)
    const filters = config.filters || {
      localityIds: config.includeLocalityCross ? undefined : [],
    };

    // Estrutura profissional tipada que os geradores esperam (Fase 3)
    const reportData: ReportSurveyData = {
      surveyId,
      tenantId: config.tenantId || planning?.tenant_id,
      title: survey?.title || 'Relatório de Pesquisa',
      filters: filters as ReportFilters, // transitional - will be fully typed when ReportFilters is hardened
      // planningContext is the new typed shape
      planningContext: planning ? {
        objective: planning.objective,
        sample_size: planning.sample_size,
        ...planning,
      } : undefined,
      planning,
      // Other fields the generators currently expect
      questions: questions || [],
      totals,
      reportType,
      insights: null,
      aiUsage: null,
      generatedAt: new Date().toISOString(),
    };

    return reportData;
  }

  /**
   * Permite revogar/invalidar um link de download (segurança).
   */
  async revokeDownloadAccess(jobId: string, tenantId: string) {
    await this.supabase
      .from('report_generation_jobs')
      .update({
        status: 'expired',
        expires_at: new Date().toISOString(),
      })
      .eq('id', jobId)
      .eq('tenant_id', tenantId);
  }

  /**
   * Lista jobs de relatórios de um tenant (para página de Histórico).
   */
  async getUserJobs(tenantId: string, options: { limit?: number; offset?: number } = {}) {
    const { limit = 20, offset = 0 } = options;

    const { data, error } = await this.supabase
      .from('report_generation_jobs')
      .select(`
        id, survey_id, report_type, status, 
        file_size_bytes, processing_duration_seconds,
        ai_insights_enabled, ai_model_used, ai_tokens_used, ai_cost_usd,
        download_count, max_downloads, expires_at,
        created_at, completed_at, requested_by
      `)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw new Error(`Erro ao buscar histórico de relatórios: ${error.message}`);

    return data || [];
  }

  /**
   * Retorna estatísticas de uso de IA por tenant (governança / dashboard de custos).
   */
  async getAIUsageStats(tenantId: string) {
    const { data } = await this.supabase
      .from('report_generation_jobs')
      .select('ai_cost_usd, ai_tokens_used, ai_model_used, created_at')
      .eq('tenant_id', tenantId)
      .eq('ai_insights_enabled', true);

    const totalCost = (data || []).reduce((sum: number, r: any) => sum + (r.ai_cost_usd || 0), 0);
    const totalTokens = (data || []).reduce((sum: number, r: any) => sum + (r.ai_tokens_used || 0), 0);

    return {
      totalJobsWithAI: data?.length || 0,
      totalCostUsd: Number(totalCost.toFixed(4)),
      totalTokens,
      jobs: data || [],
    };
  }
}

export const reportJobService = new ReportJobService();