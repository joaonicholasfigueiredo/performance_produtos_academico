"""Valida uma conexão de leitura ao PostgreSQL local sem exibir credenciais."""

from __future__ import annotations

import ipaddress
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

import psycopg

from repo.database_core import DatabaseConfigurationError, _read_settings


def main() -> int:
    try:
        connection = _read_settings()["connection"]
        host = str(connection["host"])
        if host != "localhost":
            try:
                is_local = ipaddress.ip_address(host).is_loopback
            except ValueError:
                is_local = False
            if not is_local:
                print("Conexão não executada: PGHOST não é loopback local.")
                return 2
        with psycopg.connect(**connection) as database:
            with database.cursor() as cursor:
                cursor.execute("SELECT 1")
                if cursor.fetchone() != (1,):
                    print("A consulta de validação não retornou o resultado esperado.")
                    return 1
    except (DatabaseConfigurationError, psycopg.Error, OSError, ValueError) as exc:
        print(f"Conexão local não validada: {type(exc).__name__}.")
        return 1
    print("Conexão local validada: SELECT 1 retornou 1.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
