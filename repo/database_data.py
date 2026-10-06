"""Operações de leitura e substituição da base persistida."""

from __future__ import annotations

from typing import Sequence

import pandas as pd
from psycopg import sql

from app.config import NUMERIC_COLUMNS, PERIOD_COLUMN
from repo.database_core import (
    ALL_COLUMNS,
    DatabaseStorageError,
    _COLUMN_TO_DB,
    _connection,
    _create_storage,
    _identifiers,
    _storage_exists,
)
from repo.database_logs import _insert_log

def load_product_data(columns: Sequence[str] | None = None) -> pd.DataFrame:
    selected = list(columns or ALL_COLUMNS)
    unknown = [column for column in selected if column not in _COLUMN_TO_DB]
    if unknown:
        raise ValueError(f"Colunas não mapeadas: {', '.join(unknown)}")

    with _connection() as connection:
        if not _storage_exists(connection):
            return pd.DataFrame(columns=selected)
        schema, data_table, _, _ = _identifiers()
        query = sql.SQL("SELECT {} FROM {}.{} ORDER BY mes_ano, central, coop, pa, id_produto").format(
            sql.SQL(", ").join(sql.Identifier(_COLUMN_TO_DB[column]) for column in selected),
            schema,
            data_table,
        )
        with connection.cursor() as cursor:
            cursor.execute(query)
            rows = cursor.fetchall()
    return pd.DataFrame(rows, columns=selected)


def load_period_data(period: pd.Timestamp) -> pd.DataFrame:
    with _connection() as connection:
        if not _storage_exists(connection):
            return pd.DataFrame(columns=ALL_COLUMNS)
        schema, data_table, _, _ = _identifiers()
        query = sql.SQL("SELECT {} FROM {}.{} WHERE mes_ano = %s").format(
            sql.SQL(", ").join(sql.Identifier(_COLUMN_TO_DB[column]) for column in ALL_COLUMNS),
            schema,
            data_table,
        )
        with connection.cursor() as cursor:
            cursor.execute(query, (pd.Timestamp(period).date(),))
            rows = cursor.fetchall()
    return pd.DataFrame(rows, columns=ALL_COLUMNS)


def period_exists(period: pd.Timestamp) -> bool:
    with _connection() as connection:
        if not _storage_exists(connection):
            return False
        schema, data_table, _, _ = _identifiers()
        with connection.cursor() as cursor:
            cursor.execute(
                sql.SQL("SELECT EXISTS (SELECT 1 FROM {}.{} WHERE mes_ano = %s)").format(
                    schema, data_table
                ),
                (pd.Timestamp(period).date(),),
            )
            return bool(cursor.fetchone()[0])


def _database_value(column: str, value: object) -> object:
    if column == PERIOD_COLUMN:
        return pd.Timestamp(value).date()
    if column == "_IMPORTADO_EM":
        return pd.Timestamp(value).to_pydatetime()
    if column in NUMERIC_COLUMNS:
        return float(value)
    return str(value)


def replace_period_data(
    frame: pd.DataFrame,
    event: dict | None = None,
    pending_token: str | None = None,
) -> int:
    """Substitui um mês, grava seu log e conclui a prévia na mesma transação."""
    if frame.empty:
        raise ValueError("Não é possível armazenar um período vazio.")
    period = pd.Timestamp(frame[PERIOD_COLUMN].iloc[0]).date()
    columns = ALL_COLUMNS
    rows = [
        tuple(_database_value(column, row[column]) for column in columns)
        for _, row in frame.iterrows()
    ]

    with _connection() as connection:
        _create_storage(connection)
        schema, data_table, logs_table, pending_table = _identifiers()
        with connection.cursor() as cursor:
            cursor.execute(
                sql.SQL("DELETE FROM {}.{} WHERE mes_ano = %s").format(schema, data_table),
                (period,),
            )
            insert = sql.SQL("INSERT INTO {}.{} ({}) VALUES ({})").format(
                schema,
                data_table,
                sql.SQL(", ").join(sql.Identifier(_COLUMN_TO_DB[column]) for column in columns),
                sql.SQL(", ").join(sql.Placeholder() for _ in columns),
            )
            cursor.executemany(insert, rows)
            cursor.execute(
                sql.SQL("SELECT COUNT(*) FROM {}.{} WHERE mes_ano = %s").format(
                    schema, data_table
                ),
                (period,),
            )
            persisted_rows = int(cursor.fetchone()[0])
            if persisted_rows != len(rows):
                raise DatabaseStorageError(
                    "A quantidade de registros persistidos não corresponde à importação."
                )
            if event is not None:
                _insert_log(cursor, event, schema, logs_table)
            if pending_token is not None:
                cursor.execute(
                    sql.SQL("DELETE FROM {}.{} WHERE token = %s").format(
                        schema, pending_table
                    ),
                    (pending_token,),
                )
            cursor.execute(sql.SQL("SELECT COUNT(*) FROM {}.{}").format(schema, data_table))
            total_rows = int(cursor.fetchone()[0])
    return total_rows
