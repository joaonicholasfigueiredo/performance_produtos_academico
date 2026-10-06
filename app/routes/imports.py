"""Rotas de análise e confirmação de importações."""

from __future__ import annotations

from pathlib import Path

from fastapi import File, Form, HTTPException, Request, UploadFile

from app.config import MAX_UPLOAD_BYTES
from app.core import _require_admin, app
from services.importer import (
    ImportValidationError,
    analyze_upload,
    cancel_import,
    confirm_import,
)


@app.post("/api/importacoes/analisar")
async def analyze(request: Request, file: UploadFile = File(...)) -> dict:
    _require_admin(request)
    file_name = Path(file.filename or "").name
    if not file_name.lower().endswith(".xlsx"):
        raise HTTPException(status_code=400, detail="Selecione um arquivo no formato .xlsx.")

    contents = await file.read(MAX_UPLOAD_BYTES + 1)
    await file.close()
    if len(contents) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="O arquivo excede o limite de 50 MB.")
    if not contents:
        raise HTTPException(status_code=400, detail="O arquivo selecionado está vazio.")

    try:
        result = analyze_upload(file_name, contents)
    except ImportValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    return {
        "token": result.token,
        "file_name": result.file_name,
        "period_iso": result.period_iso,
        "period_label": result.period_label,
        "rows": result.rows,
        "blank_values_filled": result.blank_values_filled,
        "text_numbers_converted": result.text_numbers_converted,
        "preview": result.preview,
        "period_already_exists": result.period_already_exists,
    }


@app.post("/api/importacoes/confirmar")
def confirm(request: Request, token: str = Form(...), file_name: str = Form(...)) -> dict:
    _require_admin(request)
    try:
        return confirm_import(token, file_name)
    except ImportValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.post("/api/importacoes/cancelar")
def cancel(request: Request, token: str = Form(...)) -> dict:
    _require_admin(request)
    try:
        cancel_import(token)
    except ImportValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return {"cancelled": True}
