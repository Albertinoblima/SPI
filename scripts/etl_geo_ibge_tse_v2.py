#!/usr/bin/env python3
"""
ETL Geográfico – IBGE + TSE → geo_municipios / geo_localidades / geo_dados_eleitorais
===========================================================================================================================

Autentica via SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (não precisa de senha do banco).
Usa o cliente Python oficial supabase-py para todos os upserts/inserts.

Uso:
    python scripts/etl_geo_ibge_tse_v2.py --ufs PE
    python scripts/etl_geo_ibge_tse_v2.py --ufs SP RJ MG
    python scripts/etl_geo_ibge_tse_v2.py --all-ufs
    python scripts/etl_geo_ibge_tse_v2.py --ufs PE --skip-tse
    python scripts/etl_geo_ibge_tse_v2.py --ufs PE --with-shapes   # requer geopandas

Variáveis lidas de apps/web/.env.local (automaticamente):
    NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
    SUPABASE_SERVICE_ROLE_KEY=<service_role_key>

Pré-requisitos:
    pip install -r scripts/requirements-etl.txt
"""

import argparse
import csv
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

import requests
from dotenv import load_dotenv
from supabase import create_client, Client
from tqdm import tqdm

# GeoPandas é opcional (apenas com --with-shapes)
try:
    import geopandas as gpd
    HAS_GEO = True
except ImportError:
    HAS_GEO = False

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
TSE_YEAR = 2024

# Mapeamento UF → código IBGE do estado
UF_CODES: dict[str, int] = {
    "AC": 12, "AL": 27, "AM": 13, "AP": 16, "BA": 29, "CE": 23,
    "DF": 53, "ES": 32, "GO": 52, "MA": 21, "MG": 31, "MS": 50,
    "MT": 51, "PA": 15, "PB": 25, "PE": 26, "PI": 22, "PR": 41,
    "RJ": 33, "RN": 24, "RO": 11, "RR": 14, "RS": 43, "SC": 42,
    "SE": 28, "SP": 35, "TO": 17,
}

UF_REGIOES: dict[str, str] = {
    "AC": "Norte",    "AM": "Norte",    "AP": "Norte",   "PA": "Norte",
    "RO": "Norte",    "RR": "Norte",    "TO": "Norte",
    "AL": "Nordeste", "BA": "Nordeste", "CE": "Nordeste", "MA": "Nordeste",
    "PB": "Nordeste", "PE": "Nordeste", "PI": "Nordeste", "RN": "Nordeste",
    "SE": "Nordeste",
    "DF": "Centro-Oeste", "GO": "Centro-Oeste", "MS": "Centro-Oeste", "MT": "Centro-Oeste",
    "ES": "Sudeste",  "MG": "Sudeste",  "RJ": "Sudeste",  "SP": "Sudeste",
    "PR": "Sul",      "RS": "Sul",      "SC": "Sul",
}

TIPO_KEYWORDS: list[tuple[str, str]] = [
    (r"\bfazenda\b", "FAZENDA"),
    (r"\bsitio\b|\bsítio\b", "SITIO"),
    (r"\bpovoad[oa]\b", "POVOADO"),
    (r"\bvila\b", "VILA"),
    (r"\bnúcleo\b|\bnucleo\b", "NUCLEO"),
    (r"\bdistrito\b", "DISTRITO"),
    (r"\bsubdistrito\b|\brpa\b", "SUBDISTRITO"),
    (r"\bbairro\b", "BAIRRO"),
]

BATCH_SIZE = 200  # registros por chamada upsert

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
    low = normalize(nome)
    for pattern, tipo in TIPO_KEYWORDS:
        if re.search(pattern, low):
            return tipo
    return "BAIRRO"


def http_get(url: str, retries: int = 4, backoff: float = 1.5) -> Any:
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
        yield lst[i: i + n]


# ---------------------------------------------------------------------------
# Supabase client
# ---------------------------------------------------------------------------

