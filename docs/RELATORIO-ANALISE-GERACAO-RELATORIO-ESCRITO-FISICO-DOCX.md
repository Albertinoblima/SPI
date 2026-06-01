# Relatório de Análise: Geração de Relatório Escrito (Físico) — .docx

**Data da Análise:** 2026-05-29  
**Sistema:** iDialog Pesquisa (political-research-platform)  
**Foco:** Módulo de Geração de Relatórios .docx (Relatórios Escrit os / Físicos para impressão)  
**Autor da Análise:** Grok (baseado em auditoria de código)

---

## 1. Resumo Executivo

A geração de **relatórios escritos (físicos)** via `.docx` está em **estado avançado de fundação técnica**, mas **longe de ser um produto profissional utilizável** para entrega ao contratante.

### Status Geral: **45-50%** (backend funcional + protótipo de geração)

O sistema consegue gerar documentos Word com estrutura básica dos 3 tipos de relatório, porém o resultado final é **muito aquém** do que um relatório de pesquisa profissional exige (capa pobre, sem imagens reais, tabelas cruas, sem paginação profissional, sem carta de apresentação, etc.).

**Conclusão principal:** A funcionalidade "existe" do ponto de vista de API, mas **não entrega valor real** hoje. O pesquisador não tem interface para gerar o relatório, e o documento produzido é mais um "rascunho técnico" do que um relatório impresso apresentável.

---

## 2. Arquitetura Atual

### Fluxo de Geração

```
Frontend (inexistente) 
  → POST /api/reports/[surveyId]/generate-docx
    → DocxReportGenerator.generate(config, surveyData)
      → ReportAggregationService (getBasicTotals + getQuestionDistribution + getCrossTab)
      → Supabase (questions + company_assets + planning_data)
    → Retorna Buffer .docx
```

### Componentes Principais

| Componente | Arquivo | Status |
|------------|---------|--------|
| Rota de geração | `src/app/api/reports/[surveyId]/generate-docx/route.ts` | Funcional |
| Gerador principal | `src/lib/reports/DocxReportGenerator.ts` | Funcional mas limitado |
| Motor de dados | `ReportAggregationService.ts` | Mesmo usado no dinâmico |
| Tipos | `src/lib/reports/types.ts` | Bom |
| Schema | Migração `20260528000001_reports_advanced_foundation.sql` | Bom (com ressalvas) |

---

## 3. O que Funciona Hoje

### 3.1 Três Tipos de Relatório

- **Synthetic** (Sintético): Resumo executivo + distribuições das 4 primeiras perguntas
- **Analytical** (Analítico): Focado em cruzamentos (`selectedCrossings`)
- **Consolidated** (Consolidado): Combina totais + cruzamentos + planejamento completo

### 3.2 Integração com Planejamento (Parcial)

O gerador busca:
- `planning_data` (objetivo, sample_size, survey_type, methodology)
- `survey_premises`
- Lista completa de `questions`

### 3.3 Configurações Suportadas (no schema e na API)

```ts
interface ReportConfiguration {
  reportType: 'synthetic' | 'analytical' | 'consolidated'
  pageSize: 'A4' | 'Letter' | 'A3'
  pageOrientation: 'portrait' | 'landscape'
  paperType: 'standard' | 'recycled' | 'premium'   // ← ignorado na geração
  margins: { top, bottom, left, right }            // ← aplicado
  includeTableOfContents, includeMethodology, includePlanningMetadata
  selectedCrossings: Array<{ variables: string[], title?: string }>
  headingStyle, colorScheme
  cover: { ... }                                   // ← pouco usado
}
```

### 3.4 Busca de Logo da Empresa

Consulta `company_assets` (via `getTenantActiveLogo`). Existe upload funcional em `/dashboard/settings`.

### 3.5 Geração Real de Arquivo

Usa biblioteca `docx` oficial → gera Buffer válido que pode ser baixado.

---

## 4. Gaps Críticos para Relatório Físico Profissional

### 4.1 Capa e Identidade Visual (Maior Problema)

**Problema grave:** O gerador **nunca insere imagens reais** no documento.

