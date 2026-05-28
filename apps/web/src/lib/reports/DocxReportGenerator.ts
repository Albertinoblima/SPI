/**
 * DocxReportGenerator
 * 
 * Serviço responsável pela geração do relatório .docx avançado.
 * 
 * Decisões tomadas:
 * - Usar biblioteca `docx` (já presente no projeto).
 * - Receber uma ReportConfiguration + dados agregados.
 * - Suportar os 3 tipos de relatório (synthetic, analytical, consolidated).
 * - Futuramente: integração com templates de capa e papel timbrado.
 */

import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, AlignmentType, PageBreak } from 'docx';
import type { ReportConfiguration } from './types';
import { reportAggregationService } from './ReportAggregationService';

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
  async generate(config: ReportConfiguration, surveyData: any): Promise<Buffer> {
    const children: any[] = [];

    // === CAPA ===
    children.push(
      new Paragraph({ spacing: { after: 400 }, children: [] }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: surveyData.title || 'Relatório de Pesquisa', bold: true, size: 48 })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 200 },
        children: [new TextRun({ text: `Tipo: ${this.getReportTypeLabel(config.reportType)}`, size: 24 })],
      }),
      new Paragraph({ spacing: { after: 600 }, children: [] }),
    );

    // === METADADOS DO PLANEJAMENTO ===
    if (config.includePlanningMetadata && surveyData.planning) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun('Dados do Planejamento')],
        }),
        new Paragraph({
          children: [new TextRun(`Objetivo: ${surveyData.planning.objective || 'Não informado'}`)],
        }),
        new Paragraph({
          children: [new TextRun(`Amostra: ${surveyData.planning.sample_size || 'N/A'} entrevistas`)],
        }),
      );
    }

    children.push(new Paragraph({ children: [new PageBreak()] }));

    // === CONTEÚDO POR TIPO DE RELATÓRIO ===
    if (config.reportType === 'synthetic' || config.reportType === 'consolidated') {
      const totals = await reportAggregationService.getBasicTotals(config.surveyId);

      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun('Estatísticas Gerais')],
        }),
        new Paragraph({
          children: [new TextRun(`Total de Entrevistas: ${totals.totalResponses}`)],
        }),
      );
    }

    if (config.reportType === 'analytical' || config.reportType === 'consolidated') {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun('Análise por Cruzamentos')],
        })
      );

      if (config.selectedCrossings && config.selectedCrossings.length > 0) {
        for (const crossing of config.selectedCrossings) {
          const [q1, q2] = crossing.variables;
          const crossData = await reportAggregationService.getCrossTab(config.surveyId, q1, q2);

          children.push(
            new Paragraph({
              heading: HeadingLevel.HEADING_2,
              children: [new TextRun(crossing.title || `Cruzamento: ${q1} × ${q2}`)],
            }),
            new Paragraph({
              children: [new TextRun(`Total de respostas no cruzamento: ${crossData.total}`)],
            }),
            // TODO: Adicionar tabela real com os dados do crossData.rows
          );
        }
      } else {
        children.push(new Paragraph({
          children: [new TextRun('Nenhum cruzamento selecionado para este relatório.')],
        }));
      }
    }

    // === SUMÁRIO (simplificado) ===
    if (config.includeTableOfContents) {
      children.unshift(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun('Sumário')],
        }),
        new Paragraph({ children: [new TextRun('1. Estatísticas Gerais')] }),
        new Paragraph({ children: [new TextRun('2. Análise por Cruzamentos')] }),
        new Paragraph({ children: [new PageBreak()] }),
      );
    }

    const doc = new Document({
      styles: {
        default: {
          document: {
            styles: {
              paragraphStyles: [
                {
                  id: 'Heading1',
                  name: 'Heading 1',
                  basedOn: 'Normal',
                  run: { size: 32, bold: true, font: 'Arial' },
                },
                {
                  id: 'Heading2',
                  name: 'Heading 2',
                  basedOn: 'Normal',
                  run: { size: 26, bold: true, font: 'Arial' },
                },
              ],
            },
          },
        },
      },
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
          children,
        },
      ],
    });

    return await Packer.toBuffer(doc);
  }

  private getReportTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      synthetic: 'Sintético (Básico)',
      analytical: 'Analítico',
      consolidated: 'Consolidado',
    };
    return labels[type] || type;
  }
}

export const docxReportGenerator = new DocxReportGenerator();