/**
 * ChartImageGenerator
 *
 * Responsável por gerar imagens de alta qualidade (PNG) a partir de dados de perguntas
 * para embutir nos relatórios .docx profissionais.
 *
 * Decisão Arquitetural (Sênior - Fase 0.4):
 * - Usar Recharts para renderizar SVG (já temos no projeto)
 * - Converter SVG → PNG de alta resolução usando Sharp (já temos no projeto)
 * - Suportar os tipos de visualização definidos em preferred_visualization
 * - Gerar imagens com DPI adequado para impressão (mínimo 150-200 DPI)
 *
 * Alternativas avaliadas:
 * - chartjs-node-canvas → boa, mas perderíamos consistência visual com o frontend
 * - Puppeteer/Playwright → qualidade excelente, mas muito pesado para servidor de relatórios
 * - Solução atual (Recharts + Sharp) → melhor equilíbrio qualidade x peso x consistência
 */

import sharp from 'sharp';
import { createElement } from 'react';
import type { ElementType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

export interface ChartDataPoint {
  label: string;
  count: number;
  percentage?: number;
}

export interface GenerateChartOptions {
  width?: number;        // pixels
  height?: number;
  dpi?: number;          // para impressão (padrão 150)
  colors?: string[];
  title?: string;
  showPercentages?: boolean;
}

export class ChartImageGenerator {
  private readonly defaultColors = [
    '#2563eb', '#16a34a', '#dc2626', '#ca8a04', '#7c3aed',
    '#0891b2', '#be185d', '#4d7c0f', '#b45309', '#4338ca'
  ];

  private asComponent(component: unknown): ElementType {
    return component as ElementType;
  }

  /**
   * Gera uma imagem PNG de gráfico de barras.
   * Ideal para single_choice e rating.
   */
  async generateBarChart(
    data: ChartDataPoint[],
    options: GenerateChartOptions = {}
  ): Promise<Buffer> {
    const {
      width = 900,
      height = 520,
      dpi = 150,
      colors = this.defaultColors,
      showPercentages = true,
    } = options;

    // Prepara dados para Recharts
    const chartData = data.map((d, index) => ({
      name: d.label,
      value: d.count,
      percentage: d.percentage,
      fill: colors[index % colors.length],
    }));

    // Renderiza SVG usando Recharts
    const svg = renderToStaticMarkup(
      createElement(
        'div',
        { style: { width, height } },
        createElement(
          this.asComponent(ResponsiveContainer),
          { width: '100%', height: '100%' },
          createElement(
            this.asComponent(BarChart),
            { data: chartData, margin: { top: 20, right: 30, left: 20, bottom: 80 } },
            createElement(this.asComponent(XAxis), { dataKey: 'name', angle: -35, textAnchor: 'end', height: 80 }),
            createElement(this.asComponent(YAxis)),
            createElement(this.asComponent(Tooltip)),
            createElement(this.asComponent(Legend)),
            createElement(this.asComponent(Bar), { dataKey: 'value', name: 'Quantidade' },
              chartData.map((entry, index) =>
                createElement(this.asComponent(Cell), { key: `cell-${index}`, fill: entry.fill })
              )
            )
          )
        )
      )
    );

    // Converte SVG para PNG de alta qualidade com Sharp
    const pngBuffer = await sharp(Buffer.from(svg))
      .resize(Math.round(width * (dpi / 96)), Math.round(height * (dpi / 96)))
      .png({ quality: 95 })
      .toBuffer();

    return pngBuffer;
  }

  /**
   * Gera gráfico de pizza (pie).
   * Recomendado apenas quando há poucas categorias (≤ 6-7).
   */
  async generatePieChart(
    data: ChartDataPoint[],
    options: GenerateChartOptions = {}
  ): Promise<Buffer> {
    const {
      width = 700,
      height = 520,
      dpi = 150,
      colors = this.defaultColors,
    } = options;

    const chartData = data.map((d, index) => ({
      name: d.label,
      value: d.count,
      fill: colors[index % colors.length],
    }));

    const svg = renderToStaticMarkup(
      createElement(
        'div',
        { style: { width, height } },
        createElement(
          this.asComponent(ResponsiveContainer),
          { width: '100%', height: '100%' },
          createElement(
            this.asComponent(PieChart),
            {},
            createElement(
              this.asComponent(Pie),
              { data: chartData, dataKey: 'value', nameKey: 'name', cx: '50%', cy: '50%', outerRadius: 160 },
              chartData.map((entry, index) =>
                createElement(this.asComponent(Cell), { key: `cell-${index}`, fill: entry.fill })
              )
            ),
            createElement(this.asComponent(Tooltip)),
            createElement(this.asComponent(Legend))
          )
        )
      )
    );

    const pngBuffer = await sharp(Buffer.from(svg))
      .resize(Math.round(width * (dpi / 96)), Math.round(height * (dpi / 96)))
      .png({ quality: 95 })
      .toBuffer();

    return pngBuffer;
  }

  /**
   * Método inteligente: escolhe o melhor tipo de gráfico baseado no tipo de pergunta
   * e na quantidade de categorias.
   */
  async generateBestChartForQuestion(
    data: ChartDataPoint[],
    questionType: string,
    preferredVisualization?: string,
    options: GenerateChartOptions = {}
  ): Promise<Buffer> {
    const categoryCount = data.length;

    // Respeita a preferência do pesquisador definida no Wizard
    if (preferredVisualization === 'pie' && categoryCount <= 7) {
      return this.generatePieChart(data, options);
    }

    if (preferredVisualization === 'horizontal_bar') {
      // TODO: Implementar horizontal bar (requer mais customização)
      return this.generateBarChart(data, options);
    }

    // Heurística padrão profissional
    if (questionType === 'single_choice' || questionType === 'rating') {
      if (categoryCount <= 6) {
        return this.generatePieChart(data, options);
      }
      return this.generateBarChart(data, options);
    }

    if (questionType === 'multiple_choice') {
      return this.generateBarChart(data, options); // Barras é mais legível para múltipla
    }

    // Fallback
    return this.generateBarChart(data, options);
  }
}

export const chartImageGenerator = new ChartImageGenerator();