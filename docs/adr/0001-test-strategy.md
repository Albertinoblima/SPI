# ADR-0001: Estratégia de Testes (Test Strategy)

**Status:** Accepted  
**Date:** 2026-06  
**Deciders:** Arquiteto Sênior  
**Consulted:** Plano de Evolução Fase 0

---

## Context

O sistema atualmente possui **zero testes automatizados** em todo o código fonte. Isso representa o maior risco técnico identificado na auditoria:

- Alto risco de regressão em refatorações
- Dificuldade de validar comportamentos críticos (sync, auth multi-tenant, relatórios, RLS)
- Impossibilidade de fazer mudanças com confiança

O plano aprovado exige que a **Fase 0** estabeleça uma fundação sólida de testes antes de qualquer grande refatoração ou nova funcionalidade complexa.

## Decision

Adotar a seguinte **Estratégia de Testes** para o iDialog SPI, alinhada com os 10 Princípios do Plano de Evolução:

### 1. Test Pyramid (Rigorosa)

| Camada          | % Alvo | Propósito                                      | Exemplos |
|-----------------|--------|------------------------------------------------|----------|
| **Unit**        | 70%    | Lógica pura, validações, services, utils       | Zod schemas, formatters, conflict resolvers, business rules |
| **Integration** | 20%    | Interação entre camadas + dependências reais   | API Routes (com mocks controlados), SyncEngine + SQLite, Report generators |
| **Contract**    | 7%     | Contratos entre sistemas (Edge Functions, Mobile ↔ Backend) | sync-responses, process-media, mobile auth flows |
| **E2E / Visual**| 3%     | Fluxos críticos ponta a ponta                  | Criar pesquisa → distribuir → coletar offline → sync → gerar relatório |

### 2. Escopo por Fase (Fase 0 foco)

**Fase 0 (Fundação):**
- Cobertura mínima de **40% geral** / **60% em caminhos críticos**
- Foco em:
  - Pacotes compartilhados (`shared-validations`, `shared-utils`)
  - Camada de autenticação e autorização (`api-middleware.ts`, `getMobileAuthContext`, mobile token)
  - Edge Functions (testes de contrato)
  - Políticas RLS críticas (via pgTAP)

**Fase 1+:**
- Elevar para 70%+ em lógica de domínio
- Adicionar testes mobile robustos
- E2E para fluxos de relatório e sync

### 3. Stack de Ferramentas

**Web (Next.js 14 App Router):**
- Jest + `@swc/jest` (velocidade)
- `@testing-library/react` + `@testing-library/jest-dom`
- `next/jest` preset (recomendado para Next.js)
- MSW (Mock Service Worker) para mocks de rede/Supabase

**Shared Packages:**
- Jest + `@swc/jest` ou `ts-jest`
- Testes de schemas Zod e utilitários puros

**Mobile (React Native + Expo):**
- Jest + `react-native-testing-library`
- Mocks específicos para `expo-sqlite`, `@supabase/supabase-js`, `expo-location`, etc.
- Foco em testes de integração do SyncEngine

**Edge Functions (Deno):**
- Testes de contrato usando `@supabase/supabase-js` + Deno test runner ou `deno test`

**Banco / RLS:**
- **pgTAP** (executado dentro do Supabase ou via scripts)
- Testes obrigatórios para toda nova política RLS

**E2E (fase posterior):**
- Playwright (web)
- Detox (mobile) — avaliado posteriormente

### 4. Estratégia de Mocks

- **Supabase**: Nunca usar cliente real em testes de unidade. Usar MSW para rotas HTTP ou mocks manuais de `createClient`.
- **SQLite (mobile)**: Usar banco em memória (`:memory:`) ou arquivo temporário por teste.
- **Network**: MSW é a ferramenta preferida para consistência entre web e mobile.
- **Geolocalização / Câmera**: Mocks determinísticos com factories.

### 5. Cobertura e Qualidade

- Thresholds configurados no Jest por pacote/app.
- Em Fase 0: thresholds brandos (40-60%) para permitir ramp-up.
- A partir de Fase 1: thresholds mais rigorosos (mínimo 70% em código novo).
- Branches e functions devem ser cobertos em lógica crítica.

### 6. Execução

- **Local**: `npm run test` (via Turborepo quando possível)
- **CI**: Executado no workflow `quality-gates.yml` (após Fase 0.2.2)
- Pré-commit: apenas testes afetados pelos arquivos staged (via `jest --findRelatedTests`)

### 7. Princípios Adotados

- Testes devem ser **rápidos** (< 10s para suite completa na máquina do dev).
- Testes devem ser **determinísticos** (sem flakiness).
- Preferir **testes de comportamento** sobre testes de implementação.
- Todo código novo em caminhos críticos deve vir acompanhado de testes.

## Consequences

### Positive
- Cria confiança para refatorações necessárias (especialmente mobile e reports).
- Permite evolução segura do sistema.
- Estabelece cultura de qualidade desde o início.
- Reduz drasticamente o custo de manutenção a longo prazo.

### Negative / Trade-offs
- Aumento inicial de tempo para desenvolver features (curva de aprendizado + escrita de testes).
- Necessidade de boa infraestrutura de mocks (especialmente Supabase e SQLite).
- Manutenção dos mocks quando contratos mudam.

## Alternatives Considered

| Alternativa                    | Rejeitada porque |
|--------------------------------|------------------|
| Usar apenas Vitest             | Jest tem melhor ecossistema para React Native e Next.js em 2026. |
| Cobertura 80% desde o dia 1    | Irrealista e geraria resistência. Ramp-up controlado é mais sustentável. |
| Focar só em E2E (Playwright)   | Muito lento e frágil. Viola a pirâmide. |
| Testes apenas em TypeScript puro (sem RTL) | Baixa confiança em componentes React e fluxos de UI. |

## References

- Plano de Evolução: `PLANO_EVOLUCAO_NIVEL_SENIOR_PROFISSIONAL.md` (Fase 0.2)
- ADR-0000: Aprovação do plano
- Documentação futura: `docs/testing.md` (será criado após setup)

---

**Próximo passo:** Implementação da infraestrutura de testes (Jest + RTL) começando pelo web e pacotes compartilhados.
