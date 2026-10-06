from __future__ import annotations

from collections.abc import Mapping
from pathlib import Path

import jwt
from jwt import ExpiredSignatureError, InvalidTokenError

from app.config import PROJECT_ROOT, environment_value
from utils.text import clean_text


def _environment_name() -> str:
    return (
        environment_value("ENVIRONMENT")
        or environment_value("ENVIRIONMENT")
    ).casefold()


def _jwt_algorithms(default: str) -> list[str]:
    configured = environment_value("JWT_ALGORITHMS") or environment_value(
        "JWT_ALGORITHM", default
    )
    algorithms = [item.strip() for item in configured.split(",") if item.strip()]
    return algorithms or ["HS256"]


def _jwt_leeway() -> int:
    try:
        return max(0, int(environment_value("JWT_LEEWAY_SECONDS", "0")))
    except ValueError:
        return 0


def _claim(payload: Mapping[str, object], *names: str) -> object | None:
    for name in names:
        value = payload.get(name)
        if value is not None and value != "":
            return value
    return None


def is_admin_profile(profile: object | None) -> bool:
    """Retorna se o valor de perfil representa o perfil administrativo."""
    return isinstance(profile, str) and profile.strip().casefold() == "admin"


def _user_from_payload(payload: Mapping[str, object]) -> dict[str, str | None] | str:
    claims: dict[str, object] = dict(payload)
    for nested_name in ("usuario", "user", "user_info"):
        nested = payload.get(nested_name)
        if isinstance(nested, Mapping):
            for key, value in nested.items():
                claims.setdefault(str(key), value)

    subject = clean_text(_claim(claims, "uid", "user_id", "id", "sub"))
    email = clean_text(
        _claim(
            claims,
            "email",
            "mail",
            "preferred_username",
            "upn",
            "login",
        )
    )
    if email is None and subject and "@" in subject:
        email = subject
    if email is None:
        return "O token não contém um e-mail de usuário válido."

    return {
        "email": email,
        "uid": subject or email,
        "nome": clean_text(_claim(claims, "nome", "name", "full_name")) or email,
        "perfil": clean_text(_claim(claims, "perfil", "profile", "role")),
        "cargo": clean_text(_claim(claims, "cargo", "job_title", "title")),
        "departamento": clean_text(_claim(claims, "departamento", "department", "setor")),
        "numero_pa": clean_text(
            _claim(claims, "numero_pa", "numeroPa", "pa_numero", "branch_number")
        ),
        "nome_pa": clean_text(_claim(claims, "nome_pa", "nomePa", "branch_name")),
        "foto_url": clean_text(_claim(claims, "foto_url", "photo_url", "picture", "avatar")),
    }


def verificar_token(tipo: str, token: str) -> dict[str, str | None] | str:
    """Valida um JWT e converte suas claims em uma sessão de usuário."""
    if _environment_name() in {"production", "prod"}:
        public_key_path = environment_value("PUBLIC_KEY_PATH")
        if not public_key_path:
            return "PUBLIC_KEY_PATH não configurado para o ambiente de produção."
        key_path = Path(public_key_path)
        if not key_path.is_absolute():
            key_path = PROJECT_ROOT / key_path
        try:
            verification_key = key_path.read_bytes()
        except OSError:
            return "Não foi possível ler a chave pública configurada em PUBLIC_KEY_PATH."
        if not verification_key.strip():
            return "A chave pública configurada em PUBLIC_KEY_PATH está vazia."
        algorithms = _jwt_algorithms("RS256")
    else:
        verification_key = environment_value("SECRET_KEY")
        if not verification_key:
            return "SECRET_KEY não configurada para validar o token."
        algorithms = _jwt_algorithms("HS256")

    try:
        payload = jwt.decode(
            token,
            verification_key,
            algorithms=algorithms,
            leeway=_jwt_leeway(),
        )
    except ExpiredSignatureError:
        return "O token expirou."
    except InvalidTokenError:
        return "Token JWT inválido."

    if not isinstance(payload, dict):
        return "O conteúdo do token JWT é inválido."

    token_type = clean_text(_claim(payload, "tipo", "type", "token_type"))
    if token_type is not None and token_type.casefold() != tipo.casefold():
        return "O tipo do token não é válido para login."

    return _user_from_payload(payload)
