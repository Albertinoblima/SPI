# iDialog SPI - Sistema de Pesquisa Inteligente

Plataforma multi-tenant para planejamento, coleta e analise de pesquisas de campo, com operacao web administrativa, aplicativo mobile para entrevistadores e backend em Supabase.

## 1. Resumo Executivo

O iDialog SPI centraliza o ciclo completo de uma pesquisa:

1. Planejamento da pesquisa no painel web.
2. Publicacao e distribuicao por equipe, rotas e cotas.
3. Coleta em campo no mobile (com suporte offline).
4. Sincronizacao de entrevistas e midia para o backend.
5. Monitoramento analitico, controle administrativo e exportacoes.
6. Operacao continua com automacoes de dados geograficos e eleitorais.

O projeto esta organizado em monorepo com Turborepo, compartilhando tipos, validacoes e utilitarios entre os aplicativos.

## 2. Objetivo do Sistema

Entregar uma stack completa para institutos e equipes de campo que precisam:

- Criar pesquisas estruturadas com governanca por tenant.
- Distribuir trabalho de campo por entrevistador, localidade, rota e quota.
- Coletar dados com confiabilidade (geolocalizacao, evidencias de campo, trilha de sincronizacao).
- Acompanhar resultados em tempo quase real.
- Manter historico tecnico e administrativo (auditoria, saude do sistema, tickets, logs).

## 3. Arquitetura Tecnica

### 3.1 Componentes

- Mobile: React Native + Expo Router
- Web: Next.js 14 (App Router)
- Backend: Supabase (PostgreSQL + PostGIS, Auth, Storage, Edge Functions)
- Banco local mobile: SQLite (schema via Drizzle ORM)
- Estado mobile: Zustand
- Validacao: Zod
- Monorepo: npm workspaces + Turborepo

### 3.2 Fluxo macro de dados

```
Entrevistador (app mobile)
  -> coleta resposta (online/offline)
  -> armazenamento local e fila de sync
  -> envio para APIs/Edge Functions
  -> persistencia em Supabase
  -> dashboards e operacao no web
```

### 3.3 Multi-tenant e isolamento

- Cada organizacao opera como um tenant.
- Politicas de seguranca (RLS) e filtros por tenant no backend.
- Separacao de usuarios, pesquisas, entrevistas, cotas, tickets e logs por tenant.

## 4. Estrutura do Monorepo

```
apps/
  web/      # painel administrativo, APIs e dashboard
  mobile/   # app de campo com fluxo de entrevista
packages/
  shared-types/
  shared-utils/
  shared-validations/
supabase/
  migrations/
  functions/
scripts/
docs/
```

## 5. Funcionalidades Implementadas por Modulo

## 5.1 Web (administrativo + operacao)

### 5.1.1 Autenticacao e acesso

- Login, cadastro, recuperacao e redefinicao de senha.
- Controle de rotas autenticadas.
- Perfis administrativos e separacao de responsabilidades.

### 5.1.2 Pesquisa e operacao de campo

- Criacao e gerenciamento de pesquisas.
- Publicacao de pesquisa.
- Vinculo de equipe na pesquisa.
- Distribuicao por rotas/localidades/cotas.
- Monitoramento por pesquisa.
- Visualizacao de respostas e mapa de respostas.

### 5.1.3 Dashboard e analise

- Endpoint de dashboard consolidado.
- Visualizacoes para acompanhamento operacional.
- Base para exportacoes de questionario/distribuicao.

### 5.1.4 Geografia e dados eleitorais

- Endpoints para estados, cidades, municipios, localidades e populacao.
- Endpoint de eleitores TSE com consulta por UF/cidade.
- Base estatica de dados eleitorais agregados para suporte analitico.

### 5.1.5 Configuracoes e suporte

- Configuracoes da empresa (dados e ativos).
- Upload de logo/arquivos de suporte.
- Tickets de suporte para tenant.
- Sistema de notificacoes e marcacao de leitura.

### 5.1.6 Area admin do sistema

- Gestao de tenants.
- Auditoria administrativa.
- Monitoramento de saude do sistema.
- Monitoramento e ingestao de erros.
- Gestao administrativa de tickets de suporte.

## 5.2 Mobile (coleta em campo)

### 5.2.1 Fluxo de app

- Autenticacao de entrevistador.
- Navegacao principal com abas (home, pesquisas, sincronizacao).
- Abertura de pesquisa e tela de resposta.

### 5.2.2 Recursos de coleta

- Captura de geolocalizacao e utilitarios de tracking.
- Captura/gestao de foto no fluxo de formulario.
- Validacao de respostas e estrutura de perguntas dinamicas.
- Armazenamento local para operacao offline.

