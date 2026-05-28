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

import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import type { ReportConfiguration } from './types';

export class DocxReportGenerator {
  async generate(config: ReportConfiguration, data: any): Promise<Buffer> {
    // Implementação inicial básica.
    // Será expandida significativamente na Fase 2.

    const doc = new Document({
      styles: {
        default: {
          document: {
            styles: {
              paragraphStyles: [
                {
                  id: 'Title',
                  name: 'Title',
                  basedOn: 'Normal',
                  run: { size: 56, bold: true, font: 'Arial' },
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
              size: { width: 11906, height: 16838 }, // A4
              margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 },
            },
          },
          children: [
            new Paragraph({
              heading: HeadingLevel.TITLE,
              children: [new TextRun({ text: config.name, bold: true })],
            }),
            new Paragraph({
              children: [new TextRun({ text: `Tipo: ${config.reportType}` })],
            }),
            new Paragraph({
              children: [new TextRun({ text: 'Relatório gerado automaticamente pelo iDialog SPI' })],
            }),
            // TODO: Adicionar sumário, metadados do planejamento, tabelas, etc.
          ],
        },
      ],
    });

    return await Packer.toBuffer(doc);
  }
}

export const docxReportGenerator = new DocxReportGenerator();