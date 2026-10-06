"""Aplicação FastAPI.

A montagem e as rotas ficam separadas em módulos menores; este arquivo mantém
o caminho de importação público usado pelo launcher e pelos servidores ASGI.
"""

from app.core import app

__all__ = ["app"]
