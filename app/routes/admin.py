"""Rotas administrativas e página principal."""

from __future__ import annotations

from fastapi import Form, HTTPException, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates

from app.core import _require_admin, _root_path, app
from app.config import TEMPLATES_DIR
from repo.database import DatabaseConfigurationError, DatabaseStorageError
from services.audit import query_update_logs
from services.importer import ImportValidationError, base_status, wipe_base

templates = Jinja2Templates(directory=str(TEMPLATES_DIR))


@app.get("/", include_in_schema=False)
def index(request: Request) -> HTMLResponse:
    return templates.TemplateResponse(
        request=request,
        name="index.html",
        context={"app_root_path": _root_path(request)},
    )


@app.get("/api/base/status")
def get_base_status(request: Request) -> dict:
    _require_admin(request)
    try:
        return base_status()
    except ImportValidationError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.get("/api/logs")
def get_update_logs(request: Request) -> dict:
    _require_admin(request)
    try:
        return query_update_logs()
    except (DatabaseConfigurationError, DatabaseStorageError) as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.post("/api/base/limpar")
def clear_base(request: Request, confirmacao: str = Form(...)) -> dict:
    _require_admin(request)
    if confirmacao != "APAGAR_TODA_BASE":
        raise HTTPException(
            status_code=400,
            detail="A confirmação para limpar a base é inválida.",
        )
    try:
        return wipe_base()
    except ImportValidationError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