### 5.2.3 Sincronizacao

- Orquestrador de sync com listener de rede.
- Tentativa de sincronizacao ao reconectar.
- Registro de task de sincronizacao em background (Expo Background Fetch).
- Estrategia para upload em lote e tratamento de retry/conflito.

Observacao importante sobre estado atual:

- O desenho tecnico de offline-first, fila de sincronizacao, retry e resolucao de conflitos esta implementado na arquitetura do app.
- Existem pontos marcados como TODO em partes da persistencia SQLite e em trechos do pipeline de sync. Ou seja, o fluxo esta estruturado, mas algumas etapas ainda estao em consolidacao no codigo.

## 5.3 Backend Supabase

### 5.3.1 Banco de dados

- Migracoes SQL versionadas em supabase/migrations.
- Estrutura para tenants, usuarios, pesquisas, perguntas, respostas, logs e suporte.
- Endurecimento de seguranca via migracoes de RLS/politicas/admin/auditoria.

### 5.3.2 Edge Functions

- sync-responses: sincronizacao em lote de respostas e respostas detalhadas.
- process-media: upload/processamento de midia para Storage.
- generate-analytics: geracao de agregados analiticos por pesquisa.

## 6. Processo Completo (Inicio ao Fim)

Esta secao descreve o fluxo operacional completo do sistema atual.

### Etapa 1: Configuracao da operacao

1. Criar/ajustar tenant e usuarios (admin, equipe, entrevistadores).
2. Configurar parametros institucionais e ativos visuais.
3. Confirmar acesso aos modulos web e mobile.

### Etapa 2: Planejamento da pesquisa

1. Cadastrar pesquisa no web.
2. Definir perguntas e parametros de coleta.
3. Publicar pesquisa.
4. Associar equipe da pesquisa.
5. Definir distribuicao por rotas e cotas.

### Etapa 3: Distribuicao para campo

1. Entrevistador autentica no app mobile.
2. App consulta dados da pesquisa publicada, rotas e cotas via API mobile.
3. Dados da pesquisa ficam disponiveis para execucao de entrevistas.

### Etapa 4: Coleta em campo

1. Entrevistador inicia entrevista.
2. Sistema registra metadados de tempo e contexto da coleta.
3. Respostas sao preenchidas (incluindo componentes de formulario e evidencias quando aplicavel).
4. Dados podem ser mantidos localmente ate sincronizacao.

### Etapa 5: Sincronizacao

1. Sincronizacao pode ser disparada manualmente e/ou por evento de conectividade.
2. Engine processa itens pendentes em lote.
3. Entrevistas e respostas sao enviadas para o backend.
4. Midias sao processadas e enviadas ao Storage.
5. Em erros, aplica-se estrategia de retry e rastreio de falha.

### Etapa 6: Supervisao e analise

1. Dashboard e telas de monitoramento apresentam situacao de coleta.
2. Equipe analitica consulta dados por pesquisa, regiao e indicadores.
3. Exportacoes e visoes detalhadas apoiam entrega de relatorios.

### Etapa 7: Operacao, suporte e governanca

1. Tickets de suporte sao abertos e tratados.
2. Logs e alertas sao acompanhados pela area administrativa.
3. Saude do sistema e integracoes externas (GitHub/Vercel) sao monitoradas.
4. Auditoria administrativa registra alteracoes relevantes.

## 7. APIs e Superficies de Integracao

## 7.1 APIs web (Next.js Route Handlers)

O sistema expoe um conjunto amplo de endpoints, incluindo:

- Auth: login, register, forgot/reset password.
- Surveys: CRUD, publicacao, distribuicao, preview/download de questionario, rotas, equipe.
- Dashboard e respostas.
- Mobile bridge: autenticacao mobile, pesquisa, rotas, cotas, sincronizacao de entrevistas.
- Geo: estados, cidades, municipios, localities, populacao, eleitores TSE.
- Settings/Company e assets.
- Notifications.
- Support tickets e upload.
- Admin: tenants, audit-log, system health/stats/errors, support administrativo.

## 7.2 Edge Functions

- /functions/v1/sync-responses
- /functions/v1/process-media
- /functions/v1/generate-analytics

## 8. Modelo de Dados (Visao Funcional)

Entidades principais no backend:

- tenants
- users
- surveys
- questions
- responses
- response_answers
- sync_log
- interview/interview_answers (fluxo de campo via API web)
- estruturas de distribuicao (rotas, localities, quotas e equipe)
- modulos de suporte, notificacoes e auditoria

No mobile (SQLite local), existe schema para:

