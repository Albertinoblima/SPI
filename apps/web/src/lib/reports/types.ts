/**
 * Tipos centralizados para o módulo de Relatórios Avançados
 * 
 * Decisão: Manter todos os tipos de relatório aqui para consistência
 * entre o gerador .docx e o dashboard dinâmico.
 */

export type ReportType = 'synthetic' | 'analytical' | 'consolidated';

export type PageSize = 'A4' | 'Letter' | 'A3';
export type PageOrientation = 'portrait' | 'landscape';
export type PaperType = 'standard' | 'recycled' | 'premium';

export interface ReportMargins {
  top: number;    // cm
  bottom: number;
  left: number;
  right: number;
}

export interface CoverTemplateConfig {
  templateId?: string;
  customImages?: {
    cityImageUrl?: string;
    collectionPointsMapUrl?: string;
  };
  primaryColor?: string;
  secondaryColor?: string;
}

export interface ReportConfiguration {
  id?: string;
  surveyId: string;
  tenantId: string;
  name: string;
  reportType: ReportType;

  // Configurações de impressão
  pageSize: PageSize;
  pageOrientation: PageOrientation;
  paperType: PaperType;
  margins: ReportMargins;

  // Capa
  cover: CoverTemplateConfig;

  // Conteúdo
  includeTableOfContents: boolean;
  includeMethodology: boolean;
  includePlanningMetadata: boolean;

  // Para relatório analítico
  selectedCrossings?: Array<{
    variables: string[]; // ex: ["gender", "age_group", "zone"]
    title?: string;
  }>;

  // Estilo
  headingStyle: 'microsoft_word' | 'clean' | 'formal';
  colorScheme: string;

  createdAt?: string;
  updatedAt?: string;
}

// Tipos para o Dashboard Dinâmico
export interface VisualizationPreference {
  preferredChartType?: 'bar' | 'pie' | 'line' | 'table' | 'horizontal_bar' | 'stacked_bar';
  options?: Record<string, string | number | boolean>;
}

export interface CrossTabResult {
  variables: string[];
  rows: Array<Record<string, string | number | boolean | null>>;
  total: number;
}

export interface DynamicDashboardData {
  surveyId: string;
  totalResponses: number;
  lastUpdated: string;
  availableCrossings: string[][];
  results: CrossTabResult[];
  availableLocalities?: LocalityOption[];
  availableDimensions?: {
    questions?: Array<{ id: string; label: string; name?: string }>;
    [key: string]: unknown;
  };
}

// Tipos para compartilhamento público
export interface ReportShare {
  id: string;
  surveyId: string;
  reportConfigurationId?: string;
  accessType: 'protected' | 'public';
  shareToken: string;
  contractorEmail?: string;
  contractorName?: string;
  expiresAt?: string;
  isActive: boolean;
  createdAt: string;
}

export interface ContractorCredentials {
  email: string;
  password: string; // apenas no input
  name?: string;
}

// ============================================================================
// TIPOS PARA DADOS DE ENTRADA DOS GERADORES DE RELATÓRIO (Fase 3 - Type Safety)
// ============================================================================

/**
 * Estrutura de dados que os geradores (Docx/Pdf) esperam receber.
 * Substitui o uso de `any` no surveyData.
 */
export interface ReportSurveyData {
  surveyId: string;
  tenantId: string;
  title: string;
  filters?: ReportFilters;
  planning?: PlanningContext | null;
  questions?: Array<{
    id: string;
    question_text: string;
    question_type: string;
    preferred_visualization?: string;
    [key: string]: unknown;
  }>;
  totals?: {
    totalResponses: number;
    [key: string]: unknown;
  };
  completionRate?: number;
  distributions?: DistributionItem[];
  crossTabs?: CrossTabRow[];
  reportType?: ReportType | string;
  premises?: Array<Record<string, unknown>>;
  insights?: GeneratedInsight[] | null;
  aiUsage?: AIUsageMetadata | null;
  generatedAt?: string;
  totalResponses?: number;
  quotasSummary?: {
    rows: QuotasSummaryItem[];
  };
  distribution?: DistributionItem[];
  crossResults?: Array<{
    variables: string[];
    rows: CrossTabRow[];
    total: number;
  }>;
  planningContext?: PlanningContext;
}

/**
 * Configuração estendida usada internamente pelos geradores.
 */
export interface InternalReportConfig extends ProfessionalReportConfiguration {
  selectedPremises?: string[];
  includeLocalityCross?: boolean;
  useAIInsights?: boolean;
  filters?: ReportFilters;
}

// ============================================================================
// TIPOS PARA O ADVANCED REPORT AGGREGATION SERVICE (Fase 0+)
// ============================================================================

/**
 * Filtros avançados para agregações e cruzamentos profissionais.
 * Projetado para suportar o Relatório Sintético, Analítico e Consolidado de alta qualidade.
 */
export interface ReportFilters {
  // Filtro por localidade (múltiplas)
  localityIds?: string[] | undefined;

  // Filtro por zona (urban / rural / mixed)
  zones?: Array<'urban' | 'rural' | 'mixed'>;

  // Filtro por premissas (ex: sexo, faixa_etaria, escolaridade)
  // Chave = category da survey_premises, Valor = array de valores selecionados
  premises?: Record<string, string[]> | undefined;

  // Filtro por período de coleta
  dateFrom?: string; // ISO date
  dateTo?: string;   // ISO date

