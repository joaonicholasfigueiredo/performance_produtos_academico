from __future__ import annotations

import pandas as pd

from services.importer import ImportValidationError
from app.config import PERIOD_COLUMN
from services.analytics_common import (
    AGENCY_CARD_EXCLUDED_UNITS,
    FOCUS_PRODUCTS,
    GENERAL_PRODUCTS_PER_MONTH,
    _load_base,
    _parse_range,
    _period_label,
    _production_title,
    _unit_code,
    _unit_label,
    _unit_name,
)
from services.analytics_production import accumulated_production


def focus_product_agency_performance(
    start: str | None = None,
    end: str | None = None,
    calculation_basis: str | None = None,
) -> dict:
    """Compara o desempenho das agências em cada produto do escopo foco."""
    selected_basis = str(calculation_basis or "NO_PERIODO").strip().upper()
    if selected_basis not in {"ANUAL", "NO_PERIODO"}:
        raise ImportValidationError("A base de cálculo deve ser ANUAL ou NO_PERIODO.")

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
    focus_mask = (
        period_frame["PRODUTO"].fillna("").astype(str).str.upper().isin(FOCUS_PRODUCTS)
    )
    focus_frame = period_frame[focus_mask].copy()
    if focus_frame.empty:
        raise ImportValidationError(
            "Não existem dados dos produtos foco para o período selecionado."
        )

    focus_frame["_pa_key"] = focus_frame["PA"].fillna("0").astype(str)
    focus_frame["_product_key"] = (
        focus_frame["PRODUTO"].fillna("").astype(str).str.upper()
    )
    periods = sorted(focus_frame[PERIOD_COLUMN].drop_duplicates())
    monthly = (
        focus_frame.groupby(
            ["_pa_key", "_product_key", PERIOD_COLUMN],
            as_index=False,
            dropna=False,
        )
        .agg(
            meta=("META_MENSAL", "sum"),
            producao=("PRODUCAO_MENSAL", "sum"),
        )
    )
    monthly_lookup = {
        (
            str(row["_pa_key"]),
            str(row["_product_key"]),
            pd.Timestamp(row[PERIOD_COLUMN]),
        ): row
        for _, row in monthly.iterrows()
    }

    raw_units = focus_frame["PA"].fillna("0").astype(str).drop_duplicates()
    units = sorted(
        (
            unit
            for unit in raw_units
            if unit.strip() and _unit_code(unit) not in AGENCY_CARD_EXCLUDED_UNITS
        ),
        key=lambda value: (
            not _unit_code(value).isdigit(),
            int(_unit_code(value)) if _unit_code(value).isdigit() else _unit_code(value),
        ),
    )

    products: dict[str, dict] = {
        product: {"produto": product, "units": []}
        for product in sorted(FOCUS_PRODUCTS, key=str.casefold)
    }
    period_consolidated = accumulated_production(
        selected_range.start.strftime("%Y-%m"),
        selected_range.end.strftime("%Y-%m"),
        "SINGULAR",
        "NO_PERIODO",
        "FOCO",
        _source_frame=frame,
    )
    annual_consolidated = accumulated_production(
        selected_range.start.strftime("%Y-%m"),
        selected_range.end.strftime("%Y-%m"),
        "SINGULAR",
        "ANUAL",
        "FOCO",
        _source_frame=frame,
    )
    period_product_lookup = {
        str(item["produto"]).upper(): item
        for item in period_consolidated["products"]
    }
    annual_product_lookup = {
        str(item["produto"]).upper(): item
        for item in annual_consolidated["products"]
    }
    for unit in units:
        result = accumulated_production(
            selected_range.start.strftime("%Y-%m"),
            selected_range.end.strftime("%Y-%m"),
            unit,
            selected_basis,
            "FOCO",
            _source_frame=frame,
        )
        for product in result["products"]:
            product_name = str(product["produto"]).upper()
            if product_name not in products:
                continue
            points = []
            for period in periods:
                row = monthly_lookup.get((unit, product_name, pd.Timestamp(period)))
                if row is None:
                    points.append(
                        {
                            "period": period.strftime("%Y-%m"),
                            "period_label": _period_label(period),
                            "meta": None,
                            "producao": None,
                            "percentual_atingido": None,
                            "gap": None,
                            "status": "sem_dados",
                        }
                    )
                    continue
                meta = float(row["meta"])
                production = float(row["producao"])
                percentage = float(production / meta * 100) if meta > 0 else None
                points.append(
                    {
                        "period": period.strftime("%Y-%m"),
                        "period_label": _period_label(period),
                        "meta": meta,
                        "producao": production,
                        "percentual_atingido": percentage,
                        "gap": production - meta,
                        "status": (
                            "sem_meta"
                            if percentage is None
                            else "aderente"
                            if percentage >= 100
                            else "nao_aderente"
                        ),
                    }
                )
            products[product_name]["units"].append(
                {
                    "pa": unit,
                    "code": _unit_code(unit),
                    "name": _unit_name(unit),
                    "label": _unit_label(unit),
                    "points": points,
                    **product,
                }
            )

    product_results = []
    for product in products.values():
        product["units"].sort(
            key=lambda item: (
                item["percentual_atingido"] is None,
                -(item["percentual_atingido"] or 0),
                not item["code"].isdigit(),
                int(item["code"]) if item["code"].isdigit() else item["code"],
            )
        )
        with_target = sum(item["status"] != "sem_meta" for item in product["units"])
        adherent = sum(item["status"] == "aderente" for item in product["units"])
        product["summary"] = {
            "units": len(product["units"]),
            "with_target": with_target,
            "adherent": adherent,
            "adherence_rate": float(adherent / with_target * 100) if with_target else 0.0,
        }
        monthly_achieved = sum(
            point["status"] == "aderente"
            for unit in product["units"]
            for point in unit["points"]
        )
        monthly_expected = sum(
            12
            if selected_basis == "ANUAL"
            else sum(point["status"] not in {"sem_meta", "sem_dados"} for point in unit["points"])
            for unit in product["units"]
        )
        product["monthly_summary"] = {
            "expected": monthly_expected,
            "adherent": monthly_achieved,
            "adherence_rate": (
                float(monthly_achieved / monthly_expected * 100)
                if monthly_expected
                else 0.0
            ),
        }
        product_name = str(product["produto"]).upper()
        product["consolidated"] = {
            "period": period_product_lookup.get(product_name),
            "annual": annual_product_lookup.get(product_name),
        }
        product_results.append(product)

    return {
        "calculation": {"value": selected_basis},
        "range": {
            "start": selected_range.start.strftime("%Y-%m"),
            "end": selected_range.end.strftime("%Y-%m"),
            "start_label": _period_label(selected_range.start),
            "end_label": _period_label(selected_range.end),
        },
        "periods": [
            {"value": period.strftime("%Y-%m"), "label": _period_label(period)}
            for period in periods
        ],
        "products": product_results,
    }


