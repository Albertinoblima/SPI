-- ============================================================================
-- MIGRATION: 20260518000001_geo_municipios_localidades.sql
-- Descricao: Base de dados geografica unificada IBGE + TSE para consulta
--            submunicipal de localidades (bairros, distritos, sitios, fazendas).
--            Arquitetura: PostgreSQL + PostGIS com cruzamento espacial
--            ST_Distance / ST_Contains para vincular localidades TSE x IBGE.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. EXTENSOES
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Wrapper IMMUTABLE necessario para uso em colunas GENERATED ALWAYS AS.
-- O unaccent nativo e STABLE; esta funcao permite uso em expressoes geradas.
CREATE OR REPLACE FUNCTION public.f_unaccent(text)
RETURNS text AS $$
    SELECT unaccent('unaccent', $1)
$$ LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT;

COMMENT ON FUNCTION public.f_unaccent IS
'Wrapper IMMUTABLE de unaccent – necessario para colunas GENERATED ALWAYS';

-- ----------------------------------------------------------------------------
-- 1. TABELA: geo_municipios
--    Dados oficiais dos municipios brasileiros (fonte IBGE).
--    id_ibge e o codigo de 7 digitos padrao IBGE.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.geo_municipios (
    id_ibge integer PRIMARY KEY,          -- Codigo IBGE 7 digitos
    nome varchar(120) NOT NULL,
    nome_normalizado varchar(120) GENERATED ALWAYS AS (
        lower(public.f_unaccent(nome))
    ) STORED,
    uf char(2) NOT NULL,
    regiao varchar(20),                  -- Norte, Nordeste, etc.
    populacao_estimada integer,                    -- IBGE estimativa mais recente
    area_km2 numeric(12, 4),
    geom GEOMETRY (POINT, 4326),        -- Centroide do municipio (WGS84)
    criado_em timestamptz NOT NULL DEFAULT now(),
    atualizado_em timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.geo_municipios IS 'Municipios brasileiros – fonte IBGE, carga via ETL';
COMMENT ON COLUMN public.geo_municipios.id_ibge IS 'Codigo de 7 digitos do IBGE';
COMMENT ON COLUMN public.geo_municipios.geom IS 'Centroide WGS84 (EPSG:4326)';

CREATE INDEX IF NOT EXISTS idx_geo_municipios_uf
ON public.geo_municipios (uf);
CREATE INDEX IF NOT EXISTS idx_geo_municipios_nome_norm
ON public.geo_municipios (nome_normalizado);
CREATE INDEX IF NOT EXISTS idx_geo_municipios_geom
ON public.geo_municipios USING gist (geom);

-- ----------------------------------------------------------------------------
-- 2. TABELA: geo_localidades
--    Unidade territorial submunicipal: bairros, distritos, povoados,
--    sitios, fazendas. Serve de ponto de ligacao entre IBGE e TSE.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.geo_localidades (
    id bigserial PRIMARY KEY,
    municipio_id integer NOT NULL REFERENCES public.geo_municipios (id_ibge)
    ON DELETE CASCADE,
    nome varchar(180) NOT NULL,
    nome_normalizado varchar(180) GENERATED ALWAYS AS (
        lower(public.f_unaccent(nome))
    ) STORED,
    tipo varchar(30) NOT NULL
    CHECK (tipo IN (
        'BAIRRO', 'DISTRITO', 'SUBDISTRITO',
        'POVOADO', 'SITIO', 'FAZENDA',
        'VILA', 'NUCLEO', 'OUTROS'
    )),
    ibge_id bigint,      -- ID do IBGE (distrito ou subdistrito)
    setor_censitario varchar(15), -- Codigo do setor censitario (quando disponivel)
    fonte varchar(20) NOT NULL DEFAULT 'IBGE'
    CHECK (fonte IN ('IBGE', 'TSE', 'MANUAL', 'CNEFE')),
    zona varchar(10) NOT NULL DEFAULT 'URBANA'
    CHECK (zona IN ('URBANA', 'RURAL', 'MISTA')),
    geom GEOMETRY (POINT, 4326),   -- Centroide da localidade
    geom_poligono GEOMETRY (MULTIPOLYGON, 4326), -- Perimetro (opcional)
    observacoes text,
    ativo boolean NOT NULL DEFAULT TRUE,
    criado_em timestamptz NOT NULL DEFAULT now(),
    atualizado_em timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.geo_localidades IS 'Localidades submunicipais – bairros, distritos, sitios, fazendas (IBGE + TSE)';
COMMENT ON COLUMN public.geo_localidades.ibge_id IS 'ID do distrito/subdistrito no IBGE';
COMMENT ON COLUMN public.geo_localidades.geom IS 'Centroide WGS84 (calculado via CNEFE ou centroide do poligono)';

CREATE INDEX IF NOT EXISTS idx_geo_localidades_municipio
ON public.geo_localidades (municipio_id);
CREATE INDEX IF NOT EXISTS idx_geo_localidades_nome_norm
ON public.geo_localidades (nome_normalizado);
CREATE INDEX IF NOT EXISTS idx_geo_localidades_tipo
ON public.geo_localidades (tipo);
CREATE INDEX IF NOT EXISTS idx_geo_localidades_zona
ON public.geo_localidades (zona);
CREATE INDEX IF NOT EXISTS idx_geo_localidades_geom
ON public.geo_localidades USING gist (geom);
CREATE INDEX IF NOT EXISTS idx_geo_localidades_ibge_id
ON public.geo_localidades (ibge_id)
WHERE ibge_id IS NOT NULL;

-- Unicidade por municipio + nome normalizado + tipo para evitar duplicatas de ETL
CREATE UNIQUE INDEX IF NOT EXISTS uq_geo_localidades_municipio_nome_tipo
ON public.geo_localidades (municipio_id, nome_normalizado, tipo);

-- ----------------------------------------------------------------------------
-- 3. TABELA: geo_dados_demograficos
--    Dados demograficos por localidade (fonte: Censo IBGE 2022 / CNEFE).
--    Um registro por setor censitario; varios setores por localidade.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.geo_dados_demograficos (
    id bigserial PRIMARY KEY,
    localidade_id bigint NOT NULL REFERENCES public.geo_localidades (id)
    ON DELETE CASCADE,
    setor_censitario varchar(15),
    populacao_total integer NOT NULL DEFAULT 0,
    populacao_urbana integer DEFAULT 0,
    populacao_rural integer DEFAULT 0,
    domicilios_particulares integer DEFAULT 0,
    domicilios_coletivos integer DEFAULT 0,
    ano_censo smallint NOT NULL DEFAULT 2022,
    fonte_detalhada text,       -- URL ou descricao do arquivo de origem
    criado_em timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.geo_dados_demograficos IS
'Dados demograficos por setor censitario vinculados a localidades (IBGE Censo 2022)';

CREATE INDEX IF NOT EXISTS idx_geo_demograficos_localidade
ON public.geo_dados_demograficos (localidade_id);
CREATE INDEX IF NOT EXISTS idx_geo_demograficos_setor
ON public.geo_dados_demograficos (setor_censitario)
WHERE setor_censitario IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 4. TABELA: geo_dados_eleitorais
--    Eleitores vinculados a locais de votacao TSE, cruzados espacialmente
--    com localidades via ST_Distance.
--    "bacia de captacao": um local de votacao rural serve varios sitios vizinhos.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.geo_dados_eleitorais (
    id bigserial PRIMARY KEY,
    localidade_id bigint NOT NULL REFERENCES public.geo_localidades (id)
    ON DELETE CASCADE,
    codigo_local_votacao integer NOT NULL, -- Codigo TSE do local de votacao
    nome_local_votacao varchar(200),
    endereco_local text,
    quantidade_eleitores integer NOT NULL DEFAULT 0,
    secoes_vinculadas text,        -- JSON ou lista das secoes eleitorais
    geom_local_votacao GEOMETRY (POINT, 4326), -- Coordenada do local de votacao
    distancia_metros numeric(10, 2), -- Distancia calculada por ST_Distance
    metodo_vinculo varchar(20) NOT NULL DEFAULT 'ESPACIAL'
    CHECK (metodo_vinculo IN (
        'EXATO',      -- nome bate exatamente
        'ESPACIAL',   -- ST_Distance / ST_Contains
        'BACIA',      -- raio de influencia rural
        'MANUAL'      -- vinculo manual auditado
    )),
    raio_influencia_km numeric(6, 2), -- Para metodo BACIA (zonas rurais)
    ano_atualizacao smallint NOT NULL DEFAULT 2024,
    fonte_detalhada text,
    criado_em timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.geo_dados_eleitorais IS
'Dados eleitorais TSE vinculados a localidades por cruzamento espacial';
COMMENT ON COLUMN public.geo_dados_eleitorais.metodo_vinculo IS
'Como o local de votacao foi vinculado: EXATO=nome, ESPACIAL=ST_Distance, BACIA=raio rural, MANUAL=auditado';
COMMENT ON COLUMN public.geo_dados_eleitorais.raio_influencia_km IS
'Raio de influencia em km para localidades rurais (bacia de captacao eleitoral)';

CREATE INDEX IF NOT EXISTS idx_geo_eleitorais_localidade
ON public.geo_dados_eleitorais (localidade_id);
CREATE INDEX IF NOT EXISTS idx_geo_eleitorais_local_votacao
ON public.geo_dados_eleitorais (codigo_local_votacao);
CREATE INDEX IF NOT EXISTS idx_geo_eleitorais_geom
ON public.geo_dados_eleitorais USING gist (geom_local_votacao)
WHERE geom_local_votacao IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 5. TABELA: geo_ingestao_log
--    Auditoria de todas as operacoes de carga ETL.
--    Permite rastrear origem, versao e estado de cada importacao.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.geo_ingestao_log (
    id bigserial PRIMARY KEY,
    operacao varchar(50) NOT NULL, -- 'ibge_municipios','ibge_localidades','tse_eleitores', etc.
    municipio_id integer REFERENCES public.geo_municipios (id_ibge),
    registros_total integer NOT NULL DEFAULT 0,
    registros_novos integer NOT NULL DEFAULT 0,
    registros_atua integer NOT NULL DEFAULT 0,
    registros_erro integer NOT NULL DEFAULT 0,
    status varchar(20) NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'em_andamento', 'concluido', 'erro')),
    detalhes jsonb,
    iniciado_em timestamptz NOT NULL DEFAULT now(),
    concluido_em timestamptz,
    usuario_id uuid REFERENCES public.users (id)
);

COMMENT ON TABLE public.geo_ingestao_log IS
'Auditoria de operacoes ETL de ingestao de dados geograficos';

CREATE INDEX IF NOT EXISTS idx_geo_ingestao_log_municipio
ON public.geo_ingestao_log (municipio_id)
WHERE municipio_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_geo_ingestao_log_status
ON public.geo_ingestao_log (status, iniciado_em DESC);

-- ----------------------------------------------------------------------------
-- 6. VIEW CONSOLIDADA: vw_consulta_localidades
--    Visao unificada IBGE + TSE por localidade.
--    Calcula populacao total, eleitores e percentual de mobilizacao eleitoral.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.vw_consulta_localidades
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
    -- Taxa de mobilizacao eleitoral (eleitores / populacao total * 100)
    coalesce(sum(d.populacao_rural), 0)::integer AS habitantes_rurais,
    -- Metodo predominante de vinculo eleitoral nesta localidade
    coalesce(sum(d.domicilios_particulares), 0)::integer AS domicilios,
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
LEFT JOIN public.geo_dados_eleitorais e
    ON l.id = e.localidade_id
WHERE l.ativo = TRUE
GROUP BY
    l.id, l.municipio_id, m.nome, m.uf, m.regiao,
    l.nome, l.tipo, l.zona, l.ibge_id, l.fonte,
    l.geom, l.ativo, l.criado_em;

COMMENT ON VIEW public.vw_consulta_localidades IS
'Visao consolidada IBGE + TSE: populacao, eleitores e taxa de mobilizacao por localidade';

-- ----------------------------------------------------------------------------
-- 7. VIEW: vw_municipio_resumo
--    Resumo por municipio agregando todas as localidades.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.vw_municipio_resumo
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
LEFT JOIN public.geo_dados_eleitorais e
    ON l.id = e.localidade_id
LEFT JOIN public.geo_ingestao_log gl
    ON m.id_ibge = gl.municipio_id
GROUP BY m.id_ibge, m.nome, m.uf, m.regiao, m.populacao_estimada, m.area_km2;

COMMENT ON VIEW public.vw_municipio_resumo IS
'Resumo por municipio: total de localidades, populacao, eleitores e status de ingestao';

-- ----------------------------------------------------------------------------
-- 8. FUNCAO: fn_municipios_proximos(lat, lng, raio_km)
--    Retorna municipios dentro de um raio geografico usando PostGIS.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_municipios_proximos(
    p_lat double precision,
    p_lng double precision,
    p_raio_km double precision DEFAULT 50
)
RETURNS TABLE (
    id_ibge integer,
    nome varchar,
    uf char(2),
    distancia_km numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        m.id_ibge,
        m.nome,
        m.uf,
        ROUND(
            (ST_Distance(
                m.geom::geography,
                ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
            ) / 1000.0)::NUMERIC, 2
        ) AS distancia_km
    FROM public.geo_municipios m
    WHERE m.geom IS NOT NULL
      AND ST_DWithin(
            m.geom::geography,
            ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
            p_raio_km * 1000
          )
    ORDER BY distancia_km;
$$;

COMMENT ON FUNCTION public.fn_municipios_proximos IS
'Retorna municipios dentro de p_raio_km km de um ponto (lat/lng WGS84)';

-- ----------------------------------------------------------------------------
-- 9. FUNCAO: fn_localidades_por_ponto(lat, lng, raio_km)
--    Retorna localidades proximas de um ponto (util para vincular TSE).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_localidades_por_ponto(
    p_lat double precision,
    p_lng double precision,
    p_raio_km double precision DEFAULT 5
)
RETURNS TABLE (
    id bigint,
    municipio varchar,
    uf char(2),
    localidade varchar,
    tipo varchar,
    zona varchar,
    distancia_km numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        l.id,
        m.nome  AS municipio,
        m.uf,
        l.nome  AS localidade,
        l.tipo,
        l.zona,
        ROUND(
            (ST_Distance(
                l.geom::geography,
                ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
            ) / 1000.0)::NUMERIC, 2
        ) AS distancia_km
    FROM public.geo_localidades l
    JOIN public.geo_municipios m ON l.municipio_id = m.id_ibge
    WHERE l.geom IS NOT NULL
      AND l.ativo = TRUE
      AND ST_DWithin(
            l.geom::geography,
            ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
            p_raio_km * 1000
          )
    ORDER BY distancia_km;
$$;

COMMENT ON FUNCTION public.fn_localidades_por_ponto IS
'Retorna localidades dentro de p_raio_km km de um ponto – utilizado no cruzamento espacial TSE';

-- ----------------------------------------------------------------------------
-- 10. RLS – Leitura publica (dados geograficos sao publicos por natureza).
--     Escrita somente via service_role (backend ETL).
-- ----------------------------------------------------------------------------
ALTER TABLE public.geo_municipios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geo_localidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geo_dados_demograficos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geo_dados_eleitorais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geo_ingestao_log ENABLE ROW LEVEL SECURITY;

-- Leitura autenticada para todas as tabelas geo publicas
CREATE POLICY geo_municipios_select_auth
ON public.geo_municipios FOR SELECT
TO authenticated
USING (TRUE);

CREATE POLICY geo_localidades_select_auth
ON public.geo_localidades FOR SELECT
TO authenticated
USING (TRUE);

CREATE POLICY geo_demograficos_select_auth
ON public.geo_dados_demograficos FOR SELECT
TO authenticated
USING (TRUE);

CREATE POLICY geo_eleitorais_select_auth
ON public.geo_dados_eleitorais FOR SELECT
TO authenticated
USING (TRUE);

-- Ingestao: leitura restrita a admins do sistema
CREATE POLICY geo_ingestao_log_select_admin
ON public.geo_ingestao_log FOR SELECT
TO authenticated
USING (public.is_system_admin());

-- ----------------------------------------------------------------------------
-- 11. GRANTS para o schema publico (execucao das funcoes)
-- ----------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.fn_municipios_proximos TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_localidades_por_ponto TO authenticated;
