from __future__ import annotations

import pandas as pd

from app.config import BALANCE_INCREMENT_PRODUCTS, PERIOD_COLUMN
from services.importer import ImportValidationError
from services.analytics_common import (
    ACCUMULATED_FIELD_OPTIONS,
    _filter_product_scope,
    _load_base,
    _parse_range,
    _period_label,
    _production_title,
    _unit_label,
)
def accumulated_production(
    start: str | None = None,
    end: str | None = None,
    pa: str | None = None,
    calculation_basis: str | None = None,
    product_scope: str | None = None,
    _source_frame: pd.DataFrame | None = None,
) -> dict:
    selected_basis = str(calculation_basis or "MENSAL").strip().upper()
    snapshot_option = ACCUMULATED_FIELD_OPTIONS.get(selected_basis)
    if selected_basis != "MENSAL" and snapshot_option is None:
        raise ImportValidationError(
            "A base de cálculo deve ser ANUAL ou NO_PERIODO."
        )
    columns = [PERIOD_COLUMN, "PA", "PRODUTO"]
    if selected_basis in {"MENSAL", "NO_PERIODO"}:
        columns.extend(["META_MENSAL", "PRODUCAO_MENSAL"])
        if selected_basis == "MENSAL":
            columns.extend(["META_ANUAL", "PRODUCAO_ANUAL"])
    else:
        columns.extend([snapshot_option["meta"], snapshot_option["production"]])
    frame = _source_frame.copy() if _source_frame is not None else _load_base(columns)
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

    if selected_basis == "MENSAL":
        balance_mask = filtered["PRODUTO"].isin(BALANCE_INCREMENT_PRODUCTS)
        regular = (
            filtered[~balance_mask]
            .groupby("PRODUTO", as_index=False, dropna=False)
            .agg(
                meta_acumulada=("META_MENSAL", "sum"),
                producao_acumulada=("PRODUCAO_MENSAL", "sum"),
            )
        )
        regular["regra_calculo"] = "soma_mensal"
        regular["periodo_referencia"] = None

        balance_rows = filtered[balance_mask]
        if not balance_rows.empty:
            latest_by_product = balance_rows.groupby("PRODUTO")[PERIOD_COLUMN].transform("max")
            balances = (
                balance_rows[balance_rows[PERIOD_COLUMN] == latest_by_product]
                .groupby("PRODUTO", as_index=False, dropna=False)
                .agg(
                    meta_acumulada=("META_ANUAL", "sum"),
                    producao_acumulada=("PRODUCAO_ANUAL", "sum"),
                    periodo_referencia=(PERIOD_COLUMN, "max"),
                )
            )
            balances["regra_calculo"] = "ultimo_saldo_anual"
            balances["periodo_referencia"] = balances["periodo_referencia"].dt.strftime("%Y-%m")
            grouped = (
                pd.concat([regular, balances], ignore_index=True)
                if not regular.empty
                else balances
            )
        else:
            grouped = regular
        calculation = {
            "value": "MENSAL",
            "label": "Produção mensal acumulada",
            "meta_field": "META_MENSAL",
            "production_field": "PRODUCAO_MENSAL",
            "uses_latest_period": False,
            "reference_period": filtered[PERIOD_COLUMN].max().strftime("%Y-%m"),
        }
    elif selected_basis == "NO_PERIODO":
        balance_mask = filtered["PRODUTO"].isin(BALANCE_INCREMENT_PRODUCTS)
        regular = (
            filtered[~balance_mask]
            .groupby("PRODUTO", as_index=False, dropna=False)
            .agg(
                meta_acumulada=("META_MENSAL", "sum"),
                producao_acumulada=("PRODUCAO_MENSAL", "sum"),
            )
        )
        regular["regra_calculo"] = "soma_mensal_no_periodo"
        regular["periodo_referencia"] = None

        balance_rows = filtered[balance_mask]
        if not balance_rows.empty:
            latest_by_product = balance_rows.groupby("PRODUTO")[PERIOD_COLUMN].transform("max")
            balances = (
                balance_rows[balance_rows[PERIOD_COLUMN] == latest_by_product]
                .groupby("PRODUTO", as_index=False, dropna=False)
                .agg(
                    meta_acumulada=("META_MENSAL", "sum"),
                    producao_acumulada=("PRODUCAO_MENSAL", "sum"),
                    periodo_referencia=(PERIOD_COLUMN, "max"),
                )
            )
            balances["regra_calculo"] = "saldo_mensal_nao_acumulado"
            balances["periodo_referencia"] = balances["periodo_referencia"].dt.strftime("%Y-%m")
            grouped = (
                pd.concat([regular, balances], ignore_index=True)
                if not regular.empty
                else balances
            )
        else:
            grouped = regular
        calculation = {
            "value": "NO_PERIODO",
            "label": "Produção no período",
            "meta_field": "META_MENSAL",
            "production_field": "PRODUCAO_MENSAL",
            "uses_latest_period": False,
            "reference_period": filtered[PERIOD_COLUMN].max().strftime("%Y-%m"),
        }
    else:
        option = snapshot_option
        latest_by_product = filtered.groupby("PRODUTO")[PERIOD_COLUMN].transform("max")
        latest_rows = filtered[filtered[PERIOD_COLUMN] == latest_by_product]
        grouped = (
            latest_rows
            .groupby("PRODUTO", as_index=False, dropna=False)
            .agg(
                meta_acumulada=(option["meta"], "sum"),
                producao_acumulada=(option["production"], "sum"),
                periodo_referencia=(PERIOD_COLUMN, "max"),
            )
        )
        grouped["regra_calculo"] = option["rule"]
        grouped["periodo_referencia"] = grouped["periodo_referencia"].dt.strftime("%Y-%m")
        calculation = {
            "value": selected_basis,
            "label": option["label"],
            "meta_field": option["meta"],
            "production_field": option["production"],
            "uses_latest_period": True,
            "reference_period": filtered[PERIOD_COLUMN].max().strftime("%Y-%m"),
        }

    grouped["produto"] = grouped["PRODUTO"].fillna("0").astype(str)
    grouped["gap"] = grouped["producao_acumulada"] - grouped["meta_acumulada"]

    def calculate_percentage(row: pd.Series) -> float | None:
        if row["meta_acumulada"] <= 0:
            return None
        return float(row["producao_acumulada"] / row["meta_acumulada"] * 100)

    grouped["percentual_atingido"] = grouped.apply(calculate_percentage, axis=1)
    grouped["status"] = grouped["percentual_atingido"].map(
        lambda value: (
            "sem_meta"
            if pd.isna(value)
            else "aderente"
            if value >= 100
            else "nao_aderente"
        )
    )
    grouped = grouped.sort_values(
        ["percentual_atingido", "produto"],
        ascending=[False, True],
        na_position="last",
        kind="stable",
    )

    products = [
        {
            "produto": row.produto,
            "meta_acumulada": float(row.meta_acumulada),
            "producao_acumulada": float(row.producao_acumulada),
            "gap": float(row.gap),
            "percentual_atingido": (
                None
                if pd.isna(row.percentual_atingido)
                else float(row.percentual_atingido)
            ),
            "status": row.status,
            "regra_calculo": row.regra_calculo,
            "periodo_referencia": row.periodo_referencia,
        }
        for row in grouped.itertuples(index=False)
    ]
    adherent = sum(product["status"] == "aderente" for product in products)
    with_target = sum(product["status"] != "sem_meta" for product in products)
    selected_periods = sorted(filtered[PERIOD_COLUMN].drop_duplicates())

    return {
        "scope": {
            "value": selected_scope,
            "label": "7 produtos foco" if selected_scope == "FOCO" else f"{len(products)} produtos",
        },
        "calculation": calculation,
        "range": {
            "start": selected_range.start.strftime("%Y-%m"),
            "end": selected_range.end.strftime("%Y-%m"),
            "start_label": _period_label(selected_range.start),
            "end_label": _period_label(selected_range.end),
            "title": _production_title(selected_range.start, selected_range.end),
        },
        "unit": {
            "value": selected_unit,
            "label": unit_label,
            "is_singular": selected_unit == "SINGULAR",
        },
        "summary": {
            "products": len(products),
            "with_target": with_target,
            "adherent": adherent,
            "not_adherent": sum(product["status"] == "nao_aderente" for product in products),
            "without_target": sum(product["status"] == "sem_meta" for product in products),
            "adherence_rate": float(adherent / with_target * 100) if with_target else 0.0,
            "months_with_data": len(selected_periods),
        },
        "products": products,
    }
