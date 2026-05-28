/**
 * ReportAggregationService
 * 
 * Serviço central responsável por todas as agregações e cruzamentos de dados de pesquisa.
 * 
 * Decisão de arquitetura:
 * - Começar com queries diretas no Postgres (rápido de implementar).
 * - Evoluir para Materialized Views quando o volume crescer.
 * - Manter toda lógica de agregação aqui para ser reutilizada tanto pelo .docx quanto pelo Dashboard.
 */

import { createAdminClient } from '@/lib/supabase/admin';

export class ReportAggregationService {
  private supabase = createAdminClient();

  /**
   * Retorna totais básicos de uma pesquisa.
   */
  async getBasicTotals(surveyId: string) {
    const { count: totalResponses } = await this.supabase
      .from('responses')
      .select('*', { count: 'exact', head: true })
      .eq('survey_id', surveyId)
      .eq('is_complete', true);

    // TODO: Adicionar mais métricas (taxa de resposta, tempo médio, etc.)

    return {
      totalResponses: totalResponses || 0,
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Gera cruzamento entre duas variáveis.
   * Exemplo: gender × age_group
   */
  async getCrossTab(
    surveyId: string, 
    variable1: string, 
    variable2: string
  ) {
    // Estratégia inicial: buscar todas as respostas + respostas das perguntas
    // Em produção real, isso deve ser otimizado com views ou funções Postgres.

    const { data: answers } = await this.supabase
      .from('response_answers')
      .select(`
        question_id,
        answer_json,
        answer_text,
        questions(question_text, options)
      `)
      .eq('survey_id', surveyId); // Isso exige que a view/join esteja correta

    // Por enquanto retornamos estrutura básica.
    // Implementação completa virá na próxima iteração.

    return {
      variables: [variable1, variable2],
      rows: [],
      total: 0,
      message: 'Agregação básica - implementação completa pendente',
    };
  }

  /**
   * Retorna todos os cruzamentos possíveis para uma pesquisa (baseado nas perguntas).
   */
  async getAvailableCrossings(surveyId: string): Promise<string[][]> {
    const { data: questions } = await this.supabase
      .from('questions')
      .select('id, question_text, question_type, options')
      .eq('survey_id', surveyId)
      .in('question_type', ['single_choice', 'multiple_choice', 'rating']);

    if (!questions) return [];

    // Por enquanto, sugerimos cruzamentos entre perguntas categóricas
    const categoricalQuestions = questions.map(q => q.id);

    // Combinações simples (2 a 2)
    const combinations: string[][] = [];
    for (let i = 0; i < categoricalQuestions.length; i++) {
      for (let j = i + 1; j < categoricalQuestions.length; j++) {
        combinations.push([categoricalQuestions[i], categoricalQuestions[j]]);
      }
    }

    return combinations.slice(0, 20); // Limitar para não explodir a UI inicialmente
  }
}

export const reportAggregationService = new ReportAggregationService();