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
  options?: Record<string, any>;
}

export interface CrossTabResult {
  variables: string[];
  rows: Array<Record<string, any>>;
  total: number;
}

export interface DynamicDashboardData {
  surveyId: string;
  totalResponses: number;
  lastUpdated: string;
  availableCrossings: string[][];
  results: CrossTabResult[];
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