def get_supabase() -> Client:
    """Cria cliente Supabase usando variáveis de ambiente."""
    # Tenta .env.local do app web primeiro
    for env_path in [
        ROOT_DIR / "apps" / "web" / ".env.local",
        ROOT_DIR / ".env.local",
        ROOT_DIR / ".env",
    ]:
        if env_path.exists():
            load_dotenv(env_path, override=False)
            log.info("Carregado .env de %s", env_path)
            break

    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

    if not url or not key:
        log.error(
            "SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY precisam estar definidos.\n"
            "Verifique apps/web/.env.local ou defina as variáveis de ambiente."
        )
        sys.exit(1)

    log.info("Conectando a %s…", url)
    return create_client(url, key)


def log_ingestao(
    sb: Client,
    operacao: str,
    municipio_id: int | None,
    totais: dict[str, int],
    status: str,
    detalhes: dict | None = None,
) -> None:
    try:
        sb.table("geo_ingestao_log").insert({
            "operacao": operacao,
            "municipio_id": municipio_id,
            "registros_total": totais.get("total", 0),
            "registros_novos": totais.get("novos", 0),
            "registros_atua": totais.get("atualizados", 0),
            "registros_erro": totais.get("erros", 0),
            "status": status,
            "detalhes": detalhes or {},
            "concluido_em": datetime.now(tz=timezone.utc).isoformat(),
        }).execute()
    except Exception as exc:
        log.warning("Falha ao registrar log de ingestão: %s", exc)


# ---------------------------------------------------------------------------
# Fase 1 – Municípios via API IBGE
# ---------------------------------------------------------------------------

def etl_municipios(sb: Client, ufs: list[str]) -> list[int]:
    """
    Carrega municípios via API IBGE e faz upsert em geo_municipios.
    Retorna lista de id_ibge inseridos/atualizados.
    """
    log.info("=== Fase 1: Municípios ===")
    url = f"{IBGE_API}/municipios?orderBy=nome"
    log.info("Baixando lista completa de municípios da API IBGE…")
    data = http_get(url).json()

    municipios = [
        m for m in data
        if m.get("microrregiao") and m["microrregiao"].get("mesorregiao")
        and m["microrregiao"]["mesorregiao"].get("UF")
        and m["microrregiao"]["mesorregiao"]["UF"].get("sigla") in ufs
    ]
    log.info("Municípios a processar: %d", len(municipios))

    rows = []
    for m in municipios:
        uf = m["microrregiao"]["mesorregiao"]["UF"]["sigla"]
        rows.append({
            "id_ibge": m["id"],
            "nome": m["nome"],
            "uf": uf,
            "regiao": UF_REGIOES.get(uf),
        })

    erros = 0
    for batch in chunks(rows, BATCH_SIZE):
        try:
            sb.table("geo_municipios").upsert(
                batch,
                on_conflict="id_ibge",
            ).execute()
        except Exception as exc:
            log.error("Erro ao inserir lote de municípios: %s", exc)
            erros += len(batch)

    log.info("Municípios: %d processados, %d erros", len(rows), erros)
    log_ingestao(sb, "ibge_municipios", None,
                 {"total": len(rows), "novos": len(rows), "atualizados": 0, "erros": erros},
                 "concluido" if erros == 0 else "erro", {"ufs": ufs})

    return [m["id"] for m in municipios]


# ---------------------------------------------------------------------------
# Fase 2 – Localidades (distritos + subdistritos) via API IBGE
# ---------------------------------------------------------------------------

