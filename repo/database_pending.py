"""Persistência das prévias de importação."""

from __future__ import annotations

import json

import pandas as pd
from psycopg import sql
from psycopg.types.json import Jsonb

from app.config import EXPECTED_COLUMNS, NUMERIC_COLUMNS, PERIOD_COLUMN
from repo.database_core import _connection, _create_storage, _identifiers

def save_pending_import(token: str, frame: pd.DataFrame) -> None:
    payload = json.loads(
        frame[EXPECTED_COLUMNS].to_json(
            orient="records",
            date_format="iso",
            force_ascii=False,
        )
    )
    with _connection() as connection:
        _create_storage(connection)
        schema, _, _, pending_table = _identifiers()
        with connection.cursor() as cursor:
            cursor.execute(
                sql.SQL(
                    "DELETE FROM {}.{} WHERE created_at < NOW() - INTERVAL '24 hours'"
                ).format(schema, pending_table)
            )
            cursor.execute(
                sql.SQL(
                    "INSERT INTO {}.{} (token, payload) VALUES (%s, %s) "
                    "ON CONFLICT (token) DO UPDATE SET created_at = NOW(), payload = EXCLUDED.payload"
                ).format(schema, pending_table),
                (token, Jsonb(payload)),
            )


def load_pending_import(token: str) -> pd.DataFrame:
    with _connection() as connection:
        _create_storage(connection)
        schema, _, _, pending_table = _identifiers()
        with connection.cursor() as cursor:
            cursor.execute(
                sql.SQL(
                    "SELECT payload FROM {}.{} "
                    "WHERE token = %s AND created_at >= NOW() - INTERVAL '24 hours'"
                ).format(schema, pending_table),
                (token,),
            )
            row = cursor.fetchone()
    if row is None:
        return pd.DataFrame(columns=EXPECTED_COLUMNS)
    frame = pd.DataFrame(row[0], columns=EXPECTED_COLUMNS)
    for column in NUMERIC_COLUMNS:
        frame[column] = pd.to_numeric(frame[column], errors="raise").astype("float64")
    frame[PERIOD_COLUMN] = pd.to_datetime(frame[PERIOD_COLUMN])
    return frame


def delete_pending_import(token: str) -> bool:
    with _connection() as connection:
        _create_storage(connection)
        schema, _, _, pending_table = _identifiers()
        with connection.cursor() as cursor:
            cursor.execute(
                sql.SQL("DELETE FROM {}.{} WHERE token = %s").format(schema, pending_table),
                (token,),
            )
            return cursor.rowcount > 0


def count_pending_imports() -> int:
    with _connection() as connection:
        _create_storage(connection)
        schema, _, _, pending_table = _identifiers()
        with connection.cursor() as cursor:
            cursor.execute(
                sql.SQL("SELECT COUNT(*) FROM {}.{}").format(schema, pending_table)
            )
            return int(cursor.fetchone()[0])
