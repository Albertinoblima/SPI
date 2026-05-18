#!/usr/bin/env python3
"""
ETL Geográfico – IBGE + TSE → geo_municipios / geo_localidades / geo_dados_demograficos / geo_dados_eleitorais
===========================================================================================================================

Popula as tabelas geográficas do banco a partir de:
  1. API IBGE Localidades  – municípios, distritos, subdistritos (sem download de shapefile)
  2. Shapefile IBGE Malha Municipal 2022 – geometrias dos municípios (opcional, ~50 MB por UF)
  3. CSV TSE Perfil do Eleitorado por Seção – quantidade de eleitores por local de votação

Estratégia de aquisição:
  - Municípios e localidades básicas: API REST IBGE (não requer download de arquivo)
  - Geometrias municipais: shapefile IBGE malha municipal UF-a-UF (~15 MB/UF comprimido)
  - Dados eleitorais: CSV TSE CDN (já existe script generate-tse-voters.mjs; este script
    popula o banco a partir do JSON gerado ou baixa diretamente)
  - Dados demográficos do Censo 2022: CSV IBGE Agregados por Setor Censitário (~2 GB total
    apenas se --full-census for passado; por padrão usa estimativas populacionais da API)

Uso:
    python scripts/etl_geo_ibge_tse.py --help
    python scripts/etl_geo_ibge_tse.py --ufs SP RJ MG          # apenas estas UFs
    python scripts/etl_geo_ibge_tse.py --all-ufs               # todos os 27 estados
    python scripts/etl_geo_ibge_tse.py --ufs PE --full-census  # com dados de setores censitários
    python scripts/etl_geo_ibge_tse.py --ufs PE --skip-tse     # sem dados eleitorais

Variáveis de ambiente necessárias (ou via .env na raiz do monorepo):
    SUPABASE_DB_URL=postgresql://postgres:<senha>@db.<projeto>.supabase.co:5432/postgres

Pré-requisitos:
    pip install -r scripts/requirements-etl.txt
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import logging
import os
import re
import sys
import time
import unicodedata
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Generator

import geopandas as gpd
import psycopg2
import psycopg2.extras
import requests
from dotenv import load_dotenv
from shapely.geometry import Point
from tqdm import tqdm

# ---------------------------------------------------------------------------
# Configuração
# ---------------------------------------------------------------------------

ROOT_DIR = Path(__file__).resolve().parent.parent
TEMP_DIR = ROOT_DIR / ".etl_cache"
TEMP_DIR.mkdir(exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
log = logging.getLogger("etl_geo")

IBGE_API = "https://servicodados.ibge.gov.br/api/v1/localidades"
IBGE_MALHA_BASE = "https://geoftp.ibge.gov.br/organizacao_do_territorio/malhas_territoriais/malhas_municipais/municipio_2022/UFs"
TSE_CDN_BASE = "https://cdn.tse.jus.br/estatistica/sead/odsele/perfil_eleitor_secao"

# Mapeamento UF → código IBGE do estado
UF_CODES: dict[str, int] = {
    "AC": 12, "AL": 27, "AM": 13, "AP": 16, "BA": 29, "CE": 23,
    "DF": 53, "ES": 32, "GO": 52, "MA": 21, "MG": 31, "MS": 50,
    "MT": 51, "PA": 15, "PB": 25, "PE": 26, "PI": 22, "PR": 41,
    "RJ": 33, "RN": 24, "RO": 11, "RR": 14, "RS": 43, "SC": 42,
    "SE": 28, "SP": 35, "TO": 17,
}

UF_REGIOES: dict[str, str] = {
    "AC": "Norte",   "AM": "Norte",   "AP": "Norte",  "PA": "Norte",
    "RO": "Norte",   "RR": "Norte",   "TO": "Norte",
    "AL": "Nordeste","BA": "Nordeste","CE": "Nordeste","MA": "Nordeste",
    "PB": "Nordeste","PE": "Nordeste","PI": "Nordeste","RN": "Nordeste",
    "SE": "Nordeste",
    "DF": "Centro-Oeste","GO": "Centro-Oeste","MS": "Centro-Oeste","MT": "Centro-Oeste",
    "ES": "Sudeste", "MG": "Sudeste", "RJ": "Sudeste", "SP": "Sudeste",
    "PR": "Sul",     "RS": "Sul",     "SC": "Sul",
}

# Palavras-chave para classificar tipo de localidade pelo nome
TIPO_KEYWORDS: list[tuple[str, str]] = [
    (r"\bfazenda\b",  "FAZENDA"),
    (r"\bsitio\b|\bsítio\b", "SITIO"),
    (r"\bpovoad[oa]\b", "POVOADO"),
    (r"\bvila\b",     "VILA"),
    (r"\bnúcleo\b|\bnucleo\b", "NUCLEO"),
    (r"\bdistrito\b", "DISTRITO"),
    (r"\bsubdistrito\b|\brpa\b", "SUBDISTRITO"),
    (r"\bbairro\b",   "BAIRRO"),
]

# ---------------------------------------------------------------------------
# Utilitários
# ---------------------------------------------------------------------------

def normalize(text: str) -> str:
    """Remove acentos e converte para minúsculas."""
    return "".join(
        c for c in unicodedata.normalize("NFD", text)
        if unicodedata.category(c) != "Mn"
    ).lower().strip()


def infer_tipo(nome: str) -> str:
    """Infere o tipo de localidade pelo nome."""
    low = normalize(nome)
    for pattern, tipo in TIPO_KEYWORDS:
        if re.search(pattern, low):
            return tipo
    return "BAIRRO"


def http_get(url: str, retries: int = 4, backoff: float = 1.5) -> Any:
    """GET com retry e backoff exponencial."""
    for attempt in range(retries):
        try:
            r = requests.get(url, timeout=30)
            r.raise_for_status()
            return r
        except requests.RequestException as exc:
            if attempt < retries - 1:
                wait = backoff ** attempt
                log.warning("Tentativa %d falhou (%s). Aguardando %.1fs…", attempt + 1, exc, wait)
                time.sleep(wait)
            else:
                raise


def chunks(lst: list, n: int) -> Generator[list, None, None]:
    for i in range(0, len(lst), n):
        yield lst[i : i + n]


# ---------------------------------------------------------------------------
# Banco de dados
# ---------------------------------------------------------------------------

def get_conn(db_url: str) -> psycopg2.extensions.connection:
    conn = psycopg2.connect(db_url)
    conn.autocommit = False
    return conn


def log_ingestao(
    conn,
    operacao: str,
    municipio_id: int | None,
    totais: dict[str, int],
    status: str,
    detalhes: dict | None = None,
) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO public.geo_ingestao_log
                (operacao, municipio_id, registros_total, registros_novos,
                 registros_atua, registros_erro, status, detalhes, concluido_em)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, now())
            """,
            (
                operacao,
                municipio_id,
                totais.get("total", 0),
                totais.get("novos", 0),
                totais.get("atualizados", 0),
                totais.get("erros", 0),
                status,
                json.dumps(detalhes or {}, ensure_ascii=False, default=str),
            ),
        )
    conn.commit()


