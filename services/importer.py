from __future__ import annotations

import hashlib
import re
import unicodedata
import uuid
from dataclasses import dataclass
from datetime import datetime
from io import BytesIO
from pathlib import Path
from threading import Lock
from zoneinfo import ZoneInfo

import pandas as pd

from app.config import (
    EXPECTED_COLUMNS,
    NATURAL_KEY_COLUMNS,
    NUMERIC_COLUMNS,
    PERIOD_COLUMN,
    TEXT_COLUMNS,
)
from repo import database
from services.audit import build_update_event


class ImportValidationError(ValueError):
    """Erro de validação que pode ser apresentado diretamente ao usuário."""


@dataclass(frozen=True)
class AnalysisResult:
    token: str
    file_name: str
    period_iso: str
    period_label: str
    rows: int
    blank_values_filled: int
    text_numbers_converted: int
    preview: list[dict]
    period_already_exists: bool


_WRITE_LOCK = Lock()
_SAO_PAULO = ZoneInfo("America/Sao_Paulo")
_MONTHS_PT = (
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
)


def _column_key(value: object) -> str:
    text = unicodedata.normalize("NFKD", str(value).strip())
    text = "".join(char for char in text if not unicodedata.combining(char))
    return re.sub(r"[^A-Z0-9]+", "_", text.upper()).strip("_")


def _validate_and_rename_columns(frame: pd.DataFrame) -> pd.DataFrame:
    expected_by_key = {_column_key(column): column for column in EXPECTED_COLUMNS}
    found_by_key: dict[str, object] = {}

    for column in frame.columns:
        key = _column_key(column)
        if key in found_by_key:
            raise ImportValidationError(
                f"A planilha possui colunas duplicadas equivalentes a “{column}”."
            )
        found_by_key[key] = column

    missing = [
        expected
        for key, expected in expected_by_key.items()
        if key not in found_by_key
    ]
    if missing:
        raise ImportValidationError(
            "A planilha não contém todas as colunas obrigatórias. "
            f"Ausentes: {', '.join(missing)}."
        )

    rename = {
        found_by_key[key]: expected
        for key, expected in expected_by_key.items()
    }
    return frame.rename(columns=rename)[EXPECTED_COLUMNS].copy()


def _parse_number(value: object) -> tuple[float, bool]:
    if pd.isna(value) or (isinstance(value, str) and not value.strip()):
        return 0.0, False

    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return float(value), False

    raw = str(value).strip().replace("\u00a0", "").replace(" ", "")
    raw = re.sub(r"(?i)R\$", "", raw)
    raw = raw.replace("%", "")

    if "," in raw and "." in raw:
        if raw.rfind(",") > raw.rfind("."):
            normalized = raw.replace(".", "").replace(",", ".")
        else:
            normalized = raw.replace(",", "")
    elif "," in raw:
        normalized = raw.replace(".", "").replace(",", ".")
    else:
        normalized = raw

    try:
        return float(normalized), True
    except ValueError as exc:
        raise ImportValidationError(
            f"O valor “{value}” não pôde ser convertido em número."
        ) from exc


def _parse_period(value: object) -> pd.Timestamp:
    if pd.isna(value) or (isinstance(value, str) and not value.strip()):
        raise ImportValidationError("A coluna MÊS/ANO possui valor vazio.")

    if isinstance(value, (pd.Timestamp, datetime)):
        parsed = pd.Timestamp(value)
    elif isinstance(value, (int, float)) and not isinstance(value, bool):
        parsed = pd.Timestamp("1899-12-30") + pd.to_timedelta(float(value), unit="D")
    else:
        raw = str(value).strip()
        parsed = pd.NaT
        for pattern in (
            r"^(?P<month>\d{1,2})[/-](?P<year>\d{4})$",
            r"^(?P<year>\d{4})[/-](?P<month>\d{1,2})$",
        ):
            match = re.match(pattern, raw)
            if match:
                parsed = pd.Timestamp(
                    year=int(match.group("year")),
                    month=int(match.group("month")),
                    day=1,
                )
                break
        if pd.isna(parsed):
            try:
                parsed = pd.to_datetime(raw, dayfirst=True, errors="raise")
            except (ValueError, TypeError) as exc:
                raise ImportValidationError(
                    f"O período “{value}” não é uma data MÊS/ANO válida."
                ) from exc

    return pd.Timestamp(year=parsed.year, month=parsed.month, day=1)


