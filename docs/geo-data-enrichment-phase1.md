# Plano de Implementação – Fase 1: Enriquecimento de Dados Geo para Planejamento de Pesquisa

**Status:** Em execução  
**Período estimado:** 2–3 semanas  
**Prioridade:** Alta (alinhamento entre a poderosa camada de dados geo criada nos ETLs e o módulo de Planejamento)

---

## 1. Contexto e Objetivo Estratégico

O sistema possui uma camada de dados geográficos extremamente rica no PostgreSQL (IBGE + TSE + CNEFE 2022 + PostGIS), construída através de ETLs automatizados. No entanto, o módulo de **Planejamento de Pesquisa** (especialmente Passos 2 e 4) atualmente consome majoritariamente:

- Dados de municípios via `vw_municipio_resumo` (parcialmente)
- Localidades diretamente da API do IBGE em tempo de execução (sem usar o que já está persistido e enriquecido no banco)
- População básica que o usuário traz na seleção manual

**Objetivo da Fase 1:**
Transformar o banco de dados geo na **fonte primária confiável e enriquecida** para o fluxo de Planejamento de Pesquisa, com fallback elegante e transparente para as APIs IBGE/TSE quando necessário.

Benefícios esperados:
- População mais precisa (Censo 2022 via `geo_demograficos_municipio` + agregados)
- Contagem real de residências (CNEFE) → base excelente para dimensionamento amostral
- Total de eleitores e % de mobilização eleitoral por município/localidade
- Indicadores claros de qualidade/cobertura dos dados para o pesquisador
- Redução de chamadas externas e melhoria de performance/consistência

---

## 2. Escopo Exato da Fase 1 (Entregáveis)

### 2.1 Novos / Melhorados Endpoints (Backend)

1. **`/api/geo/municipality-profile`** (NOVO – principal entregável)
   - Entrada: `state` + `city` (nome ou código)
   - Saída rica:
     - Dados básicos do município (id_ibge, nome, uf, regiao, populacao_estimada)
     - `population_census` (prioridade `geo_demograficos_municipio`)
     - `total_electorate` + `electorate_percentage`
     - `residences_cnefe` (total de residências)
     - `localities_count` (total / urbanas / rurais)
     - `data_quality`: objeto com flags (`has_census`, `has_tse`, `has_cnefe`, `ingestion_score`)
     - `sources`: array de fontes usadas
     - `last_updated`

2. **Melhoria em `/api/geo/localities`** (híbrido)
   - Adicionar parâmetro opcional `?enriched=true`
   - Quando true: priorizar dados de `geo_localidades` + joins com `geo_dados_residenciais` e `geo_dados_demograficos`
   - Manter 100% compatibilidade com o comportamento atual (fallback para IBGE puro)

3. **Melhoria em `/api/geo/municipios`**
   - Adicionar campos de qualidade na resposta quando possível:
     - `has_census_data`, `has_tse_data`, `has_cnefe_data`, `data_quality_score` (0–3)
   - Manter contrato atual

### 2.2 Camada de Planejamento (Frontend)

4. **Atualização de tipos** (`components/planning/types.ts`)
   - Enriquecer `PlanningMunicipality` e `PlanningLocality` com campos opcionais de metadados enriquecidos.

5. **Evolução do `GeographicBaseSelector`**
   - Ao selecionar um município, fazer chamada para o profile enriquecido (com debounce/throttling).
   - Exibir badges visuais de qualidade:
     - "Censo 2022 disponível"
     - "Dados TSE disponíveis"
     - "Residências CNEFE: X"
     - Score visual (Excelente / Boa / Parcial)
   - Botão/ toggle "Usar dados enriquecidos do banco (recomendado)" vs "Usar apenas dados básicos"
   - Quando enriquecido selecionado: sobrescrever `population` com o valor mais preciso do banco.
   - Resumo da base passa a mostrar métricas adicionais (residências totais, % eleitores, etc.)

6. **Ajustes em `Step2GeographicBase` e `Step4Distribution`**
   - Passar metadados enriquecidos adiante no `geographicBase`.
   - No Passo 4: usar população do profile enriquecido como base para cálculo proporcional quando disponível (melhor que a população_estimada simples).

### 2.3 Suporte e Qualidade

7. (Opcional, mas recomendado) Criar ou ajustar uma **view materializada ou função RPC** para o municipality-profile (performance).
8. Garantir que todas as mudanças sejam **retrocompatíveis**.
9. Adicionar tratamento de erro + integração com `reportClientError` nos novos fluxos.
10. Documentação inline + atualização do plano.

