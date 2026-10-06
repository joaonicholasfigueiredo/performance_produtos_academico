import os
import re
import sys
from pathlib import Path


SOURCE_ROOT = Path(__file__).resolve().parent.parent
IS_FROZEN = bool(getattr(sys, "frozen", False))
PROJECT_ROOT = Path(sys.executable).resolve().parent if IS_FROZEN else SOURCE_ROOT
VIEWS_DIR = PROJECT_ROOT / "views"
TEMPLATES_DIR = VIEWS_DIR / "templates"
DATABASE_CONFIG_PATH = PROJECT_ROOT / ".config"
ENV_CONFIG_PATH = PROJECT_ROOT / ".config" / ".env"
ROOT_ENV_CONFIG_PATH = PROJECT_ROOT / ".env"


def read_env_file(path: Path) -> dict[str, str]:
    """Lê um arquivo dotenv simples em UTF-8 ou UTF-16."""
    if not path.is_file():
        return {}

    raw_content = path.read_bytes()
    encoding = "utf-16" if raw_content.startswith((b"\xff\xfe", b"\xfe\xff")) else "utf-8-sig"
    try:
        content = raw_content.decode(encoding)
    except UnicodeDecodeError:
        return {}

    values: dict[str, str] = {}
    for raw_line in content.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[7:].lstrip()
        key, separator, value = line.partition("=")
        key = key.strip()
        if not separator or not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", key):
            continue
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
            value = value[1:-1]
        values[key] = value
    return values


def environment_value(name: str, default: str = "") -> str:
    """Obtém uma configuração do ambiente ou dos arquivos dotenv do projeto."""
    process_value = os.getenv(name)
    if process_value is not None and process_value.strip():
        return process_value.strip()

    file_values: dict[str, str] = {}
    for path in (DATABASE_CONFIG_PATH, ROOT_ENV_CONFIG_PATH, ENV_CONFIG_PATH):
        file_values.update(read_env_file(path))
    return file_values.get(name, default).strip()

MAX_UPLOAD_BYTES = 50 * 1024 * 1024

EXPECTED_COLUMNS = [
    "CENTRAL",
    "COOP",
    "PA",
    "PRODUTO",
    "ID_PRODUTO",
    "META_MENSAL",
    "PRODUCAO_MENSAL",
    "META_TRIMESTRAL",
    "PRODUCAO_TRIMESTRAL",
    "META_SEMESTRAL",
    "PRODUCAO_SEMESTRAL",
    "META_ANUAL",
    "PRODUCAO_ANUAL",
    "META_NO_PERIODO",
    "PRODUCAO_NO_PERIODO",
    "MÊS/ANO",
]

NUMERIC_COLUMNS = [
    "META_MENSAL",
    "PRODUCAO_MENSAL",
    "META_TRIMESTRAL",
    "PRODUCAO_TRIMESTRAL",
    "META_SEMESTRAL",
    "PRODUCAO_SEMESTRAL",
    "META_ANUAL",
    "PRODUCAO_ANUAL",
    "META_NO_PERIODO",
    "PRODUCAO_NO_PERIODO",
]

TEXT_COLUMNS = ["CENTRAL", "COOP", "PA", "PRODUTO", "ID_PRODUTO"]
PERIOD_COLUMN = "MÊS/ANO"
NATURAL_KEY_COLUMNS = ["CENTRAL", "COOP", "PA", "ID_PRODUTO", PERIOD_COLUMN]

BALANCE_INCREMENT_PRODUCTS = {
    "CREDITO_PESSOAL",
    "CREDITO_RURAL",
    "CREDITO_PJ",
}
