#!/usr/bin/env python3
"""
ETL CNEFE 2022 -> localidades complementares e residencias por localidade.

Le os CSVs estaduais em C:/Users/alber/Downloads/ibge/<UF>/<UF>.csv,
agrega por UF, municipio, localidade e zona, gera um CSV final e, quando
solicitado, sincroniza geo_localidades e geo_dados_residenciais no Supabase.
"""

from __future__ import annotations

import argparse
import csv
import logging
import os
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

import pandas as pd
import requests
from dotenv import load_dotenv
from supabase import Client, create_client
from tqdm import tqdm

ROOT_DIR = Path(__file__).resolve().parent.parent
DEFAULT_INPUT_DIR = Path(r"C:/Users/alber/Downloads/ibge")
DEFAULT_OUTPUT_DIR = ROOT_DIR / "data" / "processed"
DEFAULT_OUTPUT_FILE = "cnefe_localidades_residencias_2022.csv"
DEFAULT_YEAR = 2022

UF_NAMES: dict[str, str] = {
    "AC": "Acre",
    "AL": "Alagoas",
    "AM": "Amazonas",
    "AP": "Amapá",
    "BA": "Bahia",
    "CE": "Ceará",
    "DF": "Distrito Federal",
    "ES": "Espírito Santo",
    "GO": "Goiás",
    "MA": "Maranhão",
    "MG": "Minas Gerais",
    "MS": "Mato Grosso do Sul",
    "MT": "Mato Grosso",
    "PA": "Pará",
    "PB": "Paraíba",
    "PE": "Pernambuco",
    "PI": "Piauí",
    "PR": "Paraná",
    "RJ": "Rio de Janeiro",
    "RN": "Rio Grande do Norte",
    "RO": "Rondônia",
    "RR": "Roraima",
    "RS": "Rio Grande do Sul",
    "SC": "Santa Catarina",
    "SE": "Sergipe",
    "SP": "São Paulo",
    "TO": "Tocantins",
}

RURAL_PATTERNS = [
    "FAZENDA",
    "SITIO",
    "SÍTIO",
    "CHACARA",
    "CHÁCARA",
    "POVOADO",
    "ASSENTAMENTO",
    "AGROVILA",
    "GLEBA",
    "LINHA",
    "COLONIA",
    "COLÔNIA",
    "RURAL",
    "VILA RURAL",
    "KM ",
    "RODOVIA",
    "ESTRADA",
]

URBAN_PATTERNS = [
    "CENTRO",
    "BAIRRO",
    "JARDIM",
    "PARQUE",
    "CONJUNTO",
    "RESIDENCIAL",
    "LOTEAMENTO",
    "CIDADE",
    "VILA",
    "DISTRITO",
]

TYPE_RULES = [
    ("FAZENDA", ["FAZENDA"]),
    ("SITIO", ["SITIO", "SÍTIO", "CHACARA", "CHÁCARA"]),
    ("POVOADO", ["POVOADO", "ASSENTAMENTO", "AGROVILA"]),
    ("VILA", ["VILA"]),
    ("NUCLEO", ["NUCLEO", "NÚCLEO"]),
    ("DISTRITO", ["DISTRITO"]),
    ("BAIRRO", ["BAIRRO"]),
    ("OUTROS", []),
]

logger = logging.getLogger("etl_cnefe")


def normalize_text(value: Any) -> str:
    if value is None:
        return ""
    text = str(value).strip()
    text = unicodedata.normalize("NFD", text)
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    return re.sub(r"\s+", " ", text).upper()


def normalize_key(value: Any) -> str:
    return normalize_text(value)


def parse_int(value: Any) -> int | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    try:
        return int(float(text.replace(",", ".")))
    except ValueError:
        return None


def http_get(url: str, retries: int = 3, backoff: float = 1.5) -> requests.Response:
    last_error: Exception | None = None
    for attempt in range(retries):
        try:
            response = requests.get(url, timeout=120)
            response.raise_for_status()
            return response
        except Exception as exc:  # pragma: no cover - network fallback
            last_error = exc
            if attempt < retries - 1:
                continue
    raise RuntimeError(f"Falha ao acessar {url}: {last_error}") from last_error


def infer_tipo_localidade(nome_localidade: str) -> str:
    normalized = normalize_text(nome_localidade)
    for tipo, patterns in TYPE_RULES:
        if tipo == "OUTROS":
            continue
        if any(pattern in normalized for pattern in patterns):
            return tipo
    return "OUTROS"


