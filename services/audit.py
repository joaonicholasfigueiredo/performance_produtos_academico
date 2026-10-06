from __future__ import annotations

import uuid
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import pandas as pd

from app.config import (
    EXPECTED_COLUMNS,
    NATURAL_KEY_COLUMNS,
    NUMERIC_COLUMNS,
    PERIOD_COLUMN,
)
from repo import database


_SAO_PAULO = ZoneInfo("America/Sao_Paulo")
_AUDITED_COLUMNS = ["PRODUTO", *NUMERIC_COLUMNS]


def _json_value(value: object) -> str | float | None:
    if value is None or pd.isna(value):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, (pd.Timestamp, datetime)):
        return pd.Timestamp(value).strftime("%Y-%m-%d")
    return str(value)


def _key(row: pd.Series) -> tuple[str, ...]:
    values: list[str] = []
    for column in NATURAL_KEY_COLUMNS:
        value = row[column]
        if column == PERIOD_COLUMN:
            values.append(pd.Timestamp(value).strftime("%Y-%m"))
        else:
            values.append(str(value))
    return tuple(values)


def _rows_by_key(frame: pd.DataFrame) -> dict[tuple[str, ...], pd.Series]:
    if frame.empty:
        return {}
    ordered = frame.copy()
    if "_IMPORTADO_EM" in ordered.columns:
        ordered = ordered.sort_values("_IMPORTADO_EM", kind="stable")
    return {_key(row): row for _, row in ordered.iterrows()}


def _different(before: object, after: object) -> bool:
    if pd.isna(before) and pd.isna(after):
        return False
    if isinstance(before, (int, float)) and isinstance(after, (int, float)):
        return abs(float(before) - float(after)) > 1e-9
    return str(before) != str(after)


def _values(row: pd.Series | None) -> dict:
    if row is None:
        return {}
    return {
        column: _json_value(row[column])
        for column in _AUDITED_COLUMNS
    }


def build_update_event(
    existing: pd.DataFrame,
    incoming: pd.DataFrame,
    source_file: str,
) -> dict:
    existing_rows = _rows_by_key(existing)
    incoming_rows = _rows_by_key(incoming)
    all_keys = sorted(set(existing_rows) | set(incoming_rows))
    changes: list[dict] = []

    for row_key in all_keys:
        before_row = existing_rows.get(row_key)
        after_row = incoming_rows.get(row_key)

        if before_row is None:
            change_type = "INCLUIDO"
            changed_fields = list(_AUDITED_COLUMNS)
        elif after_row is None:
            change_type = "REMOVIDO"
            changed_fields = list(_AUDITED_COLUMNS)
        else:
            changed_fields = [
                column
                for column in _AUDITED_COLUMNS
                if _different(before_row[column], after_row[column])
            ]
            if not changed_fields:
                continue
            change_type = "ATUALIZADO"

        reference = after_row if after_row is not None else before_row
        changes.append(
            {
                "type": change_type,
                "central": str(reference["CENTRAL"]),
                "coop": str(reference["COOP"]),
                "pa": str(reference["PA"]),
                "id_produto": str(reference["ID_PRODUTO"]),
                "produto": str(reference["PRODUTO"]),
                "changed_fields": changed_fields,
                "before": _values(before_row),
                "after": _values(after_row),
            }
        )

    period = pd.Timestamp(incoming[PERIOD_COLUMN].iloc[0])
    occurred_at = datetime.now(_SAO_PAULO)
    return {
        "schema_version": 1,
        "event_id": uuid.uuid4().hex,
        "occurred_at": occurred_at.isoformat(),
        "period": period.strftime("%Y-%m"),
        "period_label": period.strftime("%m/%Y"),
        "source_file": Path(source_file).name,
        "summary": {
            "previous_rows": len(existing),
            "current_rows": len(incoming),
            "changed_products": len(changes),
            "included": sum(item["type"] == "INCLUIDO" for item in changes),
            "updated": sum(item["type"] == "ATUALIZADO" for item in changes),
            "removed": sum(item["type"] == "REMOVIDO" for item in changes),
        },
        "changes": changes,
    }


def save_update_event(event: dict) -> str:
    """Persiste o evento na tabela de auditoria do PostgreSQL."""
    return database.save_log_event(event)


def query_update_logs() -> dict:
    events = database.load_log_events()
    entries: list[dict] = []
    for event in events:
        for change in event.get("changes", []):
            entries.append(
                {
                    "event_id": event["event_id"],
                    "occurred_at": event["occurred_at"],
                    "period": event["period"],
                    "period_label": event["period_label"],
                    "source_file": event["source_file"],
                    **change,
                }
            )

    return {
        "summary": {
            "updates": len(events),
            "changes": len(entries),
            "periods": len({event["period"] for event in events}),
            "invalid_files": 0,
        },
        "events": events,
        "entries": entries,
    }