# ---------------------------------------------------------------------------
# Fase 1 – Municípios via API IBGE
# ---------------------------------------------------------------------------

def etl_municipios(conn, ufs: list[str], gdf_municipios: gpd.GeoDataFrame | None) -> dict[str, int]:
    """
    Carrega municípios de todas as UFs via API IBGE.
    Se gdf_municipios for fornecido, enriquece com geometria (centroide).
    Retorna { id_ibge: id_ibge } para uso nas fases seguintes.
    """
    log.info("=== Fase 1: Municípios ===")
    url = f"{IBGE_API}/municipios?orderBy=nome"
    log.info("Baixando lista completa de municípios da API IBGE…")
    data = http_get(url).json()

    # Filtra pelas UFs solicitadas
    municipios = [m for m in data if m["microrregiao"]["mesorregiao"]["UF"]["sigla"] in ufs]
    log.info("Municípios a processar: %d", len(municipios))

    novos = atualizados = erros = 0

    with conn.cursor() as cur:
        for m in tqdm(municipios, desc="Municípios", unit="mun"):
            ibge_id = m["id"]
            nome = m["nome"]
            uf = m["microrregiao"]["mesorregiao"]["UF"]["sigla"]
            regiao = UF_REGIOES.get(uf)
            pop = m.get("populacao")  # presente em /municipios com ?view=nivelado (API v2)

            # Tenta pegar geometria do GeoDataFrame shapefile (se carregado)
            geom_wkt = None
            if gdf_municipios is not None:
                row = gdf_municipios[gdf_municipios["CD_MUN"].astype(str).str.startswith(str(ibge_id))]
                if not row.empty:
                    centroid = row.geometry.centroid.iloc[0]
                    geom_wkt = f"SRID=4326;POINT({centroid.x} {centroid.y})"

            try:
                cur.execute(
                    """
                    INSERT INTO public.geo_municipios
                        (id_ibge, nome, uf, regiao, populacao_estimada, geom)
                    VALUES (%s, %s, %s, %s, %s, ST_GeomFromEWKT(%s))
                    ON CONFLICT (id_ibge) DO UPDATE SET
                        nome               = EXCLUDED.nome,
                        uf                 = EXCLUDED.uf,
                        regiao             = EXCLUDED.regiao,
                        populacao_estimada = COALESCE(EXCLUDED.populacao_estimada, geo_municipios.populacao_estimada),
                        geom               = COALESCE(EXCLUDED.geom, geo_municipios.geom),
                        atualizado_em      = now()
                    """,
                    (ibge_id, nome, uf, regiao, pop, geom_wkt or "SRID=4326;POINT(0 0)"),
                )
                if cur.rowcount and cur.statusmessage.startswith("INSERT"):
                    novos += 1
                else:
                    atualizados += 1
            except Exception as exc:
                log.error("Erro no município %d (%s): %s", ibge_id, nome, exc)
                conn.rollback()
                erros += 1
                continue

        conn.commit()

    totais = {"total": len(municipios), "novos": novos, "atualizados": atualizados, "erros": erros}
    log.info("Municípios: %d novos, %d atualizados, %d erros", novos, atualizados, erros)
    log_ingestao(conn, "ibge_municipios", None, totais, "concluido" if erros == 0 else "erro",
                 {"ufs": ufs})
    return {m["id"]: m["id"] for m in municipios}


