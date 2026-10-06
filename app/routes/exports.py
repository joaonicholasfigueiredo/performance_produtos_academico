"""Rotas de download dos relatórios."""

from __future__ import annotations

from fastapi import HTTPException, Request
from fastapi.responses import Response

from app.core import _require_admin, app
from services.exporter import (
    export_agency_cards_pdf,
    export_base,
    export_tracking_table,
)
from services.importer import ImportValidationError


def _download_response(content: bytes, file_name: str, media_type: str) -> Response:
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{file_name}"'},
    )


@app.get("/api/exportacoes/base")
def download_base(request: Request) -> Response:
    _require_admin(request)
    try:
        content, file_name = export_base()
    except ImportValidationError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return _download_response(
        content,
        file_name,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


@app.get("/api/exportacoes/acompanhamento")
def download_tracking_table(
    visao: str = "SINTETICO",
    inicio: str | None = None,
    fim: str | None = None,
    pa: str | None = None,
    base_calculo: str | None = None,
    escopo: str | None = None,
    produtos: str | None = None,
    busca: str | None = None,
) -> Response:
    product_names = [name for name in str(produtos or "").split("|") if name]
    try:
        content, file_name = export_tracking_table(
            visao,
            inicio,
            fim,
            pa,
            base_calculo,
            escopo,
            product_names,
            busca,
        )
    except ImportValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return _download_response(
        content,
        file_name,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


@app.get("/api/exportacoes/acompanhamento-agencias")
def download_agency_cards_pdf(
    inicio: str | None = None,
    fim: str | None = None,
    base_calculo: str | None = None,
) -> Response:
    try:
        content, file_name = export_agency_cards_pdf(inicio, fim, base_calculo)
    except ImportValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return _download_response(content, file_name, "application/pdf")
