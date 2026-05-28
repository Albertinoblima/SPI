# Plano de Execução Detalhado – Módulo de Relatórios Avançados (DOCX + Dashboard Dinâmico Protegido)

**Data:** 28 de maio de 2026  
**Prioridade:** Alta (fecha o ciclo do produto)  
**Abordagem:** Planejamento minucioso + Execução incremental com decisões técnicas recomendadas

---

## 1. Visão do Produto Final

O sistema deve entregar dois tipos principais de relatórios para o contratante:

### A. Relatório para Download (.docx) – Profissional e Configurável
- Configurações completas de impressão (tamanho da folha, orientação, tipo de papel, margens).
- Modelos de capa avançados (suporte a imagem da cidade, mapa com pontos de coleta).
- Papel timbrado automático nas páginas internas usando os logotipos da empresa (já existentes no sistema).
- Sumário automático.
- Tipografia hierárquica estilo Microsoft Word.
- Paginação profissional.
- Três tipos de relatório:
  - **Sintético (Básico)**: Números e percentuais principais.
  - **Analítico**: Cruzamentos escolhidos pelo usuário (zona, sexo, faixa etária, etc.).
  - **Consolidado**: Relatório completo com tudo.

### B. Relatório Dinâmico (estilo Power BI)
- Dashboard interativo completo com **todos os cruzamentos possíveis**.
- Gráficos inteligentes que respeitam o tipo da pergunta (definido no wizard de criação).
- Geração de página web **personalizada** para a empresa/contratante.
- Acesso protegido: O contratante deve se cadastrar com e-mail + senha (com recuperação de senha).
- Segurança robusta (tokens por compartilhamento + autenticação do contratante).

---

## 2. Análise do Estado Atual (Gaps Críticos)

**Pontos Fortes existentes:**
- Planejamento muito rico (metadados excelentes).
- Coleta estruturada (`responses` + `response_answers`).
- Biblioteca `docx` já configurada.
- Logos da empresa disponíveis (`company_assets`).

**Gaps Graves:**
- Não existe nenhum gerador de relatório de **resultados**.
- Não existe motor de agregação/cruzamentos performático.
- Não existe sistema de templates de capa ou papel timbrado.
- Não existe conceito de "relatório configurável" pelo usuário.
- Dashboard analítico inexistente.
- Sem mecanismo seguro de compartilhamento com contratantes.

**Conclusão:** Estamos no estágio inicial para esta funcionalidade crítica.

---

## 3. Arquitetura Recomendada (Melhores Decisões Técnicas)

### 3.1 Princípios de Design
- **Separação clara**: Configuração do relatório vs Geração vs Apresentação.
- **Reutilização**: Usar metadados do planejamento (Passo 1) para alimentar automaticamente os relatórios.
- **Extensibilidade**: O usuário deve poder salvar "modelos de relatório".
- **Segurança por camadas** para o relatório dinâmico público.

### 3.2 Stack Recomendado
- **Geração .docx**: Biblioteca `docx` (já no projeto) + templates bem estruturados.
- **Dashboard Dinâmico**: Next.js + Recharts (ou Tremor) + React Query.
- **Agregação**: Postgres Views + Materialized Views (para performance).
- **Autenticação de Contratantes**: Tabela dedicada + bcrypt (ou Supabase Auth com roles customizadas).
- **Compartilhamento**: Tokens de acesso com expiração + vinculação a credenciais do contratante.

### 3.3 Modelo de Dados Principal (Proposto)

**Tabelas novas chave:**
- `report_cover_templates` (já criado na migração de fundação)
- `report_configurations` (configurações salvas)
- `report_shares` (links gerados + credenciais do contratante)
- `report_access_logs` (auditoria)

**Extensões:**
- `questions` → `preferred_visualization` + `visualization_options` (já na migração)

---

## 4. Roadmap de Execução em Fases (Recomendado)

### Fase 1 – Fundação (2-3 semanas) – **Prioridade Máxima**
- Aplicar e refinar migração de fundação.
- Criar service de agregação básico (`ReportAggregationService`).
- Views materializadas para totais e cruzamentos simples.
- Tipos TypeScript completos.
- Estrutura de pastas para o módulo de relatórios.