def etl_localidades_ibge(sb: Client, municipio_ids: list[int]) -> None:
    """
    Para cada município, busca distritos/subdistritos via API IBGE
    e faz upsert em geo_localidades.
    NOTA: nome_normalizado é coluna GENERATED — não deve ser enviada no insert.
    """
    log.info("=== Fase 2: Localidades IBGE ===")
    erros = 0
    total = 0

    for mun_id in tqdm(municipio_ids, desc="Localidades", unit="mun"):
        try:
            distritos = http_get(f"{IBGE_API}/municipios/{mun_id}/distritos").json()
        except Exception as exc:
            log.warning("Distritos não encontrados para %d: %s", mun_id, exc)
            erros += 1
            continue

        registros: list[dict] = []
        for d in distritos:
            nome_d = d["nome"]
            tipo = infer_tipo(nome_d)
            zona = "RURAL" if any(k in normalize(nome_d) for k in ("rural", "zona rural")) else "URBANA"
            registros.append({
                "municipio_id": mun_id,
                "nome": nome_d,
                "tipo": tipo,
                "ibge_id": int(d["id"]),
                "fonte": "IBGE",
                "zona": zona,
            })

            # Subdistritos
            try:
                subdist = http_get(f"{IBGE_API}/distritos/{d['id']}/subdistritos").json()
                for s in subdist:
                    nome_s = s["nome"]
                    zona_s = "RURAL" if "rural" in normalize(nome_s) else "URBANA"
                    registros.append({
                        "municipio_id": mun_id,
                        "nome": nome_s,
                        "tipo": "SUBDISTRITO",
                        "ibge_id": int(s["id"]),
                        "fonte": "IBGE",
                        "zona": zona_s,
                    })
            except Exception:
                pass

        if registros:
            for batch in chunks(registros, BATCH_SIZE):
                try:
                    sb.table("geo_localidades").upsert(
                        batch,
                        on_conflict="municipio_id,ibge_id",
                        ignore_duplicates=False,
                    ).execute()
                    total += len(batch)
                except Exception as exc:
                    log.error("Erro ao inserir localidades do mun %d: %s", mun_id, exc)
                    erros += len(batch)

    log.info("Localidades IBGE: %d inseridas/atualizadas, %d erros", total, erros)
    log_ingestao(sb, "ibge_localidades", None,
                 {"total": total, "novos": total, "atualizados": 0, "erros": erros},
                 "concluido" if erros == 0 else "erro")


# ---------------------------------------------------------------------------
# Fase 3 – Shapefile IBGE Malha Municipal (geometrias) – opcional
# ---------------------------------------------------------------------------

def etl_geometrias_municipios(sb: Client, ufs: list[str]) -> None:
    """
    Enriquece geo_municipios com centroides e área a partir dos shapefiles IBGE.
    Requer geopandas (pip install geopandas).
    NOTA: supabase-py não suporta PostGIS diretamente; aqui apenas logamos o aviso.
    Para geometrias reais use migrations + SQL direto via Supabase CLI.
    """
    if not HAS_GEO:
        log.error("geopandas não instalado. Execute: pip install geopandas")
        return

    log.info("=== Fase 3: Geometrias municipais (shapefiles IBGE) ===")
    log.warning(
        "supabase-py não suporta inserção de geometrias PostGIS nativas.\n"
        "Esta fase baixa os shapefiles para cache mas NÃO atualiza o banco.\n"
        "Para inserir geometrias, use: supabase db query --linked --file <sql>"
    )

    for uf in ufs:
        uf_upper = uf.upper()
        url = f"{IBGE_MALHA_BASE}/{uf_upper}/{uf_upper}_Municipios_2022.zip"
        zip_path = TEMP_DIR / f"malha_{uf_upper}.zip"
        shp_dir = TEMP_DIR / f"malha_{uf_upper}"

        if shp_dir.exists() and any(shp_dir.glob("*.shp")):
            log.info("Shapefile de %s já em cache.", uf_upper)
            continue

        log.info("Baixando shapefile %s (~15-25 MB)…", uf_upper)
        try:
            r = http_get(url)
            zip_path.write_bytes(r.content)
            shp_dir.mkdir(exist_ok=True)
            with zipfile.ZipFile(zip_path) as zf:
                zf.extractall(shp_dir)
            log.info("Shapefile de %s salvo em %s", uf_upper, shp_dir)
        except Exception as exc:
            log.error("Erro ao baixar shapefile %s: %s", uf_upper, exc)


