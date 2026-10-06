from __future__ import annotations

import configparser
import json
import os
import re
from contextlib import contextmanager
from datetime import date, datetime
from typing import Iterator, Sequence

import pandas as pd
import psycopg
from psycopg import sql
from psycopg.types.json import Jsonb

from app.config import (
    DATABASE_CONFIG_PATH,
    ENV_CONFIG_PATH,
    EXPECTED_COLUMNS,
    NATURAL_KEY_COLUMNS,
    NUMERIC_COLUMNS,
    PERIOD_COLUMN,
    ROOT_ENV_CONFIG_PATH,
    read_env_file,
)


class DatabaseConfigurationError(RuntimeError):
    """Configuração ausente ou inválida do PostgreSQL."""


class DatabaseStorageError(RuntimeError):
    """Falha ao acessar o armazenamento PostgreSQL."""


_IDENTIFIER = re.compile(r"^[a-z_][a-z0-9_]*$")
_METADATA_COLUMNS = ["_REGISTRO_ID", "_ARQUIVO_ORIGEM", "_IMPORTADO_EM"]
ALL_COLUMNS = [*EXPECTED_COLUMNS, *_METADATA_COLUMNS]

_COLUMN_TO_DB = {
    "CENTRAL": "central",
    "COOP": "coop",
    "PA": "pa",
    "PRODUTO": "produto",
    "ID_PRODUTO": "id_produto",
    "META_MENSAL": "meta_mensal",
    "PRODUCAO_MENSAL": "producao_mensal",
    "META_TRIMESTRAL": "meta_trimestral",
    "PRODUCAO_TRIMESTRAL": "producao_trimestral",
    "META_SEMESTRAL": "meta_semestral",
    "PRODUCAO_SEMESTRAL": "producao_semestral",
    "META_ANUAL": "meta_anual",
    "PRODUCAO_ANUAL": "producao_anual",
    "META_NO_PERIODO": "meta_no_periodo",
    "PRODUCAO_NO_PERIODO": "producao_no_periodo",
    PERIOD_COLUMN: "mes_ano",
    "_REGISTRO_ID": "registro_id",
    "_ARQUIVO_ORIGEM": "arquivo_origem",
    "_IMPORTADO_EM": "importado_em",
}


def _setting(
    name: str,
    env_file_values: dict[str, str],
    parser: configparser.ConfigParser,
    option: str,
    fallback: str = "",
) -> str:
    """Obtém PG* do ambiente, depois .env, e por fim do .config INI."""
    process_value = os.getenv(name)
    if process_value is not None and process_value.strip():
        return process_value.strip()

    file_value = env_file_values.get(name)
    if file_value is not None and file_value.strip():
        return file_value.strip()

    return parser.get("postgresql", option, fallback=fallback).strip()


def _read_settings() -> dict[str, object]:
    parser = configparser.ConfigParser(interpolation=None)
    config_env_values = read_env_file(DATABASE_CONFIG_PATH)
    env_file_values = {
        **config_env_values,
        **read_env_file(ROOT_ENV_CONFIG_PATH),
        **read_env_file(ENV_CONFIG_PATH),
    }
    if DATABASE_CONFIG_PATH.is_file():
        try:
            parser.read(DATABASE_CONFIG_PATH, encoding="utf-8")
        except configparser.Error as exc:
            if not config_env_values:
                raise DatabaseConfigurationError(
                    f"O arquivo {DATABASE_CONFIG_PATH.name} não está em formato INI ou dotenv válido."
                ) from exc

    connection_values = {
        "host": _setting("PGHOST", env_file_values, parser, "host"),
        "port": _setting("PGPORT", env_file_values, parser, "port"),
        "database": _setting("PGDATABASE", env_file_values, parser, "database"),
        "user": _setting("PGUSER", env_file_values, parser, "user"),
    }
    missing = [key for key, value in connection_values.items() if not value]
    if missing:
        raise DatabaseConfigurationError(
            "Configure no .env, nas variáveis PG* ou na seção [postgresql]: "
            + ", ".join(missing)
            + "."
        )

    try:
        port = int(connection_values["port"])
        timeout = int(
            _setting(
                "PGCONNECT_TIMEOUT",
                env_file_values,
                parser,
                "connect_timeout",
                fallback="5",
            )
        )
    except ValueError as exc:
        raise DatabaseConfigurationError("A porta e o tempo de conexão devem ser números inteiros.") from exc

    identifiers = {
        "schema": parser.get("storage", "schema", fallback="performance_produtos").strip(),
        "data_table": parser.get("storage", "data_table", fallback="dados").strip(),
        "logs_table": parser.get("storage", "logs_table", fallback="logs_alteracoes").strip(),
        "pending_table": parser.get(
            "storage", "pending_table", fallback="importacoes_pendentes"
        ).strip(),
    }
    invalid = [name for name, value in identifiers.items() if not _IDENTIFIER.fullmatch(value)]
    if invalid:
        raise DatabaseConfigurationError(
            "Os identificadores do armazenamento devem usar apenas letras minúsculas, números e _."
        )

    connection = {
        "host": connection_values["host"],
        "port": port,
        "dbname": connection_values["database"],
        "user": connection_values["user"],
        "password": _setting("PGPASSWORD", env_file_values, parser, "password"),
        "sslmode": _setting(
            "PGSSLMODE",
            env_file_values,
            parser,
            "sslmode",
            fallback="prefer",
        ),
        "connect_timeout": timeout,
    }
    for env_name, option in (
        ("PGSSLROOTCERT", "sslrootcert"),
        ("PGSSLCERT", "sslcert"),
        ("PGSSLKEY", "sslkey"),
    ):
        value = _setting(env_name, env_file_values, parser, option)
        if value:
            connection[option] = value

    return {
        "connection": connection,
        **identifiers,
    }


