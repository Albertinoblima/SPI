# Plano Detalhado de Execução – Módulo de Relatórios Avançados

**Data:** 28 de maio de 2026  
**Escopo:** Relatório para Download (.docx) + Relatório Dinâmico Protegido (estilo Power BI)  
**Abordagem:** Planejamento minucioso + Execução em fases priorizadas

---

## 1. Visão Geral do Objetivo

Criar um sistema de relatórios **robusto, profissional e completo** que permita:

### A. Relatório para Download (.docx)
- Configurações avançadas de impressão (tamanho da folha, orientação, tipo de papel, margens).
- Modelos de capa ricos (suporte a imagens da cidade, mapas com pontos de coleta).
- Papel timbrado automático nas páginas internas usando os logotipos da empresa.
- Sumário automático.
- Tipografia profissional (títulos hierárquicos estilo Word).
- Paginação correta.
- Três tipos de relatório:
  - **Sintético (Básico)**: Números e percentuais principais.
  - **Analítico**: Cruzamentos selecionados pelo usuário (zona, sexo, faixa etária, etc.).
  - **Consolidado**: Relatório completo.

### B. Relatório Dinâmico (Power BI Style)
- Dashboard altamente interativo com **todos os cruzamentos possíveis**.
- Gráficos inteligentes que respeitam o tipo de pergunta (definido no wizard).
- Geração de **página web personalizada** para o contratante.
- Acesso protegido por credenciais (e-mail + senha) com recuperação de senha.
- Segurança robusta (tokens por pesquisa + autenticação do contratante).

---

## 2. Análise do Estado Atual (Gaps Identificados)

### O que já existe (bom):
- Planejamento muito maduro (metadados ricos).
- Coleta estruturada (`responses` + `response_answers`).
- Biblioteca `docx` já configurada no projeto.
- Logos de tenants disponíveis.
- Sistema de autenticação (Supabase Auth).

### O que está faltando (crítico):
- Nenhum gerador de relatório de **resultados** (apenas materiais de campo).
- Sem motor de agregação/cruzamentos performático.
- Sem sistema de templates de capa.
- Sem conceito de "relatório configurável" salvo.
- Sem dashboard analítico interativo.
- Sem mecanismo de páginas públicas protegidas para contratantes.

---

## 3. Arquitetura Recomendada (Melhores Decisões)

### 3.1 Camadas Principais

| Camada                    | Tecnologia / Abordagem                          | Justificativa |
|---------------------------|--------------------------------------------------|-------------|
| **Configuração de Relatórios** | Tabelas no Supabase + UI no Next.js             | Facilidade de manutenção |
| **Geração .docx**          | Biblioteca `docx` (server-side)                 | Já está no projeto, performática |
| **Agregação de Dados**     | Postgres Views + Materialized Views + API       | Melhor performance para cruzamentos |
| **Dashboard Dinâmico**     | Next.js + Recharts / Tremor + React Query       | Rápido, bonito e interativo |
| **Páginas Públicas**       | Rotas protegidas com token + autenticação customizada | Segurança + experiência do contratante |
| **Autenticação de Contratantes** | Supabase Auth (tabela `report_contractors`) ou JWT customizado | Reutilizar o que já existe |

### 3.2 Modelo de Dados Proposto (Essencial)

Novas tabelas principais:

- `report_templates` (modelos de capa + configurações padrão)
- `report_configurations` (configurações salvas pelo usuário para uma pesquisa)
- `report_shares` (links gerados + credenciais de contratantes)
- `report_contractors` (usuários do lado do contratante com acesso aos relatórios)

---

## 4. Roadmap de Implementação (Fases)

### Fase 1 – Fundação (Obrigatória)

**Objetivo:** Criar a base técnica que permitirá todos os relatórios.