# ---------------------------------------------------------------------------
# Fase 2 – Localidades (distritos + subdistritos) via API IBGE
# ---------------------------------------------------------------------------

def etl_localidades_ibge(conn, municipio_ids: list[int]) -> None:
    """
    Para cada município, busca distritos e subdistritos via API IBGE
    e insere em geo_localidades.
    """
    log.info("=== Fase 2: Localidades IBGE (distritos/subdistritos) ===")
    novos = atualizados = erros = 0

    for mun_id in tqdm(municipio_ids, desc="Localidades", unit="mun"):
        try:
            distritos = http_get(f"{IBGE_API}/municipios/{mun_id}/distritos").json()
        except Exception as exc:
            log.warning("Distritos não encontrados para %d: %s", mun_id, exc)
            erros += 1
            continue

        registros: list[tuple] = []
        for d in distritos:
            nome_d = d["nome"]
            tipo = infer_tipo(nome_d)
            # Zona: distritos sede tendem a ser urbanos; demais são verificados pelo nome
            zona = "RURAL" if any(k in normalize(nome_d) for k in ("rural", "zona rural")) else "URBANA"
            registros.append((mun_id, nome_d, tipo, int(d["id"]), "IBGE", zona))

            # Subdistritos (ex: RPAs de Recife)
            try:
                subdist = http_get(f"{IBGE_API}/distritos/{d['id']}/subdistritos").json()
                for s in subdist:
                    nome_s = s["nome"]
                    tipo_s = "SUBDISTRITO"
                    zona_s = "RURAL" if "rural" in normalize(nome_s) else "URBANA"
                    registros.append((mun_id, nome_s, tipo_s, int(s["id"]), "IBGE", zona_s))
            except Exception:
                pass  # Nem todo distrito tem subdistritos

        with conn.cursor() as cur:
            for rec in registros:
                try:
                    cur.execute(
                        """
                        INSERT INTO public.geo_localidades
                            (municipio_id, nome, tipo, ibge_id, fonte, zona)
                        VALUES (%s, %s, %s, %s, %s, %s)
                        ON CONFLICT (municipio_id, nome_normalizado, tipo) DO UPDATE SET
                            ibge_id       = EXCLUDED.ibge_id,
                            fonte         = EXCLUDED.fonte,
                            zona          = EXCLUDED.zona,
                            atualizado_em = now()
                        """,
                        rec,
                    )
                    if "INSERT" in cur.statusmessage:
                        novos += 1
                    else:
                        atualizados += 1
                except Exception as exc:
                    log.error("Erro ao inserir localidade %s (mun %d): %s", rec[1], rec[0], exc)
                    conn.rollback()
                    erros += 1

            conn.commit()

        log_ingestao(conn, "ibge_localidades", mun_id,
                     {"total": len(registros), "novos": novos, "atualizados": atualizados, "erros": erros},
                     "concluido")

    log.info("Localidades IBGE: %d novos, %d atualizados, %d erros", novos, atualizados, erros)


