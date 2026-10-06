from __future__ import annotations

from datetime import datetime
from io import BytesIO
from zoneinfo import ZoneInfo

import pandas as pd
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A3, landscape
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen.canvas import Canvas

from services.analytics import agency_accumulated_production
from services.importer import ImportValidationError


def _is_unit_product(product: object) -> bool:
    return str(product).upper().startswith("PREVIDENCIA")


def _humanize_product(product: object) -> str:
    return str(product).replace("_", " ").title()
def _pdf_pt_br_number(value: float, decimals: int = 0) -> str:
    formatted = f"{float(value):,.{decimals}f}"
    return formatted.translate(str.maketrans({",": ".", ".": ","}))


def _pdf_card_value(product: str, value: float) -> str:
    numeric_value = float(value)
    number = _pdf_pt_br_number(abs(numeric_value))
    if _is_unit_product(product):
        return f"-{number}" if numeric_value < 0 else number
    return f"-R$ {number}" if numeric_value < 0 else f"R$ {number}"


def _pdf_fit_text(text: str, width: float, size: float, font: str = "Helvetica") -> str:
    if stringWidth(text, font, size) <= width:
        return text
    suffix = "..."
    candidate = text
    while candidate and stringWidth(candidate + suffix, font, size) > width:
        candidate = candidate[:-1]
    return candidate.rstrip() + suffix


def _draw_agency_pdf_header(
    pdf: Canvas,
    page_width: float,
    page_height: float,
    period_label: str,
    generated_label: str,
) -> None:
    pdf.setFillColor(HexColor("#003641"))
    pdf.rect(0, page_height - 76, page_width, 76, fill=1, stroke=0)
    pdf.setFillColor(HexColor("#C9D200"))
    pdf.rect(0, page_height - 78, page_width, 3, fill=1, stroke=0)
    pdf.setFillColor(HexColor("#C9D200"))
    pdf.setFont("Helvetica-Bold", 7)
    pdf.drawString(28, page_height - 20, "ACOMPANHAMENTO DE PRODUTOS")
    pdf.setFillColor(HexColor("#FFFFFF"))
    pdf.setFont("Helvetica-Bold", 18)
    pdf.drawString(28, page_height - 43, "ACOMPANHAMENTO AGENCIAS")
    pdf.setFont("Helvetica", 7)
    pdf.setFillColor(HexColor("#C4D8D3"))
    pdf.drawString(28, page_height - 61, f"PERIODO: {period_label.upper()}")
    generated_width = stringWidth(generated_label, "Helvetica", 7)
    pdf.drawString(page_width - 28 - generated_width, page_height - 61, generated_label)