# ---------------------------------------------------------------------------
# Fase 4 – Dados eleitorais TSE
# ---------------------------------------------------------------------------

def download_tse_csv(uf: str) -> Path:
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


def parse_tse_csv(csv_dir: Path) -> dict[str, dict[int, dict]]:
    """
    Lê CSV TSE e agrega eleitores por (chave_mun → local_votacao).
    Chave do município: "NM_MUNICIPIO|SG_UF" normalizado.
    """
    csv_files = list(csv_dir.rglob("*.csv"))
    if not csv_files:
        raise FileNotFoundError(f"Nenhum CSV em {csv_dir}")

    resultado: dict[str, dict[int, dict]] = {}
    for csv_file in csv_files:
        log.info("Lendo %s…", csv_file.name)
        with open(csv_file, encoding="latin-1", newline="") as f:
            reader = csv.DictReader(f, delimiter=";")
            for row in reader:
                try:
                    nm_mun = normalize(row.get("NM_MUNICIPIO", "") or "")
                    sg_uf = (row.get("SG_UF", "") or "").strip().upper()
                    if not nm_mun or not sg_uf:
                        continue
                    chave_mun = f"{nm_mun}|{sg_uf}"
                    nr_local = int(row.get("NR_LOCAL_VOTACAO", "0") or "0")
                    eleitores = int(row.get("QT_ELEITORES_PERFIL", "0") or "0")
                    if chave_mun not in resultado:
                        resultado[chave_mun] = {}
                    if nr_local not in resultado[chave_mun]:
                        resultado[chave_mun][nr_local] = {
                            "nome": row.get("NM_LOCAL_VOTACAO", ""),
                            "endereco": "",  # coluna não presente no CSV TSE 2024
                            "bairro": "",    # coluna não presente no CSV TSE 2024
                            "eleitores": 0,
                            "secoes": set(),
                        }
                    resultado[chave_mun][nr_local]["eleitores"] += eleitores
                    resultado[chave_mun][nr_local]["secoes"].add(row.get("NR_SECAO", ""))
                except (ValueError, KeyError):
                    continue
    return resultado


