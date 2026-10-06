from __future__ import annotations

from dataclasses import dataclass

import pandas as pd

from app.config import BALANCE_INCREMENT_PRODUCTS, PERIOD_COLUMN
from repo import database
from services.importer import ImportValidationError


VENDA_NOVA_SINGULAR = "VENDA_NOVA_SINGULAR"
VENDA_NOVA_PA = "VENDA_NOVA_PA"
SEGURO_VIDA_SOURCE = "SEGURO_VIDA"
SEGURO_VIDA_TARGET = "SEGURO_VIDA_ARRECADACAO"
SEGURO_VIDA_SOURCE_UNIT = "00"
SEGURO_VIDA_TARGET_UNIT = "89"
GENERAL_PRODUCTS_PER_MONTH = 18
FOCUS_PRODUCTS_PER_MONTH = 7
AGENCY_CARD_EXCLUDED_UNITS = {"89", "999"}
FOCUS_PRODUCTS = {
    "COBRANCA",
    "CONSORCIOS",
    "SEGURO_RURAL",
    "VENDA_NOVA_PA",
    "SEGUROS_GERAIS",
    "SICOOBCARD",
    "SIPAG",
}
UNIT_NAMES = {
    "00": "SEDE",
    "89": "UNIDADE ADMINISTRATIVA",
    "999": "UNIDADE ADMINISTRATIVA",
}
ACCUMULATED_FIELD_OPTIONS = {
    "ANUAL": {
        "meta": "META_ANUAL",
        "production": "PRODUCAO_ANUAL",
        "label": "Produção anual",
        "rule": "ultimo_saldo_anual",
    },
    "NO_PERIODO": {
        "meta": "META_NO_PERIODO",
        "production": "PRODUCAO_NO_PERIODO",
        "label": "Produção no período",
        "rule": "ultimo_saldo_no_periodo",
    },
}


@dataclass(frozen=True)
class PeriodRange:
    start: pd.Timestamp
    end: pd.Timestamp


def _load_base(columns: list[str]) -> pd.DataFrame:
    try:
        frame = database.load_product_data(columns)
    except (database.DatabaseConfigurationError, database.DatabaseStorageError) as exc:
        raise ImportValidationError(str(exc)) from exc
    if frame.empty:
        raise ImportValidationError("Ainda não existem dados importados para montar o acompanhamento.")
    frame[PERIOD_COLUMN] = pd.to_datetime(frame[PERIOD_COLUMN]).dt.to_period("M").dt.to_timestamp()
    return _apply_business_allocations(frame)


def _period_label(period: pd.Timestamp) -> str:
    months = (
        "Jan",
        "Fev",
        "Mar",
        "Abr",
        "Mai",
        "Jun",
        "Jul",
        "Ago",
        "Set",
        "Out",
        "Nov",
        "Dez",
    )
    return f"{months[period.month - 1]}/{period.year}"


def _unit_code(unit: object) -> str:
    value = str(unit).strip()
    if value.isdigit() and len(value) < 2:
        return value.zfill(2)
    return value


def _apply_business_allocations(frame: pd.DataFrame) -> pd.DataFrame:
    """Aplica alocações gerenciais sem alterar os registros originais do banco."""
    if "PA" not in frame.columns or "PRODUTO" not in frame.columns:
        return frame

    adjusted = frame.copy()
    product_names = adjusted["PRODUTO"].fillna("").astype(str).str.strip().str.upper()
    unit_codes = adjusted["PA"].fillna("0").map(_unit_code)
    seguro_vida = (
        product_names.eq(SEGURO_VIDA_SOURCE)
        & unit_codes.eq(SEGURO_VIDA_SOURCE_UNIT)
    )
    adjusted.loc[seguro_vida, "PA"] = SEGURO_VIDA_TARGET_UNIT
    adjusted.loc[seguro_vida, "PRODUTO"] = SEGURO_VIDA_TARGET
    adjusted = _adjust_venda_nova_pa_monthly_target(adjusted)
    return adjusted