def infer_zona(row: dict[str, Any]) -> str:
    pieces = [
        row.get("DSC_LOCALIDADE", ""),
        row.get("NOM_TIPO_SEGLOGR", ""),
        row.get("NOM_TITULO_SEGLOGR", ""),
        row.get("NOM_SEGLOGR", ""),
        row.get("DSC_ESTABELECIMENTO", ""),
    ]
    text = normalize_text(" ".join(str(piece or "") for piece in pieces))
    has_rural = any(pattern in text for pattern in RURAL_PATTERNS)
    has_urban = any(pattern in text for pattern in URBAN_PATTERNS)

    if has_rural and not has_urban:
        return "RURAL"
    if has_urban and not has_rural:
        return "URBANA"
    return "MISTA"


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
        raise RuntimeError("SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY precisam estar definidos")
    return create_client(url, key)


def load_municipio_lookup() -> dict[int, dict[str, Any]]:
    try:
        sb = load_supabase()
        response = sb.table("geo_municipios").select("id_ibge,nome,uf").execute()
        lookup = {
            int(row["id_ibge"]): {"nome": row["nome"], "uf": row["uf"]}
            for row in response.data
        }
        if lookup:
            return lookup
    except Exception:
        pass

    url = "https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome"
    response = http_get(url)

    lookup: dict[int, dict[str, Any]] = {}
    for municipio in response.json():
        uf = municipio["microrregiao"]["mesorregiao"]["UF"]["sigla"]
        lookup[int(municipio["id"])] = {"nome": municipio["nome"], "uf": uf}
    return lookup


def discover_input_files(input_dir: Path) -> list[Path]:
    if input_dir.is_file():
        return [input_dir]

    files: list[Path] = []
    for folder in sorted(input_dir.iterdir()):
        if not folder.is_dir():
            continue
        if not re.match(r"^\d{2}_[A-Z]{2}$", folder.name):
            continue
        files.extend(sorted(folder.glob("*.csv")))
    return files


def read_state_file(
    csv_path: Path,
    row_counter: Counter[tuple[str, int, int, str, str, str]],
    display_labels: dict[tuple[str, int, int, str, str, str], dict[str, str]],
) -> None:
    match = re.match(r"^(?P<codigo>\d{2})_(?P<uf>[A-Z]{2})$", csv_path.parent.name)
    if not match:
        raise ValueError(f"Pasta invalida para UF: {csv_path.parent.name}")

    uf = match.group("uf")
    codigo_uf_folha = parse_int(match.group("codigo"))

    with csv_path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle, delimiter=";")
        required = {"COD_UF", "COD_MUNICIPIO", "DSC_LOCALIDADE"}
        missing = required - set(reader.fieldnames or [])
        if missing:
            raise ValueError(f"Arquivo {csv_path.name} nao possui colunas esperadas: {sorted(missing)}")

        for row in reader:
            municipio_code = parse_int(row.get("COD_MUNICIPIO"))
            codigo_uf = parse_int(row.get("COD_UF")) or codigo_uf_folha
            if municipio_code is None or codigo_uf is None:
                continue

            localidade = str(row.get("DSC_LOCALIDADE") or "").strip()
            if not localidade:
                localidade = "SEM_LOCALIDADE"

            zona = infer_zona(row)
            tipo_localidade = infer_tipo_localidade(localidade)
            key = (
                uf,
                codigo_uf,
                municipio_code,
                normalize_key(localidade),
                zona,
                tipo_localidade,
            )

            row_counter[key] += 1
            display_labels.setdefault(key, {"localidade": localidade})


