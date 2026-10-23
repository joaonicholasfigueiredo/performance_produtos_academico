"""Experimento C: HTTP e serviços reais, com fronteiras PostgreSQL simuladas.

Executar somente este módulo, com PERFORMANCE_TEST_POSTGRES=0.
Não usa TestClient nem gerenciador de lifespan: ASGITransport envia apenas HTTP.
"""

import asyncio
from datetime import datetime, timedelta, timezone
from io import BytesIO
import os
from unittest.mock import Mock

import httpx
import jwt
from openpyxl import Workbook
import psycopg
import pytest


_JWT_SECRET = "experimento-c-chave-sintetica-exclusiva-para-testes"
_ENDPOINT = "/api/importacoes/analisar"
_XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


@pytest.fixture
def isolated_app(monkeypatch):
    # O conftest pai instala seu guard antes da coleta. Não autorizar sessões DB.
    assert os.getenv("PERFORMANCE_TEST_POSTGRES") != "1"
    from repo import postgres_isolation

    assert postgres_isolation.active()
    assert postgres_isolation._settings is None

    connection_attempt = Mock(
        name="postgresql_connection_sentinel",
        side_effect=AssertionError("Tentativa de conexão PostgreSQL no experimento C"),
    )
    startup_attempt = Mock(
        name="startup_persistence_sentinel",
        side_effect=AssertionError("Startup com persistência não autorizado"),
    )
    # Antes de importar a aplicação, cobrir entradas síncronas, assíncronas e
    # o alias bruto que o isolamento guarda para operações administrativas.
    monkeypatch.setattr(psycopg, "connect", connection_attempt)
    monkeypatch.setattr(psycopg.Connection, "connect", connection_attempt)
    monkeypatch.setattr(psycopg.AsyncConnection, "connect", connection_attempt)
    monkeypatch.setattr(postgres_isolation, "_RAW_CONNECT", connection_attempt)

    monkeypatch.setenv("ENVIRONMENT", "test")
    monkeypatch.setenv("SECRET_KEY", _JWT_SECRET)
    monkeypatch.setenv("JWT_ALGORITHMS", "HS256")
    monkeypatch.setenv("JWT_LEEWAY_SECONDS", "0")
    monkeypatch.setenv("SESSION_COOKIE_SECURE", "0")
    monkeypatch.setenv("ROOT_PATH", "/")

    persistence = {}
    try:
        from repo import database, database_core

        from app import core

        monkeypatch.setattr(database, "initialize_database", startup_attempt)
        monkeypatch.setattr(database_core, "initialize_database", startup_attempt)
        monkeypatch.setattr(core, "initialize_database", startup_attempt)
        # Patches na fachada efetivamente usada por importer e services.units.
        for name, result in (
            ("validate_origins", None),
            ("load_units", []),
            ("period_exists", False),
            ("save_pending_import", None),
        ):
            dependency = Mock(spec=getattr(database, name), return_value=result)
            monkeypatch.setattr(database, name, dependency)
            persistence[name] = dependency

        yield core.app, persistence
    finally:
        # Mesmo uma tentativa capturada pelo código da aplicação reprova o teste.
        connection_attempt.assert_not_called()
        startup_attempt.assert_not_called()


def _xlsx(*, duplicate=False, invalid_number=False):
    from app.config import EXPECTED_COLUMNS, NUMERIC_COLUMNS, PERIOD_COLUMN

    row = {column: 100.0 for column in NUMERIC_COLUMNS}
    row.update(
        CENTRAL="01", COOP="0001", PA="01", PRODUTO="PRODUTO_TESTE",
        ID_PRODUTO="produto-c-01",
    )
    row[PERIOD_COLUMN] = "10/2026"
    if invalid_number:
        row["META_MENSAL"] = "numero-invalido-c"

    workbook = Workbook()
    sheet = workbook.active
    sheet.append(EXPECTED_COLUMNS)
    sheet.append([row[column] for column in EXPECTED_COLUMNS])
    if duplicate:
        # Medida diferente: duplicidade é da chave natural, não da linha inteira.
        repeated = {**row, "PRODUCAO_MENSAL": 125.0}
        sheet.append([repeated[column] for column in EXPECTED_COLUMNS])
    with BytesIO() as output:
        workbook.save(output)
        contents = output.getvalue()
    workbook.close()
    return contents


async def _login(client, profile):
    token = jwt.encode(
        {
            "sub": "usuario-sintetico-c",
            "email": "experimento-c@example.invalid",
            "perfil": profile,
            "tipo": "login",
            "exp": datetime.now(timezone.utc) + timedelta(minutes=5),
        },
        _JWT_SECRET,
        algorithm="HS256",
    )
    response = await client.post("/login", json={"token": token})
    assert response.status_code == 303
    assert "set-cookie" in response.headers
    # Comprova que o middleware leu a sessão produzida pela autenticação real.
    current_user = await client.get("/api/usuario")
    assert current_user.status_code == 200
    assert current_user.json()["perfil"] == profile
    assert current_user.json()["email"] == "experimento-c@example.invalid"


def _assert_no_persistence(persistence):
    for dependency in persistence.values():
        dependency.assert_not_called()


@pytest.mark.parametrize(
    "invalid_input, expected_detail",
    [
        pytest.param(
            "duplicate",
            "A planilha possui mais de uma linha para a mesma combinação de "
            "CENTRAL, COOP, PA, ID_PRODUTO e MÊS/ANO (2 linhas).",
            id="A-ZS-05-chave-natural-duplicada",
        ),
        pytest.param(
            "number",
            "O valor “numero-invalido-c” não pôde ser convertido em número.",
            id="A-ZS-06-numero-invalido",
        ),
    ],
)
def test_rejeicao_xlsx(isolated_app, invalid_input, expected_detail):
    app, persistence = isolated_app
    contents = _xlsx(
        duplicate=invalid_input == "duplicate",
        invalid_number=invalid_input == "number",
    )

    async def scenario():
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app),
            base_url="http://experimento-c.invalid",
            follow_redirects=False,
        ) as client:
            await _login(client, "admin")
            response = await client.post(
                _ENDPOINT, files={"file": ("experimento-c.xlsx", contents, _XLSX_TYPE)},
            )
            assert response.status_code == 422
            assert response.json() == {"detail": expected_detail}
            _assert_no_persistence(persistence)

    asyncio.run(scenario())


@pytest.mark.parametrize(
    "profile, expected_status, expected_detail",
    [
        pytest.param(
            None, 401, "Autenticação necessária.",
            id="A-ZS-07-sem-autenticacao",
        ),
        pytest.param(
            "consulta", 403, "Acesso permitido somente para o perfil admin.",
            id="A-ZS-08-sem-perfil-admin",
        ),
    ],
)
def test_bloqueio_importacao(isolated_app, profile, expected_status, expected_detail):
    app, persistence = isolated_app
    contents = _xlsx()

    async def scenario():
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app),
            base_url="http://experimento-c.invalid",
            follow_redirects=False,
        ) as client:
            if profile is not None:
                await _login(client, profile)
            response = await client.post(
                _ENDPOINT, files={"file": ("experimento-c.xlsx", contents, _XLSX_TYPE)},
            )
            assert response.status_code == expected_status
            assert response.json() == {"detail": expected_detail}
            if profile is None:
                assert response.headers["location"] == "/login"
            _assert_no_persistence(persistence)

    asyncio.run(scenario())
