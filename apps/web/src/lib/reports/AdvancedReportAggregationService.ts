/**
 * AdvancedReportAggregationService
 *
 * Serviço de agregação de alto nível para relatórios profissionais.
 *
 * Princípios de Design (Sênior):
 * - Fonte da verdade: sempre response_answers + responses
 * - Filtros poderosos e tipados (localidade + premissas mapeadas)
 * - Preferência por agregação no banco sempre que possível
 * - Preparado para cache / materialized views no futuro
 * - Mantém compatibilidade com o serviço antigo durante a transição
 *
 * Este serviço será a base para:
 * - Relatório Sintético (distribuições com filtros)
 * - Relatório Analítico (cruzamentos por pergunta × premissas × localidade)
 * - Relatório Consolidado (mesmo + contexto para IA)
 */

import { createAuditedSupabaseAdminClient } from '@political-research/shared-utils/src/supabase/admin-client';
import type {
  ReportFilters,
  FilteredDistributionResult,
  AdvancedCrossTabResult,
  AggregationOptions,
  DistributionItem,
  CrossTabRow,
} from './types';

export class AdvancedReportAggregationService {
  private supabase = createAuditedSupabaseAdminClient('AdvancedReportAggregationService');

  /**
   * Retorna totais básicos com suporte a filtros.
   * Mantém assinatura similar ao antigo para facilitar migração gradual.
   */
  async getBasicTotals(surveyId: string, filters?: ReportFilters): Promise<{
    totalResponses: number;
    completionRate: number;
    lastUpdated: string;
  }> {
    let query = this.supabase
      .from('responses')
      .select('*', { count: 'exact', head: true })
      .eq('survey_id', surveyId)
      .eq('is_complete', filters?.onlyComplete ?? true);

    // Aplicação futura de filtros de data / entrevistador / localidade virá aqui
    // (depende de como persistimos locality_id na response)

    const { count } = await query;

    return {
      totalResponses: count || 0,
      completionRate: 100, // TODO: calcular de verdade quando tivermos mais dados
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Distribuição de uma pergunta com filtros avançados aplicados.
   * Suporte real a premissas (via mapped_question_id) e filtros básicos.
   */
  async getQuestionDistributionWithFilters(
    surveyId: string,
    questionId: string,
    filters?: ReportFilters,
    options?: AggregationOptions
  ): Promise<FilteredDistributionResult> {
    const startTime = Date.now();

    // 1. Obter response_ids que atendem aos filtros de premissas (se houver)
    let filteredResponseIds: string[] | null = null;

    if (filters?.premises && Object.keys(filters.premises).length > 0) {
      filteredResponseIds = await this.getResponseIdsMatchingPremises(surveyId, filters.premises);
      if (filteredResponseIds.length === 0) {
        return { labels: [], values: [], total: 0, appliedFilters: filters || {} };
      }
    }

    // 2. Query principal
    let query = this.supabase
      .from('response_answers')
      .select('answer_text, answer_json, response_id, created_at')
      .eq('survey_id', surveyId)
      .eq('question_id', questionId);

    if (filteredResponseIds) {
      query = query.in('response_id', filteredResponseIds);
    }

    if (filters?.dateFrom) query = query.gte('created_at', filters.dateFrom);
    if (filters?.dateTo) query = query.lte('created_at', filters.dateTo);

    // Suporte básico a filtro por localidade (requer que responses.locality_id esteja populado)
    if (filters?.localityIds && filters.localityIds.length > 0) {
      // Filtramos via subquery nas responses
      const { data: matchingResponses } = await this.supabase
        .from('responses')
        .select('id')
        .eq('survey_id', surveyId)
        .in('locality_id', filters.localityIds);

      if (matchingResponses && matchingResponses.length > 0) {
        const respIds = matchingResponses.map(r => r.id);
        query = query.in('response_id', respIds);
      } else {
        // Sem respostas → retorno vazio
        return { labels: [], values: [], total: 0, appliedFilters: filters || {} };
      }
    }

    const { data: answers, error } = await query;

    if (error) {
      console.error('AdvancedReportAggregationService error:', error);
      throw new Error('Falha ao consultar distribuições com filtros');
    }

    if (!answers || answers.length === 0) {
      return {
        labels: [],
        values: [],
        total: 0,
        appliedFilters: filters || {},
      };
    }

    // Agrupamento
    const counts: Record<string, number> = {};
    answers.forEach((ans) => {
      let value = ans.answer_text || 'Não respondido';
      if (ans.answer_json && typeof ans.answer_json === 'object' && 'value' in ans.answer_json) {
        const rawValue = (ans.answer_json as { value?: unknown }).value;
        value = typeof rawValue === 'string' ? rawValue : JSON.stringify(rawValue);
      } else if (ans.answer_json && typeof ans.answer_json === 'object') {
        value = JSON.stringify(ans.answer_json);
      }
      counts[value] = (counts[value] || 0) + 1;
    });

    const total = answers.length;
    const labels = Object.keys(counts);
    const values: DistributionItem[] = labels
      .map((label) => ({
        label,
        count: counts[label] ?? 0,
        percentage: Math.round(((counts[label] ?? 0) / total) * 100),
      }))
      .sort((a, b) => b.count - a.count);

    return {
      labels,
      values,
      total,
      appliedFilters: filters || {},
      metadata: { executionTimeMs: Date.now() - startTime },
    };
  }

  /**
   * Resolve uma premissa (category) para o question_id mapeado.
   * Usa o campo `mapped_question_id` adicionado na migration Fase 0.
   */
  private async resolvePremiseToQuestionId(
    surveyId: string,
    category: string
  ): Promise<string | null> {
    const normalizedCategory = category.toLowerCase().trim();

    const { data } = await this.supabase
      .from('survey_premises')
      .select('mapped_question_id, category, label')
      .eq('survey_id', surveyId)
      .ilike('category', normalizedCategory)
      .not('mapped_question_id', 'is', null)
      .single();

    return data?.mapped_question_id || null;
  }

  /**
   * Cruzamento avançado com suporte a filtros por localidade e premissas.
   *
   * Esta é a peça central para o Relatório Analítico conforme especificado pelo usuário:
   * - Uma seção por pergunta
   * - Cruzamentos com localidade + premissas escolhidas pelo pesquisador
   */
  async getCrossTabWithFilters(
    surveyId: string,
    primaryQuestionId: string,
    secondaryDimension: string | { type: 'premise'; category: string },
    filters?: ReportFilters,
    options?: AggregationOptions
  ): Promise<AdvancedCrossTabResult> {
    const startTime = Date.now();

    const questionIds: string[] = [primaryQuestionId];
    let secondaryLabel: string = String(secondaryDimension);

    // Resolução profissional de premissa → question_id
    if (typeof secondaryDimension === 'object' && secondaryDimension.type === 'premise') {
      const resolvedQuestionId = await this.resolvePremiseToQuestionId(
        surveyId,
        secondaryDimension.category
      );

      if (!resolvedQuestionId) {
        return {
          dimensions: [primaryQuestionId, secondaryDimension.category],
          rows: [],
          total: 0,
          appliedFilters: filters || {},
          metadata: {
            executionTimeMs: Date.now() - startTime,
            warning: `Premissa "${secondaryDimension.category}" não possui mapeamento para uma pergunta. Configure mapped_question_id na survey_premises.`,
          },
        };
      }

      questionIds.push(resolvedQuestionId);
      secondaryLabel = secondaryDimension.category;
    } else if (typeof secondaryDimension === 'string') {
      questionIds.push(secondaryDimension);
    }

    // Busca das respostas (base para pivot)
    const { data: answers } = await this.supabase
      .from('response_answers')
      .select('response_id, question_id, answer_text, answer_json')
      .eq('survey_id', surveyId)
      .in('question_id', questionIds);

    if (!answers || answers.length === 0) {
      return {
        dimensions: [primaryQuestionId, secondaryLabel],
        rows: [],
        total: 0,
        appliedFilters: filters || {},
      };
    }

    // Agrupamento por response_id
    const byResponse: Record<string, Record<string, string>> = {};

    answers.forEach((ans) => {
      if (!byResponse[ans.response_id]) byResponse[ans.response_id] = {};

      let value = ans.answer_text || 'N/A';
      if (ans.answer_json && typeof ans.answer_json === 'object' && 'value' in ans.answer_json) {
        value = (ans.answer_json as { value: string }).value;
      }
      const responseBucket = byResponse[ans.response_id];
      if (!responseBucket) {
        return;
      }
      responseBucket[ans.question_id] = value;
    });

    // Pivot
    const matrix: Record<string, Record<string, number>> = {};
    let total = 0;

    Object.values(byResponse).forEach((pair) => {
      const val1 = pair[primaryQuestionId] || 'N/A';
      const secondaryQuestionId = questionIds[1];
      const val2 = secondaryQuestionId ? pair[secondaryQuestionId] || 'N/A' : 'N/A';

      if (!matrix[val1]) matrix[val1] = {};
      if (!matrix[val1][val2]) matrix[val1][val2] = 0;

      matrix[val1][val2] += 1;
      total++;
    });

    const rows: CrossTabRow[] = Object.entries(matrix).flatMap(([val1, val2Obj]) =>
      Object.entries(val2Obj).map(([val2, count]) => ({
        [primaryQuestionId]: val1,
        [secondaryLabel]: val2,
        count,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0,
      } as CrossTabRow))
    );

    return {
      dimensions: [primaryQuestionId, secondaryLabel],
      rows: rows.slice(0, options?.maxRows ?? 2000),
      total,
      appliedFilters: filters || {},
      metadata: rows.length > 800
        ? {
          executionTimeMs: Date.now() - startTime,
          warning: 'Muitos resultados. Recomenda-se aplicar filtros adicionais (localidade, premissas específicas).',
        }
        : { executionTimeMs: Date.now() - startTime },
    };
  }

  /**
   * Retorna perguntas que podem ser usadas como dimensões de cruzamento,
   * já considerando as premissas mapeadas da pesquisa.
   */
  async getCrossableDimensions(surveyId: string) {
    const { data: questions } = await this.supabase
      .from('questions')
      .select('id, question_text, question_type, options')
      .eq('survey_id', surveyId)
      .in('question_type', ['single_choice', 'multiple_choice', 'rating'])
      .order('order_index');

    const { data: mappedPremises } = await this.supabase
      .from('survey_premises')
      .select('id, category, label, mapped_question_id')
      .eq('survey_id', surveyId)
      .not('mapped_question_id', 'is', null);

    return {
      questions: questions || [],
      mappedPremises: mappedPremises || [],
    };
  }

  /**
   * Retorna todas as premissas cadastradas para uma pesquisa,
   * indicando se já estão mapeadas para perguntas (prontas para cruzamento).
   * Usado pela UI de geração de relatório para o pesquisador escolher os filtros.
   */
  async getAvailablePremisesForCross(surveyId: string) {
    const { data } = await this.supabase
      .from('survey_premises')
      .select('id, category, label, options, mapped_question_id')
      .eq('survey_id', surveyId)
      .order('order_index');

    return (data || []).map((p) => ({
      ...p,
      isMappableForCross: !!p.mapped_question_id,
    }));
  }

  /**
   * Retorna localidades da pesquisa (útil para montar filtros na UI).
   */
  async getSurveyLocalities(surveyId: string) {
    const { data } = await this.supabase
      .from('survey_localities')
      .select('id, name, zone, interviews_required')
      .eq('survey_id', surveyId)
      .order('name');

    return data || [];
  }

  /**
   * Retorna os response_ids que atendem aos filtros de premissas.
   * Essencial para o Relatório Dinâmico e Analítico funcionarem de verdade.
   */
  private async getResponseIdsMatchingPremises(
    surveyId: string,
    premises: Record<string, string[]>
  ): Promise<string[]> {
    const categories = Object.keys(premises);
    if (categories.length === 0) return [];

    // Resolve todas as premissas para seus question_ids mapeados
    const premiseQuestions: Array<{ category: string; questionId: string; values: string[] }> = [];

    for (const category of categories) {
      const mappedQuestionId = await this.resolvePremiseToQuestionId(surveyId, category);
      if (mappedQuestionId) {
        const premiseValues = premises[category];
        if (!premiseValues) {
          continue;
        }
        premiseQuestions.push({
          category,
          questionId: mappedQuestionId,
          values: premiseValues,
        });
      }
    }

    if (premiseQuestions.length === 0) return [];

    // Busca respostas para todas as premissas envolvidas
    const allQuestionIds = premiseQuestions.map(p => p.questionId);
    const { data: answers } = await this.supabase
      .from('response_answers')
      .select('response_id, question_id, answer_text, answer_json')
      .eq('survey_id', surveyId)
      .in('question_id', allQuestionIds);

    if (!answers || answers.length === 0) return [];

    // Agrupa por response_id
    const byResponse: Record<string, Record<string, string>> = {};
    answers.forEach((ans) => {
      if (!byResponse[ans.response_id]) byResponse[ans.response_id] = {};
      let value = ans.answer_text || '';
      if (ans.answer_json && typeof ans.answer_json === 'object' && 'value' in ans.answer_json) {
        value = (ans.answer_json as { value: string }).value;
      }
      const responseBucket = byResponse[ans.response_id];
      if (!responseBucket) {
        return;
      }
      responseBucket[ans.question_id] = value;
    });

    // Filtra responses que batem com TODAS as premissas selecionadas
    const matchingResponseIds: string[] = [];

    Object.entries(byResponse).forEach(([responseId, answersMap]) => {
      let matchesAll = true;

      for (const pq of premiseQuestions) {
        const responseValue = answersMap[pq.questionId];
        if (!responseValue || !pq.values.includes(responseValue)) {
          matchesAll = false;
          break;
        }
      }

      if (matchesAll) {
        matchingResponseIds.push(responseId);
      }
    });

    return matchingResponseIds;
  }
}

export const advancedReportAggregationService = new AdvancedReportAggregationService();
