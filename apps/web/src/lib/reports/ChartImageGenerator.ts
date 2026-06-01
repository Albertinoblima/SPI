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

  private escapeXml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private polarToCartesian(cx: number, cy: number, radius: number, angleInDegrees: number) {
    const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180;
    return {
      x: cx + radius * Math.cos(angleInRadians),
      y: cy + radius * Math.sin(angleInRadians),
    };
  }

  private describeArc(cx: number, cy: number, radius: number, startAngle: number, endAngle: number): string {
    const start = this.polarToCartesian(cx, cy, radius, endAngle);
    const end = this.polarToCartesian(cx, cy, radius, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
    return [
      `M ${cx} ${cy}`,
      `L ${start.x} ${start.y}`,
      `A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`,
      'Z',
    ].join(' ');
  }

  private renderBarChartSvg(data: ChartDataPoint[], width: number, height: number, colors: string[], showPercentages: boolean, title?: string): string {
    const margin = { top: 50, right: 30, bottom: 110, left: 60 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;
    const maxValue = Math.max(1, ...data.map((point) => point.count));
    const barGap = Math.max(12, Math.floor(chartWidth * 0.02));
    const barWidth = Math.max(24, Math.floor((chartWidth - barGap * Math.max(data.length - 1, 0)) / Math.max(data.length, 1)));

    const bars = data.map((point, index) => {
      const barHeight = Math.round((point.count / maxValue) * chartHeight);
      const x = margin.left + index * (barWidth + barGap);
      const y = margin.top + chartHeight - barHeight;
      const valueLabel = showPercentages && point.percentage !== undefined
        ? `${point.count} (${point.percentage.toFixed(1)}%)`
        : `${point.count}`;

      return [
        `<rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="6" fill="${colors[index % colors.length]}" />`,
        `<text x="${x + barWidth / 2}" y="${y - 10}" text-anchor="middle" font-size="12" fill="#0f172a">${this.escapeXml(valueLabel)}</text>`,
        `<text x="${x + barWidth / 2}" y="${margin.top + chartHeight + 18}" text-anchor="end" transform="rotate(-35 ${x + barWidth / 2} ${margin.top + chartHeight + 18})" font-size="12" fill="#334155">${this.escapeXml(point.label)}</text>`,
      ].join('');
    }).join('');

    const gridLines = Array.from({ length: 5 }, (_, index) => {
      const value = Math.round((maxValue / 4) * index);
      const y = margin.top + chartHeight - Math.round((value / maxValue) * chartHeight);
      return [
        `<line x1="${margin.left}" y1="${y}" x2="${margin.left + chartWidth}" y2="${y}" stroke="#e2e8f0" stroke-width="1" />`,
        `<text x="${margin.left - 10}" y="${y + 4}" text-anchor="end" font-size="11" fill="#64748b">${value}</text>`,
      ].join('');
    }).join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        <rect width="100%" height="100%" fill="#ffffff" />
        ${title ? `<text x="${width / 2}" y="28" text-anchor="middle" font-size="18" font-weight="700" fill="#0f172a">${this.escapeXml(title)}</text>` : ''}
        ${gridLines}
        <line x1="${margin.left}" y1="${margin.top + chartHeight}" x2="${margin.left + chartWidth}" y2="${margin.top + chartHeight}" stroke="#94a3b8" stroke-width="1.5" />
        <line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${margin.top + chartHeight}" stroke="#94a3b8" stroke-width="1.5" />
        ${bars}
      </svg>`;
  }

  private renderPieChartSvg(data: ChartDataPoint[], width: number, height: number, colors: string[], title?: string): string {
    const total = Math.max(1, data.reduce((sum, point) => sum + point.count, 0));
    const cx = Math.round(width * 0.32);
    const cy = Math.round(height * 0.52);
    const radius = Math.min(150, Math.floor(Math.min(width, height) * 0.25));
    const legendX = Math.round(width * 0.62);
    const legendY = 90;

    let startAngle = 0;
    const slices = data.map((point, index) => {
      const sliceAngle = (point.count / total) * 360;
      const endAngle = startAngle + sliceAngle;
      const path = this.describeArc(cx, cy, radius, startAngle, endAngle);
      const midAngle = startAngle + sliceAngle / 2;
      const labelPosition = this.polarToCartesian(cx, cy, radius * 0.68, midAngle);
      const percentage = ((point.count / total) * 100).toFixed(1);
      const sliceMarkup = [
        `<path d="${path}" fill="${colors[index % colors.length]}" stroke="#ffffff" stroke-width="2" />`,
        sliceAngle >= 18
          ? `<text x="${labelPosition.x}" y="${labelPosition.y}" text-anchor="middle" font-size="12" fill="#ffffff" font-weight="700">${percentage}%</text>`
          : '',
      ].join('');
      startAngle = endAngle;
      return sliceMarkup;
    }).join('');

    const legend = data.map((point, index) => {
      const percentage = ((point.count / total) * 100).toFixed(1);
      const rowY = legendY + index * 28;
      return `
        <rect x="${legendX}" y="${rowY - 11}" width="14" height="14" rx="3" fill="${colors[index % colors.length]}" />
        <text x="${legendX + 22}" y="${rowY}" font-size="12" fill="#334155">${this.escapeXml(point.label)}: ${point.count} (${percentage}%)</text>`;
    }).join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        <rect width="100%" height="100%" fill="#ffffff" />
        ${title ? `<text x="${width / 2}" y="28" text-anchor="middle" font-size="18" font-weight="700" fill="#0f172a">${this.escapeXml(title)}</text>` : ''}
        ${slices}
        ${legend}
      </svg>`;
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

    const svg = this.renderBarChartSvg(data, width, height, colors, showPercentages, options.title);

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

    const svg = this.renderPieChartSvg(data, width, height, colors, options.title);

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