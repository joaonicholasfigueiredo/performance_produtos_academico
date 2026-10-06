"""Fachada pública dos serviços de análise.

A implementação foi separada por responsabilidade para manter cada módulo pequeno.
"""

from services.analytics_common import (
    ACCUMULATED_FIELD_OPTIONS,
    AGENCY_CARD_EXCLUDED_UNITS,
    FOCUS_PRODUCTS,
    FOCUS_PRODUCTS_PER_MONTH,
    GENERAL_PRODUCTS_PER_MONTH,
    PeriodRange,
    SEGURO_VIDA_SOURCE,
    SEGURO_VIDA_SOURCE_UNIT,
    SEGURO_VIDA_TARGET,
    SEGURO_VIDA_TARGET_UNIT,
    UNIT_NAMES,
    VENDA_NOVA_PA,
    VENDA_NOVA_SINGULAR,
    _apply_business_allocations,
    _filter_product_scope,
    _filter_venda_nova_by_unit,
    _load_base,
    _period_label,
    _parse_range,
    _production_title,
    _unit_code,
    _unit_label,
    _unit_name,
    available_periods,
)
from services.analytics_agencies import (
    agency_accumulated_production,
    focus_product_agency_performance,
)
from services.analytics_production import accumulated_production
from services.analytics_evolution import product_evolution_study
from services.analytics_summary import (
    monthly_product_evolution,
    unit_performance_summary,
)

__all__ = [
    "PeriodRange",
    "accumulated_production",
    "agency_accumulated_production",
    "available_periods",
    "focus_product_agency_performance",
    "monthly_product_evolution",
    "product_evolution_study",
    "unit_performance_summary",
]