def _draw_agency_card(
    pdf: Canvas,
    unit: dict,
    x: float,
    y: float,
    width: float,
    height: float,
) -> None:
    dark = HexColor("#06473D")
    teal = HexColor("#00AE9D")
    lime = HexColor("#D9F16D")
    line = HexColor("#DCE7E3")
    soft = HexColor("#F5F8F6")
    ink = HexColor("#18302B")
    muted = HexColor("#687B75")
    positive = HexColor("#16834F")
    negative = HexColor("#D43F2F")
    products = unit["products"]
    header_height = 55
    column_header_height = 22
    bottom_padding = 8
    content_height = header_height + column_header_height + bottom_padding + max(len(products), 1) * 27
    if content_height < height:
        y += height - content_height
        height = content_height

    pdf.setFillColor(HexColor("#FFFFFF"))
    pdf.setStrokeColor(line)
    pdf.roundRect(x, y, width, height, 9, fill=1, stroke=1)

    pdf.setFillColor(dark)
    pdf.roundRect(x, y + height - header_height, width, header_height, 9, fill=1, stroke=0)
    pdf.rect(x, y + height - header_height, width, 9, fill=1, stroke=0)

    badge_x = x + 12
    badge_y = y + height - 42
    pdf.setFillColor(lime)
    pdf.roundRect(badge_x, badge_y, 44, 27, 6, fill=1, stroke=0)
    pdf.setFillColor(HexColor("#003641"))
    pdf.setFont("Helvetica-Bold", 8)
    pdf.drawCentredString(badge_x + 22, badge_y + 9, f"PA {unit['code']}")

    pdf.setFillColor(HexColor("#FFFFFF"))
    pdf.setFont("Helvetica-Bold", 10)
    pdf.drawString(x + 66, y + height - 25, _pdf_fit_text(unit["name"], width - 145, 10, "Helvetica-Bold"))
    summary = unit["summary"]
    pdf.setFillColor(HexColor("#BED2CD"))
    pdf.setFont("Helvetica", 6.5)
    pdf.drawString(
        x + 66,
        y + height - 40,
        f"{summary['adherent']} de {summary['with_target']} produto(s) aderente(s)",
    )
    rate = f"{_pdf_pt_br_number(summary['adherence_rate'], 1)}%"
    pdf.setFillColor(lime)
    pdf.setFont("Helvetica-Bold", 10)
    pdf.drawRightString(x + width - 12, y + height - 31, rate)

    table_top = y + height - header_height
    row_height = min(
        27,
        (height - header_height - column_header_height - bottom_padding)
        / max(len(products), 1),
    )
    column_widths = [width * .29, width * .19, width * .20, width * .12, width * .20]
    column_x = [x]
    for column_width in column_widths[:-1]:
        column_x.append(column_x[-1] + column_width)

    pdf.setFillColor(teal)
    pdf.rect(x, table_top - column_header_height, width, column_header_height, fill=1, stroke=0)
    headers = ("PRODUTO", "META", "PRODUCAO", "%", "GAP")
    pdf.setFillColor(HexColor("#003641"))
    pdf.setFont("Helvetica-Bold", 6)
    for index, header in enumerate(headers):
        if index == 0:
            pdf.drawString(column_x[index] + 6, table_top - 14, header)
        else:
            pdf.drawCentredString(column_x[index] + column_widths[index] / 2, table_top - 14, header)

    current_y = table_top - column_header_height
    for row_index, product in enumerate(products):
        current_y -= row_height
        if row_index % 2:
            pdf.setFillColor(soft)
            pdf.rect(x, current_y, width, row_height, fill=1, stroke=0)
        pdf.setStrokeColor(line)
        pdf.line(x, current_y, x + width, current_y)

        product_name = _humanize_product(product["produto"])
        meta = _pdf_card_value(product["produto"], product["meta_acumulada"])
        production = _pdf_card_value(product["produto"], product["producao_acumulada"])
        percentage = product["percentual_atingido"]
        percentage_text = "-" if percentage is None else f"{_pdf_pt_br_number(percentage, 1)}%"
        gap_prefix = "+" if product["gap"] > 0 else ""
        gap = f"{gap_prefix}{_pdf_card_value(product['produto'], product['gap'])}"

        baseline = current_y + max(4, (row_height - 6) / 2)
        pdf.setFillColor(ink)
        pdf.setFont("Helvetica-Bold", 5.8)
        pdf.drawString(
            column_x[0] + 6,
            baseline,
            _pdf_fit_text(product_name, column_widths[0] - 11, 5.8, "Helvetica-Bold"),
        )
        pdf.setFont("Helvetica", 5.5)
        pdf.setFillColor(ink)
        pdf.drawRightString(column_x[1] + column_widths[1] - 5, baseline, meta)
        pdf.setFont("Helvetica-Bold", 5.5)
        pdf.drawRightString(column_x[2] + column_widths[2] - 5, baseline, production)
        if percentage is None:
            pdf.setFillColor(muted)
        else:
            pdf.setFillColor(positive if percentage >= 100 else negative)
        pdf.drawRightString(column_x[3] + column_widths[3] - 5, baseline, percentage_text)
        pdf.setFillColor(positive if product["gap"] >= 0 else negative)
        pdf.drawRightString(column_x[4] + column_widths[4] - 5, baseline, gap)

    pdf.setStrokeColor(line)
    for position in column_x[1:]:
        pdf.line(position, current_y, position, table_top)


def export_agency_cards_pdf(
    start: str | None = None,
    end: str | None = None,
    calculation_basis: str | None = None,
) -> tuple[str, str]:
    data = agency_accumulated_production(start, end, calculation_basis)
    if not data["units"]:
        raise ImportValidationError("Não existem agências para exportar no período selecionado.")

    now = datetime.now(ZoneInfo("America/Sao_Paulo"))
    timestamp = now.strftime("%Y%m%d_%H%M%S")
    file_name = f"acompanhamento_agencias_{timestamp}.pdf"
    output = BytesIO()

    page_width, page_height = landscape(A3)
    pdf = Canvas(output, pagesize=(page_width, page_height), pageCompression=1)
    pdf.setTitle("Acompanhamento Agencias")
    period_label = (
        data["range"]["start_label"]
        if data["range"]["start"] == data["range"]["end"]
        else f"{data['range']['start_label']} a {data['range']['end_label']}"
    )
    if data["calculation"]["value"] == "ANUAL":
        reference_year, reference_month = map(
            int, data["calculation"]["reference_period"].split("-")
        )
        month_names = (
            "JAN", "FEV", "MAR", "ABR", "MAI", "JUN",
            "JUL", "AGO", "SET", "OUT", "NOV", "DEZ",
        )
        period_label = (
            f"ANUAL - POSICAO DE {month_names[reference_month - 1]}/{reference_year}"
        )
    generated_label = f"EMITIDO EM: {now.strftime('%d/%m/%Y - %H:%M')}"
    cards_per_page = 3
    margin = 28
    gap = 12
    card_width = (page_width - margin * 2 - gap * 2) / cards_per_page
    card_y = 35
    card_height = page_height - 125
    total_pages = (len(data["units"]) + cards_per_page - 1) // cards_per_page

    for page_index in range(total_pages):
        _draw_agency_pdf_header(pdf, page_width, page_height, period_label, generated_label)
        page_units = data["units"][
            page_index * cards_per_page:(page_index + 1) * cards_per_page
        ]
        for column, unit in enumerate(page_units):
            card_x = margin + column * (card_width + gap)
            _draw_agency_card(pdf, unit, card_x, card_y, card_width, card_height)
        pdf.setFillColor(HexColor("#687B75"))
        pdf.setFont("Helvetica", 7)
        pdf.drawCentredString(
            page_width / 2,
            16,
            f"Pagina {page_index + 1} de {total_pages}",
        )
        pdf.showPage()

    pdf.save()
    return output.getvalue(), file_name