---

## 3. Arquitetura Proposta (Decisões Tomadas)

- **Fonte primária para Planejamento:** Banco de dados (via Supabase client no backend ou RPC quando possível).
- **Fallback:** Manter chamadas atuais para IBGE/TSE (com cache já existente).
- **Princípio:** "Enriquecido quando disponível, básico quando não".
- **UI Philosophy:** Dar controle e transparência ao pesquisador (ele vê a qualidade dos dados que está usando).
- **Performance:** Usar o `geo_ibge_cache` existente + queries bem indexadas nas views.
- **Não bloquear:** Nada que quebre o fluxo atual de seleção de municípios/localidades.

---

## 4. Ordem Recomendada de Implementação (Interna)

1. **Análise + Documentação** (este arquivo) – feito
2. Implementar endpoint `/api/geo/municipality-profile` (o mais impactante)
3. Melhorar `/api/geo/localities` com modo enriched
4. Estender resposta de `/api/geo/municipios`
5. Atualizar tipos TypeScript
6. Evoluir o componente `GeographicBaseSelector` (UI + chamadas)
7. Ajustes em Step2 + Step4
8. Testes manuais + TypeScript + integração com monitoring
9. Documentação final e commit

---

## 5. Riscos e Mitigações

| Risco | Probabilidade | Mitigação |
|-------|---------------|---------|
| View `vw_municipio_resumo` desatualizada (migrações divergentes) | Médio | Fazer queries diretas com joins na API quando necessário (mais confiável que depender só da view) |
| Performance em municípios grandes (muitas localidades) | Médio | Usar agregações no banco + paginação/limite no enriched localities |
| Quebra de compatibilidade em chamadas existentes | Baixo | Manter parâmetros e formatos atuais; adicionar campos novos como opcionais |
| ETLs ainda não rodaram para todos os municípios | Médio | UI mostra claramente quando dados estão parciais + fallback automático |
| Complexidade de matching nome de cidade | Baixo | Reutilizar lógica existente de `br-reference.ts` + normalize |

---

## 6. Critérios de Sucesso da Fase 1

- Ao selecionar um município no Passo 2, o sistema mostra pelo menos 2–3 indicadores de dados enriquecidos (quando disponíveis).
- População usada no Passo 4 pode vir do Censo (mais precisa) quando o usuário opta por dados enriquecidos.
- Nenhuma chamada existente quebra (regressão zero).
- TypeScript limpo e sem warnings novos.
- Pesquisador consegue entender facilmente a qualidade da base geográfica que está montando.

---

## 7. Arquivos Principais que Serão Tocados

**Backend (APIs):**
- `apps/web/src/app/api/geo/municipality-profile/route.ts` (novo)
- `apps/web/src/app/api/geo/localities/route.ts` (modificação)
- `apps/web/src/app/api/geo/municipios/route.ts` (extensão leve)

**Tipos e Componentes:**
- `apps/web/src/components/planning/types.ts`
- `apps/web/src/components/planning/GeographicBaseSelector.tsx`
- `apps/web/src/app/(dashboard)/planning/new/steps/Step2GeographicBase.tsx`
- `apps/web/src/app/(dashboard)/planning/new/steps/Step4Distribution.tsx`

**Documentação:**
- Este arquivo
- Possível atualização em `docs/deployment.md` ou `TSE_VOTER_DATA.md`

**Possível (se necessário):**
- Nova migration para view otimizada ou RPC (se performance exigir)

---

## 8. Visão de Fases Futuras (Breve)

**Fase 2 (Médio prazo):**
- Integração mais profunda de perfil TSE (faixas etárias/sexo) no Passo 4 para sugestão de cotas por estrato.
- Uso de `residencias_cnefe` como denominador para cálculos de densidade amostral.
- Unificação da seleção de localidades entre Planejamento e módulo de Surveys.

**Fase 3 (Longo prazo):**
- Camada de "Geo Intelligence" (funções RPC ou service) como fonte única.
- Materialized views para performance.
- Suporte a dados mais granulares (setor censitário) quando necessário.

---

**Próximo passo imediato:** Implementação do endpoint `/api/geo/municipality-profile`.

Todas as ações deste plano estão aprovadas para execução autônoma e de alta qualidade.

---

*Documento gerado como parte do esforço contínuo de evolução do módulo de Planejamento de Pesquisa – Sistema iDialog SPI.*