@contextmanager
def _connection() -> Iterator[psycopg.Connection]:
    settings = _read_settings()
    try:
        with psycopg.connect(**settings["connection"]) as connection:
            yield connection
    except (psycopg.Error, OSError) as exc:
        raise DatabaseStorageError(
            "Não foi possível acessar o PostgreSQL. Confira o serviço e os dados do .config/.env."
        ) from exc


def _identifiers() -> tuple[
    sql.Identifier,
    sql.Identifier,
    sql.Identifier,
    sql.Identifier,
]:
    settings = _read_settings()
    return (
        sql.Identifier(str(settings["schema"])),
        sql.Identifier(str(settings["data_table"])),
        sql.Identifier(str(settings["logs_table"])),
        sql.Identifier(str(settings["pending_table"])),
    )


def _create_storage(connection: psycopg.Connection) -> None:
    schema, data_table, logs_table, pending_table = _identifiers()
    with connection.cursor() as cursor:
        cursor.execute(sql.SQL("CREATE SCHEMA IF NOT EXISTS {}").format(schema))
        cursor.execute(
            sql.SQL(
                """
                CREATE TABLE IF NOT EXISTS {}.{} (
                    central TEXT NOT NULL,
                    coop TEXT NOT NULL,
                    pa TEXT NOT NULL,
                    produto TEXT NOT NULL,
                    id_produto TEXT NOT NULL,
                    meta_mensal DOUBLE PRECISION NOT NULL DEFAULT 0,
                    producao_mensal DOUBLE PRECISION NOT NULL DEFAULT 0,
                    meta_trimestral DOUBLE PRECISION NOT NULL DEFAULT 0,
                    producao_trimestral DOUBLE PRECISION NOT NULL DEFAULT 0,
                    meta_semestral DOUBLE PRECISION NOT NULL DEFAULT 0,
                    producao_semestral DOUBLE PRECISION NOT NULL DEFAULT 0,
                    meta_anual DOUBLE PRECISION NOT NULL DEFAULT 0,
                    producao_anual DOUBLE PRECISION NOT NULL DEFAULT 0,
                    meta_no_periodo DOUBLE PRECISION NOT NULL DEFAULT 0,
                    producao_no_periodo DOUBLE PRECISION NOT NULL DEFAULT 0,
                    mes_ano DATE NOT NULL,
                    registro_id CHAR(64) NOT NULL,
                    arquivo_origem TEXT NOT NULL,
                    importado_em TIMESTAMPTZ NOT NULL,
                    PRIMARY KEY (central, coop, pa, id_produto, mes_ano)
                )
                """
            ).format(schema, data_table)
        )
        cursor.execute(
            sql.SQL("CREATE INDEX IF NOT EXISTS {} ON {}.{} (mes_ano)").format(
                sql.Identifier("idx_performance_produtos_mes_ano"), schema, data_table
            )
        )
        cursor.execute(
            sql.SQL(
                """
                CREATE TABLE IF NOT EXISTS {}.{} (
                    event_id CHAR(32) PRIMARY KEY,
                    occurred_at TIMESTAMPTZ NOT NULL,
                    period DATE NOT NULL,
                    period_label TEXT NOT NULL,
                    source_file TEXT NOT NULL,
                    payload JSONB NOT NULL
                )
                """
            ).format(schema, logs_table)
        )
        cursor.execute(
            sql.SQL("CREATE INDEX IF NOT EXISTS {} ON {}.{} (period, occurred_at DESC)").format(
                sql.Identifier("idx_performance_produtos_logs_periodo"), schema, logs_table
            )
        )
        cursor.execute(
            sql.SQL(
                """
                CREATE TABLE IF NOT EXISTS {}.{} (
                    token CHAR(32) PRIMARY KEY,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    payload JSONB NOT NULL
                )
                """
            ).format(schema, pending_table)
        )


def initialize_database() -> None:
    """Cria o schema e as tabelas da aplicação quando ainda não existem."""
    with _connection() as connection:
        _create_storage(connection)


def _storage_exists(connection: psycopg.Connection) -> bool:
    settings = _read_settings()
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT to_regclass(%s) IS NOT NULL",
            (f'{settings["schema"]}.{settings["data_table"]}',),
        )
        return bool(cursor.fetchone()[0])