# ---------------------------------------------------------------------------
# Fase 3 – Shapefile IBGE Malha Municipal (geometrias) – opcional
# ---------------------------------------------------------------------------

def download_shapefile_uf(uf: str) -> Path:
    """
    Baixa e extrai o shapefile da malha municipal de uma UF do IBGE.
    URL padrão: https://geoftp.ibge.gov.br/.../<UF>/<UF>_Municipios_2022.zip
    """
    uf_upper = uf.upper()
    url = f"{IBGE_MALHA_BASE}/{uf_upper}/{uf_upper}_Municipios_2022.zip"
    zip_path = TEMP_DIR / f"malha_{uf_upper}.zip"
    shp_dir = TEMP_DIR / f"malha_{uf_upper}"

    if shp_dir.exists() and any(shp_dir.glob("*.shp")):
        log.info("Shapefile de %s já em cache: %s", uf_upper, shp_dir)
        return shp_dir

    log.info("Baixando shapefile %s (~15-25 MB)…", uf_upper)
    r = http_get(url)
    zip_path.write_bytes(r.content)

    log.info("Extraindo %s…", zip_path)
    shp_dir.mkdir(exist_ok=True)
    with zipfile.ZipFile(zip_path) as zf:
        zf.extractall(shp_dir)

    return shp_dir


def load_shapefile_uf(uf: str) -> gpd.GeoDataFrame:
    shp_dir = download_shapefile_uf(uf)
    shp_files = list(shp_dir.rglob("*.shp"))
    if not shp_files:
        raise FileNotFoundError(f"Nenhum .shp encontrado em {shp_dir}")
    gdf = gpd.read_file(shp_files[0])
    return gdf.to_crs(epsg=4326)


def etl_geometrias_municipios(conn, ufs: list[str]) -> None:
    """
    Enriquece geo_municipios com centroides reais a partir dos shapefiles.
    """
    log.info("=== Fase 3: Geometrias municipais (shapefiles IBGE) ===")
    for uf in ufs:
        log.info("Processando shapefile de %s…", uf)
        try:
            gdf = load_shapefile_uf(uf)
        except Exception as exc:
            log.error("Erro ao carregar shapefile %s: %s", uf, exc)
            continue

        # Coluna com código IBGE — pode ser CD_MUN, CD_GEOCMU, CD_GEOCODIGO dependendo do ano
        cod_col = next((c for c in gdf.columns if "CD_MUN" in c or "CD_GEOCMU" in c or "CD_GEO" in c), None)
        if cod_col is None:
            log.warning("Coluna de código IBGE não encontrada no shapefile de %s. Colunas: %s", uf, gdf.columns.tolist())
            continue

        with conn.cursor() as cur:
            for _, row in tqdm(gdf.iterrows(), total=len(gdf), desc=f"Geometrias {uf}", unit="mun"):
                try:
                    ibge_id = int(str(row[cod_col])[:7])  # 7 dígitos
                    centroid = row.geometry.centroid
                    area_km2 = None
                    # Calcula área em km² reprojetando para UTM do Brasil (EPSG:5880)
                    try:
                        gdf_utm = gdf.to_crs(epsg=5880)
                        area_km2 = round(gdf_utm.loc[row.name, "geometry"].area / 1e6, 4)
                    except Exception:
                        pass

                    cur.execute(
                        """
                        UPDATE public.geo_municipios
                        SET geom          = ST_SetSRID(ST_MakePoint(%s, %s), 4326),
                            area_km2      = COALESCE(%s, area_km2),
                            atualizado_em = now()
                        WHERE id_ibge = %s
                        """,
                        (centroid.x, centroid.y, area_km2, ibge_id),
                    )
                except Exception as exc:
                    log.error("Erro na geometria do município %s: %s", row.get(cod_col), exc)

        conn.commit()
        log.info("Geometrias de %s concluídas.", uf)


# ---------------------------------------------------------------------------
# Fase 4 – Dados eleitorais TSE
# ---------------------------------------------------------------------------

TSE_YEAR = 2024