def build_rows(
    row_counter: Counter[tuple[str, int, int, str, str, str]],
    display_labels: dict[tuple[str, int, int, str, str, str], dict[str, str]],
    municipio_lookup: dict[int, dict[str, Any]],
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for (uf, codigo_uf, municipio_code, local_key, zona, tipo_localidade), quantidade in row_counter.items():
        municipio = municipio_lookup.get(municipio_code, {})
        rows.append(
            {
                "estado": UF_NAMES.get(uf, uf),
                "uf": uf,
                "codigo_uf": codigo_uf,
                "codigo_municipio_ibge": municipio_code,
                "municipio": municipio.get("nome", f"MUNICIPIO_{municipio_code}"),
                "localidade": display_labels[(uf, codigo_uf, municipio_code, local_key, zona, tipo_localidade)]["localidade"],
                "zona": zona,
                "tipo_localidade": tipo_localidade,
                "quantidade_residencias": quantidade,
            }
        )

    rows.sort(
        key=lambda item: (
            item["uf"],
            item["municipio"],
            item["localidade"],
            item["zona"],
            item["tipo_localidade"],
        )
    )
    return rows


def ensure_table_rows(
    sb: Client,
    rows: list[dict[str, Any]],
    source_file: str,
    year: int,
) -> None:
    municipio_groups: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        municipio_groups[int(row["codigo_municipio_ibge"])].append(row)

    for municipio_id, group_rows in tqdm(municipio_groups.items(), desc="Supabase", unit="mun"):
        localidade_resp = (
            sb.table("geo_localidades")
            .select("id,nome,nome_normalizado,tipo,zona")
            .eq("municipio_id", municipio_id)
            .execute()
        )

        existing: dict[str, dict[str, Any]] = {}
        for item in localidade_resp.data:
            existing.setdefault(normalize_key(item["nome"]), item)

        missing_localities: list[dict[str, Any]] = []
        for row in group_rows:
            normalized_name = normalize_key(row["localidade"])
            if normalized_name in existing:
                continue
            missing_localities.append(
                {
                    "municipio_id": municipio_id,
                    "nome": row["localidade"],
                    "tipo": row["tipo_localidade"],
                    "fonte": "CNEFE",
                    "zona": row["zona"],
                }
            )

        if missing_localities:
            inserted = (
                sb.table("geo_localidades")
                .insert(missing_localities)
                .select("id,nome,nome_normalizado,tipo")
                .execute()
            )
            for item in inserted.data:
                existing.setdefault(normalize_key(item["nome"]), item)

        residual_rows: list[dict[str, Any]] = []
        for row in group_rows:
            localidade_row = existing.get(normalize_key(row["localidade"]))
            if not localidade_row:
                continue
            residual_rows.append(
                {
                    "localidade_id": localidade_row["id"],
                    "zona": row["zona"],
                    "quantidade_residencias": row["quantidade_residencias"],
                    "ano_censo": year,
                    "fonte_detalhada": source_file,
                }
            )

        if residual_rows:
            sb.table("geo_dados_residenciais").upsert(
                residual_rows,
                on_conflict="localidade_id,zona,ano_censo",
            ).execute()


def validate_dictionary(dictionary_path: Path) -> None:
    try:
        dictionary = pd.read_excel(dictionary_path, engine="xlrd")
    except Exception as exc:
        raise RuntimeError(f"Falha ao ler dicionario {dictionary_path}: {exc}") from exc

    column_name = next(
        (col for col in dictionary.columns if normalize_key(col) == "VARIAVEL"),
        dictionary.columns[0],
    )
    variables = {normalize_key(item) for item in dictionary[column_name].dropna().tolist()}
    expected = {"COD_UF", "COD_MUNICIPIO", "DSC_LOCALIDADE", "COD_ESPECIE", "LATITUDE", "LONGITUDE"}
    missing = sorted(expected - variables)
    if missing:
        logger.warning("Dicionario nao contem algumas variaveis esperadas: %s", ", ".join(missing))


def main() -> int:
    parser = argparse.ArgumentParser(description="Consolida e sincroniza o CNEFE 2022 por localidade.")
    parser.add_argument("--input-dir", type=Path, default=DEFAULT_INPUT_DIR)
    parser.add_argument("--output-file", type=Path, default=DEFAULT_OUTPUT_DIR / DEFAULT_OUTPUT_FILE)
    parser.add_argument("--dictionary", type=Path, default=None, help="Caminho para o Dicionario_CNEFE_Censo_2022.xls")
    parser.add_argument("--sync-db", action="store_true", help="Sincroniza Supabase depois de gerar o CSV")
    parser.add_argument("--year", type=int, default=DEFAULT_YEAR)
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

    if args.dictionary:
        validate_dictionary(args.dictionary)

    input_files = discover_input_files(args.input_dir)
    if not input_files:
        logger.error("Nenhum CSV estadual encontrado em %s", args.input_dir)
        return 1

    row_counter: Counter[tuple[str, int, int, str, str, str]] = Counter()
    display_labels: dict[tuple[str, int, int, str, str, str], dict[str, str]] = {}

    for csv_path in tqdm(input_files, desc="UFs", unit="arquivo"):
        logger.info("Processando %s", csv_path)
        read_state_file(csv_path, row_counter, display_labels)

    municipio_lookup = load_municipio_lookup()
    rows = build_rows(row_counter, display_labels, municipio_lookup)

    args.output_file.parent.mkdir(parents=True, exist_ok=True)
    pd.DataFrame(rows).to_csv(args.output_file, index=False, encoding="utf-8")
    logger.info("CSV consolidado salvo em %s (%d linhas)", args.output_file, len(rows))

    if args.sync_db:
        sb = load_supabase()
        ensure_table_rows(sb, rows, str(args.output_file), args.year)
        logger.info("Sincronizacao com Supabase concluida")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())