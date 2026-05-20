"""
load_residencias_cnefe.py
=========================
Lê o CSV processado pelo ETL (cnefe_localidades_residencias_2022.csv) e
alimenta a tabela geo_dados_residenciais no Supabase.

Estratégia de correspondência:
  1. Agrupa por municipio_ibge.
  2. Busca geo_localidades com municipio_id = codigo_municipio_ibge.
  3. Normaliza o nome da localidade (lower + remove acentos) e compara com
     nome_normalizado do banco.
  4. Localidades sem correspondência são inseridas como fonte='CNEFE'.
  5. Faz upsert em geo_dados_residenciais pelo constraint
     uq_geo_residenciais_localidade_zona_ano.

Uso:
    python scripts/load_residencias_cnefe.py
    python scripts/load_residencias_cnefe.py --uf AC
    python scripts/load_residencias_cnefe.py --uf AC SP RJ
    python scripts/load_residencias_cnefe.py --all

Variáveis de ambiente necessárias (ou em .env.local):
    NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_URL
    SUPABASE_SERVICE_ROLE_KEY
"""

from __future__ import annotations

import argparse
import csv
import logging
import os
import re
import time
import unicodedata
from collections import defaultdict
from pathlib import Path

from dotenv import load_dotenv
from supabase import Client, create_client
from tqdm import tqdm

MAX_RETRIES = 5
RETRY_BACKOFF = [2, 4, 8, 16, 32]  # segundos


def retry_execute(fn, *args, **kwargs):
    """Executa fn(*args, **kwargs).execute() com retry em erros de rede."""
    import httpx
    for attempt in range(MAX_RETRIES):
        try:
            return fn(*args, **kwargs).execute()
        except (httpx.RemoteProtocolError, httpx.ConnectError, httpx.ReadError,
                httpx.TimeoutException, Exception) as exc:
            # Relança imediatamente erros de lógica (4xx)
            msg = str(exc)
            if hasattr(exc, 'response') and getattr(exc, 'response', None) is not None:
                if exc.response.status_code < 500:
                    raise
            if attempt == MAX_RETRIES - 1:
                raise
            wait = RETRY_BACKOFF[attempt]
            logger.warning("Erro de rede (tentativa %d/%d): %s — aguardando %ds",
                           attempt + 1, MAX_RETRIES, msg, wait)
            time.sleep(wait)

ROOT_DIR = Path(__file__).resolve().parents[1]
DEFAULT_CSV = ROOT_DIR / "data" / "processed" / "cnefe_localidades_residencias_2022.csv"
YEAR = 2022

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Utilitários
# ---------------------------------------------------------------------------