# Colunas do CSV TSE Perfil do Eleitorado por Seção (2024)
# DT_GERACAO;HH_GERACAO;ANO_ELEICAO;CD_TIPO_ELEICAO;NM_TIPO_ELEICAO;NR_TURNO;CD_ELEICAO;DS_ELEICAO;
# SG_UF;CD_MUNICIPIO;NM_MUNICIPIO;CD_MUN_IBGE;NR_ZONA;NR_SECAO;NR_LOCAL_VOTACAO;
# NM_LOCAL_VOTACAO;DS_LOCAL_VOTACAO_ENDERECO;NR_CEP;NM_BAIRRO;
# CD_GENERO;DS_GENERO;CD_FAIXA_ETARIA;DS_FAIXA_ETARIA;CD_GRAU_ESCOLARIDADE;DS_GRAU_ESCOLARIDADE;QT_ELEITORES_PERFIL


def download_tse_csv(uf: str) -> Path:
    """
    Baixa o CSV do perfil do eleitorado por seção eleitoral para uma UF.
    """
    uf_upper = uf.upper()
    url = f"{TSE_CDN_BASE}/perfil_eleitor_secao_{TSE_YEAR}_{uf_upper}.zip"
    zip_path = TEMP_DIR / f"tse_{uf_upper}_{TSE_YEAR}.zip"
    csv_dir = TEMP_DIR / f"tse_{uf_upper}_{TSE_YEAR}"

    if csv_dir.exists() and any(csv_dir.glob("*.csv")):
        log.info("CSV TSE de %s já em cache.", uf_upper)
        return csv_dir

    log.info("Baixando CSV TSE %s %d (~20-200 MB)…", uf_upper, TSE_YEAR)
    r = http_get(url)
    zip_path.write_bytes(r.content)

    csv_dir.mkdir(exist_ok=True)
    with zipfile.ZipFile(zip_path) as zf:
        zf.extractall(csv_dir)

    return csv_dir


def parse_tse_csv(csv_dir: Path) -> dict[int, dict[int, dict]]:
    """
    Lê CSV TSE e agrega eleitores por (municipio_ibge → local_votacao).
    Retorna: { cd_mun_ibge: { nr_local: { nome, endereco, bairro, eleitores, secoes } } }
    """
    csv_files = list(csv_dir.rglob("*.csv"))
    if not csv_files:
        raise FileNotFoundError(f"Nenhum CSV em {csv_dir}")

    resultado: dict[int, dict[int, dict]] = {}

    for csv_file in csv_files:
        log.info("Lendo %s…", csv_file.name)
        with open(csv_file, encoding="latin-1", newline="") as f:
            reader = csv.DictReader(f, delimiter=";")
            for row in reader:
                try:
                    ibge_id = int(row.get("CD_MUN_IBGE", "0") or "0")
                    nr_local = int(row.get("NR_LOCAL_VOTACAO", "0") or "0")
                    eleitores = int(row.get("QT_ELEITORES_PERFIL", "0") or "0")
                    nr_secao = row.get("NR_SECAO", "")
                    nome_local = row.get("NM_LOCAL_VOTACAO", "")
                    endereco = row.get("DS_LOCAL_VOTACAO_ENDERECO", "")
                    bairro = row.get("NM_BAIRRO", "")

                    if ibge_id not in resultado:
                        resultado[ibge_id] = {}
                    if nr_local not in resultado[ibge_id]:
                        resultado[ibge_id][nr_local] = {
                            "nome": nome_local,
                            "endereco": endereco,
                            "bairro": bairro,
                            "eleitores": 0,
                            "secoes": set(),
                        }
                    resultado[ibge_id][nr_local]["eleitores"] += eleitores
                    resultado[ibge_id][nr_local]["secoes"].add(nr_secao)
                except (ValueError, KeyError):
                    continue

    return resultado


