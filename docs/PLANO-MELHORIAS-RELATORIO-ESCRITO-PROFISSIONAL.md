# Plano de Melhorias – Geração de Relatório Escrito Profissional (.docx)

**Versão:** 1.1 (Atualizado após aprovação)  
**Data:** 29 de maio de 2026  
**Aviso importante:** Esta versão foi atualizada após aprovação. Consulte também o documento complementar:  
`ATUALIZACAO-PLANO-RELATORIO-SINTETICO-GRAFICOS-DOWNLOAD-SEGURO.md` para as novas regras do Relatório Sintético e estratégia de download seguro.  
**Autor:** Grok (baseado em análise profunda do código atual)  
**Objetivo:** Transformar a geração de relatórios .docx em um produto profissional, confiável e alinhado com as expectativas de mercado de pesquisa de opinião e eleitoral.

---

## 1. Resumo Executivo

O módulo atual de geração de relatórios escritos (.docx) é funcional do ponto de vista técnico, mas **não entrega um documento com qualidade profissional** para o contratante. 

Este plano propõe uma evolução estruturada para entregar:

- **Relatório Sintético**: Apenas números e percentuais limpos e executivos.
- **Relatório Analítico**: Sintético + seções estruturadas de cruzamentos por pergunta × (localidade + premissas).
- **Relatório Consolidado**: Completo + **análises profundas geradas por IA** para cada questão.

**Foco principal da evolução:**
- Cruzamentos inteligentes baseados nas **premissas cadastradas** pelo pesquisador (`survey_premises`) + localidade.
- Embedding real de identidade visual (logo + papel timbrado).
- UI completa para o pesquisador configurar e gerar o relatório.
- Uso de IA para gerar insights de alto valor no relatório consolidado.
- Performance, qualidade visual e padronização profissional.

**Abordagem recomendada:** Execução em 4 fases incrementais, com entregas de valor a cada fase.

---

## 2. Estado Atual vs Estado Desejado

| Dimensão                        | Atual (Maio/2026)                          | Desejado (Pós-Plano)                              |
|--------------------------------|--------------------------------------------|---------------------------------------------------|
| Tipos de relatório             | 3 tipos (sintético, analítico, consolidado) | Mantidos + regras claras de conteúdo             |
| Cruzamentos                    | 2 variáveis livres, sem filtros            | Por pergunta + localidade + premissas definidas  |
| Identidade visual              | Placeholders de texto                      | Logo real + papel timbrado embutido              |
| UI de geração                  | Inexistente (só API)                       | Interface completa dentro da pesquisa            |
| Dados de planejamento          | Parcial e inconsistente (research_plans)   | Uso completo de cotas, premissas e localidades   |
| Análises qualitativas          | Nenhuma                                    | Geradas por IA no Consolidado                    |
| Profissionalismo visual        | Baixo (tabelas cruas)                      | Alto (tabelas formatadas, gráficos, paginação)   |
| Performance                    | Queries pesadas em memória                 | Agregação otimizada + cache                      |

---

## 3. Requisitos Detalhados por Tipo de Relatório

### 3.1 Relatório Sintético (Visual e Profissional)

**Nova definição (após aprovação):**
- Relatório **altamente visual**, com foco em gráficos profissionais de alta qualidade.
- **Uma página dedicada por pergunta**.
- Em cada página: números + percentuais + gráfico grande e bem formatado.
- O tipo de gráfico deve respeitar o `preferred_visualization` definido no Wizard de criação da pesquisa (bar, pie, horizontal_bar, stacked_bar etc.).

**Conteúdo obrigatório:**
- Capa profissional com logo da empresa + título + contratante + período + ficha técnica completa
- Sumário Executivo (1 página) com indicadores principais + tabela de cotas realizadas × planejadas
- **Uma página por pergunta** contendo:
  - Título da pergunta
  - Resumo numérico (n e % por opção)
  - Gráfico grande (adequado ao tipo de pergunta)
  - Base de respondentes