def _period_label(period: pd.Timestamp) -> str:
    return f"{_MONTHS_PT[period.month - 1]}/{period.year}"


def _json_preview(frame: pd.DataFrame) -> list[dict]:
    preview = frame.head(5).copy()
    preview[PERIOD_COLUMN] = preview[PERIOD_COLUMN].dt.strftime("%m/%Y")
    return preview.to_dict(orient="records")


def _normalize(file_bytes: bytes) -> tuple[pd.DataFrame, int, int]:
    try:
        raw = pd.read_excel(BytesIO(file_bytes), engine="openpyxl", dtype=object)
    except Exception as exc:
        raise ImportValidationError(
            "Não foi possível ler o arquivo. Confirme se ele é um .xlsx válido e não está corrompido."
        ) from exc

    if raw.empty:
        raise ImportValidationError("A planilha não possui linhas para importar.")

    frame = _validate_and_rename_columns(raw)
    blank_mask = frame.isna() | frame.apply(
        lambda column: column.map(lambda value: isinstance(value, str) and not value.strip())
    )
    blank_values_filled = int(blank_mask.sum().sum())

    for column in TEXT_COLUMNS:
        frame[column] = frame[column].map(
            lambda value: "0"
            if pd.isna(value) or (isinstance(value, str) and not value.strip())
            else str(value).strip()
        )

    converted = 0
    for column in NUMERIC_COLUMNS:
        parsed = frame[column].map(_parse_number)
        frame[column] = parsed.map(lambda result: result[0]).astype("float64")
        converted += int(parsed.map(lambda result: result[1]).sum())

    frame[PERIOD_COLUMN] = frame[PERIOD_COLUMN].map(_parse_period)
    periods = frame[PERIOD_COLUMN].drop_duplicates()
    if len(periods) != 1:
        labels = ", ".join(_period_label(period) for period in periods.sort_values())
        raise ImportValidationError(
            "Cada arquivo deve representar somente um MÊS/ANO. "
            f"Foram encontrados: {labels}."
        )

    duplicated_keys = frame.duplicated(subset=NATURAL_KEY_COLUMNS, keep=False)
    if duplicated_keys.any():
        count = int(duplicated_keys.sum())
        raise ImportValidationError(
            "A planilha possui mais de uma linha para a mesma combinação de "
            f"CENTRAL, COOP, PA, ID_PRODUTO e MÊS/ANO ({count} linhas)."
        )

    return frame, blank_values_filled, converted


def _has_period(period: pd.Timestamp) -> bool:
    try:
        return database.period_exists(period)
    except (database.DatabaseConfigurationError, database.DatabaseStorageError) as exc:
        raise ImportValidationError(str(exc)) from exc


def analyze_upload(file_name: str, file_bytes: bytes) -> AnalysisResult:
    frame, blanks, converted = _normalize(file_bytes)
    period = frame[PERIOD_COLUMN].iloc[0]
    token = uuid.uuid4().hex
    period_already_exists = _has_period(period)
    try:
        database.save_pending_import(token, frame)
    except (database.DatabaseConfigurationError, database.DatabaseStorageError) as exc:
        raise ImportValidationError(str(exc)) from exc

    return AnalysisResult(
        token=token,
        file_name=file_name,
        period_iso=period.strftime("%Y-%m-01"),
        period_label=_period_label(period),
        rows=len(frame),
        blank_values_filled=blanks,
        text_numbers_converted=converted,
        preview=_json_preview(frame),
        period_already_exists=period_already_exists,
    )


