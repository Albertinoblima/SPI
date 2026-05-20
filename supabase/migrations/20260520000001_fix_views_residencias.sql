-- ============================================================================
-- MIGRATION: 20260520000001_fix_views_residencias.sql
-- Descricao: Aplica a tabela geo_dados_residenciais (caso nao exista) e
--            recria as views consolidadas com a nova coluna residencias_cnefe.
--            Corrige erro "cannot change name of view column" do CREATE OR
--            REPLACE VIEW ao reordenar colunas.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. TABELA geo_dados_residenciais (idempotente)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.geo_dados_residenciais (
    id bigserial PRIMARY KEY,
    localidade_id bigint NOT NULL REFERENCES public.geo_localidades (id)
    ON DELETE CASCADE,
    zona varchar(10) NOT NULL DEFAULT 'MISTA'
    CHECK (zona IN ('URBANA', 'RURAL', 'MISTA')),
    quantidade_residencias integer NOT NULL DEFAULT 0,
    ano_censo smallint NOT NULL DEFAULT 2022,
    fonte_detalhada text,
    criado_em timestamptz NOT NULL DEFAULT now(),
    atualizado_em timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_geo_residenciais_localidade_zona_ano
    UNIQUE (localidade_id, zona, ano_censo)
);

COMMENT ON TABLE public.geo_dados_residenciais IS
'Contagem de residencias por localidade, derivada do CNEFE 2022 (IBGE).';

COMMENT ON COLUMN public.geo_dados_residenciais.zona IS
'Zona derivada do CNEFE (heuristica do ETL: URBANA, RURAL ou MISTA).';

CREATE INDEX IF NOT EXISTS idx_geo_residenciais_localidade
ON public.geo_dados_residenciais (localidade_id);

CREATE INDEX IF NOT EXISTS idx_geo_residenciais_ano
ON public.geo_dados_residenciais (ano_censo);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'trg_geo_residenciais_atualizado_em'
    ) THEN
        CREATE TRIGGER trg_geo_residenciais_atualizado_em
            BEFORE UPDATE ON public.geo_dados_residenciais
            FOR EACH ROW EXECUTE FUNCTION public.update_atualizado_em();
    END IF;
END;
$$;

ALTER TABLE public.geo_dados_residenciais ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename  = 'geo_dados_residenciais'
          AND policyname = 'geo_residenciais_select_auth'
    ) THEN
        CREATE POLICY geo_residenciais_select_auth
        ON public.geo_dados_residenciais FOR SELECT
        TO authenticated
        USING (TRUE);
    END IF;
END;
$$;

-- ----------------------------------------------------------------------------
-- 2. Recria vw_consulta_localidades com DROP CASCADE para evitar conflito
-- ----------------------------------------------------------------------------
DROP VIEW IF EXISTS public.vw_consulta_localidades CASCADE;

CREATE VIEW public.vw_consulta_localidades
WITH (security_invoker = TRUE)
AS
SELECT
    l.id AS localidade_id,
    l.municipio_id,
    m.nome AS municipio,
    m.uf,
    m.regiao,
    l.nome AS localidade,
    l.tipo AS tipo_localidade,
    l.zona,
    l.ibge_id,
    l.fonte,
    l.geom,
    l.ativo,
    l.criado_em,
    coalesce(sum(d.populacao_total), 0)::integer AS total_habitantes,
    coalesce(sum(d.populacao_urbana), 0)::integer AS habitantes_urbanos,
    coalesce(sum(d.populacao_rural), 0)::integer AS habitantes_rurais,
    coalesce(sum(d.domicilios_particulares), 0)::integer AS domicilios,
    coalesce(sum(r.quantidade_residencias), 0)::integer AS residencias_cnefe,
    coalesce(sum(e.quantidade_eleitores), 0)::integer AS total_eleitores,
    CASE
        WHEN coalesce(sum(d.populacao_total), 0) > 0
            THEN round(
                (
                    coalesce(sum(e.quantidade_eleitores), 0)::numeric
                    / sum(d.populacao_total)::numeric
                ) * 100, 2
            )
    END AS percentual_eleitores_populacao,
    (
        SELECT sub_e.metodo_vinculo
        FROM public.geo_dados_eleitorais sub_e
        WHERE sub_e.localidade_id = l.id
        GROUP BY sub_e.metodo_vinculo
        ORDER BY count(*) DESC
        LIMIT 1
    ) AS metodo_vinculo_eleitoral
FROM public.geo_localidades l
INNER JOIN public.geo_municipios m
    ON l.municipio_id = m.id_ibge
LEFT JOIN public.geo_dados_demograficos d
    ON l.id = d.localidade_id
LEFT JOIN public.geo_dados_residenciais r
    ON l.id = r.localidade_id
LEFT JOIN public.geo_dados_eleitorais e
    ON l.id = e.localidade_id
WHERE l.ativo = TRUE
GROUP BY
    l.id, l.municipio_id, m.nome, m.uf, m.regiao,
    l.nome, l.tipo, l.zona, l.ibge_id, l.fonte,
    l.geom, l.ativo, l.criado_em;

COMMENT ON VIEW public.vw_consulta_localidades IS
'Visao consolidada IBGE + TSE + CNEFE: populacao, residencias e eleitores por localidade';

-- ----------------------------------------------------------------------------
-- 3. Recria vw_municipio_resumo
-- ----------------------------------------------------------------------------
DROP VIEW IF EXISTS public.vw_municipio_resumo CASCADE;

CREATE VIEW public.vw_municipio_resumo
WITH (security_invoker = TRUE)
AS
SELECT
    m.id_ibge,
    m.nome,
    m.uf,
    m.regiao,
    m.populacao_estimada,
    m.area_km2,
    count(DISTINCT l.id) AS total_localidades,
    count(DISTINCT l.id) FILTER (WHERE l.zona = 'URBANA') AS localidades_urbanas,
    count(DISTINCT l.id) FILTER (WHERE l.zona = 'RURAL') AS localidades_rurais,
    coalesce(sum(d.populacao_total), 0)::integer AS populacao_censo,
    coalesce(sum(r.quantidade_residencias), 0)::integer AS residencias_cnefe,
    coalesce(sum(e.quantidade_eleitores), 0)::integer AS total_eleitores,
    CASE
        WHEN coalesce(sum(d.populacao_total), 0) > 0
            THEN round(
                (
                    coalesce(sum(e.quantidade_eleitores), 0)::numeric
                    / sum(d.populacao_total)::numeric
                ) * 100, 2
            )
    END AS percentual_eleitores,
    count(DISTINCT CASE WHEN gl.status = 'concluido' THEN gl.operacao END) AS ingestoes_concluidas,
    max(gl.concluido_em) AS ultima_ingestao_em
FROM public.geo_municipios m
LEFT JOIN public.geo_localidades l
    ON m.id_ibge = l.municipio_id AND l.ativo = TRUE
LEFT JOIN public.geo_dados_demograficos d
    ON l.id = d.localidade_id
LEFT JOIN public.geo_dados_residenciais r
    ON l.id = r.localidade_id
LEFT JOIN public.geo_dados_eleitorais e
    ON l.id = e.localidade_id
LEFT JOIN public.geo_ingestao_log gl
    ON m.id_ibge = gl.municipio_id
GROUP BY m.id_ibge, m.nome, m.uf, m.regiao, m.populacao_estimada, m.area_km2;

COMMENT ON VIEW public.vw_municipio_resumo IS
'Resumo por municipio: localidades, populacao, residencias CNEFE, eleitores e status de ingestao';