- Metodologia e Ficha Técnica
- Rodapé com paginação, "Documento Confidencial" e identificação

**Regras:**
- Sem cruzamentos (esses ficam para o Analítico)
- Alta qualidade de impressão (gráficos em boa resolução)
- Design limpo, moderno e corporativo

> **Detalhes completos + estratégia de geração de gráficos** estão no documento de atualização: `ATUALIZACAO-PLANO-RELATORIO-SINTETICO-GRAFICOS-DOWNLOAD-SEGURO.md`

### 3.2 Relatório Analítico

**Estrutura:**
1. Todo o conteúdo do **Sintético**
2. **Seção de Análise Cruzada** (nova estrutura proposta pelo usuário):

   Para **cada pergunta principal** (perguntas de opinião/comportamento):
   - Título da pergunta
   - Distribuição geral (do sintético)
   - Subseção: **Cruzamentos por Localidade**
     - Tabela cruzada: Pergunta × Localidades (todas ou selecionadas)
   - Subseção: **Cruzamentos por Premissas**
     - Para cada premissa cadastrada em `survey_premises` que o pesquisador marcar como "usar em cruzamentos":
       - Tabela: Pergunta × Opções da Premissa (Sexo, Faixa Etária, etc.)
     - Opção de gerar cruzamento com **uma premissa** ou com **todas** as premissas ativas

**Configuração pelo pesquisador:**
- Na tela de geração do relatório, permitir selecionar:
  - Quais perguntas principais incluir
  - Quais premissas usar nos cruzamentos (checkbox por premissa)
  - Se quer cruzamento por localidade (sim/não)
  - Filtros globais opcionais (ex: só zona urbana)

### 3.3 Relatório Consolidado (Completo + Inteligente)

**Estrutura:**
1. Todo o conteúdo do **Sintético**
2. Todo o conteúdo do **Analítico** (com os cruzamentos)
3. **Seção de Análises e Insights** (novo e de alto valor):
   - Para cada pergunta principal:
     - Resumo numérico + tabela
     - **Parágrafo de análise profunda** gerado por IA (3-6 frases interpretando os números, destacando padrões, correlações com cruzamentos, implicações estratégicas)
   - Síntese geral ao final com os 5-7 principais achados da pesquisa (gerado por IA)

**Requisitos de IA:**
- Usar API de IA (recomendado: xAI Grok ou OpenAI GPT-4o / o3)
- Contexto rico: pergunta + distribuição + cruzamentos principais + dados de planejamento
- Prompt bem estruturado + temperatura baixa para consistência
- Cache dos insights gerados (para não regenerar a cada download)
- Opção de "Regenerar análise" para o pesquisador
- Controle de custo (limite de tokens por relatório)

---

## 4. Melhorias Técnicas e de Experiência Recomendadas (Além do Pedido)

| # | Melhoria | Justificativa | Prioridade |
|---|----------|---------------|----------|
| 1 | Embedding real de logo e imagens de capa no DOCX | Atualmente só texto. Essencial para profissionalismo | Crítica |
| 2 | Cabeçalho e rodapé com logo + numeração de páginas em todas as páginas | Padrão mínimo de documento impresso profissional | Crítica |
| 3 | Gráficos como imagens embutidas (barras, pizza) | Relatórios de pesquisa quase sempre têm gráficos | Alta |
| 4 | Tabelas de cotas realizadas × planejadas (localidade + premissas) | Informação mais cobrada por contratantes | Alta |
| 5 | Suporte a templates de capa reutilizáveis (`report_cover_templates`) | Já existe no schema, nunca foi usado | Média |
| 6 | Geração também em PDF de alta qualidade (além de .docx) | Muitos clientes preferem PDF para impressão | Média |
| 7 | Versão do relatório + data/hora de geração + hash de integridade | Rastreabilidade e governança | Média |
| 8 | Logs de geração e download de relatórios | Auditoria (tabela `report_access_logs` existe mas vazia) | Média |
| 9 | Opção de incluir questionário completo no anexo | Comum em relatórios técnicos | Baixa-Média |
| 10 | Testes estatísticos simples nos cruzamentos (qui-quadrado) | Dá credibilidade científica ao relatório | Baixa |

