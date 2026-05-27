-- Migration: Criação da tabela research_plans para o módulo Planejamento da Pesquisa
-- Estrutura leve, flexível e multi-tenant

create table if not exists public.research_plans (
    id uuid primary key default uuid_generate_v4(),
    tenant_id uuid not null references tenants(id) on delete cascade,
    created_by uuid not null references users(id) on delete set null,
    name text not null,
    status text default 'draft',
    planning_data jsonb not null default '{}',
    linked_survey_id uuid references surveys(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- Índices para performance e multi-tenant
create index if not exists idx_research_plans_tenant on public.research_plans (tenant_id);
create index if not exists idx_research_plans_created_by on public.research_plans (created_by);
create index if not exists idx_research_plans_status on public.research_plans (status);

-- RLS: Permitir acesso apenas ao tenant correto
alter table public.research_plans enable row level security;

-- Política: Somente usuários do tenant podem acessar
create policy "Research plans are tenant-isolated"
    on public.research_plans
    for all
    using (tenant_id = auth.uid()::uuid or auth.role() = 'service_role');
