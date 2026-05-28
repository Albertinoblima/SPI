# Análise Completa do Fluxo Lógico do Sistema iDialog SPI

**Data da Análise:** 28 de maio de 2026  
**Objetivo:** Verificar se o sistema atual atende ao fluxo lógico completo de uma pesquisa profissional (do planejamento à entrega de relatórios para o contratante).

---

## 1. Fluxo Lógico Esperado (segundo o usuário)

1. **Criar a pesquisa**
   - Definir rotas de forma lógica (base geográfica, localidades)
   - Distribuir cotas proporcionalmente **com os entrevistadores** (não apenas por localidade)
   - Gerar pacotes/rotas por entrevistador

2. **Enviar para o aplicativo mobile**
   - O app deve **apenas** colher respostas (com validações: geolocalização, foto, etc.) e sincronizar de volta para o sistema central.

3. **Com os dados coletados, gerar relatórios**
   - **Relatório Dinâmico** (estilo Power BI / Tableau): dashboard interativo com filtros, cruzamentos, drill-down. Deve gerar **link compartilhável** para o contratante.
   - **Relatório .docx profissional**:
     - Opções: Básico vs Analítico (com cruzamentos escolhidos pelo usuário)
     - Modelos de capa
     - Usar metadados do planejamento (objetivo, metodologia, público-alvo, cotas, etc.) para alimentar o relatório automaticamente.

---

## 2. Avaliação por Etapa

### 2.1 Criação da Pesquisa (Planejamento - 5 Passos)

**Status: Muito Bom / Excelente (com ressalvas)**

**Pontos Fortes (já implementados com alta qualidade):**
- Passo 1: Definição básica boa.
- **Passo 2 - Base Geográfica**: Um dos pontos mais fortes do sistema atualmente.
  - Seletor profissional com filtros Urbana/Rural, busca, cache.
  - Badges de qualidade de dados (Censo/TSE/CNEFE).
  - Suporte a municípios completos ou localidades específicas.
  - Integração com `/api/geo/municipality-profile`.
- **Passo 4 - Distribuição de Cotas**:
  - Excelente suporte a travamento (locks) de cotas por localidade.
  - Redistribuição proporcional automática.
  - Sugestão inteligente baseada em TSE (sexo + faixa etária) + densidade CNEFE (Fase 2 do planejamento).
- Backend suporta `survey_routes` e `survey_distribution_quotas` com `interviewer_id`.

**Gaps Críticos:**
- **Não existe interface clara para atribuição de cotas/rotas por entrevistador** no planejamento.
  - O sistema tem o modelo de dados (`survey_distribution_quotas.interviewer_id`), mas o UI do Passo 4/5 trabalha apenas com cotas geográficas.
  - Não há tela para o pesquisador dizer "Entrevistador João fica com 80 entrevistas na Localidade X, 40 na Y".
- Distribuição por equipe/entrevistadores ainda é feita manualmente ou via API (não é parte do fluxo guiado dos 5 passos).

**Conclusão desta etapa:** 80-85% atendido. Falta a última camada de "distribuição operacional por entrevistador".

---

### 2.2 Envio para o Aplicativo Mobile

**Status: Bom / Muito Bom**

**Pontos Fortes:**
- App mobile (Expo/React Native) bem estruturado com:
  - Offline-first forte (SyncEngine, OfflineStorage, ConflictResolver).
  - Coleta estruturada (QuestionRenderer).
  - Captura de geolocalização, foto e assinatura.
  - Sincronização bidirecional.
- Backend expõe `/api/mobile/pesquisa/[id]` que retorna:
  - `survey` + `questions`
  - `routes`
  - `quotas` (filtradas por `interviewer_id` quando o usuário logado é entrevistador).
- Existe `survey_team_members` com papéis (interviewer, supervisor, etc.).

**Gaps:**
- O mobile ainda parece receber "tudo que o entrevistador tem direito", mas a experiência de "minhas rotas do dia" / "minha cota restante" ainda é básica.
- Não há evidência forte de que o planejamento alimenta automaticamente as rotas por entrevistador de forma rica (endereços, ordem de visita, etc.).

**Conclusão:** O mobile está corretamente focado em **coleta pura** (bom). A integração de dados do planejamento existe no modelo, mas a usabilidade operacional para o entrevistador ainda pode melhorar.

---

### 2.3 Geração de Relatórios

**Status: Muito Fraco / Quase Inexistente (maior gap do sistema atualmente)**

#### 2.3.1 Relatório Dinâmico (estilo Power BI)

- Existe uma página `/responses` e `/responses/map`, mas ambas são **placeholders** ("Nenhuma resposta registrada ainda" / "Coming Soon").
- Não existe dashboard analítico interativo.
- Não existe mecanismo de **link público/compartilhável** para contratantes analisarem cruzamentos sozinhos.
- Não há engine de cruzamentos dinâmicos (filtros por variável, tabulações cruzadas, etc.).

