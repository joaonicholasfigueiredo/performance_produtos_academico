from __future__ import annotations


def clean_text(value: object | None) -> str | None:
    """Converte valores simples em texto limpo, retornando None para vazios."""
    if value is None or isinstance(value, (dict, list, tuple, set)):
        return None
    text = str(value).strip()
    return text or None
