-- ============================================================================
-- MIGRATION: 20260518000002_geo_etl_constraints.sql
-- Descricao: Adiciona constraints de unicidade necessarias para o ETL Python
--            operar com ON CONFLICT (upsert idempotente).
--            Tambem adiciona coluna de populacao estimada via API IBGE para
--            municipios que nao tenham shapefile carregado.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Unicidade em geo_dados_eleitorais
--    Evita duplicatas de ETL re-executado: mesmo local de votacao vinculado
--    a mesma localidade no mesmo ano.
-- ----------------------------------------------------------------------------
ALTER TABLE public.geo_dados_eleitorais
ADD CONSTRAINT uq_geo_eleitorais_localidade_local_ano
UNIQUE (localidade_id, codigo_local_votacao, ano_atualizacao);

-- ----------------------------------------------------------------------------
-- 2. Unicidade em geo_dados_demograficos
--    Evita duplicatas por setor censitario dentro de uma localidade.
-- ----------------------------------------------------------------------------
ALTER TABLE public.geo_dados_demograficos
ADD CONSTRAINT uq_geo_demograficos_localidade_setor
UNIQUE (localidade_id, setor_censitario);

-- ----------------------------------------------------------------------------
-- 3. Indice de suporte para match textual bairro TSE → localidade
--    O ETL usa ILIKE '%bairro%' no nome_normalizado; este indice GIN
--    acelera a busca por trigrama.
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_geo_localidades_nome_trgm
ON public.geo_localidades USING gin (nome_normalizado gin_trgm_ops);

-- ----------------------------------------------------------------------------
-- 4. Funcao auxiliar: fn_upsert_localidade
--    Usada pelo ETL e tambem pela Opcao A (carga sob demanda via API).
--    Garante atomicidade no INSERT … ON CONFLICT sem race condition.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_upsert_localidade(
    p_municipio_id INTEGER,
    p_nome VARCHAR,
    p_tipo VARCHAR,
    p_ibge_id BIGINT DEFAULT NULL,
    p_fonte VARCHAR DEFAULT 'IBGE',
    p_zona VARCHAR DEFAULT 'URBANA',
    p_geom_lng DOUBLE PRECISION DEFAULT NULL,
    p_geom_lat DOUBLE PRECISION DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id BIGINT;
BEGIN
    INSERT INTO public.geo_localidades
        (municipio_id, nome, tipo, ibge_id, fonte, zona, geom)
    VALUES (
        p_municipio_id,
        p_nome,
        p_tipo,
        p_ibge_id,
        p_fonte,
        p_zona,
        CASE WHEN p_geom_lng IS NOT NULL AND p_geom_lat IS NOT NULL
             THEN ST_SetSRID(ST_MakePoint(p_geom_lng, p_geom_lat), 4326)
             ELSE NULL
        END
    )
    ON CONFLICT (municipio_id, nome_normalizado, tipo) DO UPDATE
        SET ibge_id       = COALESCE(EXCLUDED.ibge_id, geo_localidades.ibge_id),
            fonte         = EXCLUDED.fonte,
            zona          = EXCLUDED.zona,
            geom          = COALESCE(EXCLUDED.geom, geo_localidades.geom),
            atualizado_em = now()
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.fn_upsert_localidade IS
'Upsert atômico de localidade – usado pelo ETL Python e pela carga sob demanda (Opção A)';

GRANT EXECUTE ON FUNCTION public.fn_upsert_localidade TO authenticated;

-- ----------------------------------------------------------------------------
-- 5. View materializada parcial: municipios sem localidades carregadas
--    Permite ao admin ver quais municipios precisam de ETL.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.vw_municipios_sem_localidades AS
SELECT
    m.id_ibge,
    m.nome,
    m.uf,
    m.regiao,
    m.populacao_estimada,
    m.criado_em
FROM public.geo_municipios m
WHERE
    NOT EXISTS (
        SELECT 1 FROM public.geo_localidades l
        WHERE l.municipio_id = m.id_ibge
    )
ORDER BY m.uf, m.nome;

COMMENT ON VIEW public.vw_municipios_sem_localidades IS
'Municípios cadastrados mas sem nenhuma localidade – precisam de ETL';