- surveys e metadados locais
- routes/quotas
- interviews/responses/answers
- sync_queue com retry metadata

## 9. Seguranca, Controle e Observabilidade

### 9.1 Seguranca

- Politicas de isolamento por tenant.
- Uso de service role apenas em contexto servidor/funcoes.
- Endpoints com validacao de payload e tratamento padronizado de erro.
- Catalogo de codigos de erro para operacao e suporte.

### 9.2 Observabilidade

- Coleta/consulta de logs de erro e severidade.
- Endpoint de saude com dados de Supabase, GitHub e Vercel.
- Centro administrativo para auditoria e suporte.

## 10. Dados Geograficos e Eleitorais (ETL + Automacao)

O projeto inclui pipeline de dados para enriquecer analise territorial:

- ETL IBGE/TSE.
- Consolidacao CNEFE 2022.
- Geracao de base estatica de eleitores por municipio.

Workflows CI/CD relevantes:

- deploy-web.yml
- build-mobile.yml
- etl-geo-ibge.yml
- monthly-data-sync.yml
- update-tse-voters.yml
- sql-lint.yml

## 11. Setup de Desenvolvimento

## 11.1 Pre-requisitos

- Node.js 18+
- npm 10+
- Supabase CLI (para banco/funcoes locais)
- Python 3.11+ (para scripts ETL e utilitarios SQL)

## 11.2 Instalacao

```
npm install
```

Opcional (bootstrap de ambiente via script):

```
bash scripts/setup-dev.sh
```

## 11.3 Execucao

### Web

```
npm run dev:web
```

### Mobile

```
npm run dev:mobile
```

### Build/Lint/Typecheck

```
npm run build
npm run lint
npm run typecheck
```

## 12. Variaveis de Ambiente

## 12.1 Web (apps/web/.env.local)

Minimo para funcionamento:

- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY

Variaveis adicionais usadas em modulos administrativos e diagnostico:

- GITHUB_TOKEN
- GITHUB_REPO
- VERCEL_TOKEN
- VERCEL_PROJECT_ID
- VERCEL_TEAM_ID
- MOBILE_AUTH_SECRET (ou fallback SUPABASE_JWT_SECRET/NEXTAUTH_SECRET)

Existe exemplo em apps/web/.env.example.

## 12.2 Mobile

Usa variaveis publicas para conexao com backend/supabase no ambiente Expo.

## 13. SQL, Migracoes e Qualidade

- Migracoes em supabase/migrations.
- Lint SQL com SQLFluff integrado ao projeto.

Comandos:

```
npm run sql:lint
npm run sql:fix
npm run sql:check
npm run sql:lint:migrations
npm run sql:fix:migrations
```

## 14. Deploy e Operacao

Topologia de producao prevista:

- Web em Vercel.
- Backend em Supabase Cloud.
- Dominio principal de produto: spi.idialog.com.br.

Pipeline esperado:

1. Push na branch principal.
2. CI valida qualidade (incluindo SQL lint quando aplicavel).
3. Deploy web automatizado.
4. Monitoramento de saude e erros no painel admin.

## 15. Estado Atual e Escopo Tecnico

O repositorio contem uma base ampla e funcional para operacao web e backend, incluindo administracao de pesquisas, rotas/cotas, APIs mobile, monitoramento e governanca.

No mobile, a arquitetura de offline-first e sincronizacao ja esta desenhada e conectada aos modulos principais, com pontos especificos ainda em finalizacao (marcados como TODO) na camada de persistencia e no fluxo completo de sync local.

Isso permite evolucao incremental sem ruptura da arquitetura.

## 16. Documentacao Complementar

Consulte a pasta docs para detalhes aprofundados:

- architecture.md
- api-reference.md
- data-sync-strategy.md
- deployment.md
- dashboard_detalhado.md
- TSE_VOTER_DATA.md
- sqlfluff-setup.md
- error_codes_idialog.md

### Programa de Evolução para Nível Sênior

O projeto segue o **Plano de Evolução para Nível Sênior e Profissional** (aprovado).

- Todas as decisões arquiteturais relevantes são registradas em ADRs: `docs/adr/`
- Quality Gates obrigatórios rodam em todo PR (lint + typecheck) via `.github/workflows/quality-gates.yml`
- Hooks locais: Husky + lint-staged + commitlint (enforce qualidade no desenvolvedor local)
- Consulte `PLANO_EVOLUCAO_NIVEL_SENIOR_PROFISSIONAL.md` (raiz) para o roadmap completo, fases e gates de qualidade.

## 17. Licenca e Uso

Uso interno e operacional conforme diretrizes do projeto/organizacao mantenedora.