def etl_dados_eleitorais(sb: Client, ufs: list[str]) -> None:
    """
    Para cada UF, baixa CSV TSE, busca localidades via API supabase-py
    e insere em geo_dados_eleitorais.
    """
    log.info("=== Fase 4: Dados Eleitorais TSE ===")

    # Carrega mapa nome_normalizado|UF → id_ibge de todos os municípios
    log.info("Carregando mapa de municípios para lookup TSE…")
    mun_map: dict[str, int] = {}
    page_size = 1000
    offset = 0
    while True:
        r = sb.table("geo_municipios").select("id_ibge,nome,uf").range(offset, offset + page_size - 1).execute()
        for m in r.data:
            chave = f"{normalize(m['nome'])}|{m['uf']}"
            mun_map[chave] = m["id_ibge"]
        if len(r.data) < page_size:
            break
        offset += page_size
    log.info("Mapa de municípios carregado: %d entradas", len(mun_map))

    for uf in ufs:
        log.info("Processando TSE %s…", uf)
        try:
            csv_dir = download_tse_csv(uf)
            tse_data = parse_tse_csv(csv_dir)
        except Exception as exc:
            log.error("Erro no CSV TSE de %s: %s", uf, exc)
            continue

        total = 0
        erros = 0

        for chave_mun, locais in tqdm(tse_data.items(), desc=f"TSE {uf}", unit="mun"):
            ibge_id = mun_map.get(chave_mun)
            if ibge_id is None:
                log.warning("Município não encontrado no banco: %s", chave_mun)
                erros += len(locais)
                continue

            # Busca localidades do município via supabase-py
            try:
                resp = (
                    sb.table("geo_localidades")
                    .select("id,nome_normalizado")
                    .eq("municipio_id", ibge_id)
                    .execute()
                )
                localidades = resp.data
            except Exception as exc:
                log.warning("Falha ao buscar localidades do mun %d: %s", ibge_id, exc)
                continue

            # Fallback: se não há localidades, usa primeiro registro qualquer do município
            if not localidades:
                localidade_id_fallback = None
            else:
                localidade_id_fallback = localidades[0]["id"]

            batch: list[dict] = []
            for nr_local, info in locais.items():
                # Sem bairro disponível no CSV TSE 2024, sempre usa fallback
                if localidade_id_fallback is None:
                    erros += 1
                    continue

                batch.append({
                    "localidade_id": localidade_id_fallback,
                    "codigo_local_votacao": nr_local,
                    "nome_local_votacao": info["nome"],
                    "endereco_local": info["endereco"],
                    "quantidade_eleitores": info["eleitores"],
                    "secoes_vinculadas": ",".join(sorted(info["secoes"])),
                    "metodo_vinculo": "ESPACIAL",
                    "ano_atualizacao": TSE_YEAR,
                    "fonte_detalhada": f"TSE Perfil Eleitorado {TSE_YEAR} - {uf}",
                })

            if batch:
                for b in chunks(batch, BATCH_SIZE):
                    try:
                        sb.table("geo_dados_eleitorais").upsert(
                            b,
                            on_conflict="localidade_id,codigo_local_votacao,ano_atualizacao",
                            ignore_duplicates=True,
                        ).execute()
                        total += len(b)
                    except Exception as exc:
                        log.error("Erro ao inserir dados eleitorais mun %d: %s", ibge_id, exc)
                        erros += len(b)

        log_ingestao(sb, f"tse_eleitores_{uf}", None,
                     {"total": total, "novos": total, "atualizados": 0, "erros": erros},
                     "concluido" if erros == 0 else "erro", {"uf": uf, "ano": TSE_YEAR})
        log.info("TSE %s: %d locais inseridos, %d erros", uf, total, erros)


# ---------------------------------------------------------------------------
# Fase Extra – Estimativas populacionais IBGE (atualiza geo_municipios)
# ---------------------------------------------------------------------------

def etl_populacao_estimada(sb: Client, municipio_ids: list[int] | None = None) -> None:
    """
    Busca estimativas populacionais do IBGE (Censo 2022, tabela 9514)
    e atualiza geo_municipios.populacao_estimada.
    Se municipio_ids for fornecido, filtra apenas esses municípios.
    """
    log.info("=== Fase Extra: Estimativas Populacionais IBGE ===")
    # Tabela 9514 – Censo 2022: total de pessoas residentes
    url = (
        "https://servicodados.ibge.gov.br/api/v3/agregados/9514"
        "/periodos/2022/variaveis/93?localidades=N6[all]"
    )
    log.info("Baixando estimativas populacionais do IBGE (Censo 2022)…")
    try:
        data = http_get(url).json()
    except Exception as exc:
        log.error("Erro ao buscar estimativas populacionais: %s", exc)
        return

    pop_map: dict[int, int] = {}
    for item in data:
        for resultado in item.get("resultados", []):
            for serie_item in resultado.get("series", []):
                localidade = serie_item.get("localidade", {})
                try:
                    ibge_id = int(localidade.get("id", 0))
                except (ValueError, TypeError):
                    continue
                serie = serie_item.get("serie", {})
                for _periodo, valor in serie.items():
                    if valor and valor not in ("...", "-"):
                        try:
                            pop_map[ibge_id] = int(str(valor).replace(".", "").replace(",", ""))
                        except ValueError:
                            pass
                        break

    log.info("Estimativas obtidas para %d municípios via API IBGE", len(pop_map))

    if municipio_ids:
        municipio_set = set(municipio_ids)
        pop_map = {k: v for k, v in pop_map.items() if k in municipio_set}
        log.info("Filtrando para %d municípios solicitados", len(pop_map))

    rows = [{"id_ibge": ibge_id, "populacao_estimada": pop} for ibge_id, pop in pop_map.items()]
    erros = 0
    atualizados = 0
    # Usa UPDATE individual por registro (upsert falha por NOT NULL constraints)
    log.info("Atualizando %d registros em geo_municipios (UPDATE individual)…", len(rows))
    for row in tqdm(rows, desc="populacao_estimada", unit="mun"):
        try:
            sb.table("geo_municipios").update(
                {"populacao_estimada": row["populacao_estimada"]}
            ).eq("id_ibge", row["id_ibge"]).execute()
            atualizados += 1
        except Exception as exc:
            log.error("Erro ao atualizar municipio %d: %s", row["id_ibge"], exc)
            erros += 1

    log.info("Populacao estimada: %d municípios atualizados, %d erros", atualizados, erros)
    log_ingestao(
        sb, "ibge_populacao_estimada", None,
        {"total": len(rows), "novos": 0, "atualizados": atualizados, "erros": erros},
        "concluido" if erros == 0 else "erro",
    )


