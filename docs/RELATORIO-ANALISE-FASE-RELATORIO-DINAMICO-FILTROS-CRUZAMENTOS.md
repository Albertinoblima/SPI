# Relatório de Análise: Fase de Relatório Dinâmico com Filtros para Cruzamento de Dados

**Data da Análise:** 2026-05-29  
**Sistema:** iDialog Pesquisa (political-research-platform)  
**Foco:** Módulo de Relatórios Dinâmicos (Fase 4 do plano de implementação)  
**Autor da Análise:** Grok (baseado em auditoria de código)

---

## 1. Resumo Executivo

A fase de **Relatório Dinâmico com Filtros para Cruzamento de Dados** encontra-se em **estado de fundação parcial / protótipo funcional**.

### Status Geral: 35-40% concluído (foco backend)

| Dimensão                    | Status     | Observação |
|----------------------------|------------|----------|
| Infraestrutura de Dados    | Boa        | Schema + tabelas criadas |
| Motor de Agregação         | Básico     | Funciona para 2 variáveis, sem filtros |
| APIs de Analytics          | Funcionais | Suportam cruzamentos sob demanda |
| Acesso Público Protegido   | Implementado | Token + credenciais bcrypt |
| UI do Contratante          | Protótipo  | Funcional mas cru (JSON bruto) |
| UI do Pesquisador          | Ausente    | Sem tela para configurar shares/cruzamentos |
| Filtros de Cruzamento      | **Inexistentes** | Principal gap da fase |
| Performance / Escalabilidade | Crítica  | Agregação em memória JS |
| Integração com .docx       | Parcial    | Usa mesmo motor, sem filtros |
| Configurações Salvas       | Schema existe | Pouco usado no código |

**Conclusão principal:** O backend entrega a **promessa mínima** de cruzamentos dinâmicos para o contratante via link protegido, mas **faltam completamente os filtros** solicitados na fase, não existe UI administrativa para o pesquisador configurar o que o contratante verá, e a experiência atual é de protótipo (resultados em JSON).

---

## 2. O que Já Existe e Funciona

### 2.1 Schema de Banco de Dados (migração 20260528)

- `report_configurations` — guarda tipo de relatório, selected_crossings (JSONB), layout, etc.
- `report_shares` — links de compartilhamento com `share_token`, `access_type`, `contractor_email` + `password_hash`
- `report_cover_templates` — templates reutilizáveis de capa
- `report_access_logs` — auditoria (tabela existe, nunca escrita)
- Extensão de `questions` com `preferred_visualization` + `visualization_options`

**Problema encontrado:** No schema, `report_shares.report_configuration_id` é `NOT NULL`, mas o código de `createShare` insere `null` com frequência.

### 2.2 ReportAggregationService (`src/lib/reports/ReportAggregationService.ts`)

Motor central reutilizado por .docx e dashboard:

- `getBasicTotals(surveyId)`
- `getQuestionDistribution(surveyId, questionId)`
- `getCrossTab(surveyId, q1, q2)` — pivô em memória no JS após buscar todas as respostas das 2 perguntas
- `getCrossableQuestions(surveyId)` — filtra por `single_choice | multiple_choice | rating`

**Ponto positivo:** Lógica centralizada e comentada com decisão de arquitetura clara (queries diretas → materialized views).

### 2.3 APIs de Relatórios

- `GET /api/reports/[surveyId]/analytics` — (autenticado tenant) suporta `?cross1=&cross2=`
- `GET /api/reports/public/[shareToken]/analytics` — suporta credenciais na query + `?cross1=&cross2=`
- `POST /api/reports/[surveyId]/shares` — cria share + opcionalmente já define credenciais do contratante
- `POST /api/reports/[surveyId]/generate-docx` — aceita `selectedCrossings` no body

### 2.4 Fluxo de Acesso Público para Contratante

Página funcional em:
`src/app/reports/public/[shareToken]/page.tsx`