```ts
// Busca a URL...
const tenantLogoUrl = await this.getTenantActiveLogo(...);

// ...mas só coloca texto placeholder:
children.push(
  new Paragraph({ children: [new TextRun({ text: '[Logotipo da Empresa]', ... })] })
);
```

- Não usa `<Image>` do `docx` (a biblioteca suporta)
- Não embute o logo baixado
- Placeholder para "Imagem da Cidade / Mapa com Pontos de Coleta" também é só texto

**Requisito de mercado:** Relatório impresso com papel timbrado + logo na capa + foto da cidade é obrigatório para parecer profissional.

### 4.2 Tabelas de Cruzamento Muito Rudimentares

No tipo Analytical:

```ts
const tableRows = ...crossData.rows.slice(0, 12).map(...)
new Table({ rows: tableRows })
```

Problemas:
- Cabeçalhos ruins (usa IDs quando não encontra label)
- Sem formatação de percentuais
- Sem totais por linha/coluna
- Sem destaque de maior valor
- Limite arbitrário de 12 linhas (corta dados)
- Sem testes de significância estatística

### 4.3 Ausência de Elementos Essenciais de Relatório Físico

| Elemento Profissional          | Status Atual          | Impacto |
|--------------------------------|-----------------------|--------|
| Cabeçalho / Rodapé com logo em **todas** as páginas | Não existe | Alto |
| Numeração de páginas           | Não existe (só rodapé textual) | Alto |
| Sumário automático (real)      | Falso (texto estático) | Médio |
| Gráficos (barras, pizza)       | Zero (só texto + tabelas) | Crítico |
| Cartão de amostra (Planned vs Achieved por cota) | Não | Alto |
| Análise geográfica             | Não | Médio |
| Conclusões / Recomendações     | Não | Alto |
| Anexos (questionário completo) | Não | Médio |
| Metadados de confidencialidade | Não | Médio |

### 4.4 Dados do Planejamento Subutilizados

No route de geração:
```ts
premises: survey.survey_premises || [],
planning: survey.planning_data?.[0] || null,
```

No `DocxReportGenerator`:
- `premises` é **buscado mas nunca usado**
- `planning_data` do novo sistema (`research_plans`) é ignorado (código busca campo antigo direto na survey)
- Cotas detalhadas, distribuição por entrevistador, base geográfica rica — tudo desperdiçado

### 4.5 `paperType` é Mentira

O campo existe em `ReportConfiguration` e no schema, mas **nunca influencia** a geração do documento. É apenas metadado.

### 4.6 Sem UI para o Pesquisador

**Zero interface** para:
- Escolher tipo de relatório
- Selecionar cruzamentos específicos
- Configurar capa (escolher template)
- Definir margens / orientação / tamanho
- Fazer preview antes de gerar
- Salvar `report_configurations` e reutilizar

A única forma de gerar hoje é chamando a API diretamente com payload manual.

### 4.7 Inconsistência de Modelo de Planejamento

Existe migração de 27/05/2026 criando `research_plans` com `planning_data` JSONB + `linked_survey_id`.

O código de relatório ainda usa:
```sql
planning_data(*)
FROM surveys
```

Isso significa que relatórios gerados após a nova estrutura de planejamento podem vir **completamente vazios** de metadados.

### 4.8 Performance e Volume

Mesmo problema do relatório dinâmico:
- Busca todas as perguntas + todas as respostas de cada uma individualmente em loops `for`
- `getCrossTab` faz pivot em memória
- Para um relatório consolidado com 30 perguntas + 5 cruzamentos = dezenas de queries pesadas

---

## 5. Análise de Qualidade do Documento Gerado (Atual)

**Resultado típico hoje (sintético):**

1. Título centralizado grande
2. Tipo do relatório (itálico)
3. Linha decorativa + texto "[Logotipo da Empresa]"
4. Texto placeholder de mapa
5. Seção "1. Planejamento da Pesquisa" (muito básica)
6. Quebra de página
7. "2. Resumo Executivo" + 4 perguntas com bullets de texto
8. Rodapé genérico com data

