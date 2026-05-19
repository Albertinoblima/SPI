-- Migration: Cria tabela geo_demograficos_municipio
--   Dados demográficos por município (nível municipal, não setor censitário).
--   Fonte: IBGE Censo 2022 via API SIDRA.
--   Colunas: população total, masculina, feminina,
--            faixas etárias (JSONB), escolaridade (JSONB).
--   A tabela geo_dados_demograficos (existente) é para setor censitário
--   via localidade_id — esta nova tabela é complementar, nível município.
-- ---------------------------------------------------------------------------

-- 1. Nova tabela: geo_demograficos_municipio
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.geo_demograficos_municipio (
    id                  bigserial PRIMARY KEY,
    municipio_id        integer NOT NULL
                        REFERENCES public.geo_municipios (id_ibge) ON DELETE CASCADE,
    ano_censo           smallint NOT NULL DEFAULT 2022,
    populacao_total     integer NOT NULL DEFAULT 0,
    populacao_masculina integer DEFAULT 0,
    populacao_feminina  integer DEFAULT 0,
    -- Faixas etárias quinquenais: {"0_4": 1234, "5_9": 5678, ..., "90_mais": 123}
    faixas_etarias      jsonb,
    -- Escolaridade: {"sem_instrucao": 1234, "fundamental_incompleto": 5678, ...}
    escolaridade        jsonb,
    fonte               text DEFAULT 'IBGE Censo 2022 (API SIDRA)',
    criado_em           timestamptz NOT NULL DEFAULT now(),
    atualizado_em       timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_demograficos_municipio_ano UNIQUE (municipio_id, ano_censo)
);

COMMENT ON TABLE public.geo_demograficos_municipio IS
'Dados demográficos por município: população total, por sexo, faixa etária e escolaridade. Fonte: IBGE Censo 2022 via API SIDRA.';

CREATE INDEX IF NOT EXISTS idx_geo_dem_mun_municipio_id
    ON public.geo_demograficos_municipio (municipio_id);

CREATE INDEX IF NOT EXISTS idx_geo_dem_mun_ano_censo
    ON public.geo_demograficos_municipio (ano_censo);

-- Trigger para atualizar atualizado_em automaticamente
CREATE OR REPLACE FUNCTION public.update_atualizado_em()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    NEW.atualizado_em = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_geo_dem_mun_atualizado_em
    BEFORE UPDATE ON public.geo_demograficos_municipio
    FOR EACH ROW EXECUTE FUNCTION public.update_atualizado_em();

-- 2. RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.geo_demograficos_municipio ENABLE ROW LEVEL SECURITY;

-- Leitura: qualquer autenticado
CREATE POLICY geo_dem_mun_select_auth
    ON public.geo_demograficos_municipio FOR SELECT
    TO authenticated
    USING (TRUE);

-- Escrita: apenas service_role (ETL)
CREATE POLICY geo_dem_mun_insert_service
    ON public.geo_demograficos_municipio FOR INSERT
    TO service_role
    WITH CHECK (TRUE);

CREATE POLICY geo_dem_mun_update_service
    ON public.geo_demograficos_municipio FOR UPDATE
    TO service_role
    USING (TRUE) WITH CHECK (TRUE);

-- 3. Atualiza vw_municipio_resumo para incluir dados da nova tabela
--    - populacao_censo agora usa geo_demograficos_municipio quando disponível
--    - percentual_eleitores usa populacao_total da nova tabela como prioridade
--    - ingestoes_concluidas inclui +1 quando há dados demográficos municipais
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS public.vw_municipio_resumo;

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
    count(DISTINCT l.id)                                              AS total_localidades,
    count(DISTINCT l.id) FILTER (WHERE l.zona = 'URBANA')            AS localidades_urbanas,
    count(DISTINCT l.id) FILTER (WHERE l.zona = 'RURAL')             AS localidades_rurais,
    -- populacao_censo: prioridade geo_demograficos_municipio, fallback geo_dados_demograficos (setor)
    coalesce(
        dm.populacao_total,
        coalesce(sum(d.populacao_total), 0)::integer
    )                                                                 AS populacao_censo,
    dm.populacao_masculina                                            AS populacao_masculina,
    dm.populacao_feminina                                             AS populacao_feminina,
    dm.faixas_etarias                                                 AS faixas_etarias,
    dm.escolaridade                                                   AS escolaridade,
    coalesce(sum(e.quantidade_eleitores), 0)::integer                 AS total_eleitores,
    -- percentual_eleitores: prioridade nova tabela, depois setor censitário, depois estimada
    CASE
        WHEN dm.populacao_total > 0
            THEN round(
                coalesce(sum(e.quantidade_eleitores), 0)::numeric
                / dm.populacao_total::numeric * 100, 2
            )
        WHEN coalesce(sum(d.populacao_total), 0) > 0
            THEN round(
                coalesce(sum(e.quantidade_eleitores), 0)::numeric
                / sum(d.populacao_total)::numeric * 100, 2
            )
        WHEN m.populacao_estimada IS NOT NULL AND m.populacao_estimada > 0
            THEN round(
                coalesce(sum(e.quantidade_eleitores), 0)::numeric
                / m.populacao_estimada::numeric * 100, 2
            )
    END                                                               AS percentual_eleitores,
    -- ingestoes_concluidas:
    --   +1 dados eleitorais TSE
    --   +1 dados demográficos municipais (nova tabela)
    --   +1 populacao_estimada
    (
        CASE WHEN count(DISTINCT e.id) > 0                THEN 1 ELSE 0 END
        + CASE WHEN dm.id IS NOT NULL                     THEN 1 ELSE 0 END
        + CASE WHEN m.populacao_estimada IS NOT NULL       THEN 1 ELSE 0 END
    )                                                                 AS ingestoes_concluidas,
    max(gl.concluido_em)                                              AS ultima_ingestao_em
FROM public.geo_municipios m
LEFT JOIN public.geo_localidades l
    ON m.id_ibge = l.municipio_id AND l.ativo = TRUE
LEFT JOIN public.geo_dados_demograficos d
    ON l.id = d.localidade_id
LEFT JOIN public.geo_demograficos_municipio dm
    ON m.id_ibge = dm.municipio_id
LEFT JOIN public.geo_dados_eleitorais e
    ON l.id = e.localidade_id
LEFT JOIN public.geo_ingestao_log gl
    ON m.id_ibge = gl.municipio_id
GROUP BY m.id_ibge, m.nome, m.uf, m.regiao, m.populacao_estimada, m.area_km2,
         dm.populacao_total, dm.populacao_masculina, dm.populacao_feminina,
         dm.faixas_etarias, dm.escolaridade, dm.id;

COMMENT ON VIEW public.vw_municipio_resumo IS
'Resumo por município: localidades, população (total/sexo/faixa etária), eleitores e status. '
'ingestoes_concluidas: 0=Sem dados, 1=Parcial, 2=Parcial, 3=Completo.';
