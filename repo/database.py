"""Fachada pública do repositório PostgreSQL.

As operações foram separadas por responsabilidade, mantendo este módulo como
ponto único de compatibilidade para os consumidores existentes.
"""

from repo.database_core import (
    ALL_COLUMNS,
    DatabaseConfigurationError,
    DatabaseStorageError,
    initialize_database,
)
from repo.database_data import (
    load_period_data,
    load_product_data,
    period_exists,
    replace_period_data,
)
from repo.database_logs import (
    drop_storage,
    load_log_events,
    save_log_event,
    storage_status,
)
from repo.database_pending import (
    count_pending_imports,
    delete_pending_import,
    load_pending_import,
    save_pending_import,
)

__all__ = [
    "ALL_COLUMNS",
    "DatabaseConfigurationError",
    "DatabaseStorageError",
    "count_pending_imports",
    "delete_pending_import",
    "drop_storage",
    "initialize_database",
    "load_log_events",
    "load_pending_import",
    "load_period_data",
    "load_product_data",
    "period_exists",
    "replace_period_data",
    "save_log_event",
    "save_pending_import",
    "storage_status",
]
