-- ============================================================================
-- MIGRATION: 20260515000001_geographic_hierarchy_localities.sql
-- Descricao: Hierarquia territorial da pesquisa (nacional/estadual/municipal) e
--            niveis de localidades (estado, cidade, localidade especifica)
-- Data: 2026-05-15
-- ============================================================================

-- --------------------------------------------------------------------------
-- PARTE 1: ABRANGENCIA TERRITORIAL NA TABELA SURVEYS
-- --------------------------------------------------------------------------

ALTER TABLE public.surveys ADD COLUMN IF NOT EXISTS geographic_scope VARCHAR(30);
ALTER TABLE public.surveys ADD COLUMN IF NOT EXISTS scope_country_name VARCHAR(120);
ALTER TABLE public.surveys ADD COLUMN IF NOT EXISTS scope_state_name VARCHAR(120);
ALTER TABLE public.surveys ADD COLUMN IF NOT EXISTS scope_city_name VARCHAR(120);
ALTER TABLE public.surveys ADD COLUMN IF NOT EXISTS specific_public_description TEXT;

COMMENT ON COLUMN public.surveys.geographic_scope IS
'Abrangencia territorial: national, state, city, specific_public';
COMMENT ON COLUMN public.surveys.scope_country_name IS
'Pais de referencia para pesquisas em nivel nacional';
COMMENT ON COLUMN public.surveys.scope_state_name IS
'Estado de referencia para pesquisas estaduais e municipais';
COMMENT ON COLUMN public.surveys.scope_city_name IS
'Cidade de referencia para pesquisas municipais';
COMMENT ON COLUMN public.surveys.specific_public_description IS
'Descricao do recorte de publico especifico quando a abrangencia nao for territorial';

ALTER TABLE public.surveys DROP CONSTRAINT IF EXISTS surveys_geographic_scope_check;
ALTER TABLE public.surveys ADD CONSTRAINT surveys_geographic_scope_check CHECK (
    geographic_scope IS NULL
    OR geographic_scope IN ('national', 'state', 'city', 'specific_public')
) NOT VALID;

-- --------------------------------------------------------------------------
-- PARTE 2: HIERARQUIA NA TABELA SURVEY_LOCALITIES
-- --------------------------------------------------------------------------

ALTER TABLE public.survey_localities ADD COLUMN IF NOT EXISTS geo_level VARCHAR(20) DEFAULT 'locality';
ALTER TABLE public.survey_localities ADD COLUMN IF NOT EXISTS parent_state_name VARCHAR(120);
ALTER TABLE public.survey_localities ADD COLUMN IF NOT EXISTS parent_city_name VARCHAR(120);

COMMENT ON COLUMN public.survey_localities.geo_level IS
'Nivel da localidade: state, city, locality';
COMMENT ON COLUMN public.survey_localities.parent_state_name IS
'Estado pai quando o nivel for city/locality';
COMMENT ON COLUMN public.survey_localities.parent_city_name IS
'Cidade pai quando o nivel for locality';

ALTER TABLE public.survey_localities DROP CONSTRAINT IF EXISTS survey_localities_geo_level_check;
ALTER TABLE public.survey_localities ADD CONSTRAINT survey_localities_geo_level_check CHECK (
    geo_level IN ('state', 'city', 'locality')
) NOT VALID;

-- Remove restricao antiga e amplia campo para suportar publicos especificos
ALTER TABLE public.survey_localities DROP CONSTRAINT IF EXISTS survey_localities_population_type_check;
ALTER TABLE public.survey_localities ALTER COLUMN population_type TYPE VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_survey_localities_hierarchy
ON public.survey_localities (survey_id, geo_level, parent_state_name, parent_city_name);
