-- ============================================================================
-- MIGRATION: 20260514_publico_alvo_estratificacao_amostra.sql
-- Descrição: Atualização do campo público alvo nas localidades e renomeação
--            de premissas para estratificação da amostra
-- Data: 2026-05-14
-- ============================================================================

-- ============================================================================
-- PARTE 1: ATUALIZAR CONSTRAINT DE population_type EM survey_localities
-- Ampliar os valores aceitos para incluir todos os públicos-alvo
-- ============================================================================

-- Remover constraint antiga
ALTER TABLE public.survey_localities
    DROP CONSTRAINT IF EXISTS survey_localities_population_type_check;

-- Adicionar nova constraint com todos os públicos-alvo
ALTER TABLE public.survey_localities
    ADD CONSTRAINT survey_localities_population_type_check
    CHECK (population_type IN (
        'eleitores',
        'habitantes',
        'comerciantes',
        'comerciarios',
        'consumidores',
        'dona_de_casa',
        'industriarios',
        'funcionarios_publicos',
        'prestadores_servicos',
        'professores',
        'profissional_liberal',
        'publico_geral',
        'segmento_especifico',
        'sindicalistas',
        -- valores legados (compatibilidade retroativa)
        'voters',
        'inhabitants'
    ));

-- Atualizar valor padrão para o novo padrão em português
ALTER TABLE public.survey_localities
    ALTER COLUMN population_type SET DEFAULT 'eleitores';

-- Migrar registros existentes com valores legados
UPDATE public.survey_localities SET population_type = 'eleitores'  WHERE population_type = 'voters';
UPDATE public.survey_localities SET population_type = 'habitantes' WHERE population_type = 'inhabitants';

-- Comentário atualizado
COMMENT ON COLUMN public.survey_localities.population_type IS
    'Público-alvo da localidade: eleitores, habitantes, comerciantes, comerciarios, consumidores, dona_de_casa, industriarios, funcionarios_publicos, prestadores_servicos, professores, profissional_liberal, publico_geral, segmento_especifico, sindicalistas';

-- ============================================================================
-- PARTE 2: ADICIONAR CAMPO stratification_label EM survey_premises
-- Armazena a denominação escolhida para a estratificação da amostra
-- ============================================================================

ALTER TABLE public.survey_premises
    ADD COLUMN IF NOT EXISTS stratification_label VARCHAR(255);

COMMENT ON COLUMN public.survey_premises.stratification_label IS
    'Denominação da estratificação escolhida pelo usuário, ex: Perfil dos Entrevistados, Aspecto Sócio Econômico da Amostra, etc.';

-- ============================================================================
-- PARTE 3: COMENTÁRIOS ATUALIZADOS NA TABELA survey_premises
-- ============================================================================

COMMENT ON TABLE public.survey_premises IS
    'Estratificação da Amostra: critérios de perfil do entrevistado (sexo, faixa etária, escolaridade, estado civil, religião, renda, profissão, interesse, etc.)';

-- ============================================================================
-- PARTE 4: ÍNDICE DE PERFORMANCE PARA stratification_label
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_survey_premises_stratification
    ON public.survey_premises(survey_id, stratification_label);