# ---------------------------------------------------------------------------
# Fase Demográfica: total, sexo, faixa etária, escolaridade por município
# ---------------------------------------------------------------------------

def _parse_ibge_series(data: list, /) -> dict[int, int]:
    """Extrai {ibge_id: valor_int} de uma resposta JSON da API SIDRA."""
    result: dict[int, int] = {}
    for item in data:
        for resultado in item.get("resultados", []):
            for serie_item in resultado.get("series", []):
                localidade = serie_item.get("localidade", {})
                try:
                    ibge_id = int(localidade.get("id", 0))
                except (ValueError, TypeError):
                    continue
                serie = serie_item.get("serie", {})
                for _periodo, valor in serie.items():
                    if valor and valor not in ("...", "-", ""):
                        try:
                            result[ibge_id] = int(str(valor).replace(".", "").replace(",", ""))
                        except ValueError:
                            pass
                        break
    return result


def _fetch_ibge_variable(url: str, desc: str) -> dict[int, int]:
    """Busca uma variável da API IBGE e retorna {ibge_id: valor}."""
    log.info("Baixando %s...", desc)
    try:
        data = http_get(url).json()
        result = _parse_ibge_series(data)
        log.info("%s: %d municípios", desc, len(result))
        return result
    except Exception as exc:
        log.error("Erro ao buscar %s: %s", desc, exc)
        return {}