def _adjust_venda_nova_pa_monthly_target(frame: pd.DataFrame) -> pd.DataFrame:
    """Rateia nos PAs a parcela da meta Singular que excede a soma das metas dos PAs."""
    required_columns = {PERIOD_COLUMN, "PRODUTO", "META_MENSAL"}
    if not required_columns.issubset(frame.columns):
        return frame

    adjusted = frame.copy()
    product_names = adjusted["PRODUTO"].fillna("").astype(str).str.strip().str.upper()
    singular_mask = product_names.eq(VENDA_NOVA_SINGULAR)
    pa_mask = product_names.eq(VENDA_NOVA_PA)

    if not singular_mask.any() or not pa_mask.any():
        return adjusted

    adjusted["META_MENSAL"] = pd.to_numeric(
        adjusted["META_MENSAL"], errors="coerce"
    ).astype(float)
    singular_targets = (
        adjusted.loc[singular_mask]
        .groupby(PERIOD_COLUMN, dropna=False)["META_MENSAL"]
        .sum()
    )
    pa_targets = (
        adjusted.loc[pa_mask]
        .groupby(PERIOD_COLUMN, dropna=False)["META_MENSAL"]
        .sum()
    )

    for period, pa_total in pa_targets.items():
        singular_total = singular_targets.get(period)
        if singular_total is None or pa_total <= 0 or singular_total <= pa_total:
            continue

        period_pa_mask = pa_mask & adjusted[PERIOD_COLUMN].eq(period)
        adjusted.loc[period_pa_mask, "META_MENSAL"] *= singular_total / pa_total

    return adjusted


def _unit_name(unit: object) -> str:
    code = _unit_code(unit)
    return UNIT_NAMES.get(code, f"PA {code}")


def _unit_label(unit: object) -> str:
    code = _unit_code(unit)
    name = _unit_name(unit)
    return f"PA {code} — {name}" if name != f"PA {code}" else name


def _filter_venda_nova_by_unit(
    frame: pd.DataFrame,
    selected_unit: str,
) -> pd.DataFrame:
    """Keep only the Venda Nova indicator that belongs to the selected scope."""
    product_names = frame["PRODUTO"].fillna("").astype(str).str.upper()
    excluded_product = (
        VENDA_NOVA_PA
        if selected_unit == "SINGULAR"
        else VENDA_NOVA_SINGULAR
    )
    return frame[product_names != excluded_product].copy()


def _filter_product_scope(
    frame: pd.DataFrame,
    selected_unit: str,
    product_scope: str | None,
) -> tuple[pd.DataFrame, str]:
    selected_scope = str(product_scope or "GERAL").strip().upper()
    if selected_scope == "FOCO":
        product_names = frame["PRODUTO"].fillna("").astype(str).str.upper()
        return frame[product_names.isin(FOCUS_PRODUCTS)].copy(), selected_scope
    if selected_scope != "GERAL":
        raise ImportValidationError("O escopo de produtos deve ser GERAL ou FOCO.")
    return _filter_venda_nova_by_unit(frame, selected_unit), selected_scope


def _production_title(start: pd.Timestamp, end: pd.Timestamp) -> str:
    months = (
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
    if start.year == end.year:
        if start.month == end.month:
            return f"Produção ({months[start.month - 1]})"
        return f"Produção ({months[start.month - 1]} a {months[end.month - 1]})"
    return (
        f"Produção ({months[start.month - 1]}/{start.year} "
        f"a {months[end.month - 1]}/{end.year})"
    )


def available_periods() -> dict:
    frame = _load_base([PERIOD_COLUMN, "PA", "PRODUTO"])
    periods = sorted(frame[PERIOD_COLUMN].drop_duplicates())
    units = sorted(
        (
            unit
            for unit in frame["PA"].fillna("0").astype(str).drop_duplicates()
            if unit.strip() and _unit_code(unit) not in AGENCY_CARD_EXCLUDED_UNITS
        ),
        key=lambda value: (
            not value.isdigit(),
            int(value) if value.isdigit() else value,
        ),
    )
    return {
        "periods": [
            {
                "value": period.strftime("%Y-%m"),
                "label": _period_label(period),
            }
            for period in periods
        ],
        "default_start": periods[0].strftime("%Y-%m"),
        "default_end": periods[-1].strftime("%Y-%m"),
        "units": [
            {"value": "SINGULAR", "label": "Singular · todas as agências"},
            *[
                {"value": unit, "label": _unit_label(unit)}
                for unit in units
            ],
        ],
        "default_unit": "SINGULAR",
    }


def _parse_range(start: str | None, end: str | None, periods: pd.Series) -> PeriodRange:
    available = sorted(periods.drop_duplicates())
    try:
        start_period = (
            pd.Period(start, freq="M").to_timestamp()
            if start
            else available[0]
        )
        end_period = (
            pd.Period(end, freq="M").to_timestamp()
            if end
            else available[-1]
        )
    except (ValueError, TypeError) as exc:
        raise ImportValidationError("O período informado é inválido.") from exc

    if start_period > end_period:
        raise ImportValidationError("O período inicial não pode ser posterior ao período final.")
    return PeriodRange(start=start_period, end=end_period)
