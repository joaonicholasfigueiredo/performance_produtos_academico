from __future__ import annotations

import pandas as pd

from app.config import BALANCE_INCREMENT_PRODUCTS, PERIOD_COLUMN
from services.importer import ImportValidationError
from services.analytics_common import (
    AGENCY_CARD_EXCLUDED_UNITS,
    _filter_product_scope,
    _load_base,
    _period_label,
    _unit_code,
    _unit_label,
)


def product_evolution_study(
    pa: str | None = None,
    product: str | None = None,
) -> dict:
    """Compara a evolução anual de um produto com a trajetória até dezembro."""
    frame = _load_base(
        [
            PERIOD_COLUMN,
            "PA",
            "PRODUTO",
            "META_MENSAL",
            "PRODUCAO_MENSAL",
            "META_ANUAL",
            "PRODUCAO_ANUAL",
        ]
    )
    latest_period = pd.Timestamp(frame[PERIOD_COLUMN].max())
    year_frame = frame[frame[PERIOD_COLUMN].dt.year == latest_period.year].copy()
    raw_units = year_frame["PA"].fillna("0").astype(str).drop_duplicates()
    units = sorted(
        (
            unit
            for unit in raw_units
            if unit.strip() and _unit_code(unit) not in AGENCY_CARD_EXCLUDED_UNITS
        ),
        key=lambda value: (
            not value.isdigit(),
            int(value) if value.isdigit() else value,
        ),
    )
    if not units:
        raise ImportValidationError("Não existem agências disponíveis para o estudo de evolução.")

    selected_unit = str(pa or units[0]).strip()
    if selected_unit not in units:
        raise ImportValidationError(f"O PA {selected_unit} não está disponível no estudo de evolução.")

    unit_frame = year_frame[
        year_frame["PA"].fillna("0").astype(str) == selected_unit
    ].copy()
    unit_frame, _ = _filter_product_scope(unit_frame, selected_unit, "GERAL")
    products = sorted(
        unit_frame["PRODUTO"].fillna("").astype(str).loc[lambda values: values.ne("")].unique(),
        key=str.casefold,
    )
    if not products:
        raise ImportValidationError("Não existem produtos disponíveis para a agência selecionada.")

    requested_product = str(product or "").strip()
    selected_product = (
        requested_product
        if requested_product in products
        else "COBRANCA"
        if "COBRANCA" in products
        else products[0]
    )
    product_rows = unit_frame[unit_frame["PRODUTO"].astype(str) == selected_product].copy()
    for column in ("META_MENSAL", "PRODUCAO_MENSAL", "META_ANUAL", "PRODUCAO_ANUAL"):
        product_rows[column] = pd.to_numeric(product_rows[column], errors="coerce").fillna(0.0)
    monthly = (
        product_rows.groupby(PERIOD_COLUMN, as_index=False)
        .agg(
            monthly_target=("META_MENSAL", "sum"),
            monthly_production=("PRODUCAO_MENSAL", "sum"),
            annual_target=("META_ANUAL", "sum"),
            annual_production=("PRODUCAO_ANUAL", "sum"),
        )
        .sort_values(PERIOD_COLUMN)
    )
    reference_row = monthly.iloc[-1]
    reference_period = pd.Timestamp(reference_row[PERIOD_COLUMN])
    annual_target = float(reference_row["annual_target"])
    current_production = float(reference_row["annual_production"])
    current_month_production = float(reference_row["monthly_production"])
    previous_production = (
        float(monthly.iloc[-2]["annual_production"])
        if len(monthly) > 1
        else 0.0
    )
    monthly_evolution = current_production - previous_production
    gap = max(annual_target - current_production, 0.0)
    months_elapsed = reference_period.month
    months_remaining = 12 - months_elapsed
    required_per_month = (
        gap / months_remaining
        if months_remaining > 0
        else gap
    )
    current_ideal = annual_target * months_elapsed / 12 if annual_target > 0 else 0.0
    percentage = current_production / annual_target * 100 if annual_target > 0 else None
    projected_year_end = (
        current_production / months_elapsed * 12
        if months_elapsed > 0
        else current_production
    )
    average_monthly_pace = (
        current_production / months_elapsed
        if months_elapsed > 0
        else current_production
    )
    will_reach_target = annual_target > 0 and projected_year_end >= annual_target
    recommended_per_month = max(average_monthly_pace, required_per_month)
    base_monthly_target = annual_target / 12 if annual_target > 0 else 0.0
    plan_additional_to_base = max(recommended_per_month - base_monthly_target, 0.0)
    pace_increase_required = max(required_per_month - average_monthly_pace, 0.0)
    projected_variance = projected_year_end - annual_target
    if annual_target <= 0:
        status = "sem_meta"
    elif current_production >= annual_target:
        status = "atingida"
    elif current_production >= current_ideal:
        status = "no_ritmo"
    else:
        status = "abaixo_do_ritmo"

    rows_by_month = {
        pd.Timestamp(row[PERIOD_COLUMN]).month: row
        for _, row in monthly.iterrows()
    }
    is_balance_product = selected_product in BALANCE_INCREMENT_PRODUCTS
    cumulative_monthly_target = 0.0
    cumulative_monthly_production = 0.0
    points: list[dict] = []
    for month in range(1, 13):
        period = pd.Timestamp(year=reference_period.year, month=month, day=1)
        row = rows_by_month.get(month)
        actual = float(row["annual_production"]) if row is not None else None
        displayed_monthly_target = (
            float(row["monthly_target"])
            if row is not None
            else base_monthly_target
        )
        monthly_production = float(row["monthly_production"]) if row is not None else None
        if row is not None:
            cumulative_monthly_target += displayed_monthly_target
            cumulative_monthly_production += monthly_production or 0.0
        recommended_projection = None
        if month >= months_elapsed:
            recommended_projection = (
                current_production + recommended_per_month * (month - months_elapsed)
            ) if annual_target > 0 else current_production
        ideal_target = annual_target * month / 12 if annual_target > 0 else 0.0
        accumulated_variance = None
        if actual is not None:
            accumulated_variance = (
                actual - ideal_target
                if is_balance_product
                else cumulative_monthly_production - cumulative_monthly_target
            )
        points.append(
            {
                "period": period.strftime("%Y-%m"),
                "period_label": _period_label(period),
                "monthly_target": displayed_monthly_target,
                "monthly_target_source": "imported" if row is not None else "annual_reference",
                "monthly_production": monthly_production,
                "monthly_gap": (
                    monthly_production - displayed_monthly_target
                    if monthly_production is not None
                    else None
                ),
                "actual_production": actual,
                "ideal_target": ideal_target,
                "accumulated_deficit": (
                    max(-accumulated_variance, 0.0)
                    if accumulated_variance is not None
                    else None
                ),
                "accumulated_surplus": (
                    max(accumulated_variance, 0.0)
                    if accumulated_variance is not None
                    else None
                ),
                "evolution_plan": (
                    recommended_per_month
                    if month > months_elapsed and annual_target > 0
                    else None
                ),
                "plan_additional_to_base": (
                    plan_additional_to_base
                    if month > months_elapsed and annual_target > 0
                    else None
                ),
                "recommended_projection": recommended_projection,
                "variance_to_ideal": actual - ideal_target if actual is not None else None,
                "has_data": row is not None,
            }
        )

    return {
        "year": reference_period.year,
        "reference_period": reference_period.strftime("%Y-%m"),
        "reference_label": _period_label(reference_period),
        "units": [
            {"value": unit, "code": _unit_code(unit), "label": _unit_label(unit)}
            for unit in units
        ],
        "products": products,
        "unit": {
            "value": selected_unit,
            "code": _unit_code(selected_unit),
            "label": _unit_label(selected_unit),
        },
        "product": {
            "value": selected_product,
            "is_balance": is_balance_product,
        },
        "summary": {
            "annual_target": annual_target,
            "current_production": current_production,
            "current_month_production": current_month_production,
            "monthly_evolution": monthly_evolution,
            "percentage": percentage,
            "gap": gap,
            "months_elapsed": months_elapsed,
            "months_remaining": months_remaining,
            "current_ideal": current_ideal,
            "required_per_month": required_per_month,
            "average_monthly_pace": average_monthly_pace,
            "recommended_per_month": recommended_per_month,
            "base_monthly_target": base_monthly_target,
            "plan_additional_to_base": plan_additional_to_base,
            "pace_increase_required": pace_increase_required,
            "projected_year_end": projected_year_end,
            "projected_variance": projected_variance,
            "will_reach_target": will_reach_target,
            "status": status,
        },
        "points": points,
    }