def etl_dados_eleitorais(conn, ufs: list[str]) -> None:
    """
    Para cada UF:
      1. Baixa CSV TSE
      2. Para cada municipio+local_votacao, localiza a localidade mais próxima no banco
         usando o bairro declarado (match textual) ou ST_Distance (match espacial)
      3. Insere em geo_dados_eleitorais
    """
    log.info("=== Fase 4: Dados Eleitorais TSE ===")

    for uf in ufs:
        log.info("Processando TSE %s…", uf)
        try:
            csv_dir = download_tse_csv(uf)
            tse_data = parse_tse_csv(csv_dir)
        except Exception as exc:
            log.error("Erro no CSV TSE de %s: %s", uf, exc)
            continue

        with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
            for ibge_id, locais in tqdm(tse_data.items(), desc=f"TSE {uf}", unit="mun"):
                # Busca localidades do município ordenadas por nome_normalizado
                cur.execute(
                    "SELECT id, nome, nome_normalizado FROM public.geo_localidades WHERE municipio_id = %s",
                    (ibge_id,),
                )
                localidades = cur.fetchall()
                if not localidades:
                    continue  # Município ainda não tem localidades (pular)

                # Índice de localidades por nome normalizado para match rápido
                loc_idx: dict[str, int] = {l["nome_normalizado"]: l["id"] for l in localidades}

                for nr_local, info in locais.items():
                    bairro_norm = normalize(info["bairro"])
                    localidade_id: int | None = None
                    metodo = "ESPACIAL"

                    # Tenta match textual pelo bairro
                    if bairro_norm in loc_idx:
                        localidade_id = loc_idx[bairro_norm]
                        metodo = "EXATO"
                    else:
                        # Tenta match parcial (prefixo)
                        matches = [v for k, v in loc_idx.items() if bairro_norm and bairro_norm in k]
                        if matches:
                            localidade_id = matches[0]
                            metodo = "ESPACIAL"

                    if localidade_id is None:
                        # Associa à primeira localidade urbana do município como fallback
                        cur.execute(
                            """
                            SELECT id FROM public.geo_localidades
                            WHERE municipio_id = %s AND zona = 'URBANA'
                            ORDER BY nome LIMIT 1
                            """,
                            (ibge_id,),
                        )
                        row = cur.fetchone()
                        if row:
                            localidade_id = row["id"]
                            metodo = "BACIA"
                        else:
                            continue

                    secoes_str = ",".join(sorted(info["secoes"]))
                    try:
                        cur.execute(
                            """
                            INSERT INTO public.geo_dados_eleitorais
                                (localidade_id, codigo_local_votacao, nome_local_votacao,
                                 endereco_local, quantidade_eleitores, secoes_vinculadas,
                                 metodo_vinculo, ano_atualizacao, fonte_detalhada)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                            ON CONFLICT DO NOTHING
                            """,
                            (
                                localidade_id, nr_local, info["nome"],
                                info["endereco"], info["eleitores"], secoes_str,
                                metodo, TSE_YEAR,
                                f"TSE Perfil Eleitorado {TSE_YEAR} - {uf}",
                            ),
                        )
                    except Exception as exc:
                        log.error("Erro ao inserir dado eleitoral local %d mun %d: %s", nr_local, ibge_id, exc)

            conn.commit()

        log_ingestao(conn, f"tse_eleitores_{uf}", None,
                     {"total": sum(len(v) for v in tse_data.values()), "novos": 0, "atualizados": 0, "erros": 0},
                     "concluido", {"uf": uf, "ano": TSE_YEAR})
        log.info("TSE %s concluído.", uf)


# ---------------------------------------------------------------------------
# Fase 5 – Censo IBGE 2022 (dados demográficos por setor censitário) – opcional
# ---------------------------------------------------------------------------

CENSO_URL_BASE = "https://ftp.ibge.gov.br/Censos/Censo_Demografico_2022/Agregados_por_Setores_Censitarios"

