-- Migration: Corrige vw_municipio_resumo
--   1. percentual_eleitores usa populacao_estimada como fallback quando
--      geo_dados_demograficos está vazia
--   2. ingestoes_concluidas baseado em dados reais das tabelas ao invés
--      do geo_ingestao_log (que loga por UF, não por município)
-- ---------------------------------------------------------------------------

-- DROP necessário pois CREATE OR REPLACE não permite mudar tipo de coluna
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
    coalesce(sum(d.populacao_total), 0)::integer                      AS populacao_censo,
    coalesce(sum(e.quantidade_eleitores), 0)::integer                 AS total_eleitores,
    -- percentual usa geo_dados_demograficos quando disponível,
    -- senão usa populacao_estimada do município como fallback
    CASE
        WHEN coalesce(sum(d.populacao_total), 0) > 0
            THEN round(
                (
                    coalesce(sum(e.quantidade_eleitores), 0)::numeric
                    / sum(d.populacao_total)::numeric
                ) * 100, 2
            )
        WHEN m.populacao_estimada IS NOT NULL AND m.populacao_estimada > 0
            THEN round(
                (
                    coalesce(sum(e.quantidade_eleitores), 0)::numeric
                    / m.populacao_estimada::numeric
                ) * 100, 2
            )
    END                                                               AS percentual_eleitores,
    -- ingestoes_concluidas baseado em dados reais nas tabelas:
    --   +1 se há registros eleitorais TSE para o município
    --   +1 se há registros demográficos IBGE para o município
    --   +1 se populacao_estimada foi preenchida
    (
        CASE WHEN count(DISTINCT e.id) > 0            THEN 1 ELSE 0 END
        + CASE WHEN count(DISTINCT d.id) > 0          THEN 1 ELSE 0 END
        + CASE WHEN m.populacao_estimada IS NOT NULL   THEN 1 ELSE 0 END
    )                                                                 AS ingestoes_concluidas,
    -- mantém ultima_ingestao_em via log para auditoria (pode ser NULL)
    max(gl.concluido_em)                                              AS ultima_ingestao_em
FROM public.geo_municipios m
LEFT JOIN public.geo_localidades l
    ON m.id_ibge = l.municipio_id AND l.ativo = TRUE
LEFT JOIN public.geo_dados_demograficos d
    ON l.id = d.localidade_id
LEFT JOIN public.geo_dados_eleitorais e
    ON l.id = e.localidade_id
LEFT JOIN public.geo_ingestao_log gl
    ON m.id_ibge = gl.municipio_id
GROUP BY m.id_ibge, m.nome, m.uf, m.regiao, m.populacao_estimada, m.area_km2;

COMMENT ON VIEW public.vw_municipio_resumo IS
'Resumo por município: total de localidades, população, eleitores e status de ingestão. '
'ingestoes_concluidas: 0=Sem dados, 1-2=Parcial, 3=Completo (eleitorais+demográficos+estimativa).';
