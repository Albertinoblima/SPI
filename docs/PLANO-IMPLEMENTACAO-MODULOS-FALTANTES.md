# Plano de Execução – Implantação dos Módulos e Fases Faltantes (Básicas)

**Data:** 28 de maio de 2026  
**Base:** Análise do Fluxo Lógico Completo (docs/FLUXO-LOGICO-SISTEMA-ANALISE-COMPLETA.md)  
**Objetivo:** Fechar o ciclo completo de uma pesquisa profissional de forma realista e priorizada.

---

## 1. Resumo Executivo

O sistema atual está **forte no planejamento e na coleta**, mas **muito fraco na entrega de valor final** (relatórios para o contratante). 

Sem relatórios de qualidade, o produto não completa o fluxo lógico esperado pelo mercado de pesquisas.

**Estratégia recomendada:**
- Fechar primeiro o que falta no **loop de campo** (distribuição por entrevistador).
- Depois construir o **módulo de Relatórios** de forma incremental (básico → analítico → dinâmico compartilhável).
- Manter o foco em versões **básicas mas usáveis** primeiro, adiando polimento para fases posteriores.

---

## 2. Visão Geral das Fases Propostas

| Fase | Nome | Prioridade | Escopo Básico | Entrega Esperada | Duração Estimada |
|------|------|------------|---------------|------------------|------------------|
| **Fase 0** | Fundação de Dados para Análise | Alta | Modelo de dados + APIs de agregação para relatórios | Base sólida para todos os relatórios | 1-2 semanas |
| **Fase 1** | Fechamento do Loop de Campo | Alta | Distribuição e atribuição de cotas/rotas por entrevistador | Pesquisador consegue planejar e enviar pacotes por pessoa | 2-3 semanas |
| **Fase 2** | Relatórios Básicos | Alta | Relatório .docx básico + dashboard simples de progresso | Primeira entrega de valor ao contratante | 3-4 semanas |
| **Fase 3** | Relatórios Analíticos + Cruzamentos | Média-Alta | .docx com cruzamentos escolhidos + dashboard analítico básico | Relatório analítico real | 4-5 semanas |
| **Fase 4** | Relatórios Dinâmicos Compartilháveis | Média | Dashboard estilo Power BI + links públicos/privados | Contratante consegue analisar sozinho | 5-6 semanas |
| **Fase 5** | Polimento e Experiência Final | Baixa | Capas profissionais, templates, performance, UX refinada | Produto pronto para escala | Contínuo |

**Recomendação forte:** Executar **Fase 0 + Fase 1 + Fase 2** como bloco prioritário antes de avançar para funcionalidades mais complexas.

---

## 3. Detalhamento das Fases

### Fase 0 – Fundação de Dados para Análise (Obrigatória)

**Objetivo:** Criar a infraestrutura que permitirá todos os relatórios futuros de forma performática.

**Entregas Básicas:**
- Tabela `survey_results_cache` ou views materializadas para agregações rápidas.
- API `/api/surveys/[id]/results` com endpoints de:
  - Totais e percentuais
  - Cruzamentos simples (duas variáveis)
  - Filtros por localidade, sexo, faixa etária, etc.
- Indexação adequada nas tabelas de `responses`.
- Documentação do modelo de dados para análise.

**Decisões Técnicas Recomendadas:**
- Usar Supabase + Postgres views + materialized views onde necessário.
- Criar um serviço leve de agregação (pode começar em TypeScript no próprio backend).

**Risco se não feito:** Qualquer relatório ficará lento e difícil de manter.

---

### Fase 1 – Fechamento do Loop de Campo (Distribuição por Entrevistador)

**Objetivo:** Permitir que o pesquisador distribua as cotas e rotas por entrevistador de forma clara.

**Entregas Básicas:**
- Nova tela ou seção no Passo 4/5 de Planejamento: "Atribuição à Equipe".
- Interface para:
  - Listar membros da equipe do survey (`survey_team_members`)
  - Atribuir cotas por localidade + entrevistador
  - Visualizar resumo por entrevistador (total de entrevistas, por zona, etc.)
- API para salvar `survey_distribution_quotas` com `interviewer_id`.
- Envio automático dessas informações para o mobile (já parcialmente suportado).
- Validação: não permitir que a soma por entrevistador ultrapasse a cota da localidade.

**Decisões Técnicas:**
- Manter o modelo atual de `survey_distribution_quotas`.
- Criar componente reutilizável de "Distribuição por Entrevistador".
- Permitir ajuste fino depois da coleta começar (dentro de limites).

**Benefício:** Fecha o fluxo "Planejamento → Atribuição → Coleta" de forma profissional.

---

### Fase 2 – Relatórios Básicos (Primeira Entrega de Valor)

**Objetivo:** Entregar o primeiro relatório útil para o contratante.

**Entregas Básicas (MVP):**

**A. Relatório .docx Básico**
- Geração de documento Word usando a biblioteca `docx` (já configurada no projeto).
- Seções obrigatórias:
  - Capa simples (com logo, nome da pesquisa, contratante, período)
  - Metodologia (alimentada automaticamente do Passo 1 do planejamento)
  - Estatísticas gerais (total de entrevistas, taxa de resposta, distribuição geográfica)
  - Principais resultados (tabelas simples)
- Opção de download direto na interface do tenant.

**B. Dashboard Básico de Progresso**
- Página simples de "Resultados" com:
  - Total de entrevistas realizadas vs planejadas
  - Progresso por localidade
  - Progresso por entrevistador
  - Filtros básicos (período, zona)