def etl_censo_demografico(conn, ufs: list[str]) -> None:
    """
    Baixa os agregados por setor censitário do Censo 2022 para cada UF.
    ATENÇÃO: cada arquivo UF pode ter 50-300 MB descomprimido.
    Vincula setores às localidades por match de código de município + nome de bairro.
    """
    log.info("=== Fase 5: Censo Demográfico IBGE 2022 ===")
    log.warning("Esta fase baixa até ~300 MB por UF. Pode demorar bastante.")

    for uf in ufs:
        uf_upper = uf.upper()
        # Arquivo básico de domicílios e população
        url = f"{CENSO_URL_BASE}/CSV/BR_{uf_upper}_20231030.zip"
        zip_path = TEMP_DIR / f"censo_{uf_upper}.zip"
        csv_dir = TEMP_DIR / f"censo_{uf_upper}"

        if not (csv_dir.exists() and any(csv_dir.glob("*.csv"))):
            log.info("Baixando Censo 2022 %s…", uf_upper)
            try:
                r = http_get(url)
                zip_path.write_bytes(r.content)
                csv_dir.mkdir(exist_ok=True)
                with zipfile.ZipFile(zip_path) as zf:
                    zf.extractall(csv_dir)
            except Exception as exc:
                log.error("Erro ao baixar Censo %s: %s", uf_upper, exc)
                continue

        csv_files = list(csv_dir.rglob("*.csv"))
        if not csv_files:
            log.warning("Nenhum CSV de Censo encontrado para %s", uf_upper)
            continue

        # Colunas esperadas: Cod_setor, Cod_municipio, Nome_municipio, Nome_bairro,
        # V001 (domicílios particulares), V002 (morad. perm.) etc.
        # O formato varia por release; aqui tratamos o padrão 2022.
        with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
            for csv_file in csv_files:
                log.info("Lendo %s…", csv_file.name)
                try:
                    with open(csv_file, encoding="utf-8-sig", newline="") as f:
                        reader = csv.DictReader(f, delimiter=";")
                        batch: list[tuple] = []

                        for row in reader:
                            try:
                                cod_setor = row.get("Cod_setor", "").strip()
                                cod_mun = int(cod_setor[:7]) if len(cod_setor) >= 7 else None
                                if cod_mun is None:
                                    continue

                                # Busca localidade pelo município + match de bairro no nome
                                bairro_censo = normalize(row.get("Nome_subdistrito", "") or row.get("Nome_bairro", ""))
                                cur.execute(
                                    """
                                    SELECT id FROM public.geo_localidades
                                    WHERE municipio_id = %s
                                      AND nome_normalizado ILIKE %s
                                    LIMIT 1
                                    """,
                                    (cod_mun, f"%{bairro_censo}%"),
                                )
                                loc = cur.fetchone()
                                if loc is None:
                                    continue

                                pop_total = int(row.get("V001", "0") or "0")
                                domicilios = int(row.get("V002", "0") or "0")

                                batch.append((
                                    loc["id"], cod_setor, pop_total, 0, 0,
                                    domicilios, 0, 2022,
                                    f"Censo IBGE 2022 – {csv_file.name}",
                                ))
                            except (ValueError, KeyError):
                                continue

                        if batch:
                            psycopg2.extras.execute_values(
                                cur,
                                """
                                INSERT INTO public.geo_dados_demograficos
                                    (localidade_id, setor_censitario, populacao_total,
                                     populacao_urbana, populacao_rural,
                                     domicilios_particulares, domicilios_coletivos,
                                     ano_censo, fonte_detalhada)
                                VALUES %s
                                ON CONFLICT DO NOTHING
                                """,
                                batch,
                                page_size=500,
                            )
                            conn.commit()
                            log.info("Inseridos %d setores censitários de %s", len(batch), csv_file.name)

                except Exception as exc:
                    log.error("Erro ao processar Censo %s: %s", csv_file.name, exc)
                    conn.rollback()

        log_ingestao(conn, f"censo_2022_{uf}", None,
                     {"total": 0, "novos": 0, "atualizados": 0, "erros": 0},
                     "concluido", {"uf": uf})


