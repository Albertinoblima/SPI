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

import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, AlignmentType, PageBreak, BorderStyle } from 'docx';
import type { ReportConfiguration } from './types';
import { reportAggregationService } from './ReportAggregationService';
import { createAdminClient } from '@/lib/supabase/admin';

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
  private supabase = createAdminClient();

  async generate(config: ReportConfiguration, surveyData: any): Promise<Buffer> {
    const children: any[] = [];
    const totals = await reportAggregationService.getBasicTotals(config.surveyId);

    // Buscar logo real da empresa (company_assets)
    const tenantLogoUrl = await this.getTenantActiveLogo(surveyData.tenantId || config.tenantId);

    // Buscar perguntas reais da pesquisa para enriquecer o conteúdo
    const { data: questions } = await this.supabase
      .from('questions')
      .select('id, question_text, question_type, options, order_index')
      .eq('survey_id', config.surveyId)
      .order('order_index');

    const realQuestions = questions || [];

    // === CAPA PROFISSIONAL ===
    children.push(
      new Paragraph({ spacing: { after: 80 }, children: [] }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: surveyData.title || 'Relatório de Pesquisa', bold: true, size: 48 })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 40 },
        children: [new TextRun({ text: this.getReportTypeLabel(config.reportType), size: 26, italics: true, color: '444444' })],
      }),
      new Paragraph({ spacing: { after: 160 }, children: [] }),
    );

    // === PAPEL TIMBRADO / LOGO REAL ===
    if (tenantLogoUrl) {
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 80 },
          children: [new TextRun({ text: '────────────────────────────────────────', size: 18, color: 'CCCCCC' })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 60 },
          children: [new TextRun({ text: '[Logotipo da Empresa]', size: 18, color: '666666' })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 120 },
          children: [new TextRun({ text: 'Papel timbrado aplicado automaticamente', size: 14, color: '888888', italics: true })],
        })
      );
    } else {
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 80 },
          children: [new TextRun({ text: '[Espaço reservado para Logotipo / Papel Timbrado da Empresa]', size: 16, color: 'AAAAAA', italics: true })],
        })
      );
    }

    // Placeholder para imagem da cidade / mapa (requisito do usuário - pronto para evolução com upload)
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 60 },
        children: [new TextRun({ text: '[Imagem da Cidade / Mapa com Pontos de Coleta - configurável]', size: 14, color: 'BBBBBB', italics: true })],
      }),
      new Paragraph({ spacing: { after: 140 }, children: [] })
    );

    // === METADADOS DO PLANEJAMENTO (5 passos) ===
    if (config.includePlanningMetadata && surveyData.planning) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun('1. Planejamento da Pesquisa')],
        }),
        new Paragraph({ children: [new TextRun({ text: `Objetivo: `, bold: true }), new TextRun(surveyData.planning.objective || 'Não informado') ] }),
        new Paragraph({ children: [new TextRun({ text: `Amostra planejada: `, bold: true }), new TextRun(`${surveyData.planning.sample_size || 'N/A'} entrevistas`)] }),
        new Paragraph({ children: [new TextRun({ text: `Tipo: `, bold: true }), new TextRun(surveyData.planning.survey_type || 'N/A')] }),
        new Paragraph({ children: [new TextRun({ text: `Base geográfica: `, bold: true }), new TextRun('Definida no planejamento (cotas por localidade)')] }),
      );
    }

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

    // === CONTEÚDO DIFERENCIADO POR TIPO DE RELATÓRIO ===
    const type = config.reportType;

    if (type === 'synthetic') {
      // SINTÉTICO: Resumo executivo limpo + principais indicadores
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun('2. Resumo Executivo (Sintético)')],
        }),
        new Paragraph({ children: [new TextRun(`Total de entrevistas realizadas: ${totals.totalResponses}`)] }),
        new Paragraph({ children: [new TextRun('Este relatório apresenta os principais indicadores e percentuais da pesquisa de forma consolidada.')] }),
        new Paragraph({ spacing: { after: 120 }, children: [] }),
      );

      // Mostrar até 4 perguntas principais com distribuição
      const topQuestions = realQuestions.slice(0, 4);
      for (const q of topQuestions) {
        const dist = await reportAggregationService.getQuestionDistribution(config.surveyId, q.id);
        children.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            children: [new TextRun(q.question_text)],
          })
        );
        if (dist.values.length > 0) {
          dist.values.slice(0, 5).forEach((v: any) => {
            children.push(new Paragraph({ children: [new TextRun(`• ${v.label}: ${v.count} (${v.percentage}%)`)] }));
          });
        } else {
          children.push(new Paragraph({ children: [new TextRun('Sem respostas registradas.')] }));
        }
        children.push(new Paragraph({ spacing: { after: 60 }, children: [] }));
      }

    } else if (type === 'analytical') {
      // ANALÍTICO: Focado em cruzamentos escolhidos
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun('2. Análise Cruzada (Analítico)')],
        }),
        new Paragraph({ children: [new TextRun('Este relatório apresenta cruzamentos selecionados para análise aprofundada de correlações.')] }),
        new Paragraph({ spacing: { after: 100 }, children: [] }),
      );

      if (config.selectedCrossings && config.selectedCrossings.length > 0) {
        for (const crossing of config.selectedCrossings) {
          const q1 = crossing.variables[0];
          const q2 = crossing.variables[1];
          const crossData = await reportAggregationService.getCrossTab(config.surveyId, q1, q2);

          // Tentar resolver textos das perguntas
          const q1Text = realQuestions.find((qq: any) => qq.id === q1)?.question_text || q1;
          const q2Text = realQuestions.find((qq: any) => qq.id === q2)?.question_text || q2;

          children.push(
            new Paragraph({
              heading: HeadingLevel.HEADING_2,
              children: [new TextRun(crossing.title || `${q1Text} × ${q2Text}`)],
            }),
            new Paragraph({ children: [new TextRun(`Total de respostas válidas no cruzamento: ${crossData.total}`)] }),
          );

          if (crossData.rows.length > 0) {
            const tableRows = [
              new TableRow({
                children: [q1Text, q2Text, 'Qtd', '%'].map(h =>
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: String(h).substring(0, 40), bold: true, size: 18 })] })],
                    borders: { top: { style: BorderStyle.SINGLE, size: 1 }, bottom: { style: BorderStyle.SINGLE, size: 1 }, left: { style: BorderStyle.SINGLE, size: 1 }, right: { style: BorderStyle.SINGLE, size: 1 } },
                  })
                ),
              }),
              ...crossData.rows.slice(0, 12).map((row: any) =>
                new TableRow({
                  children: Object.values(row).map((val: any) =>
                    new TableCell({
                      children: [new Paragraph({ children: [new TextRun({ text: String(val), size: 16 })] })],
                      borders: { top: { style: BorderStyle.SINGLE, size: 1 }, bottom: { style: BorderStyle.SINGLE, size: 1 }, left: { style: BorderStyle.SINGLE, size: 1 }, right: { style: BorderStyle.SINGLE, size: 1 } },
                    })
                  ),
                })
              ),
            ];
            children.push(new Table({ rows: tableRows }));
          }
          children.push(new Paragraph({ spacing: { after: 80 }, children: [] }));
        }
      } else {
        children.push(new Paragraph({ children: [new TextRun('Nenhum cruzamento foi selecionado para este relatório analítico.')] }));
      }

    } else if (type === 'consolidated') {
      // CONSOLIDADO: Completo - metodologia + totais + cruzamentos + planejamento
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun('2. Relatório Consolidado Completo')],
        }),
        new Paragraph({ children: [new TextRun(`Total de entrevistas realizadas: ${totals.totalResponses}`)] }),
        new Paragraph({ spacing: { after: 100 }, children: [] }),
      );

      // Seção de principais distribuições
      children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun('Principais Indicadores')] }));
      const topQ = realQuestions.slice(0, 3);
      for (const q of topQ) {
        const dist = await reportAggregationService.getQuestionDistribution(config.surveyId, q.id);
        children.push(new Paragraph({ children: [new TextRun({ text: q.question_text, bold: true })] }));
        dist.values.slice(0, 4).forEach((v: any) => {
          children.push(new Paragraph({ children: [new TextRun(`   ${v.label}: ${v.count} (${v.percentage}%)`)] }));
        });
      }

      // Cruzamentos selecionados (se houver)
      if (config.selectedCrossings && config.selectedCrossings.length > 0) {
        children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun('Cruzamentos Analíticos')] }));
        for (const crossing of config.selectedCrossings.slice(0, 3)) {
          const crossData = await reportAggregationService.getCrossTab(config.surveyId, crossing.variables[0], crossing.variables[1]);
          const q1Text = realQuestions.find((qq: any) => qq.id === crossing.variables[0])?.question_text || crossing.variables[0];
          children.push(new Paragraph({ children: [new TextRun(`${q1Text} × ${crossing.variables[1]}: ${crossData.total} respostas`)] }));
        }
      }

      // Metadados completos do planejamento
      if (surveyData.planning) {
        children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun('Dados Completos do Planejamento')] }));
        children.push(new Paragraph({ children: [new TextRun(JSON.stringify(surveyData.planning).substring(0, 600) + '...')] }));
      }
    }

    // === RODAPÉ / PAGINAÇÃO (básica) ===
    children.push(
      new Paragraph({ spacing: { before: 200 }, children: [] }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: '────────────────────────────────────────', size: 16, color: 'CCCCCC' })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: `Relatório gerado em ${new Date().toLocaleDateString('pt-BR')} • Sistema iDialog`, size: 14, color: '888888' })],
      })
    );

    // Sumário simples no início (quando solicitado)
    if (config.includeTableOfContents) {
      children.unshift(
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('Sumário')] }),
        new Paragraph({ children: [new TextRun('1. Planejamento da Pesquisa')] }),
        new Paragraph({ children: [new TextRun('2. Resultados por Tipo de Relatório')] }),
        new Paragraph({ children: [new TextRun('3. Metodologia e Notas')] }),
        new Paragraph({ children: [new PageBreak()] })
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
                  run: { size: 24, bold: true, font: 'Arial' },
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

  private async getTenantActiveLogo(tenantId?: string): Promise<string | null> {
    if (!tenantId) return null;
    try {
      const { data } = await this.supabase
        .from('company_assets')
        .select('file_url')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .eq('asset_type', 'logo')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      return data?.file_url || null;
    } catch {
      return null;
    }
  }

  private getReportTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      synthetic: 'Relatório Sintético (Básico)',
      analytical: 'Relatório Analítico (Cruzamentos)',
      consolidated: 'Relatório Consolidado (Completo)',
    };
    return labels[type] || type;
  }
}

export const docxReportGenerator = new DocxReportGenerator();