### Fase 2 – Gerador .docx Avançado (4-5 semanas)
- UI de configuração completa (papel, orientação, margens, tipo de papel).
- Sistema de modelos de capa com upload de imagens (cidade/mapa).
- Integração com logos da empresa para papel timbrado.
- Geração dos 3 tipos de relatório (Sintético, Analítico, Consolidado).
- Sumário automático, tipografia Word, paginação.
- Uso automático de metadados do planejamento.

### Fase 3 – Dashboard Dinâmico + Personalização (5-6 semanas)
- Motor de dashboard interativo.
- Gráficos adaptativos por tipo de pergunta.
- Geração de página web personalizada.
- Sistema de credenciais do contratante (cadastro, login, reset senha).
- Proteção robusta do acesso.

### Fase 4 – Polimento, Performance e Governança (2-3 semanas)
- Performance em grandes volumes.
- Mais templates de capa.
- Export adicional (PDF do dashboard).
- Logs avançados e controles de acesso.

---

## 5. Decisões Técnicas Recomendadas (Justificadas)

1. **.docx primeiro, depois Dashboard**
   - Mais controlável, gera valor mais rápido para o contratante.
   - Menor risco técnico inicial.

2. **Agregação no Banco de Dados**
   - Postgres é excelente para isso. Evitar trazer tudo para a aplicação.

3. **Autenticação Híbrida para o Dashboard Público**
   - Token de compartilhamento + credenciais do contratante (melhor segurança que só token).

4. **Gráficos adaptativos**
   - Guardar `preferred_visualization` na pergunta desde a criação. Isso é uma decisão de produto excelente.

5. **Separação clara de responsabilidades**
   - `ReportConfigurationService`
   - `DocxReportGenerator`
   - `AnalyticsAggregationService`
   - `PublicReportAccessService`

---

## 6. Riscos e Mitigações

- **Risco**: Performance ruim em cruzamentos com muitas respostas.
  - **Mitigação**: Materialized Views + cache agressivo na Fase 1.

- **Risco**: Complexidade do gerador .docx explodir.
  - **Mitigação**: Começar com templates bem definidos e evoluir.

- **Risco**: Segurança da página pública.
  - **Mitigação**: Múltiplas camadas (token + senha + rate limiting + logs).

---

## 7. Status Atual da Execução (28/05/2026)

- **Planejamento**: Concluído (este documento + PLANO-RELATORIOS-AVANCADOS.md).
- **Fundação de Dados**: Migração criada (`20260528000001_reports_advanced_foundation.sql`).
- **Estrutura Técnica (já executado)**:
  - `lib/reports/types.ts` — Tipos centralizados e bem tipados.
  - `lib/reports/ReportAggregationService.ts` — Service de agregação (esqueleto robusto com decisões de arquitetura).
  - `lib/reports/DocxReportGenerator.ts` — Gerador de .docx (esqueleto preparado para evolução).

**Progresso Real da Execução (atualizado agora):**
- `ReportAggregationService` já tem implementação funcional de totais, distribuição por pergunta e cruzamentos.
- `DocxReportGenerator` já suporta os três tipos de relatório + metadados do planejamento.
- API `/api/reports/[surveyId]/analytics` criada.

Estamos bem posicionados para entregar valor rapidamente.

---

**Status mais recente (ritmo atual mantido):**

- DOCX Generator: Melhorado com mais integração de metadados do planejamento e estrutura mais profissional para capa/letterhead.
- Dynamic Protected Report: Página pública agora busca e exibe dados reais (totais + cruzamentos) após login do contratante.
- Ritmo mantido: Progresso sólido, equilibrado e de qualidade nos dois relatórios (download + dinâmico protegido).

Continuando no mesmo ritmo de execução de qualidade (28/05).

Estou continuando a execução com as melhores decisões até o final.

**Atualização mais recente (ritmo mantido):**
- Criado endpoint seguro dedicado para o relatório dinâmico público.
- Página protegida agora consome e exibe dados reais após autenticação.
- Ritmo mantido: Progresso equilibrado e de qualidade.
- Página protegida agora consome dados reais após autenticação do contratante.
- Progresso equilibrado nos dois relatórios.