def _fetch_ibge_age_groups() -> dict[int, dict[str, int]]:
    """
    Busca população por faixa etária quinquenal (Censo 2022, tabela 9514).
    Retorna {ibge_id: {"0_4": N, "5_9": N, ..., "90_mais": N}}.
    Faz um request por faixa (19 no total) pois buscar todas de uma vez causa 500.
    IDs de categoria confirmados via /api/v3/agregados/9514/metadados.
    """
    # (cat_id SIDRA, chave JSON)
    FAIXAS = [
        (93070, "0_4"),
        (93084, "5_9"),
        (93085, "10_14"),
        (93086, "15_19"),
        (93087, "20_24"),
        (93088, "25_29"),
        (93089, "30_34"),
        (93090, "35_39"),
        (93091, "40_44"),
        (93092, "45_49"),
        (93093, "50_54"),
        (93094, "55_59"),
        (93095, "60_64"),
        (93096, "65_69"),
        (93097, "70_74"),
        (93098, "75_79"),
        (49108, "80_84"),
        (49109, "85_89"),
        (60040, "90_mais"),
    ]
    BASE = (
        "https://servicodados.ibge.gov.br/api/v3/agregados/9514"
        "/periodos/2022/variaveis/93?localidades=N6[all]"
        "&classificacao=287["
    )
    # Fixar Sexo=Total e Forma de declaração=Total via sufixo
    SUFFIX = "|2[6794]|286[113635]"
    log.info("Baixando faixas etárias (Censo 2022) — %d requests...", len(FAIXAS))
    result: dict[int, dict[str, int]] = {}
    try:
        for cat_id, chave in FAIXAS:
            url = BASE + str(cat_id) + "]" + SUFFIX
            data = http_get(url).json()
            for item in data:
                for resultado in item.get("resultados", []):
                    # Filtrar somente o resultado da faixa correta
                    faixa_ok = any(
                        str(cat_id) in c.get("categoria", {})
                        for c in resultado.get("classificacoes", [])
                        if c.get("id") == "287"
                    )
                    if not faixa_ok:
                        continue
                    for serie_item in resultado.get("series", []):
                        try:
                            ibge_id = int(serie_item.get("localidade", {}).get("id", 0))
                        except (ValueError, TypeError):
                            continue
                        for _p, valor in serie_item.get("serie", {}).items():
                            if valor and valor not in ("...", "-", ""):
                                try:
                                    v = int(str(valor).replace(".", "").replace(",", ""))
                                    if ibge_id not in result:
                                        result[ibge_id] = {}
                                    result[ibge_id][chave] = v
                                except ValueError:
                                    pass
                            break
            log.debug("  faixa %s: %d municípios acumulados", chave, len(result))
        log.info("Faixas etárias: %d municípios", len(result))
    except Exception as exc:
        log.error("Erro ao buscar faixas etárias: %s", exc)
    return result


def _fetch_ibge_education() -> dict[int, dict[str, int]]:
    """
    Escolaridade por município.
    O IBGE SIDRA não disponibiliza a tabela 9517 (Nível de instrução) em nível
    de município (N6) via API pública no Censo 2022 — retorna dicionário vazio.
    """
    log.warning("Escolaridade por município indisponível via SIDRA API (tabela 9517 não responde em N6). Campo ficará null.")
    return {}