# ---------------------------------------------------------------------------
# CLI principal
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="ETL Geográfico – IBGE + TSE → banco iDialog",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Exemplos:
  # Carga básica de Pernambuco (localidades + eleitores, sem shapefile):
  python scripts/etl_geo_ibge_tse.py --ufs PE

  # Carga com geometrias reais dos municípios (shapefile IBGE):
  python scripts/etl_geo_ibge_tse.py --ufs PE --with-shapes

  # Carga completa com dados do Censo 2022 (arquivos grandes):
  python scripts/etl_geo_ibge_tse.py --ufs PE --full-census

  # Todos os estados (demorado – ~4h):
  python scripts/etl_geo_ibge_tse.py --all-ufs

  # Apenas municípios, sem dados eleitorais:
  python scripts/etl_geo_ibge_tse.py --ufs SP --skip-tse

  # Apenas dados eleitorais de uma UF já carregada:
  python scripts/etl_geo_ibge_tse.py --ufs SP --skip-ibge
        """,
    )
    uf_group = parser.add_mutually_exclusive_group(required=True)
    uf_group.add_argument("--ufs", nargs="+", metavar="UF",
                          help="Lista de UFs a processar (ex: SP RJ MG)")
    uf_group.add_argument("--all-ufs", action="store_true",
                          help="Processa todos os 27 estados")

    parser.add_argument("--with-shapes", action="store_true",
                        help="Baixa shapefiles IBGE para geometrias reais dos municípios (~15 MB/UF)")
    parser.add_argument("--full-census", action="store_true",
                        help="Baixa e processa agregados do Censo 2022 (~100-300 MB/UF)")
    parser.add_argument("--skip-tse", action="store_true",
                        help="Pula download e carga dos dados eleitorais TSE")
    parser.add_argument("--skip-ibge", action="store_true",
                        help="Pula carga de municípios e localidades IBGE")
    parser.add_argument("--db-url", metavar="URL",
                        help="URL de conexão PostgreSQL (padrão: SUPABASE_DB_URL do .env)")
    parser.add_argument("--cache-dir", metavar="DIR",
                        help=f"Diretório de cache de arquivos (padrão: {TEMP_DIR})")
    parser.add_argument("--log-level", default="INFO",
                        choices=["DEBUG", "INFO", "WARNING", "ERROR"])
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    logging.getLogger().setLevel(args.log_level)

    # Configurar diretório de cache
    global TEMP_DIR
    if args.cache_dir:
        TEMP_DIR = Path(args.cache_dir)
        TEMP_DIR.mkdir(parents=True, exist_ok=True)

    # Carregar variáveis de ambiente
    env_file = ROOT_DIR / ".env.local"
    if not env_file.exists():
        env_file = ROOT_DIR / ".env"
    if env_file.exists():
        load_dotenv(env_file)
        log.info("Carregado .env de %s", env_file)
    else:
        log.warning(".env não encontrado em %s — certifique-se de definir SUPABASE_DB_URL", ROOT_DIR)

    db_url = args.db_url or os.environ.get("SUPABASE_DB_URL") or os.environ.get("DATABASE_URL")
    if not db_url:
        log.error(
            "URL do banco não definida. Use --db-url ou defina SUPABASE_DB_URL no .env\n"
            "Formato: postgresql://postgres:<senha>@db.<ref>.supabase.co:5432/postgres"
        )
        sys.exit(1)

    ufs = list(UF_CODES.keys()) if args.all_ufs else [u.upper() for u in args.ufs]
    invalid = [u for u in ufs if u not in UF_CODES]
    if invalid:
        log.error("UFs inválidas: %s. UFs válidas: %s", invalid, sorted(UF_CODES.keys()))
        sys.exit(1)

    log.info("Iniciando ETL para UFs: %s", ufs)
    log.info("Opções: shapes=%s, censo=%s, tse=%s, ibge=%s",
             args.with_shapes, args.full_census, not args.skip_tse, not args.skip_ibge)

    start = datetime.now(tz=timezone.utc)

    try:
        conn = get_conn(db_url)
        log.info("Conectado ao banco com sucesso.")
    except Exception as exc:
        log.error("Falha na conexão com o banco: %s", exc)
        sys.exit(1)

    try:
        municipio_ids: list[int] = []

        if not args.skip_ibge:
            # Fase 1: Municípios
            id_map = etl_municipios(conn, ufs, None)
            municipio_ids = list(id_map.keys())

            # Fase 3: Geometrias (opcional)
            if args.with_shapes:
                etl_geometrias_municipios(conn, ufs)

            # Fase 2: Localidades
            etl_localidades_ibge(conn, municipio_ids)
        else:
            # Busca IDs já existentes no banco para as UFs
            with conn.cursor() as cur:
                placeholders = ",".join(["%s"] * len(ufs))
                cur.execute(
                    f"SELECT id_ibge FROM public.geo_municipios WHERE uf IN ({placeholders})",
                    ufs,
                )
                municipio_ids = [r[0] for r in cur.fetchall()]
            log.info("Usando %d municípios existentes no banco para %s", len(municipio_ids), ufs)

        if not args.skip_tse:
            # Fase 4: Dados eleitorais
            etl_dados_eleitorais(conn, ufs)

        if args.full_census:
            # Fase 5: Censo demográfico
            etl_censo_demografico(conn, ufs)

    except KeyboardInterrupt:
        log.warning("ETL interrompido pelo usuário.")
    except Exception as exc:
        log.exception("Erro fatal no ETL: %s", exc)
        conn.rollback()
        sys.exit(1)
    finally:
        conn.close()

    elapsed = (datetime.now(tz=timezone.utc) - start).total_seconds()
    log.info("ETL concluído em %.1f segundos (%.1f min)", elapsed, elapsed / 60)


if __name__ == "__main__":
    main()
