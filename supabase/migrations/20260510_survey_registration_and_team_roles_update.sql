-- ============================================================================
-- MIGRATION: 20260510_survey_registration_and_team_roles_update.sql
-- DescriÃ§Ã£o: Campos regulatÃ³rios em surveys e atualizaÃ§Ã£o de cargos da equipe
-- Data: 2026-05-10
-- ============================================================================

-- ============================================================================
-- PARTE 1: CAMPOS REGULATÃ“RIOS DA PESQUISA
-- ============================================================================

ALTER TABLE public.surveys ADD COLUMN IF NOT EXISTS is_registered_research BOOLEAN DEFAULT FALSE;
ALTER TABLE public.surveys ADD COLUMN IF NOT EXISTS registered_responsible_name VARCHAR(255);
ALTER TABLE public.surveys ADD COLUMN IF NOT EXISTS registered_responsible_registry VARCHAR(120);
ALTER TABLE public.surveys ADD COLUMN IF NOT EXISTS registered_responsible_body VARCHAR(120);

COMMENT ON COLUMN public.surveys.is_registered_research IS
'Indica se a pesquisa foi registrada em Ã³rgÃ£o de classe oficial';
COMMENT ON COLUMN public.surveys.registered_responsible_name IS
'Nome do responsÃ¡vel tÃ©cnico quando houver registro oficial';
COMMENT ON COLUMN public.surveys.registered_responsible_registry IS
'NÃºmero de cadastro/registro profissional do responsÃ¡vel';
COMMENT ON COLUMN public.surveys.registered_responsible_body IS
'Ã“rgÃ£o de classe do registro profissional';

-- ============================================================================
-- PARTE 2: REVISÃƒO DOS CARGOS DA EQUIPE
-- ============================================================================

-- Mapeamento dos cargos antigos para os novos rÃ³tulos de negÃ³cio
UPDATE public.users
SET role = 'coordinator_general'
WHERE role = 'coordinator';

UPDATE public.users
SET role = 'supervisor_quality'
WHERE role = 'fiscal';

-- Recria a constraint de roles com os cargos atualizados
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check
CHECK (role IN (
    'admin',
    'manager',
    'interviewer',
    'driver',
    'coordinator_general',
    'coordinator_field',
    'supervisor_quality'
));

COMMENT ON COLUMN public.users.role IS
'Cargo do usuÃ¡rio: admin=Administrador, manager=Gerente, coordinator_general=Coordenador Geral, coordinator_field=Coordenador de Campo, interviewer=Entrevistador, supervisor_quality=Supervisor de Coleta e Qualidade, driver=Motorista';