def etl_demograficos_municipio(sb: Client) -> None:
    """
    Busca dados demográficos do IBGE Censo 2022 por município e upserta em
    geo_demograficos_municipio: total, masculino, feminino, faixas etárias, escolaridade.
    """
    log.info("=== Fase Demográfica: Dados por Município (IBGE Censo 2022) ===")

    BASE = (
        "https://servicodados.ibge.gov.br/api/v3/agregados/9514"
        "/periodos/2022/variaveis/93?localidades=N6[all]"
    )
    total_map = _fetch_ibge_variable(BASE, "população total")
    masc_map  = _fetch_ibge_variable(BASE + "&classificacao=2[4]", "população masculina")
    fem_map   = _fetch_ibge_variable(BASE + "&classificacao=2[5]", "população feminina")
    age_map   = _fetch_ibge_age_groups()
    edu_map   = _fetch_ibge_education()

    if not total_map:
        log.error("Nenhum dado de população total obtido. Abortando fase demográfica.")
        return

    rows = []
    for ibge_id, total in total_map.items():
        rows.append({
            "municipio_id":        ibge_id,
            "ano_censo":           2022,
            "populacao_total":     total,
            "populacao_masculina": masc_map.get(ibge_id),
            "populacao_feminina":  fem_map.get(ibge_id),
            "faixas_etarias":      age_map.get(ibge_id) or None,
            "escolaridade":        edu_map.get(ibge_id) or None,
            "fonte":               "IBGE Censo 2022 (API SIDRA)",
        })

    log.info("Upserting %d registros em geo_demograficos_municipio...", len(rows))
    BATCH = 500
    atualizados = 0
    erros = 0
    for i in tqdm(range(0, len(rows), BATCH), desc="demograficos_municipio", unit="batch"):
        batch = rows[i:i + BATCH]
        try:
            sb.table("geo_demograficos_municipio").upsert(
                batch, on_conflict="municipio_id,ano_censo"
            ).execute()
            atualizados += len(batch)
        except Exception as exc:
            log.error("Erro ao upsert batch %d: %s", i // BATCH, exc)
            erros += len(batch)

    log.info(
        "Demográficos municipais: %d registros upsertados, %d erros",
        atualizados, erros
    )
    log_ingestao(
        sb, "ibge_demograficos_municipio", None,
        {"total": len(rows), "atualizados": atualizados, "erros": erros},
        "concluido" if erros == 0 else "erro",
    )


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="ETL Geográfico – IBGE + TSE → banco Supabase (sem senha)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Exemplos:
  python scripts/etl_geo_ibge_tse_v2.py --ufs PE
  python scripts/etl_geo_ibge_tse_v2.py --ufs SP RJ MG
  python scripts/etl_geo_ibge_tse_v2.py --all-ufs
  python scripts/etl_geo_ibge_tse_v2.py --ufs PE --skip-tse
  python scripts/etl_geo_ibge_tse_v2.py --ufs PE --with-shapes
        """,
    )
    uf_group = parser.add_mutually_exclusive_group(required=True)
    uf_group.add_argument("--ufs", nargs="+", metavar="UF")
    uf_group.add_argument("--all-ufs", action="store_true")

    parser.add_argument("--with-shapes", action="store_true",
                        help="Baixa shapefiles IBGE (cache local; geometrias PostGIS não inseridas via supabase-py)")
    parser.add_argument("--skip-tse", action="store_true")
    parser.add_argument("--skip-ibge", action="store_true")
    parser.add_argument("--pop-estimada", action="store_true",
                        help="Busca estimativas populacionais do IBGE (Censo 2022) e atualiza geo_municipios.populacao_estimada")
    parser.add_argument("--demografico", action="store_true",
                        help="Busca dados demográficos do IBGE (Censo 2022): total, sexo, faixa etária e escolaridade por município")
    parser.add_argument("--log-level", default="INFO",
                        choices=["DEBUG", "INFO", "WARNING", "ERROR"])
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    logging.getLogger().setLevel(args.log_level)

    ufs = list(UF_CODES.keys()) if args.all_ufs else [u.upper() for u in args.ufs]
    invalid = [u for u in ufs if u not in UF_CODES]
    if invalid:
        log.error("UFs inválidas: %s", invalid)
        sys.exit(1)

    sb = get_supabase()
    log.info("Conectado ao Supabase com service role key.")
    log.info("UFs: %s | shapes=%s | tse=%s | ibge=%s",
             ufs, args.with_shapes, not args.skip_tse, not args.skip_ibge)

    start = datetime.now(tz=timezone.utc)
    municipio_ids: list[int] = []

    if not args.skip_ibge:
        municipio_ids = etl_municipios(sb, ufs)
        if args.with_shapes:
            etl_geometrias_municipios(sb, ufs)
        etl_localidades_ibge(sb, municipio_ids)
    else:
        # Busca IDs já no banco
        try:
            resp = sb.table("geo_municipios").select("id_ibge").in_("uf", ufs).execute()
            municipio_ids = [r["id_ibge"] for r in resp.data]
            log.info("Usando %d municípios existentes no banco", len(municipio_ids))
        except Exception as exc:
            log.error("Erro ao buscar municípios do banco: %s", exc)
            sys.exit(1)

    if not args.skip_tse:
        etl_dados_eleitorais(sb, ufs)

    if args.pop_estimada:
        # Quando --skip-ibge, municipio_ids pode estar limitado a 1000 pelo Supabase
        # Passa None para atualizar todos os municípios da API IBGE sem filtro
        pop_ids = None if args.skip_ibge else (municipio_ids if municipio_ids else None)
        etl_populacao_estimada(sb, pop_ids)

    if args.demografico:
        etl_demograficos_municipio(sb)

    elapsed = (datetime.now(tz=timezone.utc) - start).total_seconds()
    log.info("ETL concluído em %.1f s (%.1f min)", elapsed, elapsed / 60)


if __name__ == "__main__":
    main()
