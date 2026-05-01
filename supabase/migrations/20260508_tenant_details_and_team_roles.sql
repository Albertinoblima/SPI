-- ============================================================================
-- MIGRATION: 20260508_tenant_details_and_team_roles.sql
-- Descrição: Campos de detalhes da empresa no tenant e expansão dos cargos da equipe
-- Data: 2026-05-08
-- ============================================================================

-- Garante extensão uuid padrão
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- PARTE 1: CAMPOS DE DETALHES DA EMPRESA
-- ============================================================================

ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS cnpj VARCHAR(18);
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS website VARCHAR(255);
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS address VARCHAR(255);
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS address_number VARCHAR(20);
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS address_complement VARCHAR(100);
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS neighborhood VARCHAR(100);
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS city VARCHAR(100);
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS state VARCHAR(2);
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS zip_code VARCHAR(9);
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS responsavel_tecnico VARCHAR(255);

-- ============================================================================
-- PARTE 2: EXPANDIR ROLES DE USUÁRIO
-- ============================================================================

-- Remover constraint antiga de role
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;

-- Criar nova constraint com todos os cargos
ALTER TABLE public.users ADD CONSTRAINT users_role_check
    CHECK (role IN ('admin', 'manager', 'interviewer', 'fiscal', 'driver', 'coordinator'));

-- Atualizar comentários
COMMENT ON COLUMN public.users.role IS 
    'Cargo do usuário: admin=Administrador, manager=Gerente, coordinator=Coordenador, interviewer=Pesquisador, fiscal=Fiscal, driver=Motorista';
