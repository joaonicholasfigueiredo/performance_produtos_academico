"""Rotas dos indicadores de acompanhamento."""

from __future__ import annotations

from fastapi import HTTPException

from app.core import app
from services.analytics import (
    accumulated_production,
    agency_accumulated_production,
    available_periods,
    focus_product_agency_performance,
    monthly_product_evolution,
    product_evolution_study,
    unit_performance_summary,
)
from services.importer import ImportValidationError


@app.get("/api/acompanhamento/periodos")
def get_available_periods() -> dict:
    try:
        return available_periods()
    except ImportValidationError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.get("/api/acompanhamento/producao-acumulada")
def get_accumulated_production(
    inicio: str | None = None,
    fim: str | None = None,
    pa: str | None = None,
    base_calculo: str | None = None,
    escopo: str | None = None,
) -> dict:
    try:
        return accumulated_production(inicio, fim, pa, base_calculo, escopo)
    except ImportValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.get("/api/acompanhamento/producao-analitica")
def get_monthly_product_evolution(
    inicio: str | None = None,
    fim: str | None = None,
    pa: str | None = None,
    escopo: str | None = None,
) -> dict:
    try:
        return monthly_product_evolution(inicio, fim, pa, escopo)
    except ImportValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.get("/api/acompanhamento/resumo-unidades")
def get_unit_performance_summary(
    inicio: str | None = None,
    fim: str | None = None,
    base_calculo: str | None = None,
    escopo: str | None = None,
) -> dict:
    try:
        return unit_performance_summary(inicio, fim, base_calculo, escopo)
    except ImportValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.get("/api/acompanhamento/desempenho-produtos-foco")
def get_focus_product_agency_performance(
    inicio: str | None = None,
    fim: str | None = None,
    base_calculo: str | None = None,
) -> dict:
    try:
        return focus_product_agency_performance(inicio, fim, base_calculo)
    except ImportValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.get("/api/acompanhamento/agencias")
def get_agency_accumulated_production(
    inicio: str | None = None,
    fim: str | None = None,
    base_calculo: str | None = None,
) -> dict:
    try:
        return agency_accumulated_production(inicio, fim, base_calculo)
    except ImportValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.get("/api/acompanhamento/estudo-evolucao")
def get_product_evolution_study(
    pa: str | None = None,
    produto: str | None = None,
) -> dict:
    try:
        return product_evolution_study(pa, produto)
    except ImportValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