**Conclusão:** Praticamente 0% implementado.

#### 2.3.2 Relatório .docx Profissional

- Existem downloads de **questionário** e **distribuição** (materiais de campo).
- Existe um arquivo de modelo (`docs/modelo_relatorio_pesquisa.md` + .docx/.pdf), mas é apenas documentação de referência.
- **Não existe gerador de relatório de resultados .docx** que:
  - Use metadados do planejamento (objetivo, metodologia, cotas, público-alvo, etc.).
  - Ofereça opções Básico vs Analítico com cruzamentos escolhidos.
  - Tenha modelos de capa profissionais.
- Não há integração com biblioteca `docx` para geração de relatórios analíticos (apesar de `docx` estar listado como external no next.config).

**Conclusão:** 5-10% implementado (apenas materiais de campo, não relatórios de resultado).

---

## 3. Resumo por Módulo

| Etapa do Fluxo                        | Nível de Atendimento | Comentário Principal |
|---------------------------------------|----------------------|----------------------|
| Criação da Pesquisa (5 passos)        | Excelente (85-90%)   | Muito maduro, especialmente Base Geográfica e Cotas |
| Distribuição por Entrevistador        | Fraco (30-40%)       | Modelo de dados existe, UI quase não existe |
| Envio + Coleta Mobile                 | Bom (75-80%)         | Focado corretamente em coleta. Integração de rotas/cotas parcial |
| Sincronização e Armazenamento de Dados| Bom                  | Offline-first bem feito |
| Relatório Dinâmico (Power BI style)   | Quase zero (<10%)    | Maior gap atual |
| Link compartilhável para contratante  | Não existe           | Crítico para o modelo de negócio |
| Relatório .docx Analítico             | Quase zero (<10%)    | Existe modelo conceitual, sem gerador |
| Uso de metadados do planejamento no relatório | Não existe     | - |

---

## 4. Recomendações Priorizadas (Melhores Decisões)

### Prioridade Alta (Curto Prazo)

1. **Finalizar a Distribuição por Entrevistador** (Passo 4 ou novo Passo 4.5)
   - Criar interface para atribuir cotas/rotas por membro da equipe.
   - Melhorar `survey_distribution_quotas` com mais campos operacionais (se necessário).

2. **Construir o Módulo de Relatórios de Resultados** (o maior gap)
   - **Relatório Dinâmico** (prioridade 1):
     - Dashboard com filtros (localidade, sexo, idade, etc.).
     - Cruzamentos dinâmicos.
     - Geração de link público com token de acesso (válido por tempo ou por número de acessos).
   - **Relatório .docx** (prioridade 2):
     - Usar biblioteca `docx`.
     - Templates de capa (3-5 modelos).
     - Seção automática com dados do planejamento (Passo 1).
     - Opção de incluir tabelas de cruzamento selecionadas pelo usuário.

3. **Estrutura de Dados para Análise**
   - Garantir que `responses` + `survey_premises` + metadados de planejamento estejam bem modelados para cruzamentos.

### Prioridade Média

- Melhorar a experiência do entrevistador no mobile ("Minhas rotas de hoje", "Minha cota restante").
- Criar área de "Relatórios" no menu do tenant (dashboard + downloads).
- Adicionar controle de acesso a relatórios compartilhados (quem pode ver o link).

### Prioridade Baixa (mas importante para produto)

- Motor de sugestão de cruzamentos automáticos.
- Export para Excel/Power BI (OneDrive / embed).
- Versionamento de relatórios.

---

## 5. Conclusão Geral

**O sistema atende bem a primeira metade do fluxo (Planejamento + Coleta), mas falha gravemente na segunda metade (Análise e Entrega de Valor ao Contratante).**

Atualmente, depois que os dados chegam, o sistema praticamente "morre". Não há como o cliente final consumir os resultados de forma profissional e autônoma.

**Avaliação Geral do Fluxo Lógico:**  
**~45-50% atendido.**

O maior risco de produto hoje não é mais o planejamento nem a coleta — é a **falta de entrega de valor final** através de relatórios de qualidade.

---

**Recomendação Estratégica:**

Antes de investir mais em funcionalidades de planejamento (que já estão muito boas), priorize urgentemente a construção do módulo de **Relatórios e Análise**, especialmente:

1. Relatório Dinâmico + Link Compartilhável (maior ROI)
2. Geração de .docx profissional com metadados do planejamento

Isso fecha o ciclo e entrega o valor prometido ao contratante.

---

*Relatório gerado automaticamente com base em revisão profunda do codebase em 28/05/2026.*