def _row_hash(frame: pd.DataFrame) -> pd.Series:
    comparable = frame[EXPECTED_COLUMNS].copy()
    comparable[PERIOD_COLUMN] = comparable[PERIOD_COLUMN].dt.strftime("%Y-%m-%d")
    canonical = comparable.astype(str).agg("\x1f".join, axis=1)
    return canonical.map(lambda value: hashlib.sha256(value.encode("utf-8")).hexdigest())


def confirm_import(token: str, file_name: str) -> dict:
    if not re.fullmatch(r"[a-f0-9]{32}", token):
        raise ImportValidationError("A confirmação da importação é inválida.")

    with _WRITE_LOCK:
        try:
            incoming = database.load_pending_import(token)
        except (database.DatabaseConfigurationError, database.DatabaseStorageError) as exc:
            raise ImportValidationError(str(exc)) from exc
        if incoming.empty:
            raise ImportValidationError(
                "A prévia expirou ou já foi processada. Selecione o arquivo novamente."
            )
        incoming[PERIOD_COLUMN] = pd.to_datetime(incoming[PERIOD_COLUMN])
        incoming["_REGISTRO_ID"] = _row_hash(incoming)
        incoming["_ARQUIVO_ORIGEM"] = Path(file_name).name
        incoming["_IMPORTADO_EM"] = pd.Timestamp.now(tz=_SAO_PAULO).isoformat()

        period = incoming[PERIOD_COLUMN].iloc[0]
        try:
            existing_period = database.load_period_data(period)
            if not existing_period.empty:
                existing_period[PERIOD_COLUMN] = pd.to_datetime(existing_period[PERIOD_COLUMN])
            updated_period = not existing_period.empty
            update_event = (
                build_update_event(existing_period, incoming, Path(file_name).name)
                if updated_period
                else None
            )
            total_rows = database.replace_period_data(
                incoming,
                update_event,
                pending_token=token,
            )
            log_reference = (
                f"postgresql://performance_produtos/logs_alteracoes/{update_event['event_id']}"
                if update_event is not None
                else None
            )
        except Exception as exc:
            raise ImportValidationError(
                "Não foi possível concluir a atualização com segurança. "
                "A base anterior foi preservada."
            ) from exc

    change_summary = (
        update_event["summary"]
        if update_event is not None
        else {
            "included": len(incoming),
            "updated": 0,
            "removed": 0,
            "changed_products": len(incoming),
        }
    )
    return {
        "period_label": _period_label(incoming[PERIOD_COLUMN].iloc[0]),
        "action": "updated" if updated_period else "inserted",
        "received_rows": len(incoming),
        "inserted_rows": change_summary["included"],
        "updated_rows": change_summary["updated"],
        "removed_rows": change_summary["removed"],
        "changed_rows": change_summary["changed_products"],
        "duplicate_rows": 0,
        "total_rows": total_rows,
        "log_file": log_reference,
    }


def cancel_import(token: str) -> None:
    if re.fullmatch(r"[a-f0-9]{32}", token):
        try:
            database.delete_pending_import(token)
        except (database.DatabaseConfigurationError, database.DatabaseStorageError) as exc:
            raise ImportValidationError(str(exc)) from exc


def base_status() -> dict:
    try:
        status = database.storage_status()
    except (database.DatabaseConfigurationError, database.DatabaseStorageError) as exc:
        raise ImportValidationError(str(exc)) from exc
    return {
        "exists": status["exists"],
        "total_rows": status["total_rows"],
        "periods": [
            {
                "iso": pd.Timestamp(period).strftime("%Y-%m-01"),
                "label": _period_label(pd.Timestamp(period)),
            }
            for period in status["periods"]
        ],
    }


def wipe_base() -> dict:
    """Remove o schema PostgreSQL com dados, logs e prévias de importação."""
    with _WRITE_LOCK:
        status = base_status()
        try:
            pending_count = database.count_pending_imports()
            database.drop_storage()
        except (database.DatabaseConfigurationError, database.DatabaseStorageError) as exc:
            raise ImportValidationError(str(exc)) from exc

    return {
        "deleted": status["exists"],
        "removed_rows": status["total_rows"],
        "removed_periods": len(status["periods"]),
        "removed_pending_imports": pending_count,
    }