Fluxo completo implementado:
1. Acesso via token
2. Login com email + senha (bcrypt comparado contra `report_shares`)
3. Carregamento de totais + lista de perguntas cruzáveis
4. Seleção de 2 variáveis → chamada ao endpoint → retorno do cruzamento

### 2.5 Geração de .docx com Cruzamentos

`DocxReportGenerator.ts` consegue:
- Incluir seções de cruzamentos quando `config.selectedCrossings` é fornecido
- Resolver labels das perguntas
- Gerar tabelas simples nos relatórios do tipo "analytical" e "consolidated"

---

## 3. Gaps Críticos (Principalmente Filtros)

### 3.1 Ausência Total de Filtros (o pedido explícito da fase)

**Não existe nenhum mecanismo de filtro** em:

- `ReportAggregationService.getCrossTab()`
- Endpoints de analytics (público e privado)
- UI do relatório dinâmico

**Filtros esperados e ausentes:**
- Por localidade / município
- Por zona (urban/rural) — já existe no planejamento
- Por entrevistador / equipe
- Por período (data início/fim)
- Por variáveis demográficas (ex: só mulheres 25-40)
- Por status da resposta (complete / partial)

Sem filtros, o cruzamento dinâmico perde muito valor analítico para o contratante.

### 3.2 UI do Relatório Dinâmico é Protótipo

No arquivo `page.tsx` do relatório público:

```tsx
{crossResult && (
  <pre className="...">
    {JSON.stringify(crossResult, null, 2)}
  </pre>
)}
```

- Sem tabela formatada
- Sem gráfico (Recharts hardcoded em outro card)
- Sem aplicação de filtros antes do cruzamento
- Sem drill-down ou salvamento de visualização

Comentário no código reconhece: *"Em produção completa: tabelas formatadas + gráficos..."*

### 3.3 Falta de Interface para o Pesquisador

Não foi encontrado **nenhum componente** que chame:

- `POST /api/reports/[surveyId]/shares`
- `GET /api/reports/[surveyId]/shares`
- `POST /api/reports/[surveyId]/generate-docx`

O pesquisador não consegue, hoje:
- Configurar um relatório dinâmico
- Escolher quais cruzamentos pré-carregar
- Gerar link protegido com credenciais do contratante
- Visualizar preview do que o contratante verá

### 3.4 Problemas de Arquitetura e Performance

| Problema | Impacto | Severidade |
|----------|---------|------------|
| Agregação 100% em JS após `SELECT *` | Colapso com > 3-5k respostas | Alta |
| Sem materialized views / cache | Dashboard lento em produção | Alta |
| getCrossTab não aceita filtros | Impossível atender requisito da fase | Crítica |
| Sem suporte a >2 variáveis | Limitado para análises reais | Média |
| Sem pesos (weighting) | Inaceitável para pesquisa profissional | Média-Alta |

### 3.5 Inconsistências de Schema vs Código

1. `report_shares.report_configuration_id NOT NULL` vs código que passa `null`
2. `report_shares` pode ser criado sem vínculo com `report_configurations` (o que enfraquece o conceito de "configuração salva")
3. Tabela `report_access_logs` nunca é populada (nenhum `INSERT` encontrado)

### 3.6 Outros Gaps

- `preferred_visualization` das perguntas existe no banco mas quase nunca é respeitado na UI de relatórios
- Sem exportação do cruzamento dinâmico (Excel, CSV, imagem)
- Sem testes (unitários ou de integração) no módulo de relatórios
- Sem tratamento de múltipla escolha em cruzamentos (getCrossTab trata como string simples)
- Sem paginação/limites nos resultados de cruzamento

---

## 4. Mapeamento vs Plano Original (PLANO-IMPLEMENTACAO-MODULOS-FALTANTES.md)