**Decisões Técnicas:**
- Usar `docx` para geração server-side.
- Criar templates básicos de capa (3 opções no mínimo).
- Manter os dados do planejamento (objetivo, público-alvo, cotas) no relatório automaticamente.

---

### Fase 3 – Relatórios Analíticos com Cruzamentos

**Objetivo:** Permitir que o usuário gere relatórios mais profundos.

**Entregas Básicas:**
- No gerador de .docx:
  - Seleção de variáveis para cruzamento (ex: Intenção de Voto × Sexo × Faixa Etária)
  - Opção "Relatório Analítico"
- No dashboard:
  - Tabelas de cruzamento simples (2 variáveis)
  - Gráficos básicos (barras, pizza, linhas)

**Decisões Técnicas:**
- Criar um motor simples de tabulação cruzada no backend.
- Permitir que o usuário salve "modelos de relatório" (combinações de cruzamentos favoritas).

---

### Fase 4 – Relatórios Dinâmicos + Links Compartilháveis

**Objetivo:** Entregar o que o contratante realmente quer (análise autônoma).

**Entregas Básicas:**
- Dashboard interativo (filtros, drill-down, seleção de variáveis).
- Geração de **link público ou privado** com token de acesso.
- Controle de validade do link (data de expiração ou número de acessos).
- Visualização de todos os cruzamentos possíveis (dentro de limites de performance).

**Decisões Técnicas Recomendadas:**
- Usar uma abordagem simples no início (React + Recharts ou Chart.js + filtros no backend).
- Evitar complexidade excessiva (não tentar replicar Power BI completo na primeira versão).
- Criar tabela `shared_reports` para gerenciar links.

---

## 4. Recomendações de Arquitetura e Tecnologia

| Módulo                        | Recomendação Técnica                          | Justificativa |
|-------------------------------|-----------------------------------------------|-------------|
| Distribuição por Entrevistador | Next.js (Server Components + React) + Supabase | Consistência com o resto do projeto |
| Motor de Relatórios           | TypeScript + `docx` + views no Postgres       | Já temos `docx` configurado. Postgres é forte em agregações |
| Dashboard Dinâmico            | Next.js + Recharts / Tremor + API de agregação | Rápido de desenvolver e manter |
| Links Compartilháveis         | JWT de curta duração + tabela de shares       | Seguro e simples |
| Performance de Análise        | Materialized Views + Cache (Redis ou Supabase) | Essencial para cruzamentos |

**Princípio:** Manter tudo dentro do monorepo atual o máximo possível. Só criar novos pacotes se realmente necessário.

---

## 5. Estimativa de Esforço (Realista)

| Fase | Esforço Estimado (1 dev sênior + 1 dev pleno) | Observação |
|------|-----------------------------------------------|----------|
| Fase 0 (Fundação)             | 1,5 – 2 semanas                              | Crítica para tudo que vem depois |
| Fase 1 (Distribuição por Entrevistador) | 2 – 3 semanas                       | Interface + lógica de validação |
| Fase 2 (Relatórios Básicos)   | 3 – 4 semanas                                | Inclui .docx + dashboard simples |
| Fase 3 (Analíticos)           | 4 – 5 semanas                                | Depende da qualidade da Fase 0 |
| Fase 4 (Dinâmico + Links)     | 5 – 7 semanas                                | A mais complexa |

**Total para um MVP de relatórios decente (Fase 0 a 3):** ~12-15 semanas de desenvolvimento focado.

---

## 6. Riscos e Mitigações

- **Risco:** Performance ruim em cruzamentos com grande volume de respostas.
  - **Mitigação:** Investir pesado na Fase 0 (materialized views + cache).

- **Risco:** Escopo de relatórios explode (usuários querem tudo).
  - **Mitigação:** Definir claramente o que é "básico" vs "melhoria" desde o início.

- **Risco:** Falta de dados reais para testar os relatórios.
  - **Mitigação:** Criar dados sintéticos + usar pesquisas de teste.

---

## 7. Próximos Passos Imediatos (Preparação)

Antes de começar a codificar, recomenda-se preparar:

1. **Definição de Escopo Detalhado da Fase 2** (Relatórios Básicos)
   - Quais seções mínimas o .docx básico deve ter?
   - Quais filtros o dashboard inicial deve oferecer?

2. **Levantamento de Variáveis de Cruzamento**
   - Mapear todas as variáveis de resposta que serão usadas em cruzamentos.

3. **Definição de Modelos de Capa .docx**
   - Decidir quantos modelos de capa serão oferecidos inicialmente (recomendado: 3).

4. **Alinhamento com o time de campo**
   - Validar se o fluxo de distribuição por entrevistador atende à realidade operacional.

5. **Criação de Stories / Tarefas no backlog** (se estiver usando algum gerenciador).

---

## 8. Conclusão e Recomendação Final

O sistema tem uma base excelente de planejamento e coleta. O que está faltando é **fechar o ciclo entregando valor real ao contratante através de relatórios**.

**Recomendação de ordem de ataque:**

1. **Fase 0 + Fase 1** (em paralelo ou sequência rápida) — fecha o planejamento operacional.
2. **Fase 2** — primeira entrega de relatório (gera valor imediato).
3. **Fase 3 e 4** — evolução para o que o mercado realmente exige.

Este plano prioriza **entrega incremental de valor** em vez de tentar construir o relatório perfeito de uma vez.

---

**Próximo passo sugerido:**  
Após sua aprovação deste plano, podemos partir para a **preparação detalhada** (definição de escopo, wireframes, modelo de dados, etc.) da Fase 0 e Fase 1, que são as mais críticas para destravar as fases seguintes.

Quer que eu avance para o detalhamento da Fase 0 + Fase 1 agora?