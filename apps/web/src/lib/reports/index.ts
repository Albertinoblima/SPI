/**
 * Barrel export para o módulo de Relatórios Profissionais
 * 
 * Uso recomendado:
 * import { 
 *   advancedReportAggregationService, 
 *   chartImageGenerator,
 *   reportJobService 
 * } from '@/lib/reports';
 */

// Serviços principais
export { ReportAggregationService, reportAggregationService } from './ReportAggregationService';
export { AdvancedReportAggregationService, advancedReportAggregationService } from './AdvancedReportAggregationService';
export { ChartImageGenerator, chartImageGenerator } from './ChartImageGenerator';
export { ReportJobService, reportJobService } from './ReportJobService';
export { DocxReportGenerator, docxReportGenerator } from './DocxReportGenerator';
export { ReportInsightsService, reportInsightsService } from './ReportInsightsService';
export { PdfReportGenerator, pdfReportGenerator } from './PdfReportGenerator';

// Tipos
export * from './types';

// Serviços de acesso público (mantidos para compatibilidade)
export { PublicReportAccessService, publicReportAccessService } from './PublicReportAccessService';