---

## 5. Plano de Implementação em Fases

### **Fase 0 – Fundação (1,5 semana) – Obrigatória antes de tudo**

- Corrigir inconsistências de planejamento (`research_plans` vs `surveys.planning_data`)
- Criar serviço centralizado de agregação otimizada (`AdvancedReportAggregationService`)
- Adicionar suporte a filtros (localidade + premissas) no motor de cruzamentos
- Criar estrutura de cache para agregações (tabela `report_aggregations_cache` ou materialized views)
- Corrigir schema (`report_shares.report_configuration_id` nullable ou ajuste de lógica)

**Entregável:** Motor de dados confiável e performático.

### **Fase 1 – Identidade Visual e Base Profissional (2 semanas)**

- Implementar embedding real de logo (`company_assets`) usando `docx` Image + fetch
- Implementar cabeçalho/rodapé com paginação em todas as seções
- Melhorar dramaticamente a geração de tabelas (formatação, totais, destaque)
- Criar componente de geração de gráficos como imagens (Recharts + sharp ou similar)
- Atualizar `DocxReportGenerator` para suportar os novos requisitos de estrutura

**Entregável:** Primeiro relatório .docx com cara profissional (mesmo com dados sintéticos).

### **Fase 2 – Lógica de Cruzamentos Inteligentes + UI do Pesquisador (3 semanas)**

- Implementar nova lógica de cruzamento:
  - Por pergunta
  - × Localidades
  - × Cada premissa marcada (com opção "todas" ou seleção)
- Criar tabela auxiliar ou campo em `survey_premises` para marcar premissas como "crossable_for_reports"
- Criar interface completa em `/dashboard/surveys/[id]/reports` (ou aba dentro da pesquisa):
  - Seleção de tipo de relatório
  - Seleção de premissas a usar nos cruzamentos
  - Seleção de perguntas a incluir
  - Configurações de capa, margens, orientação
  - Preview textual dos cruzamentos que serão gerados
  - Botão "Gerar Relatório" (chama a API e baixa o arquivo)
- Persistir `report_configurations` com as escolhas do usuário

**Entregável:** Pesquisador consegue gerar relatórios Sintético e Analítico de forma autônoma e profissional.

### **Fase 3 – Relatório Consolidado + IA (2,5 – 3 semanas)**

- Implementar geração de insights por IA:
  - Criar serviço `ReportInsightsService`
  - Definir prompts de alta qualidade (em português)
  - Integração com API de IA (xAI ou OpenAI)
  - Cache de insights (tabela `report_question_insights`)
  - Controle de custo e rate limit
- Adicionar seção de "Análises e Interpretações" no gerador .docx
- Gerar também o "Resumo Executivo com Principais Achados" via IA
- Opção de editar/regenerar insights manualmente antes da geração final

**Entregável:** Relatório Consolidado com análises profundas geradas por IA.

### **Fase 4 – Polimento, PDF e Governança (2 semanas)**

- Adicionar exportação em PDF (usar `docx` + conversor ou `pdf-lib` + reconstrução)
- Finalizar templates de capa e integração com `report_cover_templates`
- Popular `report_access_logs` em todas as gerações e downloads
- Adicionar versionamento de relatórios gerados
- Testes automatizados (unitários + de geração de documento)
- Documentação para o usuário final

**Entregável:** Produto pronto para uso em produção com alto nível de profissionalismo.

---

## 6. Arquitetura Técnica Proposta

### Novos / Refatorados