**Entregas:**
- Extensão da tabela `survey_questions` com `preferred_chart_type` e `visualization_options`.
- Criação das tabelas `report_templates` e `report_configurations`.
- Criação de views/materialized views para agregações rápidas.
- API base de agregação (`/api/surveys/[id]/analytics`).
- Serviço de geração de .docx básico (prova de conceito).

**Duração estimada:** 2–3 semanas

### Fase 2 – Relatório .docx Avançado

**Objetivo:** Entregar o relatório para download com todas as configurações pedidas.

**Entregas:**
- UI completa de configuração do relatório (papel, orientação, capa, etc.).
- Sistema de modelos de capa com upload de imagens.
- Geração de papel timbrado usando logos do tenant.
- Três tipos de relatório (Sintético, Analítico, Consolidado).
- Sumário automático + tipografia profissional + paginação.
- Download do .docx.

**Duração estimada:** 4–5 semanas

### Fase 3 – Dashboard Dinâmico + Página Personalizada

**Objetivo:** Criar o relatório dinâmico poderoso.

**Entregas:**
- Dashboard interativo completo (filtros, cruzamentos, gráficos adaptativos).
- Geração de página web personalizada para o contratante.
- Sistema de credenciais para o contratante (cadastro, login, reset de senha).
- Proteção robusta de acesso (token da pesquisa + autenticação do contratante).

**Duração estimada:** 5–6 semanas

### Fase 4 – Polimento, Segurança e Experiência

- Performance em grandes volumes de respostas.
- Templates de capa mais sofisticados.
- Export adicional (PDF do dashboard, Excel).
- Logs de acesso aos relatórios (governança).

---

## 5. Decisões Técnicas Importantes (já tomadas)

1. **.docx**: Usar a biblioteca `docx` (já presente no projeto).
2. **Agregação**: Começar com views no Postgres + API. Só evoluir para materialized views ou cache quando necessário.
3. **Gráficos no Dashboard**: Usar Recharts (leve e flexível) ou Tremor.
4. **Autenticação do Contratante**:
   - Criar tabela dedicada `report_contractors`.
   - Usar Supabase Auth ou JWT próprio + senha hasheada.
   - Acesso sempre vinculado a uma `report_share` específica.
5. **Personalização da Página Pública**: Permitir que o tenant defina cores, logo e título da página.

---

## 6. Riscos e Mitigações

- **Risco**: Performance ruim com grandes volumes de respostas em cruzamentos.
  - **Mitigação**: Investir pesado na Fase 1 (agregação no banco).

- **Risco**: Complexidade do gerador .docx explodir.
  - **Mitigação**: Começar com templates bem definidos e evoluir incrementalmente.

- **Risco**: Segurança da página pública.
  - **Mitigação**: Camadas de proteção (token + credenciais + rate limit + logs).

---

## 7. Próximos Passos Imediatos (Recomendados)

Antes de codificar, precisamos definir:

1. **Modelo de dados final** das novas tabelas (já iniciei o esboço).
2. **Quais metadados da pergunta** serão usados para sugerir gráficos (ex: `preferred_visualization`).
3. **Quais cruzamentos** serão suportados inicialmente no Analítico.
4. **Fluxo exato** de geração da página pública + credenciais do contratante.

---

**Status deste documento (28/05/2026 - 19:45):**  
- Planejamento minucioso concluído.
- **Execução iniciada**: Migração de Fundação (`20260528000001_reports_advanced_foundation.sql`) criada e pronta para aplicação.
- Modelo de dados base para Report Configurations, Cover Templates, Report Shares e Access Logs já definido.

Próximos passos imediatos de execução:
1. Aplicar a migração.
2. Criar service de agregação básico.
3. Desenvolver a UI de configuração de relatório .docx.

Quer que eu avance agora para:
- A) Detalhar o modelo de dados completo + migração, ou
- B) Começar a implementação da Fase 1 (Engine de Agregação + primeiras tabelas)?

Estou pronto para executar com as melhores decisões.