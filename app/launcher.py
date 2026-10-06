from __future__ import annotations

import configparser
import os
import socket
import threading
import webbrowser
from dataclasses import dataclass
from pathlib import Path

import uvicorn

from app.config import DATABASE_CONFIG_PATH, environment_value


@dataclass(frozen=True)
class ServerSettings:
    host: str
    port: int


def load_server_settings(config_path: Path = DATABASE_CONFIG_PATH) -> ServerSettings:
    parser = configparser.ConfigParser(interpolation=None)
    if config_path.is_file():
        parser.read(config_path, encoding="utf-8")

    configured_host = parser.get("server", "host", fallback="127.0.0.1").strip()
    host = os.getenv("ACOMPANHAMENTO_HOST")
    if host is None and config_path == DATABASE_CONFIG_PATH:
        host = environment_value("ACOMPANHAMENTO_HOST") or environment_value("HOST")
    host = (host or configured_host).strip()
    port_text = os.getenv("ACOMPANHAMENTO_PORT")
    if port_text is None and config_path == DATABASE_CONFIG_PATH:
        port_text = environment_value("ACOMPANHAMENTO_PORT") or environment_value("PORT")
    port_text = (port_text or parser.get("server", "port", fallback="8000")).strip()
    if not host:
        raise ValueError("O host do servidor não pode ficar vazio.")
    try:
        port = int(port_text)
    except ValueError as exc:
        raise ValueError("A porta do servidor deve ser um número inteiro.") from exc
    if not 1 <= port <= 65535:
        raise ValueError("A porta do servidor deve estar entre 1 e 65535.")
    return ServerSettings(host=host, port=port)


def _local_network_address(port: int) -> str | None:
    try:
        addresses = socket.gethostbyname_ex(socket.gethostname())[2]
    except OSError:
        return None
    address = next(
        (value for value in addresses if not value.startswith(("127.", "169.254."))),
        None,
    )
    return f"http://{address}:{port}" if address else None


def _open_browser(port: int) -> None:
    """Abre a interface local depois que o servidor tiver tempo para iniciar."""
    if os.getenv("ACOMPANHAMENTO_OPEN_BROWSER", "1").strip().lower() in {
        "0",
        "false",
        "nao",
        "não",
    }:
        return
    timer = threading.Timer(1.2, webbrowser.open, args=(f"http://127.0.0.1:{port}",))
    timer.daemon = True
    timer.start()


def main() -> None:
    from app.main import app

    settings = load_server_settings()
    print(f"Acesso nesta máquina: http://127.0.0.1:{settings.port}")
    if settings.host == "127.0.0.1":
        network_address = _local_network_address(settings.port)
        print(f"Acesso pela rede local: {network_address or 'use o IP desta máquina'}")
    else:
        print(f"Servidor configurado em: http://{settings.host}:{settings.port}")
    print("Pressione Ctrl+C para encerrar.")
    _open_browser(settings.port)
    uvicorn.run(
        app,
        host=settings.host,
        port=settings.port,
        reload=False,
    )


if __name__ == "__main__":
    main()
