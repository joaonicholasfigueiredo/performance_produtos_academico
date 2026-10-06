from __future__ import annotations

import secrets
import sys
from pathlib import Path
import token

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse, Response
from fastapi.staticfiles import StaticFiles
from numpy import rint
from starlette.middleware.sessions import SessionMiddleware

from app.auth import is_admin_profile, verificar_token
from app.config import MAX_UPLOAD_BYTES, TEMPLATES_DIR, VIEWS_DIR, environment_value
from services.analytics import (
    accumulated_production,
    agency_accumulated_production,
    available_periods,
    monthly_product_evolution,
    unit_performance_summary,
)
from services.audit import query_update_logs
from repo.database import (
    DatabaseConfigurationError,
    DatabaseStorageError,
    initialize_database,
)
from services.exporter import export_agency_cards_pdf, export_base, export_tracking_table
from services.importer import (
    ImportValidationError,
    analyze_upload,
    base_status,
    cancel_import,
    confirm_import,
    wipe_base,
)


def _normalise_root_path(value: object) -> str:
    configured = str(value or "").strip()
    if not configured or configured == "/":
        return ""
    return "/" + configured.strip("/")


_configured_root_path = environment_value("ROOT_PATH")
if not _configured_root_path and environment_value("ENVIRONMENT").casefold() in {
    "production",
    "prod",
}:
    _configured_root_path = "/performance_produtos"


app = FastAPI(
    title="Acompanhamento de Produtos",
    version="0.1.0",
    docs_url="/api/docs",
    redoc_url=None,
)

app.mount("/static", StaticFiles(directory=VIEWS_DIR), name="static")

@app.middleware("http")
async def normalise_proxy_path(request: Request, call_next):
    configured_root = _configured_root_path
    scope_root = _normalise_root_path(request.scope.get("root_path"))
    path = str(request.scope.get("path") or "/")
    if configured_root and not scope_root and (path == configured_root or path.startswith(configured_root + "/")):
        relative_path = path[len(configured_root):] or "/"
        request.scope["path"] = relative_path
        if request.scope.get("raw_path"):
            request.scope["raw_path"] = relative_path.encode("utf-8")
    elif configured_root and scope_root == configured_root and not (path == configured_root or path.startswith(configured_root + "/")):
        request.scope["root_path"] = ""
    return await call_next(request)


_SESSION_USER_KEY = "usuario"
_SESSION_SECRET = (
    environment_value("SESSION_SECRET_KEY")
    or environment_value("SECRET_KEY")
    or secrets.token_urlsafe(32)
)
_SESSION_MAX_AGE = 8 * 60 * 60
try:
    _SESSION_MAX_AGE = max(300, int(environment_value("SESSION_MAX_AGE", str(_SESSION_MAX_AGE))))
except ValueError:
    pass


def _root_path(request: Request) -> str:
    return _normalise_root_path(
        request.scope.get("root_path") or environment_value("ROOT_PATH") or _configured_root_path
    )


def _request_path(request: Request) -> str:
    path = str(request.scope.get("path") or request.url.path).rstrip("/") or "/"
    root_path = _root_path(request)
    if root_path and path == root_path:
        return "/"
    if root_path and path.startswith(root_path + "/"):
        return path[len(root_path):] or "/"
    return path


def _login_path(request: Request) -> str:
    return f"{_root_path(request)}/login" or "/login"


def _post_login_redirect_path(request: Request) -> str:
    candidate = (request.query_params.get("next") or "").strip()
    if candidate.startswith("/") and not candidate.startswith("//"):
        return candidate
    return _root_path(request) or "/"


def _development_login_bypass_enabled() -> bool:
    environment = (
        environment_value("ENVIRONMENT")
        or environment_value("ENVIRIONMENT")
    ).casefold()
    return environment == "development" and "--development" in sys.argv[1:]


def _store_user_session(request: Request, usuario: dict[str, object]) -> None:
    request.session.clear()
    request.session[_SESSION_USER_KEY] = {
        field: usuario.get(field)
        for field in (
            "email",
            "uid",
            "nome",
            "perfil",
            "cargo",
            "departamento",
            "numero_pa",
            "nome_pa",
            "foto_url",
        )
    }


def _session_user(request: Request) -> dict[str, object] | None:
    usuario = request.session.get(_SESSION_USER_KEY)
    return usuario if isinstance(usuario, dict) else None


def _require_admin(request: Request) -> dict[str, object]:
    usuario = _session_user(request)
    if usuario is None:
        raise HTTPException(status_code=401, detail="Autenticação necessária.")
    if not is_admin_profile(usuario.get("perfil")):
        raise HTTPException(
            status_code=403,
            detail="Acesso permitido somente para o perfil admin.",
        )
    return usuario


def _clean_token(value: object) -> str | None:
    if isinstance(value, str):
        token = value.strip()
        return token or None
    return None


def _token_from_mapping(value: object) -> str | None:
    if not isinstance(value, dict):
        return _clean_token(value)
    for field in ("token", "access_token", "jwt"):
        token = _clean_token(value.get(field))
        if token:
            return token
    return None


async def _extract_login_token(request: Request) -> str | None:
    content_type = request.headers.get("content-type", "").lower()

    if "application/x-www-form-urlencoded" in content_type or "multipart/form-data" in content_type:
        try:
            form = await request.form()
        except (RuntimeError, ValueError):
            form = None
        if form is not None:
            token = _token_from_mapping(dict(form))
            if token:
                return token
    elif "application/json" in content_type:
        try:
            token = _token_from_mapping(await request.json())
        except (ValueError, UnicodeDecodeError):
            token = None
        if token:
            return token
    elif content_type.startswith("text/plain"):
        token = _clean_token((await request.body()).decode("utf-8", errors="ignore"))
        if token:
            return token

    for field in ("token", "access_token", "jwt"):
        token = _clean_token(request.query_params.get(field))
        if token:
            return token

    authorization = request.headers.get("authorization", "")
    scheme, _, credentials = authorization.partition(" ")
    if scheme.casefold() == "bearer":
        return _clean_token(credentials)
    return None


@app.middleware("http")
async def require_authenticated_user(request: Request, call_next):
    path = _request_path(request)
    public = (
        path in {"/login", "/logout"}
        or path == "/static"
        or path.startswith("/static/")
    )
    if public or _session_user(request) is not None:
        return await call_next(request)

    if path.startswith("/api/"):
        return JSONResponse(
            {"detail": "Autenticação necessária."},
            status_code=401,
            headers={"Location": _login_path(request)},
        )
    return RedirectResponse(url=_login_path(request), status_code=303)


app.add_middleware(
    SessionMiddleware,
    secret_key=_SESSION_SECRET,
    session_cookie=environment_value(
        "SESSION_COOKIE_NAME", "acompanhamento_produtos_session"
    ),
    max_age=_SESSION_MAX_AGE,
    same_site="lax",
    https_only=environment_value("SESSION_COOKIE_SECURE", "0").casefold()
    in {"1", "true", "yes", "on"},
)


@app.on_event("startup")
def startup() -> None:
    initialize_database()



# Importa os módulos de rotas depois de criar a aplicação e seus middlewares.
# Os decoradores desses módulos registram os endpoints na instância compartilhada.
from app.routes import admin, analytics, auth, exports, imports