**Avaliação de mercado:**  
Este documento **não passaria** como relatório final para um cliente de pesquisa (prefeitura, partido, empresa). Parece um dump técnico.

---

## 6. Comparação com Requisitos Reais de Relatório Físico

Requisitos típicos de um relatório de pesquisa eleitoral/opinião pública:

- [x] Capa com identidade visual da empresa
- [ ] Logo embutido + foto da cidade
- [ ] Sumário navegável
- [ ] Metodologia detalhada + ficha técnica
- [ ] Tamanho da amostra + erro amostral + nível de confiança
- [ ] Tabela de cotas realizadas vs planejadas (por localidade/sexo/idade)
- [ ] Gráficos profissionais (não só tabelas)
- [ ] Cruzamentos principais com interpretação
- [ ] Análise por região/geografia
- [ ] Conclusão + recomendações estratégicas
- [ ] Anexos técnicos
- [ ] Paginação, cabeçalho/rodapé, confidencialidade

**Atualmente atendidos: ~15-20%**

---

## 7. Recomendações Priorizadas

### Fase 1 – Correções Imediatas (1-2 semanas)

1. **Fazer o logo realmente aparecer no .docx**
   - Usar `docx` `Image` + `fetch` da URL do Supabase Storage
   - Fazer o mesmo para imagem de capa (cidade/mapa) quando disponível

2. **Corrigir busca de planejamento**
   - Suportar tanto `surveys.planning_data` quanto `research_plans` vinculado
   - Usar os dados ricos de cotas, premises, localities

3. **Corrigir schema vs código**
   - Tornar `report_configuration_id` nullable ou ajustar `createShare`

### Fase 2 – MVP de Relatório Profissional (3-4 semanas)

4. Criar **interface real** de geração de relatório dentro de `/dashboard/surveys/[id]`
   - Aba "Relatórios"
   - Seleção de tipo + cruzamentos + configurações visuais
   - Preview textual + botão "Gerar .docx"

5. Melhorar dramaticamente as tabelas de cruzamento
   - Formatação correta
   - Totais
   - Ordenação por frequência

6. Adicionar **cabeçalho e rodapé** com numeração de páginas (biblioteca `docx` suporta via `sections`)

### Fase 3 – Diferencial de Mercado (futuro)

7. Gerar **gráficos como imagens** (usar Recharts + sharp ou similar) e embutir no Word
8. Criar templates de capa visuais (usar `report_cover_templates`)
9. Versão em PDF também (além de .docx)
10. Relatório com interpretação textual automática (IA leve)

---

## 8. Arquivos Principais Analisados

- `src/lib/reports/DocxReportGenerator.ts` (o coração)
- `src/app/api/reports/[surveyId]/generate-docx/route.ts`
- `src/app/api/settings/company-assets/route.ts` + UI em `dashboard/settings/page.tsx`
- `src/lib/reports/types.ts`
- Migrações de relatórios (20260528) e research_plans (20260527)
- `help-topics.ts` (documentação de intenção vs realidade)

---

## 9. Conclusão

A geração de relatório escrito (físico) tem **melhor fundação técnica** que o dashboard dinâmico, porque o gerador centralizado existe e a biblioteca `docx` está bem integrada.

Porém, os **dois maiores bloqueios** são:

1. **Falta de UI** — o pesquisador não consegue usar a funcionalidade de forma prática.
2. **Falta de identidade visual real** — o documento gerado não carrega logo, nem imagens, nem papel timbrado de verdade.

Enquanto esses dois pontos não forem resolvidos, o módulo de "Relatórios .docx" continuará sendo apenas uma **prova de conceito técnica**, não um produto entregável.

**Recomendação estratégica:**  
Priorizar a correção do embedding de imagens + criação da interface de geração **antes** de investir em mais tipos de relatório ou cruzamentos complexos. Um relatório simples, mas com logo da empresa e cara profissional, entrega mais valor que 5 tipos diferentes com placeholders.

---

**Fim do Relatório de Análise — Geração de Relatório Escrito (.docx)**
