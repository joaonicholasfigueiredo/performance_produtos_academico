from __future__ import annotations

import pandas as pd

from app.config import BALANCE_INCREMENT_PRODUCTS, PERIOD_COLUMN
from services.importer import ImportValidationError
from services.analytics_common import (
    AGENCY_CARD_EXCLUDED_UNITS,
    FOCUS_PRODUCTS_PER_MONTH,
    GENERAL_PRODUCTS_PER_MONTH,
    _filter_product_scope,
    _load_base,
    _parse_range,
    _period_label,
    _unit_code,
    _unit_label,
    _unit_name,
)
def unit_performance_summary(
    start: str | None = None,
    end: str | None = None,
    calculation_basis: str | None = None,
    product_scope: str | None = None,
) -> dict:
    """Pontua, por PA, cada oportunidade mensal de atingimento dos produtos."""
    selected_basis = str(calculation_basis or "NO_PERIODO").strip().upper()
    if selected_basis not in {"ANUAL", "NO_PERIODO"}:
        raise ImportValidationError("A base de cálculo deve ser ANUAL ou NO_PERIODO.")
    selected_scope = str(product_scope or "GERAL").strip().upper()
    if selected_scope not in {"GERAL", "FOCO"}:
        raise ImportValidationError("O escopo de produtos deve ser GERAL ou FOCO.")

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
    selected_range = _parse_range(start, end, frame[PERIOD_COLUMN])
    period_frame = frame[
        frame[PERIOD_COLUMN].between(selected_range.start, selected_range.end)
    ].copy()
    selected_periods = sorted(period_frame[PERIOD_COLUMN].drop_duplicates())
    products_per_month = (
        FOCUS_PRODUCTS_PER_MONTH
        if selected_scope == "FOCO"
        else GENERAL_PRODUCTS_PER_MONTH
    )
    expected_months = 12 if selected_basis == "ANUAL" else len(selected_periods)
    period_target = products_per_month * expected_months
    raw_units = period_frame["PA"].fillna("0").astype(str).drop_duplicates()
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

    summaries: list[dict] = []
    for unit in units:
        unit_frame = period_frame[
            period_frame["PA"].fillna("0").astype(str) == unit
        ].copy()
        unit_frame, _ = _filter_product_scope(unit_frame, unit, selected_scope)
        monthly_products = (
            unit_frame.groupby(
                [PERIOD_COLUMN, "PRODUTO"],
                as_index=False,
                dropna=False,
            )
            .agg(
                meta=("META_MENSAL", "sum"),
                producao=("PRODUCAO_MENSAL", "sum"),
            )
        )
        monthly_products["atingida"] = (
            monthly_products["meta"].gt(0)
            & monthly_products["producao"].ge(monthly_products["meta"])
        )
        monthly_breakdown: list[dict] = []
        adherent = 0
        for period in selected_periods:
            month_rows = monthly_products[monthly_products[PERIOD_COLUMN] == period]
            achieved_products = sorted(
                month_rows.loc[month_rows["atingida"], "PRODUTO"]
                .fillna("")
                .astype(str)
                .tolist(),
                key=str.casefold,
            )
            month_adherent = min(len(achieved_products), products_per_month)
            adherent += month_adherent
            monthly_breakdown.append(
                {
                    "period": period.strftime("%Y-%m"),
                    "period_label": _period_label(period),
                    "target": products_per_month,
                    "adherent": month_adherent,
                    "achieved_products": achieved_products,
                    "adherence_rate": float(
                        month_adherent / products_per_month * 100
                    ),
                }
            )

        summaries.append(
            {
                "pa": unit,
                "code": _unit_code(unit),
                "name": _unit_name(unit),
                "label": _unit_label(unit),
                "products": period_target,
                "with_target": period_target,
                "adherent": adherent,
                "not_adherent": period_target - adherent,
                "without_target": 0,
                "adherence_rate": float(
                    adherent / period_target * 100
                ) if period_target else 0.0,
                "monthly": monthly_breakdown,
            }
        )

    summaries.sort(
        key=lambda item: (
            -item["adherent"],
            -item["adherence_rate"],
            not item["pa"].isdigit(),
            int(item["pa"]) if item["pa"].isdigit() else item["pa"],
        )
    )
    return {
        "scope": {
            "value": selected_scope,
            "label": (
                "7 produtos foco"
                if selected_scope == "FOCO"
                else "18 produtos"
            ),
            "products_per_month": products_per_month,
            "months": expected_months,
            "period_months": len(selected_periods),
            "target": period_target,
        },
        "calculation": {"value": selected_basis},
        "range": {
            "start": selected_range.start.strftime("%Y-%m"),
            "end": selected_range.end.strftime("%Y-%m"),
            "start_label": _period_label(selected_range.start),
            "end_label": _period_label(selected_range.end),
        },
        "units": summaries,
    }


