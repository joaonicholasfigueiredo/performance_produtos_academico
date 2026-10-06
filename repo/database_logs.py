"""Operações de auditoria e estado do armazenamento."""

from __future__ import annotations

from datetime import datetime

import psycopg
from psycopg import sql
from psycopg.types.json import Jsonb

from repo.database_core import (
    _connection,
    _create_storage,
    _identifiers,
    _storage_exists,
)


def _insert_log(
    cursor: psycopg.Cursor,
    event: dict,
    schema: sql.Identifier,
    logs_table: sql.Identifier,
) -> None:
    period = datetime.strptime(event["period"], "%Y-%m").date().replace(day=1)
    cursor.execute(
        sql.SQL(
            "INSERT INTO {}.{} (event_id, occurred_at, period, period_label, source_file, payload) "
            "VALUES (%s, %s, %s, %s, %s, %s) ON CONFLICT (event_id) DO NOTHING"
        ).format(schema, logs_table),
        (
            event["event_id"],
            datetime.fromisoformat(event["occurred_at"]),
            period,
            event["period_label"],
            event["source_file"],
            Jsonb(event),
        ),
    )


def save_log_event(event: dict) -> str:
    with _connection() as connection:
        _create_storage(connection)
        schema, _, logs_table, _ = _identifiers()
        with connection.cursor() as cursor:
            _insert_log(cursor, event, schema, logs_table)
    return event["event_id"]


def load_log_events() -> list[dict]:
    with _connection() as connection:
        if not _storage_exists(connection):
            return []
        schema, _, logs_table, _ = _identifiers()
        with connection.cursor() as cursor:
            cursor.execute(
                sql.SQL("SELECT payload FROM {}.{} ORDER BY occurred_at DESC").format(
                    schema, logs_table
                )
            )
            return [row[0] for row in cursor.fetchall()]


def storage_status() -> dict:
    with _connection() as connection:
        if not _storage_exists(connection):
            return {"exists": False, "total_rows": 0, "periods": []}
        schema, data_table, _, _ = _identifiers()
        with connection.cursor() as cursor:
            cursor.execute(sql.SQL("SELECT COUNT(*) FROM {}.{}").format(schema, data_table))
            total_rows = int(cursor.fetchone()[0])
            cursor.execute(
                sql.SQL("SELECT DISTINCT mes_ano FROM {}.{} ORDER BY mes_ano").format(
                    schema, data_table
                )
            )
            periods = [row[0] for row in cursor.fetchall()]
    return {"exists": total_rows > 0, "total_rows": total_rows, "periods": periods}


def drop_storage() -> None:
    """Remove o schema da aplicação, incluindo dados, logs e importações pendentes."""
    with _connection() as connection:
        schema, _, _, _ = _identifiers()
        with connection.cursor() as cursor:
            cursor.execute(sql.SQL("DROP SCHEMA IF EXISTS {} CASCADE").format(schema))
