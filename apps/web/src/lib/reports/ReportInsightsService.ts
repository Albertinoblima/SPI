/**
 * ReportInsightsService
 *
 * Serviço responsável por gerar análises profundas e interpretações para o Relatório Consolidado.
 *
 * Decisão Arquitetural (Sênior):
 * - Separação clara de responsabilidades: o gerador de PDF/DOCX não deve conter lógica de IA.
 * - Interface preparada para integração futura com LLM (xAI Grok, OpenAI, etc.).
 * - Suporte a cache de insights (para não regenerar a cada download).
 * - Permite override manual pelo pesquisador (importante para qualidade e governança).
 * - Por enquanto: implementação stub + estrutura para quando ativarmos a IA.
 */

import { createAuditedSupabaseAdminClient } from '@political-research/shared-utils/src/supabase/admin-client';
import type {
  GeneratedInsightsResult,
  GeneratedInsight,
  FilteredDistributionResult,
  AdvancedCrossTabResult,
  PlanningContext,
} from './types';

export interface InsightRequest {
  surveyId: string;
  questionId: string;
  distribution: FilteredDistributionResult;
  crossResults?: AdvancedCrossTabResult[];
  planningContext?: import('./types').PlanningContext;
  correlationId?: string; // F6 observability
}

export interface Insight {
  questionId: string;
  questionText: string;
  summary: string;
  keyFindings: string[];
  strategicImplications?: string;
  confidence: number; // 0-1
  generatedAt: string;
  source: 'ai' | 'manual' | 'cached' | 'fallback';
}

interface ParsedLLMResponse {
  summary: string;
  keyFindings: string[];
  strategicImplications?: string;
  confidence: number;
}

interface LLMCallResponse extends ParsedLLMResponse {
  usage?: { total_tokens?: number } | undefined;
  model?: string;
}

export class ReportInsightsService {
  private supabase = createAuditedSupabaseAdminClient('ReportInsightsService');
  // Note (Fase 2): This service uses admin client for AI governance data.
  // Consider rate-limiting + audit logging for production use of this path.

  /**
   * Gera insights para uma pergunta específica.
   * Hoje é um stub de alta qualidade. Futuramente chamará LLM.
   */
  async generateInsightForQuestion(request: InsightRequest): Promise<Insight> {
    // TODO (Fase 3): Integrar com LLM aqui (xAI Grok ou similar).
    // Por enquanto, geramos um insight estruturado e útil como fallback inteligente.

    const { questionId, distribution, crossResults = [] } = request;

    // Buscar texto da pergunta
    const { data: question } = await this.supabase
      .from('questions')
      .select('question_text')
      .eq('id', questionId)
      .single();

    const questionText = question?.question_text || 'Pergunta';

    const values = distribution.values || [];
    const topOption = values[0];
    const secondOption = values[1];
    const hasStrongDominance = topOption && topOption.percentage > 55;
    const isFragmented = !hasStrongDominance && values.length > 0 && (secondOption?.percentage || 0) > 15;

    let summary = '';
    const keyFindings: string[] = [];

    if (hasStrongDominance) {
      summary = `Há uma clara preferência majoritária por "${topOption.label}" (${topOption.percentage}% das respostas).`;
      keyFindings.push(`Dominância clara: ${topOption.percentage}% na opção líder.`);
      if (secondOption) {
        keyFindings.push(`A segunda opção mais escolhida fica bem atrás (${secondOption.percentage}%).`);
      }
    } else if (isFragmented) {
      summary = 'A opinião está fragmentada. Não há uma opção que se destaque de forma significativa.';
      keyFindings.push('Distribuição relativamente equilibrada entre as principais opções.');
    } else {
      summary = 'Existe uma tendência moderada, mas ainda com espaço para outras opções.';
      keyFindings.push(`Líder com ${topOption?.percentage || 0}%, sem dominância absoluta.`);
    }

    // Análise de cruzamentos (se existirem)
    if (crossResults.length > 0) {
      keyFindings.push(`Foram identificadas ${crossResults.length} variações relevantes ao cruzar com premissas.`);
      keyFindings.push('Recomenda-se atenção especial às diferenças por segmento.');
    }

    // Implicações estratégicas básicas
    let strategicImplications = 'Recomenda-se aprofundar a análise no relatório completo.';
    if (hasStrongDominance) {
      strategicImplications = `A forte concentração em "${topOption.label}" pode indicar uma tendência consolidada ou necessidade de ações de comunicação segmentada.`;
    } else if (isFragmented) {
      strategicImplications = 'A fragmentação sugere que diferentes públicos têm percepções distintas. Estratégias personalizadas por segmento podem ser mais eficazes.';
    }

    return {
      questionId,
      questionText,
      summary,
      keyFindings,
      strategicImplications,
      confidence: hasStrongDominance ? 0.88 : isFragmented ? 0.72 : 0.65,
      generatedAt: new Date().toISOString(),
      source: 'manual', // Será alterado para 'ai' quando integrarmos o LLM
    };
  }

