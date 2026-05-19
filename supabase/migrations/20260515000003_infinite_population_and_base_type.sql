-- ============================================================================
-- MIGRATION: 20260515000003_infinite_population_and_base_type.sql
-- Descrição: Campos para tratamento de população infinita no cálculo amostral
--            e tipo de base populacional padrão da pesquisa (TSE / IBGE / etc.)
-- Data: 2026-05-15
-- ============================================================================

-- Modo de tratamento de população infinita
-- 'national_only' : apenas pesquisas nacionais usam fórmula infinita (padrão)
-- 'auto_threshold': localidades com pop >= threshold usam fórmula infinita
-- 'force_all'     : todas as localidades usam fórmula infinita
ALTER TABLE public.surveys
ADD COLUMN IF NOT EXISTS infinite_population_mode VARCHAR(20)
DEFAULT 'national_only'
CHECK (infinite_population_mode IN ('national_only', 'auto_threshold', 'force_all'));

-- Limiar de habitantes a partir do qual a localidade é tratada como população
-- infinita no modo 'auto_threshold' (padrão: 50.000 hab.)
ALTER TABLE public.surveys
ADD COLUMN IF NOT EXISTS infinite_population_threshold INTEGER DEFAULT 50000;

-- Tipo de base populacional padrão para as localidades da pesquisa.
-- Define automaticamente qual fonte de dados (TSE ou IBGE) será usada na Etapa 2.
ALTER TABLE public.surveys
ADD COLUMN IF NOT EXISTS population_type VARCHAR(30)
DEFAULT 'eleitores'
CHECK (population_type IN (
    'eleitores', 'habitantes', 'comerciantes', 'comerciarios',
    'consumidores', 'dona_de_casa', 'industriarios',
    'funcionarios_publicos', 'prestadores_servicos', 'professores',
    'profissional_liberal', 'publico_geral', 'segmento_especifico',
    'sindicalistas'
));

-- Comentários descritivos
COMMENT ON COLUMN public.surveys.infinite_population_mode IS
'Modo de tratamento de população infinita: national_only (padrão, só nacionais), auto_threshold (pelo limiar de habitantes), force_all (todas as localidades)';

COMMENT ON COLUMN public.surveys.infinite_population_threshold IS
'Limiar de habitantes para o modo auto_threshold: localidades com pop >= threshold usam fórmula infinita (padrão 50.000)';

COMMENT ON COLUMN public.surveys.population_type IS
'Base populacional padrão da pesquisa: define qual fonte (TSE para eleitores, IBGE para habitantes) alimenta as localidades na Etapa 2';
