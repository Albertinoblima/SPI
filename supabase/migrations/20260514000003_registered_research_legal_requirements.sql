-- ============================================================================
-- MIGRATION: 20260514000003_registered_research_legal_requirements.sql
-- Descricao: Campos legais obrigatorios para pesquisa registrada e regra de PesqEle
-- Data: 2026-05-14
-- ============================================================================

ALTER TABLE public.surveys
    ADD COLUMN IF NOT EXISTS contracting_entity_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS contracting_entity_document VARCHAR(20),
    ADD COLUMN IF NOT EXISTS survey_total_value NUMERIC(14,2),
    ADD COLUMN IF NOT EXISTS invoice_reference VARCHAR(120),
    ADD COLUMN IF NOT EXISTS funding_source TEXT,
    ADD COLUMN IF NOT EXISTS is_public_disclosure BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS pesqele_registration_code VARCHAR(120);

COMMENT ON COLUMN public.surveys.contracting_entity_name IS
    'Nome da empresa ou entidade contratante da pesquisa';
COMMENT ON COLUMN public.surveys.contracting_entity_document IS
    'Documento do contratante: CPF (11) ou CNPJ (14), somente digitos';
COMMENT ON COLUMN public.surveys.survey_total_value IS
    'Valor total pago pela execucao da pesquisa';
COMMENT ON COLUMN public.surveys.invoice_reference IS
    'Identificacao da nota fiscal emitida para a pesquisa';
COMMENT ON COLUMN public.surveys.funding_source IS
    'Origem dos recursos (proprios, fundo partidario, doacoes etc.)';
COMMENT ON COLUMN public.surveys.is_public_disclosure IS
    'Indica se a pesquisa sera utilizada para divulgacao publica';
COMMENT ON COLUMN public.surveys.pesqele_registration_code IS
    'Numero/codigo do registro no Sistema de Registro de Pesquisas Eleitorais (PesqEle)';

ALTER TABLE public.surveys DROP CONSTRAINT IF EXISTS surveys_registered_research_legal_check;
ALTER TABLE public.surveys ADD CONSTRAINT surveys_registered_research_legal_check CHECK (
    is_registered_research = FALSE
    OR (
        btrim(COALESCE(registered_responsible_name, '')) <> ''
        AND btrim(COALESCE(registered_responsible_registry, '')) <> ''
        AND btrim(COALESCE(registered_responsible_body, '')) <> ''
        AND btrim(COALESCE(contracting_entity_name, '')) <> ''
        AND btrim(COALESCE(contracting_entity_document, '')) <> ''
        AND LENGTH(regexp_replace(contracting_entity_document, '\\D', '', 'g')) IN (11, 14)
        AND survey_total_value IS NOT NULL
        AND survey_total_value > 0
        AND btrim(COALESCE(invoice_reference, '')) <> ''
        AND btrim(COALESCE(funding_source, '')) <> ''
    )
) NOT VALID;

ALTER TABLE public.surveys DROP CONSTRAINT IF EXISTS surveys_public_disclosure_pesqele_check;
ALTER TABLE public.surveys ADD CONSTRAINT surveys_public_disclosure_pesqele_check CHECK (
    is_public_disclosure = FALSE
    OR btrim(COALESCE(pesqele_registration_code, '')) <> ''
) NOT VALID;
