# iDialog SPI - Sistema de Pesquisa Inteligente

Plataforma inteligente de pesquisa com suporte offline-first para coleta de dados em campo.

## Arquitetura

- **apps/mobile**: Aplicativo React Native (Expo) para coleta de dados em campo
- **apps/web**: Dashboard Next.js para gestão de pesquisas e análise de dados
- **packages/shared-types**: Tipos TypeScript compartilhados
- **packages/shared-validations**: Schemas Zod compartilhados
- **packages/shared-utils**: Utilitários comuns
- **supabase**: Configuração do Supabase (migrations, edge functions)

## Stack Tecnológica

- **Mobile**: React Native + Expo + SQLite (offline-first)
- **Web**: Next.js + Vercel
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Edge Functions)
- **Monorepo**: Turborepo

## Pré-requisitos

- Node.js >= 18
- Supabase CLI
- Expo CLI

## Setup

```bash
# Instalar dependências
npm install

# Configurar ambiente de desenvolvimento
./scripts/setup-dev.sh

# Rodar web
npm run dev:web

# Rodar mobile
npm run dev:mobile
```

## Estrutura do Banco de Dados

- **tenants**: Organizações/partidos (multi-tenant)
- **users**: Pesquisadores e administradores
- **surveys**: Pesquisas configuráveis
- **questions**: Perguntas dinâmicas (texto, múltipla escolha, GPS, foto, áudio)
- **responses**: Respostas coletadas com geolocalização
- **sync_log**: Log de sincronização offline → online

## Status de Implantação da Edge Function

A implantação automática da função Edge `sync-responses` no Supabase ficou **pendente** devido a limitações de rede/ambiente para baixar e instalar a Supabase CLI.

**Como proceder:**

1. Baixe manualmente a Supabase CLI pelo navegador: <https://github.com/supabase/cli/releases/latest/download/supabase_windows_amd64.exe>
2. Renomeie para `supabase.exe` e coloque em uma pasta do PATH (ex: `C:\Windows` ou `C:\Users\SeuUsuario`).
3. Execute o comando de deploy na raiz do projeto:

   ```bash
   supabase functions deploy sync-responses --no-verify-jwt
   ```

Após a instalação, a função estará pronta para ser implantada normalmente.
