"""Rotas de autenticação e sessão."""

from __future__ import annotations

from fastapi import HTTPException, Request
from fastapi.responses import HTMLResponse, RedirectResponse

from app.core import (
    _development_login_bypass_enabled,
    _login_path,
    _post_login_redirect_path,
    _session_user,
    _store_user_session,
    _extract_login_token,
    app,
)
from app.auth import verificar_token
from app.config import environment_value


@app.api_route("/login", methods=["GET", "POST"])
async def login(request: Request):
    """Autentica por bypass de desenvolvimento ou por token JWT."""
    index_path = _post_login_redirect_path(request)

    if request.method == "GET":
        if not _development_login_bypass_enabled():
            return HTMLResponse("Use POST e envie token para autenticar.", status_code=405)
        if (request.query_params.get("logged_out") or "").strip() == "1":
            return HTMLResponse(
                "Você saiu da sessão. Envie seu token para entrar.",
                status_code=200,
            )

        email = environment_value("ENVIRONMENT_EMAIL") or ""
        _store_user_session(
            request,
            {
                "email": email,
                "uid": "development",
                "nome": environment_value("ENVIRONMENT_NAME") or email or "development",
                "perfil": environment_value("ENVIRONMENT_PROFILE") or None,
                "cargo": environment_value("ENVIRONMENT_ROLE") or None,
                "departamento": environment_value("ENVIRONMENT_DEPARTMENT") or None,
                "numero_pa": environment_value("ENVIRONMENT_NUMERO_PA") or None,
                "nome_pa": environment_value("ENVIRONMENT_NOME_PA") or None,
                "foto_url": environment_value("ENVIRONMENT_PHOTO_URL") or None,
            },
        )
        return RedirectResponse(url=index_path, status_code=303)

    token = await _extract_login_token(request)
    if not token:
        return HTMLResponse(
            "Token ausente. Envie em form, JSON, query string ou Authorization: Bearer.",
            status_code=401,
        )

    usuario = verificar_token(tipo="login", token=token)
    if not isinstance(usuario, dict):
        return HTMLResponse(str(usuario), status_code=401)

    _store_user_session(request, usuario)
    return RedirectResponse(url=index_path, status_code=303)


@app.get("/logout")
async def logout(request: Request):
    request.session.clear()
    if _development_login_bypass_enabled():
        return RedirectResponse(
            url=f"{_login_path(request)}?logged_out=1",
            status_code=303,
        )
    return HTMLResponse(
        "Você saiu da sessão. Envie seu token via POST em /login para entrar novamente.",
        status_code=200,
    )


@app.get("/api/usuario")
def get_current_user(request: Request) -> dict[str, object]:
    """Retorna somente os dados de identificação da sessão autenticada."""
    usuario = _session_user(request)
    if usuario is None:
        raise HTTPException(status_code=401, detail="Autenticação necessária.")
    return {
        field: usuario.get(field)
        for field in (
            "email",
            "nome",
            "perfil",
            "cargo",
            "departamento",
            "numero_pa",
            "nome_pa",
            "foto_url",
        )
    }