| Entrega Esperada na Fase 4 | Status Atual |
|---------------------------|--------------|
| Dashboard interativo (filtros, drill-down) | Parcial — sem filtros |
| Geração de link público/privado com token | **Concluído** |
| Controle de validade (expiração, contagem) | Parcial (expira_at existe, não usado na UI) |
| Visualização de todos os cruzamentos possíveis | Protótipo (só 2 por vez, sem filtros) |
| Materialized Views + Cache | Não iniciado (comentado como futuro) |

A Fase 4 foi parcialmente executada de forma "de baixo para cima" (começou pelo motor e acesso público), mas pulou a experiência do usuário final (pesquisador configurando + contratante consumindo com filtros).

---

## 5. Recomendações Priorizadas

### Prioridade Crítica (para destravar a fase)

1. **Implementar filtros no ReportAggregationService**
   - Adicionar parâmetro `filters?: CrossTabFilters` em `getCrossTab`
   - Suportar: `localities`, `zones`, `interviewerIds`, `dateFrom`, `dateTo`, `demographicFilters`
   - Propagar filtros até o endpoint público e privado

2. **Corrigir inconsistência de schema**
   - Tornar `report_configuration_id` nullable na migration ou forçar vínculo no serviço

3. **Criar componente de UI para o pesquisador** (dentro de `/dashboard/surveys/[id]`)
   - Aba "Relatórios e Compartilhamento"
   - Lista de shares existentes
   - Formulário para criar share + definir credenciais do contratante
   - Seleção de cruzamentos pré-configurados

4. **Evoluir a página do contratante**
   - Substituir `<pre>JSON</pre>` por tabela pivot + Recharts real
   - Adicionar painel de filtros (multi-select de localidades, zona, etc.)
   - Botão "Aplicar filtros + Gerar cruzamento"

### Prioridade Alta

5. **Otimizar performance do motor de cruzamento**
   - Mover lógica de agregação para SQL (GROUP BY + FILTER ou CTEs)
   - Criar primeira materialized view para respostas + perguntas achatadas

6. **Escrever testes** para `ReportAggregationService` (cenários com e sem filtros)

7. **Popular report_access_logs** nos endpoints de analytics e geração de docx

### Prioridade Média

8. Suporte a cruzamentos de 3 variáveis (com limitação de performance clara)
9. Respeitar `preferred_visualization` ao renderizar cruzamentos
10. Permitir exportar o cruzamento atual (CSV / Excel)

---

## 6. Arquivos Principais Analisados

| Arquivo | Papel |
|---------|-------|
| `src/lib/reports/ReportAggregationService.ts` | Motor de agregação e cruzamentos |
| `src/lib/reports/PublicReportAccessService.ts` | Autenticação de contratantes |
| `src/lib/reports/types.ts` | Tipos centrais (CrossTabResult, etc.) |
| `src/lib/reports/DocxReportGenerator.ts` | Geração de Word com cruzamentos |
| `src/app/api/reports/public/[shareToken]/analytics/route.ts` | Endpoint principal do dinâmico |
| `src/app/api/reports/[surveyId]/shares/route.ts` | Criação/gerenciamento de links |
| `src/app/reports/public/[shareToken]/page.tsx` | UI do contratante (protótipo) |
| `supabase/migrations/20260528*_reports*.sql` | Schema das tabelas de relatórios |

---

## 7. Conclusão

A fase de **relatório dinâmico com filtros para cruzamento de dados** tem uma **base técnica sólida** (especialmente o serviço de agregação + fluxo de acesso protegido), mas está **incompleta no que mais importa para o usuário**:

- **Zero suporte a filtros** hoje
- UI do contratante é apenas demonstrativa
- Pesquisador não tem ferramenta para configurar e entregar o relatório dinâmico

**Próximo passo recomendado:** Priorizar a implementação de filtros no `ReportAggregationService` + criação de um painel mínimo de filtros na UI do contratante. Só depois vale refatorar performance e construir a UI de administração de shares.

Com essas duas entregas, o sistema passa de "protótipo que prova o conceito" para "MVP usável da Fase 4".

---

**Fim do Relatório de Análise**
