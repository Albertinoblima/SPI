-- ============================================================================
-- MIGRATION: 20260514_survey_sampling_stats.sql
-- Descrição: Campos para calculadora de amostragem estatística
-- Data: 2026-05-14
-- ============================================================================

-- Tamanho da população de referência (para fator de correção pop. finita)
ALTER TABLE public.surveys ADD COLUMN IF NOT EXISTS population_size INTEGER;

-- Efeito de Delineamento - Design Effect (padrão 1.0 = amostra aleatória simples)
ALTER TABLE public.surveys ADD COLUMN IF NOT EXISTS deff DECIMAL(5,2) DEFAULT 1.0;

-- Estimativa de proporção p (padrão 0.5 = variância máxima)
ALTER TABLE public.surveys ADD COLUMN IF NOT EXISTS p_proportion DECIMAL(5,3) DEFAULT 0.5;

-- Modo de cálculo: 'auto' (calculadora do sistema) | 'manual' (usuário define)
ALTER TABLE public.surveys ADD COLUMN IF NOT EXISTS stats_mode VARCHAR(10) DEFAULT 'auto';

COMMENT ON COLUMN public.surveys.population_size IS 'Tamanho da população de referência para fator de correção de população finita';
COMMENT ON COLUMN public.surveys.deff IS 'Design Effect (Efeito de Delineamento): fator multiplicador da variância amostral (1.0 = AAS pura)';
COMMENT ON COLUMN public.surveys.p_proportion IS 'Estimativa de proporção p para o cálculo da margem de erro (0.5 = variância máxima)';
COMMENT ON COLUMN public.surveys.stats_mode IS 'Modo de definição da amostra: auto (calculadora) ou manual (usuário define diretamente)';
