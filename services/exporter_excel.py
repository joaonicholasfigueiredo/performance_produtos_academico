"""Geração das planilhas de acompanhamento."""

from __future__ import annotations

from datetime import datetime
from io import BytesIO
from zoneinfo import ZoneInfo

import pandas as pd
from openpyxl.styles import Alignment, Font
from openpyxl.utils import get_column_letter

from app.config import EXPECTED_COLUMNS, NUMERIC_COLUMNS, PERIOD_COLUMN
from repo import database
from services.analytics import (
    accumulated_production,
    monthly_product_evolution,
    unit_performance_summary,
)
from services.exporter_excel_common import (
    _HEADER_FILL,
    _consolidated_frame,
    _monthly_volume_frames,
    _period_heading,
    _product_monthly_score_frame,
    _range_heading,
    _style_report_sheet,
    _unit_monthly_score_frame,
    _write_report_section,
)
from services.importer import ImportValidationError

def export_tracking_table(
    view: str,
    start: str | None,
    end: str | None,
    pa: str | None,
    calculation_basis: str | None,
    product_scope: str | None,
    product_names: list[str] | None = None,
    search: str | None = None,
) -> tuple[str, str]:
    # A exportação é um relatório gerencial único. Os argumentos antigos são
    # mantidos para preservar a compatibilidade do endpoint com o front-end.
    _ = (view, pa, calculation_basis, product_scope, product_names, search)
    monthly_general = monthly_product_evolution(start, end, "SINGULAR", "GERAL")
    period_general = accumulated_production(
        start, end, "SINGULAR", "NO_PERIODO", "GERAL"
    )
    annual_general = accumulated_production(
        start, end, "SINGULAR", "ANUAL", "GERAL"
    )
    unit_general = unit_performance_summary(
        start, end, "NO_PERIODO", "GERAL"
    )
    monthly_focus = monthly_product_evolution(start, end, "SINGULAR", "FOCO")
    unit_focus = unit_performance_summary(
        start, end, "NO_PERIODO", "FOCO"
    )

    monthly_frames = _monthly_volume_frames(monthly_general)
    period_frame = _consolidated_frame(period_general)
    annual_frame = _consolidated_frame(annual_general, annual=True)
    general_product_scores = _product_monthly_score_frame(monthly_general)
    general_unit_scores = _unit_monthly_score_frame(unit_general)
    focus_product_scores = _product_monthly_score_frame(monthly_focus)
    focus_unit_scores = _unit_monthly_score_frame(unit_focus)

    generated_at = datetime.now(ZoneInfo("America/Sao_Paulo"))
    timestamp = generated_at.strftime("%Y%m%d_%H%M%S_%f")
    generated_label = generated_at.strftime("%d/%m/%Y às %H:%M")
    period_label = _range_heading(monthly_general)
    period_slug = f"{monthly_general['range']['start']}_a_{monthly_general['range']['end']}"
    file_name = f"relatorio_acompanhamento_{period_slug}_{timestamp}.xlsx"
    output = BytesIO()

    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        row = 4
        for title, frame in monthly_frames:
            row = _write_report_section(
                writer,
                "Produção Mensal",
                title,
                frame,
                row,
                "volume",
            )

        row = _write_report_section(
            writer,
            "Resumo Consolidado",
            f"PRODUÇÃO ACUMULADA — {_range_heading(period_general)}",
            period_frame,
            4,
            "volume",
        )
        reference_period = annual_general["calculation"].get("reference_period")
        annual_title = (
            f"PRODUÇÃO ANUAL — ÚLTIMA BASE DISPONÍVEL: {_period_heading(reference_period)}"
            if reference_period
            else "PRODUÇÃO ANUAL"
        )
        _write_report_section(
            writer,
            "Resumo Consolidado",
            annual_title,
            annual_frame,
            row,
            "volume",
        )

        row = _write_report_section(
            writer,
            "Desempenho 19 Produtos",
            "DESEMPENHO 19 PRODUTOS — SINGULAR",
            general_product_scores,
            4,
            "score",
        )
        _write_report_section(
            writer,
            "Desempenho 19 Produtos",
            "DESEMPENHO 19 PRODUTOS — AGÊNCIAS",
            general_unit_scores,
            row,
            "score",
        )

        row = _write_report_section(
            writer,
            "Desempenho 7 Produtos",
            "DESEMPENHO 7 PRODUTOS — SINGULAR",
            focus_product_scores,
            4,
            "score",
        )
        _write_report_section(
            writer,
            "Desempenho 7 Produtos",
            "DESEMPENHO 7 PRODUTOS — AGÊNCIAS",
            focus_unit_scores,
            row,
            "score",
        )

        sheet_styles = {
            "Produção Mensal": (
                "PRODUÇÃO MENSAL POR PRODUTO",
                "D9F16D",
            ),
            "Resumo Consolidado": (
                "RESUMO EXECUTIVO CONSOLIDADO",
                "22A47E",
            ),
            "Desempenho 19 Produtos": (
                "DESEMPENHO — 19 PRODUTOS",
                "0D725A",
            ),
            "Desempenho 7 Produtos": (
                "DESEMPENHO — 7 PRODUTOS FOCO",
                "D78A2F",
            ),
        }
        for sheet in writer.book.worksheets:
            report_title, tab_color = sheet_styles[sheet.title]
            _style_report_sheet(
                sheet,
                report_title,
                period_label,
                generated_label,
                tab_color,
            )

    return output.getvalue(), file_name


def export_base() -> tuple[str, str]:
    try:
        frame = database.load_product_data(EXPECTED_COLUMNS)
    except (database.DatabaseConfigurationError, database.DatabaseStorageError) as exc:
        raise ImportValidationError(str(exc)) from exc
    if frame.empty:
        raise ImportValidationError("Ainda não existem dados importados para exportar.")

    timestamp = datetime.now(ZoneInfo("America/Sao_Paulo")).strftime("%Y%m%d_%H%M%S")
    file_name = f"acompanhamento_produtos_{timestamp}.xlsx"
    output = BytesIO()

    export_frame = frame[EXPECTED_COLUMNS].copy()
    export_frame[PERIOD_COLUMN] = pd.to_datetime(export_frame[PERIOD_COLUMN])

    with pd.ExcelWriter(output, engine="openpyxl", datetime_format="MM/YYYY") as writer:
        export_frame.to_excel(writer, sheet_name="Base acumulada", index=False)
        sheet = writer.sheets["Base acumulada"]
        sheet.freeze_panes = "A2"
        sheet.auto_filter.ref = sheet.dimensions

        for cell in sheet[1]:
            cell.fill = _HEADER_FILL
            cell.font = Font(color="FFFFFF", bold=True)
            cell.alignment = Alignment(horizontal="center")

        for index, column in enumerate(export_frame.columns, start=1):
            width = min(
                max(len(str(column)) + 2, export_frame[column].astype(str).str.len().max() + 2),
                35,
            )
            sheet.column_dimensions[get_column_letter(index)].width = width
            if column in NUMERIC_COLUMNS:
                for cell in sheet[get_column_letter(index)][1:]:
                    cell.number_format = "#,##0.00"
            elif column == PERIOD_COLUMN:
                for cell in sheet[get_column_letter(index)][1:]:
                    cell.number_format = "mm/yyyy"

    return output.getvalue(), file_name