def monthly_product_evolution(
    start: str | None = None,
    end: str | None = None,
    pa: str | None = None,
    product_scope: str | None = None,
) -> dict:
    frame = _load_base(
        [
            PERIOD_COLUMN,
            "PA",
            "PRODUTO",
            "META_MENSAL",
            "PRODUCAO_MENSAL",
        ]
    )
    selected_range = _parse_range(start, end, frame[PERIOD_COLUMN])
    filtered = frame[
        frame[PERIOD_COLUMN].between(selected_range.start, selected_range.end)
    ].copy()

    selected_unit = str(pa or "SINGULAR").strip()
    if selected_unit.upper() == "SINGULAR":
        selected_unit = "SINGULAR"
        unit_label = "Singular · todas as agências"
    else:
        available_units = set(frame["PA"].fillna("0").astype(str))
        if selected_unit not in available_units:
            raise ImportValidationError(f"O PA {selected_unit} não existe na base importada.")
        filtered = filtered[filtered["PA"].fillna("0").astype(str) == selected_unit]
        unit_label = _unit_label(selected_unit)

    filtered, selected_scope = _filter_product_scope(
        filtered, selected_unit, product_scope
    )
    if filtered.empty:
        raise ImportValidationError("Não existem dados importados para o período selecionado.")

    balance_mask = filtered["PRODUTO"].isin(BALANCE_INCREMENT_PRODUCTS)
    regular = (
        filtered[~balance_mask]
        .groupby([PERIOD_COLUMN, "PRODUTO"], as_index=False, dropna=False)
        .agg(
            meta=("META_MENSAL", "sum"),
            producao=("PRODUCAO_MENSAL", "sum"),
        )
    )
    regular["regra_calculo"] = "soma_mensal"

    balances = (
        filtered[balance_mask]
        .groupby([PERIOD_COLUMN, "PRODUTO"], as_index=False, dropna=False)
        .agg(
            meta=("META_MENSAL", "sum"),
            producao=("PRODUCAO_MENSAL", "sum"),
        )
    )
    balances["regra_calculo"] = "saldo_mensal_nao_acumulado"

    if regular.empty:
        monthly = balances
    elif balances.empty:
        monthly = regular
    else:
        monthly = pd.concat([regular, balances], ignore_index=True)

    periods = sorted(filtered[PERIOD_COLUMN].drop_duplicates())
    products: list[dict] = []
    for product_name in sorted(
        monthly["PRODUTO"].fillna("0").astype(str).unique(),
        key=lambda value: value.casefold(),
    ):
        product_rows = monthly[monthly["PRODUTO"].fillna("0").astype(str) == product_name]
        by_period = {
            pd.Timestamp(row[PERIOD_COLUMN]): row
            for _, row in product_rows.iterrows()
        }
        points: list[dict] = []
        for period in periods:
            row = by_period.get(pd.Timestamp(period))
            if row is None:
                points.append(
                    {
                        "period": period.strftime("%Y-%m"),
                        "period_label": _period_label(period),
                        "meta": None,
                        "producao": None,
                        "percentual_atingido": None,
                        "gap": None,
                    }
                )
                continue

            meta = float(row["meta"])
            production = float(row["producao"])
            points.append(
                {
                    "period": period.strftime("%Y-%m"),
                    "period_label": _period_label(period),
                    "meta": meta,
                    "producao": production,
                    "percentual_atingido": (
                        float(production / meta * 100)
                        if meta > 0
                        else None
                    ),
                    "gap": production - meta,
                }
            )

        products.append(
            {
                "produto": product_name,
                "regra_calculo": str(product_rows["regra_calculo"].iloc[0]),
                "points": points,
            }
        )

    return {
        "scope": {
            "value": selected_scope,
            "label": "7 produtos foco" if selected_scope == "FOCO" else "19 produtos",
        },
        "range": {
            "start": selected_range.start.strftime("%Y-%m"),
            "end": selected_range.end.strftime("%Y-%m"),
            "start_label": _period_label(selected_range.start),
            "end_label": _period_label(selected_range.end),
        },
        "unit": {
            "value": selected_unit,
            "label": unit_label,
            "is_singular": selected_unit == "SINGULAR",
        },
        "periods": [
            {"value": period.strftime("%Y-%m"), "label": _period_label(period)}
            for period in periods
        ],
        "products": products,
    }