def agency_accumulated_production(
    start: str | None = None,
    end: str | None = None,
    calculation_basis: str | None = None,
) -> dict:
    """Retorna a produção acumulada de todas as unidades em cards independentes."""
    selected_basis = str(calculation_basis or "NO_PERIODO").strip().upper()
    if selected_basis not in {"ANUAL", "NO_PERIODO"}:
        raise ImportValidationError("A base de cálculo deve ser ANUAL ou NO_PERIODO.")

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
    if period_frame.empty:
        raise ImportValidationError("Não existem dados importados para o período selecionado.")

    raw_units = period_frame["PA"].fillna("0").astype(str).drop_duplicates()
    units = sorted(
        (
            unit
            for unit in raw_units
            if unit.strip() and _unit_code(unit) not in AGENCY_CARD_EXCLUDED_UNITS
        ),
        key=lambda value: (
            not _unit_code(value).isdigit(),
            int(_unit_code(value)) if _unit_code(value).isdigit() else _unit_code(value),
        ),
    )

    cards: list[dict] = []
    calculation: dict | None = None
    for unit in units:
        result = accumulated_production(
            selected_range.start.strftime("%Y-%m"),
            selected_range.end.strftime("%Y-%m"),
            unit,
            selected_basis,
            "GERAL",
            _source_frame=frame,
        )
        calculation = result["calculation"]
        products = sorted(
            result["products"],
            key=lambda item: item["produto"].casefold(),
        )
        source_summary = result["summary"]
        expected_products = GENERAL_PRODUCTS_PER_MONTH
        positive_target_products = int(source_summary["with_target"])
        protected_summary = {
            **source_summary,
            "with_target": expected_products,
            "not_adherent": max(expected_products - source_summary["adherent"], 0),
            "without_target": max(expected_products - positive_target_products, 0),
            "adherence_rate": float(
                source_summary["adherent"] / expected_products * 100
            ),
        }
        cards.append(
            {
                "pa": unit,
                "code": _unit_code(unit),
                "name": _unit_name(unit),
                "label": _unit_label(unit),
                "summary": protected_summary,
                "products": products,
            }
        )

    return {
        "calculation": calculation or {"value": selected_basis},
        "range": {
            "start": selected_range.start.strftime("%Y-%m"),
            "end": selected_range.end.strftime("%Y-%m"),
            "start_label": _period_label(selected_range.start),
            "end_label": _period_label(selected_range.end),
            "title": _production_title(selected_range.start, selected_range.end),
        },
        "summary": {
            "units": len(cards),
            "products": sum(len(card["products"]) for card in cards),
        },
        "units": cards,
    }