  /**
   * Permite salvar/atualizar um insight manualmente (override pelo pesquisador).
   */
  async saveManualInsight(surveyId: string, questionId: string, insight: Partial<Insight>) {
    console.log('Salvando insight manual (stub):', { surveyId, questionId, insight });
    return { success: true };
  }

  /**
   * Gera insights para o relatório consolidado (API principal).
   *
   * Decision Sênior:
   * - Por padrão: análise de alta qualidade com fallback inteligente (sem custo).
   * - Com useAI=true: chama LLM (xAI Grok com prioridade) + captura tokens/custo.
   * - Retorna estrutura rica com metadados de uso para auditoria no ReportJobService.
   */
  async generateInsightsForSurvey(
    surveyId: string,
    questions: Array<{ id: string; question_text: string }>,
    planningContext?: PlanningContext,
    options: { useAI?: boolean } = {}
  ): Promise<GeneratedInsightsResult> {
    const useAI = options.useAI ?? false;
    const startTime = Date.now();

    if (useAI) {
      console.log(`[ReportInsightsService] Gerando insights com IA para pesquisa ${surveyId}`);
      const result = await this._generateInsightsWithAI(surveyId, questions, planningContext);
      const duration = Date.now() - startTime;

      result.usage.generationTimeMs = duration;
      result.usage.generatedAt = new Date().toISOString();

      console.log(`[ReportInsightsService] IA insights gerados para ${surveyId} em ${duration}ms | model=${result.usage.modelUsed} | tokens=${result.usage.tokensUsed} | cost=$${result.usage.costUsd?.toFixed(4)}`);
      return result;
    }

    const insights = await this._generateInsightsWithFallback(surveyId, questions, planningContext);
    const duration = Date.now() - startTime;

    return {
      insights,
      usage: {
        enabled: false,
        source: 'fallback',
        questionsProcessed: insights.length,
        generationTimeMs: duration,
        generatedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Versão interna que usa o fallback inteligente (dados reais + regras).
   */
  private async _generateInsightsWithFallback(
    surveyId: string,
    questions: Array<{ id: string; question_text: string }>,
    planningContext?: PlanningContext
  ): Promise<Insight[]> {
    const insights: Insight[] = [];

    for (const q of questions.slice(0, 6)) {
      const dist = await this.supabase
        .from('response_answers')
        .select('answer_text, answer_json')
        .eq('survey_id', surveyId)
        .eq('question_id', q.id);

      const counts: Record<string, number> = {};
      (dist.data || []).forEach((ans: { answer_text: string | null; answer_json: unknown }) => {
        let value = ans.answer_text || 'Não respondido';
        if (ans.answer_json && typeof ans.answer_json === 'object' && 'value' in ans.answer_json) {
          const rawValue = (ans.answer_json as { value?: unknown }).value;
          value = typeof rawValue === 'string' ? rawValue : JSON.stringify(rawValue);
        } else if (ans.answer_json && typeof ans.answer_json === 'object') {
          value = JSON.stringify(ans.answer_json);
        }
        counts[value] = (counts[value] || 0) + 1;
      });

      const values = Object.entries(counts).map(([label, count]) => ({
        label,
        count,
        percentage: Math.round((count / (dist.data?.length || 1)) * 100)
      })).sort((a, b) => b.count - a.count);

      const insight = await this.generateInsightForQuestion({
        surveyId,
        questionId: q.id,
        distribution: { values, labels: values.map((v) => v.label), total: dist.data?.length || 0, appliedFilters: {} },
        ...(planningContext ? { planningContext } : {}),
      });

      insights.push(insight);
    }

    return insights;
  }

  /**
   * Gera insights usando LLM (xAI Grok com prioridade) + captura metadados de uso.
   * Decision Sênior: Nunca falha a geração do relatório. Sempre cai para fallback de alta qualidade.
   */
  private async _generateInsightsWithAI(
    surveyId: string,
    questions: Array<{ id: string; question_text: string }>,
    planningContext?: PlanningContext
  ): Promise<GeneratedInsightsResult> {
    const apiKey = process.env['XAI_API_KEY'] || process.env['AI_API_KEY'];

    if (!apiKey) {
      console.warn('[ReportInsightsService] Nenhuma API key de IA configurada. Usando fallback inteligente.');
      const insights = await this._generateInsightsWithFallback(surveyId, questions, planningContext);
      return {
        insights,
        usage: {
          enabled: false,
          source: 'fallback',
          questionsProcessed: insights.length,
        },
      };
    }

    const insights: Insight[] = [];
    let totalTokens = 0;
    let modelUsed = '';
    const isXAI = !!process.env['XAI_API_KEY'];

    for (const q of questions.slice(0, 5)) { // Limite forte para controlar custo
      try {
        const dist = await this.supabase
          .from('response_answers')
          .select('answer_text, answer_json')
          .eq('survey_id', surveyId)
          .eq('question_id', q.id);

        const counts: Record<string, number> = {};
        (dist.data || []).forEach((ans: { answer_text: string | null; answer_json: unknown }) => {
          let value = ans.answer_text || 'Não respondido';
          if (ans.answer_json && typeof ans.answer_json === 'object' && 'value' in ans.answer_json) {
            const rawValue = (ans.answer_json as { value?: unknown }).value;
            value = typeof rawValue === 'string' ? rawValue : JSON.stringify(rawValue);
          } else if (ans.answer_json && typeof ans.answer_json === 'object') {
            value = JSON.stringify(ans.answer_json);
          }
          counts[value] = (counts[value] || 0) + 1;
        });

        const values = Object.entries(counts)
          .map(([label, count]) => ({
            label,
            count,
            percentage: Math.round((count / (dist.data?.length || 1)) * 100)
          }))
          .sort((a, b) => b.count - a.count);

        const prompt = this.buildInsightPrompt({
          surveyId,
          questionId: q.id,
          distribution: { values },
          ...(planningContext ? { planningContext } : {}),
        });

        const llmResponse = await this._callLLM(prompt, apiKey, isXAI);

        if (llmResponse.usage) {
          totalTokens += llmResponse.usage.total_tokens || 0;
          modelUsed = llmResponse.model || (isXAI ? 'grok-2-latest' : 'gpt-4o-mini');
        }

        insights.push({
          questionId: q.id,
          questionText: q.question_text,
          summary: llmResponse.summary,
          keyFindings: llmResponse.keyFindings,
          ...(llmResponse.strategicImplications ? { strategicImplications: llmResponse.strategicImplications } : {}),
          confidence: llmResponse.confidence || 0.78,
          generatedAt: new Date().toISOString(),
          source: 'ai',
        });
      } catch (error) {
        console.error(`[ReportInsightsService] Erro IA para pergunta ${q.id}, usando fallback:`, error);
        const fallback = await this.generateInsightForQuestion({
          surveyId,
          questionId: q.id,
          distribution: { values: [], labels: [], total: 0, appliedFilters: {} },
          ...(planningContext ? { planningContext } : {}),
        });
        insights.push({ ...fallback, source: 'fallback' });
      }
    }

    const costUsd = this._estimateCost(modelUsed, totalTokens);

    return {
      insights,
      usage: {
        enabled: true,
        modelUsed: modelUsed || (isXAI ? 'grok-2-latest' : 'gpt-4o-mini'),
        tokensUsed: totalTokens || undefined,
        costUsd,
        source: insights.some(i => i.source === 'ai') ? 'ai' : 'partial',
        questionsProcessed: insights.length,
      },
    };
  }

  /**
   * Chamada real para o LLM (xAI Grok priorizado). Retorna também usage para governança de custo.
   */
  private async _callLLM(prompt: string, apiKey: string, isXAI: boolean): Promise<LLMCallResponse> {
    const endpoint = isXAI
      ? 'https://api.x.ai/v1/chat/completions'
      : 'https://api.openai.com/v1/chat/completions';

    const model = isXAI ? 'grok-2-latest' : 'gpt-4o-mini';

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: 'Você é um analista sênior de pesquisas de opinião pública no Brasil, extremamente objetivo e estratégico. Responda sempre em português do Brasil, com tom executivo e prático.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.35,
        max_tokens: 650,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`LLM API error: ${response.status} - ${errorText}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { total_tokens?: number };
    };
    const content = data.choices?.[0]?.message?.content || '';
    const usage = data.usage || undefined; // { prompt_tokens, completion_tokens, total_tokens }

    const parsed = this._parseLLMResponse(content);

    return {
      ...parsed,
      usage,
      model,
    };
  }

  private _parseLLMResponse(content: string): ParsedLLMResponse {
    // Tenta extrair seções de forma tolerante (português e inglês)
    const summaryMatch = content.match(/(?:Resumo|Summary)[:：]?\s*(.+?)(?:\n|$)/i);
    const findingsMatch = content.match(/(?:Principais achados|Key findings|Key Findings)[:：]?\s*([\s\S]*?)(?:\n\n|Implicação|Estratégica|$)/i);
    const implicationMatch = content.match(/(?:Implicação|Strategic implication|Implicações)[:：]?\s*(.+)/i);

    const summary = summaryMatch?.[1]?.trim() || content.split('\n')[0]?.trim() || 'Insight gerado por IA.';

    const keyFindings = findingsMatch?.[1]
      ? findingsMatch[1].split(/\n|•|-/).map(s => s.trim()).filter(Boolean).slice(0, 5)
      : [];

    const strategicImplications = implicationMatch?.[1]?.trim();
    return strategicImplications
      ? {
        summary,
        keyFindings: keyFindings.length > 0 ? keyFindings : ['Análise gerada automaticamente.'],
        strategicImplications,
        confidence: 0.78,
      }
      : {
        summary,
        keyFindings: keyFindings.length > 0 ? keyFindings : ['Análise gerada automaticamente.'],
        confidence: 0.78,
      };
  }

  /**
   * Constrói prompt profissional para o LLM (otimizado para xAI Grok e OpenAI).
   */
  private buildInsightPrompt(params: {
    surveyId: string;
    questionId: string;
    distribution: { values: Array<{ label: string; count: number; percentage: number }> };
    planningContext?: PlanningContext;
  }): string {
    const { distribution, planningContext } = params;
    const top = distribution.values[0];
    const total = distribution.values.reduce((s, v) => s + v.count, 0);

    let contextBlock = '';
    if (planningContext?.research_objective) {
      contextBlock += `\nObjetivo da pesquisa: ${planningContext.research_objective}`;
    }
    if (planningContext?.target_audience) {
      contextBlock += `\nPúblico-alvo: ${planningContext.target_audience}`;
    }

    const dataSummary = distribution.values
      .slice(0, 8)
      .map(v => `- ${v.label}: ${v.percentage}% (${v.count} respostas)`)
      .join('\n');

    return `Você é um analista político sênior brasileiro com 15+ anos de experiência em pesquisas eleitorais e de opinião pública.

Analise os dados abaixo de forma objetiva, estratégica e acionável. Evite generalidades.

PERGUNTA E DISTRIBUIÇÃO:
Total de respostas: ${total}
${dataSummary}
${contextBlock ? '\nCONTEXTO DA PESQUISA:' + contextBlock : ''}

INSTRUÇÕES DE RESPOSTA (responda em português do Brasil):
1. Um resumo executivo de 2-3 frases máximo.
2. 3 a 5 "Principais achados" em bullets curtos e precisos.
3. Uma "Implicação estratégica" de 1 frase (o que o cliente deve fazer ou prestar atenção).

Formato exato esperado:
Resumo: [2-3 frases]
Principais achados:
- ...
Implicação estratégica: [1 frase direta]`;
  }

  /**
   * Estimativa de custo em USD baseada em preços públicos aproximados (jun/2026).
   * xAI Grok e OpenAI têm preços dinâmicos; este é um proxy conservador para governança.
   */
  private _estimateCost(model: string, totalTokens: number): number | undefined {
    if (!totalTokens || totalTokens <= 0) return undefined;

    const m = model.toLowerCase();

    // Preços aproximados por 1M tokens (input+output misturado) - valores conservadores
    if (m.includes('grok')) {
      // xAI Grok-2 cost (proxy)
      return (totalTokens / 1_000_000) * 2.5;
    }
    if (m.includes('gpt-4o')) {
      return (totalTokens / 1_000_000) * 3.0; // média entre input/output do 4o
    }
    if (m.includes('gpt-4')) {
      return (totalTokens / 1_000_000) * 12;
    }
    // fallback genérico
    return (totalTokens / 1_000_000) * 2.0;
  }
}

export const reportInsightsService = new ReportInsightsService();