- `src/lib/reports/AdvancedReportAggregationService.ts` (novo – com filtros)
- `src/lib/reports/ReportInsightsService.ts` (novo – IA)
- `src/lib/reports/ProfessionalDocxGenerator.ts` (refatoração forte do atual)
- `src/components/reports/ReportGeneratorWizard.tsx` (novo – UI principal)
- `src/app/api/reports/[surveyId]/generate-professional/route.ts` (nova rota recomendada)
- Tabelas novas sugeridas:
  - `report_aggregations_cache`
  - `report_question_insights`
  - `report_generated_versions` (histórico)

### Integração com IA

**Recomendação de provedor:**
- Prioridade 1: **xAI Grok** (já temos integração no projeto via help)
- Alternativa: OpenAI GPT-4o ou GPT-4o-mini (mais barato para volume)

**Estratégia de custo:**
- Gerar insights apenas quando o relatório for solicitado
- Cachear por (survey_id + question_id + versão dos dados)
- Permitir "Regenerar" manualmente (custa tokens)
- Usar modelo menor para rascunho + modelo maior para versão final

---

## 7. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|---------|
| Volume alto de respostas → lentidão | Alta | Alto | Fase 0 com cache + agregações em SQL |
| Custo de IA explodir | Média | Médio | Cache + limites por tenant + modelo menor por default |
| Pesquisador não entender a nova estrutura de cruzamentos | Média | Médio | Excelente UX + help contextual + exemplos |
| Inconsistência entre dados de planejamento antigo e novo | Alta | Alto | Fase 0 obrigatória de unificação |
| Embedding de imagens quebrar em produção | Média | Médio | Testes + fallback para placeholder bonito |

---

## 8. Esforço Estimado

| Fase | Duração Estimada | Esforço (1 sênior + 1 pleno) | Entregável Principal |
|------|------------------|------------------------------|----------------------|
| Fase 0 | 1,5 semana | 3 semanas-homem | Motor de agregação com filtros |
| Fase 1 | 2 semanas | 4 semanas-homem | Relatórios com logo e paginação real |
| Fase 2 | 3 semanas | 6 semanas-homem | UI + cruzamentos por premissas |
| Fase 3 | 2,5–3 semanas | 5–6 semanas-homem | Relatório Consolidado com IA |
| Fase 4 | 2 semanas | 4 semanas-homem | PDF + polimento final |
| **Total** | **11–12 semanas** | **22–23 semanas-homem** | Produto profissional completo |

---

## 9. Critérios de Aprovação por Fase

Para avançar de fase, os seguintes itens devem estar validados:

- **Fase 0 → 1**: Motor de agregação com filtros por localidade e premissa funcionando em testes com dados reais.
- **Fase 1 → 2**: Documento .docx gerado com logo embutido, cabeçalho/rodapé e paginação (avaliado visualmente).
- **Fase 2 → 3**: Pesquisador consegue, pela interface, gerar um relatório Analítico completo com cruzamentos por premissas.
- **Fase 3 → 4**: Relatório Consolidado contém análises geradas por IA de qualidade aceitável (revisão humana).
- **Fase 4**: Relatório final aprovado por pelo menos 2 usuários reais (pesquisador + contratante simulado).

---

## 10. Próximos Passos Imediatos (para Aprovação)

1. Revisão e aprovação deste plano pelo time/produto.
2. Definição do provedor de IA e orçamento mensal estimado.
3. Escolha da abordagem de gráficos (embed como imagem vs tabela apenas na Fase 1).
4. Decisão sobre manter ou descontinuar a rota antiga `/generate-docx`.
5. Alinhamento sobre o modelo de dados de "premissas crossáveis" (novo campo em `survey_premises`?).

---

## 11. Anexos Sugeridos (para versões futuras do plano)

- Wireframes da tela de geração de relatório
- Exemplos de prompts para a IA
- Modelo de estrutura JSON do `report_configurations` atualizado
- Exemplo de relatório gerado (mock visual)

---

**Este plano está pronto para revisão e aprovação.**

Após aprovação, podemos partir para a **Fase 0** imediatamente, que é a mais crítica para todo o restante.

---

**Fim do Plano de Melhorias – Relatório Escrito Profissional**