  // Filtro por entrevistador
  interviewerIds?: string[];

  // Filtro por status da resposta
  onlyComplete?: boolean | undefined; // default true
}

/**
 * Resultado de distribuição com filtros aplicados.
 */
export interface FilteredDistributionResult {
  labels: string[];
  values: DistributionItem[];
  total: number;
  appliedFilters: ReportFilters;
  metadata?: {
    cacheKey?: string;
    executionTimeMs?: number;
  };
}

/**
 * Resultado de cruzamento avançado (suporta múltiplas dimensões + filtros).
 */
export interface AdvancedCrossTabResult {
  dimensions: string[];
  rows: CrossTabRow[];
  total: number;
  appliedFilters: ReportFilters;
  metadata?: {
    cacheKey?: string;
    executionTimeMs?: number;
    warning?: string;
  };
}

/**
 * Opções de execução para o serviço de agregação.
 */
export interface AggregationOptions {
  useCache?: boolean;
  timeoutMs?: number;
  maxRows?: number; // proteção contra resultados muito grandes
}

// ============================================================================
// TIPOS PARA DADOS DE AGREGAÇÃO (usados pelos geradores - Fase 3)
// ============================================================================

export interface QuotasSummaryItem {
  locality_id: string;
  locality_name?: string;
  quota_total: number;
  completed: number;
  percentage?: number;
  locality?: string;
  planned?: number;
  realized?: number;
}

export interface DistributionItem {
  label: string;
  count: number;
  value?: number;
  percentage: number;
}

export interface CrossTabRow {
  [key: string]: string | number | boolean | null | undefined;
}

// ============================================================================
// TIPOS PARA DADOS DINÂMICOS DE RESPOSTAS (Fase 3)
// ============================================================================

/**
 * Representação tipada (tanto quanto possível) do campo answer_json em response_answers.
 * Usado para evitar `any` quando lidamos com respostas complexas (ex: rating, matrix, etc.).
 */
export type AnswerJsonValue =
  | string
  | number
  | boolean
  | string[]
  | null
  | { value: string | number | boolean; label?: string }
  | Record<string, unknown>;

/**
 * Estrutura de uma resposta individual vinda do banco.
 */
export interface ResponseAnswerRow {
  response_id: string;
  question_id: string;
  answer_text?: string | null;
  answer_number?: number | null;
  answer_date?: string | null;
  answer_json?: AnswerJsonValue;
  created_at: string;
}

// ============================================================================
// TIPOS PARA GOVERNANÇA DE USO DE IA NOS RELATÓRIOS (Fase 4)
// ============================================================================

/**
 * Metadados de uso de IA retornados após geração de insights.
 * Usado para persistir em report_generation_jobs e auditoria de custos.
 */
export interface AIUsageMetadata {
  enabled: boolean;
  modelUsed?: string | undefined;
  tokensUsed?: number | undefined;
  costUsd?: number | undefined;
  generationTimeMs?: number | undefined;
  generatedAt?: string | undefined;
  source: 'ai' | 'fallback' | 'partial';
  questionsProcessed: number;
}

// ============================================================================
// TIPOS PARA O DYNAMIC REPORT PANEL (Fase 3 - Type Safety)
// ============================================================================

export interface PremiseOption {
  id: string;
  category: string;
  label: string;
  mapped_question_id?: string | null;
  options?: Record<string, unknown>;
}

export interface LocalityOption {
  id: string;
  name: string;
  zone?: string;
}

export interface DynamicAnalysisResult {
  rows?: Array<Record<string, string | number | boolean | null>>;
  values?: Array<{ label: string; count: number; percentage?: number }>;
  total?: number;
  dimensions?: string[];
}

/**
 * Resultado estendido de geração de insights que inclui tanto os insights
 * quanto os metadados de consumo de IA (para rastreamento no JobService).
 */
export interface GeneratedInsight {
  questionId?: string;
  questionText?: string;
  summary?: string;
  keyFindings?: string[];
  strategicImplications?: string;
  confidence: number;
  generatedAt?: string;
  source?: 'ai' | 'manual' | 'cached' | 'fallback';
  title?: string;
  description?: string;
  supportingData?: Record<string, unknown>;
}

export interface GeneratedInsightsResult {
  insights: GeneratedInsight[];
  usage: AIUsageMetadata;
}

/**
 * Contexto de planejamento vindo do Job ou da pesquisa.
 * Usado nos geradores e em insights.
 */
export interface PlanningContext {
  objective?: string;
  sample_size?: number | string;
  methodology?: string;
  survey_type?: string;
  research_objective?: string;
  target_audience?: string;
  tenant_id?: string;
  sampleSize?: number;
  confidenceLevel?: number;
  marginError?: number;
}

/**
 * Extensão de ReportConfiguration para suportar flags de IA e seleção de premissas.
 * (Usado no snapshot do job e no fluxo de geração).
 */
export interface ProfessionalReportConfiguration extends ReportConfiguration {
  // Seleção de premissas para cruzamentos (Analítico + Consolidado)
  selectedPremises?: string[];
  includeLocalityCross?: boolean;

  // Formato de saída
  format?: 'docx' | 'pdf';

  // Governança de IA (apenas relevante para 'consolidated')
  useAIInsights?: boolean;

  // Filtros avançados (passados via ReportFilters no job)
  filters?: ReportFilters;
}