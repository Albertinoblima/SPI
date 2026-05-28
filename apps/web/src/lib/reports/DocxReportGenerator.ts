/**
 * DocxReportGenerator - Advanced Professional Report Generator
 * 
 * Suporta os requisitos do usuário:
 * - Três tipos de relatório (Sintético, Analítico, Consolidado)
 * - Uso de metadados do Planejamento (5 passos)
 * - Estrutura preparada para modelos de capa + papel timbrado (usando company_assets)
 * - Sumário, tipografia hierárquica e paginação
 * 
 * Decisões de arquitetura:
 * - Gerar documento completo em memória usando `docx`
 * - Manter o gerador agnóstico de UI (configuração vem de fora)
 * - Futuro: Suporte a upload de imagens para capa (mapa, cidade, etc.)
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

    // === CAPA PROFISSIONAL ===
    children.push(
      new Paragraph({ spacing: { after: 120 }, children: [] }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: surveyData.title || 'Relatório de Pesquisa', bold: true, size: 56 })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 60 },
        children: [new TextRun({ text: this.getReportTypeLabel(config.reportType), size: 28, italics: true })],
      }),
      new Paragraph({ spacing: { after: 200 }, children: [] }),
    );

    // Letterhead / Logo da empresa (preparado para usar company_assets)
    if (surveyData.tenant?.logo_url) {
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 150 },
          children: [new TextRun({ text: '[Logo da Empresa - Papel Timbrado]', size: 20, color: '666666' })],
        })
      );
    } else {
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 120 },
          children: [new TextRun({ text: '[Espaço para Logo / Papel Timbrado da Empresa]', size: 18, color: '999999', italics: true })],
        })
      );
    }

    // Placeholder para imagem da cidade / mapa de coleta na capa (requisito do usuário)
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 100 },
        children: [new TextRun({ text: '[Espaço para Imagem da Cidade / Mapa com Pontos de Coleta]', size: 16, color: 'AAAAAA', italics: true })],
      })
    );

    // === METADADOS DO PLANEJAMENTO (vindos do wizard de 5 passos) ===
    if (config.includePlanningMetadata && surveyData.planning) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun('1. Dados do Planejamento')],
        }),
        new Paragraph({ children: [new TextRun(`Objetivo: ${surveyData.planning.objective || 'Não informado'}`)] }),
        new Paragraph({ children: [new TextRun(`Amostra: ${surveyData.planning.sample_size || 'N/A'} entrevistas`)] }),
        new Paragraph({ children: [new TextRun(`Tipo de pesquisa: ${surveyData.planning.survey_type || 'N/A'}`)] }),
        new Paragraph({ children: [new TextRun(`Base geográfica e cotas definidas no planejamento.`)] }),
      );
    }

    // Metodologia (vinda do planejamento)
    if (config.includeMethodology && surveyData.planning?.methodology) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun('Metodologia')],
        }),
        new Paragraph({ children: [new TextRun(surveyData.planning.methodology)] }),
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
              children: [new TextRun(`Total de respostas: ${crossData.total}`)],
            })
          );

          // Tabela simples de cruzamento
          if (crossData.rows.length > 0) {
            const tableRows = crossData.rows.slice(0, 15).map((row: any) => 
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun(String(Object.values(row)[0] || '')) ] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun(String(Object.values(row)[1] || '')) ] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun(String(row.count)) ] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun(String(row.percentage) + '%') ] })] }),
                ],
              })
            );

            children.push(
              new Table({
                rows: [
                  new TableRow({
                    children: ['Variável 1', 'Variável 2', 'Quantidade', '%'].map(h => 
                      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })] })] })
                    ),
                  }),
                  ...tableRows,
                ],
              })
            );
          }
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

  /**
   * Helper para gerar conteúdo específico por tipo de relatório.
   * Esta é a área principal de evolução para entregar os três tipos de forma completa.
   */
  private async buildContentByType(config: ReportConfiguration, surveyData: any): Promise<any[]> {
    const children: any[] = [];
    const totals = await reportAggregationService.getBasicTotals(config.surveyId);

    if (config.reportType === 'synthetic' || config.reportType === 'consolidated') {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun('Estatísticas Gerais (Sintético)')],
        }),
        new Paragraph({ children: [new TextRun(`Total de entrevistas realizadas: ${totals.totalResponses}`)] }),
        new Paragraph({ children: [new TextRun('Resumo executivo com os principais indicadores da pesquisa.')] }),
      );
    }

    if (config.reportType === 'analytical' || config.reportType === 'consolidated') {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun('Análise por Cruzamentos (Selecionados pelo Pesquisador)')],
        })
      );

      if (config.selectedCrossings && config.selectedCrossings.length > 0) {
        for (const crossing of config.selectedCrossings) {
          const crossData = await reportAggregationService.getCrossTab(
            config.surveyId, 
            crossing.variables[0], 
            crossing.variables[1]
          );

          children.push(
            new Paragraph({
              heading: HeadingLevel.HEADING_2,
              children: [new TextRun(crossing.title || `Cruzamento: ${crossing.variables.join(' × ')}`)],
            }),
            new Paragraph({ children: [new TextRun(`Total de respostas válidas: ${crossData.total}`)] }),
          );

          if (crossData.rows.length > 0) {
            const tableRows = [
              new TableRow({
                children: ['Variável 1', 'Variável 2', 'Qtd', '%'].map(h => 
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 18 })] })] })
                ),
              }),
              ...crossData.rows.slice(0, 8).map((row: any) => 
                new TableRow({
                  children: Object.values(row).map((val: any) => 
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(val), size: 18 })] })] })
                  ),
                })
              ),
            ];

            children.push(new Table({ rows: tableRows }));
          }
        }
      } else {
        children.push(new Paragraph({ children: [new TextRun('Nenhum cruzamento foi selecionado para análise.')] }));
      }
    }

    return children;
  }
}

export const docxReportGenerator = new DocxReportGenerator();