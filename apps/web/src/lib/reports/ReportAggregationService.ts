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

interface QuestionOption {
  value: string;
  label: string;
}

export class ReportAggregationService {
  private supabase = createAdminClient();

  /**
   * Retorna estatísticas gerais da pesquisa.
   */
  async getBasicTotals(surveyId: string) {
    const { count: totalResponses } = await this.supabase
      .from('responses')
      .select('*', { count: 'exact', head: true })
      .eq('survey_id', surveyId)
      .eq('is_complete', true);

    // TODO: Adicionar taxa de resposta, tempo médio, etc. quando tivermos mais dados

    return {
      totalResponses: totalResponses || 0,
      completionRate: 100, // Placeholder - calcular de verdade depois
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Retorna distribuição de respostas para uma única pergunta.
   */
  async getQuestionDistribution(surveyId: string, questionId: string) {
    const { data: answers } = await this.supabase
      .from('response_answers')
      .select('answer_text, answer_json')
      .eq('survey_id', surveyId)
      .eq('question_id', questionId);

    if (!answers || answers.length === 0) {
      return { labels: [], values: [], total: 0 };
    }

    const counts: Record<string, number> = {};

    answers.forEach((ans) => {
      let value: string;

      if (ans.answer_json && typeof ans.answer_json === 'object') {
        // Para multiple choice ou objetos
        value = ans.answer_json.value || JSON.stringify(ans.answer_json);
      } else {
        value = ans.answer_text || 'Não respondido';
      }

      counts[value] = (counts[value] || 0) + 1;
    });

    const total = answers.length;
    const labels = Object.keys(counts);
    const values = labels.map((label) => ({
      label,
      count: counts[label],
      percentage: Math.round((counts[label] / total) * 100),
    }));

    return {
      labels,
      values,
      total,
    };
  }

  /**
   * Gera cruzamento entre duas perguntas (ex: Sexo × Faixa Etária).
   */
  async getCrossTab(surveyId: string, questionId1: string, questionId2: string) {
    const { data: answers } = await this.supabase
      .from('response_answers')
      .select(`
        response_id,
        question_id,
        answer_text,
        answer_json
      `)
      .eq('survey_id', surveyId)
      .in('question_id', [questionId1, questionId2]);

    if (!answers || answers.length === 0) {
      return { rows: [], total: 0 };
    }

    // Agrupar por response_id
    const byResponse: Record<string, Record<string, string>> = {};

    answers.forEach((ans) => {
      if (!byResponse[ans.response_id]) {
        byResponse[ans.response_id] = {};
      }

      let value = ans.answer_text || 'N/A';

      if (ans.answer_json && typeof ans.answer_json === 'object' && ans.answer_json.value) {
        value = ans.answer_json.value;
      }

      byResponse[ans.response_id][ans.question_id] = value;
    });

    // Contar combinações
    const matrix: Record<string, Record<string, number>> = {};
    let total = 0;

    Object.values(byResponse).forEach((pair) => {
      const val1 = pair[questionId1] || 'N/A';
      const val2 = pair[questionId2] || 'N/A';

      if (!matrix[val1]) matrix[val1] = {};
      if (!matrix[val1][val2]) matrix[val1][val2] = 0;

      matrix[val1][val2] += 1;
      total++;
    });

    // Transformar em array para frontend (usando IDs como chaves por enquanto; labels são resolvidos no caller quando possível)
    const rows = Object.entries(matrix).flatMap(([val1, val2Obj]) =>
      Object.entries(val2Obj).map(([val2, count]) => ({
        [questionId1]: val1,
        [questionId2]: val2,
        count,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0,
      }))
    );

    return {
      variables: [questionId1, questionId2],
      rows,
      total,
      // Nota: labels amigáveis das perguntas são resolvidos no frontend ou no caller (Docx / Dashboard)
    };
  }

  /**
   * Retorna lista de perguntas que podem ser usadas em cruzamentos.
   */
  async getCrossableQuestions(surveyId: string) {
    const { data: questions } = await this.supabase
      .from('questions')
      .select('id, question_text, question_type, options')
      .eq('survey_id', surveyId)
      .in('question_type', ['single_choice', 'multiple_choice', 'rating'])
      .order('order_index');

    return questions || [];
  }
}

export const reportAggregationService = new ReportAggregationService();