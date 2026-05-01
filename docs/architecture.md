# Arquitetura do Sistema

## Visão Geral

O SPI - Sistema de Pesquisa Inteligente é composto por:

1. **App Mobile (React Native/Expo)**: Coleta de dados em campo com suporte offline
2. **Dashboard Web (Next.js)**: Gestão de pesquisas e análise de dados
3. **Backend (Supabase)**: PostgreSQL + PostGIS, Auth, Storage, Edge Functions
4. **Monorepo (Turborepo)**: Pacotes compartilhados entre mobile e web

## Fluxo de Dados

```
Entrevistador (Mobile) → SQLite Local → Sync Engine → Supabase → Dashboard (Web)
```

## Fluxo de Sincronização

```
┌─────────────┐
│  MOBILE APP │
└──────┬──────┘
       │
       │ 1. Entrevistador cria resposta offline
       ▼
┌─────────────────┐
│ SQLite (Local)  │  ← Armazena response com local_id (UUID)
└──────┬──────────┘
       │
       │ 2. Adiciona à tabela sync_queue
       ▼
┌─────────────────┐
│  Sync Queue     │  ← { entity_type: 'response', retry_count: 0 }
└──────┬──────────┘
       │
       │ 3. Rede detectada OU Background task disparada
       ▼
┌─────────────────┐
│  SyncEngine     │  ← triggerSync()
└──────┬──────────┘
       │
       │ 4. Upload em batch (50 itens)
       ▼
┌─────────────────────┐
│ SUPABASE (Postgres) │
└──────┬──────────────┘
       │
       │ 5. RLS Policy verifica tenant_id
       ▼
   ┌───────┐
   │  OK?  │
   └───┬───┘
       │
   ┌───▼───────────┐
   │ SIM: Insert   │ ──► 6. Retorna server_id
   └───────────────┘          │
       │                      ▼
   ┌───▼────────────┐   ┌──────────────┐
   │ NÃO: Conflito? │   │ Atualiza     │
   └───┬────────────┘   │ local com    │
       │                │ server_id e  │
   ┌───▼──────────┐     │ synced=true  │
   │ Resolver com │     └──────────────┘
   │ Last-Write-  │
   │ Wins (LWW)   │
   └──────────────┘
       │
       │ 7. Remove da sync_queue
       ▼
      ✅ DONE
```

## Edge Cases Tratados

1. **Sem Rede**: Acumula em `sync_queue`, retry com exponential backoff
2. **Conflito de Dados**: Last-Write-Wins baseado em `updated_at` + `sync_version`
3. **Falha Parcial**: Apenas itens com erro permanecem na fila (max 5 retries)
4. **Storage Cheio**: Compressão de imagem (70% quality, max 1920x1080) antes do upload
5. **App Fechado**: Background Fetch continua sincronizando a cada 15 minutos

## Offline-First Strategy

1. Dados são salvos localmente no SQLite (expo-sqlite)
2. Fila de sincronização (`sync_queue`) gerencia pendências
3. Ao detectar conexão, SyncEngine processa a fila em batches de 50
4. Conflitos são resolvidos com "Last-Write-Wins" (LWW)
5. Retry com exponential backoff em caso de falha
6. Respostas e suas `response_answers` são sincronizadas separadamente

## Multi-Tenant

- Isolamento de dados por `tenant_id`
- Row Level Security (RLS) no PostgreSQL via `get_user_tenant_id()`
- Cada organização/partido é um tenant
- Limites configuráveis: `max_users`, `max_surveys`, `storage_limit_mb`
- Soft delete com `deleted_at` em tenants e surveys

## Stack

| Componente | Tecnologia |
|---|---|
| Mobile | React Native + Expo |
| Web | Next.js 14 (App Router) |
| State (Mobile) | Zustand |
| DB Local | SQLite (expo-sqlite) |
| Backend | Supabase (PostgreSQL + PostGIS) |
| Auth | Supabase Auth |
| Storage | Supabase Storage |
| Validação | Zod |
| Monorepo | Turborepo |
| CI/CD | GitHub Actions + Vercel + EAS |

## Custos (Free Tier)

| Componente | Tecnologia | Custo Mensal |
|------------|-----------|-------------|
| Backend | Supabase (Postgres + Auth + Storage) | $0 (até 500MB DB, 1GB Storage) |
| Frontend Web | Vercel (Next.js) | $0 (Hobby tier) |
| Mobile | Expo (APK direto) | $0 (sem publicação em stores) |
| CDN/Media | Supabase Storage | $0 (até 1GB) |

### Quando escalar?

- **Supabase Pro ($25/mês)**: Acima de 500MB de dados ou backups diários
- **Vercel Pro ($20/mês)**: Domínio customizado e analytics avançados
- **Play Store ($25 one-time)**: Publicar APK oficialmente