def normalize_key(text: str) -> str:
    """Lower-case sem acentos preservando espaços — idêntico ao nome_normalizado do banco.
    O banco usa: lower(unaccent(nome)) via f_unaccent IMMUTABLE.
    """
    nfd = unicodedata.normalize("NFD", text)
    stripped = "".join(c for c in nfd if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", stripped).lower().strip()


def load_supabase() -> Client:
    for env_path in [
        ROOT_DIR / "apps" / "web" / ".env.local",
        ROOT_DIR / ".env.local",
        ROOT_DIR / ".env",
    ]:
        if env_path.exists():
            load_dotenv(env_path, override=False)
            break

    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise RuntimeError(
            "Defina NEXT_PUBLIC_SUPABASE_URL (ou SUPABASE_URL) e "
            "SUPABASE_SERVICE_ROLE_KEY no ambiente ou em .env.local"
        )
    return create_client(url, key)


# ---------------------------------------------------------------------------
# Leitura do CSV
# ---------------------------------------------------------------------------

def read_csv(csv_path: Path, ufs: list[str] | None = None) -> dict[str, list[dict]]:
    """
    Retorna um dict {uf -> lista de linhas} com os campos:
        codigo_municipio_ibge, localidade, zona, quantidade_residencias, tipo_localidade
    """
    data: dict[str, list[dict]] = defaultdict(list)
    with csv_path.open(encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            uf = row["uf"].strip().upper()
            if ufs and uf not in ufs:
                continue
            data[uf].append({
                "codigo_municipio_ibge": int(row["codigo_municipio_ibge"]),
                "localidade": row["localidade"].strip(),
                "zona": row["zona"].strip().upper(),
                "tipo_localidade": row["tipo_localidade"].strip().upper(),
                "quantidade_residencias": int(row["quantidade_residencias"]),
            })
    return data


# ---------------------------------------------------------------------------
# Sincronização
# ---------------------------------------------------------------------------

def sync_uf(sb: Client, uf: str, rows: list[dict]) -> dict[str, int]:
    """
    Processa todas as linhas de uma UF e retorna estatísticas.
    """
    stats = {"inseridos_localidade": 0, "upserted_residencias": 0, "sem_match": 0}

    # Agrupa por município
    municipio_groups: dict[int, list[dict]] = defaultdict(list)
    for row in rows:
        municipio_groups[row["codigo_municipio_ibge"]].append(row)

    for municipio_id, group_rows in tqdm(
        municipio_groups.items(), desc=f"  {uf}", unit="mun", leave=False
    ):
        # Busca localidades existentes neste município
        resp = retry_execute(
            sb.table("geo_localidades")
            .select("id,nome,nome_normalizado,tipo,zona")
            .eq("municipio_id", municipio_id)
        )

        existing: dict[str, dict] = {}
        for item in resp.data:
            # Usa nome_normalizado diretamente (já computado pelo banco)
            existing.setdefault(item["nome_normalizado"], item)

        # Insere localidades ausentes
        missing: list[dict] = []
        for row in group_rows:
            nk = normalize_key(row["localidade"])
            if nk not in existing:
                missing.append({
                    "municipio_id": municipio_id,
                    "nome": row["localidade"],
                    "tipo": row["tipo_localidade"],
                    "fonte": "CNEFE",
                    "zona": row["zona"],
                })

        if missing:
            inserted = retry_execute(
                sb.table("geo_localidades")
                .upsert(
                    missing,
                    on_conflict="municipio_id,nome_normalizado,tipo",
                    ignore_duplicates=True,
                )
                .select("id,nome,nome_normalizado,tipo,zona")
            )
            for item in inserted.data:
                existing.setdefault(item["nome_normalizado"], item)
            stats["inseridos_localidade"] += len(inserted.data)

        # Upsert em geo_dados_residenciais
        residenciais: list[dict] = []
        for row in group_rows:
            loc = existing.get(normalize_key(row["localidade"]))
            if not loc:
                stats["sem_match"] += 1
                continue
            residenciais.append({
                "localidade_id": loc["id"],
                "zona": row["zona"],
                "quantidade_residencias": row["quantidade_residencias"],
                "ano_censo": YEAR,
                "fonte_detalhada": str(DEFAULT_CSV),
            })

        if residenciais:
            retry_execute(
                sb.table("geo_dados_residenciais")
                .upsert(residenciais, on_conflict="localidade_id,zona,ano_censo")
            )
            stats["upserted_residencias"] += len(residenciais)

    return stats


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> int:
    parser = argparse.ArgumentParser(
        description="Carrega geo_dados_residenciais a partir do CSV CNEFE processado."
    )
    parser.add_argument(
        "--csv",
        type=Path,
        default=DEFAULT_CSV,
        help="Caminho para o CSV processado (padrão: data/processed/cnefe_localidades_residencias_2022.csv)",
    )
    parser.add_argument(
        "--uf",
        nargs="+",
        metavar="UF",
        help="Siglas de UF para processar (ex.: AC SP RJ). Omita junto com --all para processar tudo.",
    )
    parser.add_argument(
        "--all",
        action="store_true",
        help="Processa todos os estados do CSV.",
    )
    parser.add_argument(
        "--from-uf",
        metavar="UF",
        help="Retoma o processamento a partir desta UF (inclusive). Use com --all.",
    )
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
    )

    if not args.csv.exists():
        logger.error("CSV não encontrado: %s", args.csv)
        return 1

    ufs_filter: list[str] | None = None
    if args.uf:
        ufs_filter = [u.strip().upper() for u in args.uf]
    elif not args.all:
        logger.error("Informe --uf <siglas> ou --all para processar todos os estados.")
        return 1

    logger.info("Lendo CSV: %s", args.csv)
    data = read_csv(args.csv, ufs_filter)

    if not data:
        logger.warning("Nenhuma linha encontrada com os filtros informados.")
        return 0

    ufs_sorted = sorted(data.keys())
    if args.from_uf:
        start = args.from_uf.strip().upper()
        if start in ufs_sorted:
            ufs_sorted = ufs_sorted[ufs_sorted.index(start):]
        else:
            logger.warning("--from-uf '%s' nao encontrada no CSV; ignorando.", start)
    logger.info("UFs a processar: %s", ", ".join(ufs_sorted))

    sb = load_supabase()

    total_inseridos = 0
    total_upserted = 0
    total_sem_match = 0

    for uf in ufs_sorted:
        logger.info("Processando UF: %s (%d linhas)", uf, len(data[uf]))
        stats = sync_uf(sb, uf, data[uf])
        logger.info(
            "  %s → localidades inseridas: %d | residencias upserted: %d | sem match: %d",
            uf,
            stats["inseridos_localidade"],
            stats["upserted_residencias"],
            stats["sem_match"],
        )
        total_inseridos += stats["inseridos_localidade"]
        total_upserted += stats["upserted_residencias"]
        total_sem_match += stats["sem_match"]

    logger.info(
        "Concluído. Total → localidades inseridas: %d | residencias upserted: %d | sem match: %d",
        total_inseridos,
        total_upserted,
        total_sem_match,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
