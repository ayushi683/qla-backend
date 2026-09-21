"""
Generates two things once every line item in a case has an approved match:

1. A quotation Word document (.docx) — the actual document format
   Techtrol sends to customers: numbered items (A, B, C...), model number,
   description, terms.
2. A draft outbound email — subject + body text referencing the quotation —
   saved as an OutboundMessage row with send_status="PENDING" (drafted,
   NOT sent — a human still has to review and hit send, that's a separate
   piece we haven't built).

Both pieces of data (QuotationDraft/QuotationLine, OutboundMessage) already
existed in the shared schema before this was written — this module just
fills them in and produces the actual .docx file.
"""

import os
from datetime import datetime

from docx import Document
from docx.shared import Pt, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH

QUOTATIONS_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "instance", "quotations"
)


def _letter(i):
    """0 -> A, 1 -> B, ... matches the lettering style seen in real Techtrol offers."""
    return chr(ord("A") + i)


def quotation_docx_filename(internal_ref: str | None, revision_no: int) -> str:
    safe = "".join(
        ch if (ch.isalnum() or ch in "-_.") else "-"
        for ch in (internal_ref or "quotation")
    )
    return f"{safe}_R{int(revision_no or 0)}.docx"


def resolve_quotation_file(uri: str | None = None, filename: str | None = None) -> str | None:
    """Find a generated .docx under instance/quotations, ignoring slash direction."""
    names: list[str] = []
    for raw in (uri, filename):
        if not raw:
            continue
        base = os.path.basename(str(raw).replace("\\", "/").strip())
        if base and base not in {".", ".."}:
            names.append(base)
    seen: set[str] = set()
    for name in names:
        key = name.lower()
        if key in seen:
            continue
        seen.add(key)
        path = os.path.join(QUOTATIONS_DIR, name)
        if os.path.isfile(path):
            return path
    return None


def _inr(value) -> str:
    try:
        n = float(value)
    except (TypeError, ValueError):
        return "—"
    return f"Rs. {n:,.2f}"


def build_quotation_docx(case, quote_lines, revision_no, pricing=None):
    """quote_lines: list of QuotationLine-like objects (model_code, description,
    qty, uom, technical_spec_text). Returns a posix relative path."""

    os.makedirs(QUOTATIONS_DIR, exist_ok=True)

    price_by_line: dict[int, object] = {}
    if pricing is not None:
        for pl in getattr(pricing, "lines", None) or []:
            qid = getattr(pl, "quote_line_id", None)
            if qid is not None:
                price_by_line[int(qid)] = pl

    doc = Document()

    # --- Letterhead block ---
    header = doc.add_paragraph()
    header.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = header.add_run("PUNE TECHTROL PRIVATE LIMITED")
    run.bold = True
    run.font.size = Pt(15)

    sub = doc.add_paragraph()
    sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
    sub_run = sub.add_run("S-18, MIDC Bhosari, Pune - 411026, India  |  ho@punetechtrol.com")
    sub_run.font.size = Pt(9)
    sub_run.font.color.rgb = None

    doc.add_paragraph()  # spacer

    # --- Offer meta ---
    meta = doc.add_paragraph()
    meta.add_run(f"Our Offer No.: PTLW/{case.internal_ref}/{revision_no}\n").bold = True
    meta.add_run(f"Date: {datetime.now().strftime('%d/%m/%Y')}\n")
    if case.project_name:
        meta.add_run(f"Project: {case.project_name}\n")
    if case.enq_no_customer:
        meta.add_run(f"Your Enquiry No.: {case.enq_no_customer}\n")

    doc.add_paragraph("Dear Sir / Madam,")
    doc.add_paragraph(
        "Thank you for your enquiry. Please find below our offer for the items requested."
    )

    # --- Line items, lettered like the real offers (A, B, C...) ---
    for i, line in enumerate(quote_lines):
        item_para = doc.add_paragraph()
        item_run = item_para.add_run(
            f"{_letter(i)})  \u2018Techtrol\u2019 {line.description or 'Item'}"
        )
        item_run.bold = True
        item_run.font.size = Pt(11)

        table = doc.add_table(rows=0, cols=2)
        table.style = "Table Grid"
        table.autofit = False
        table.columns[0].width = Inches(1.6)
        table.columns[1].width = Inches(4.6)

        def add_row(label, value):
            row = table.add_row()
            row.cells[0].text = label
            row.cells[1].text = str(value) if value not in (None, "") else "\u2014"
            for cell in row.cells:
                for p in cell.paragraphs:
                    for r in p.runs:
                        r.font.size = Pt(10)

        add_row("Model No.", line.model_code or "TBD")
        qty_display = f"{line.qty} {line.uom or ''}".strip() if line.qty else "\u2014"
        add_row("Quantity", qty_display)
        if line.technical_spec_text:
            add_row("Specification", line.technical_spec_text)
        pl = price_by_line.get(int(getattr(line, "quote_line_id", 0) or 0))
        if pl is not None and getattr(pl, "unit_price", None) is not None:
            add_row("Unit Price", _inr(pl.unit_price))
            add_row("Amount", _inr(getattr(pl, "line_total", None) or pl.unit_price))

        doc.add_paragraph()  # spacer between items

    if pricing is not None and getattr(pricing, "grand_total", None) is not None:
        totals = doc.add_table(rows=0, cols=2)
        totals.style = "Table Grid"

        def add_total(label, value):
            row = totals.add_row()
            row.cells[0].text = label
            row.cells[1].text = value

        if getattr(pricing, "discount_pct", None):
            add_total("Discount", f"{pricing.discount_pct} %")
        if getattr(pricing, "tax_pct", None):
            add_total("Tax", f"{pricing.tax_pct} %")
        if getattr(pricing, "freight_amount", None):
            add_total("Freight", _inr(pricing.freight_amount))
        add_total("Grand Total", _inr(pricing.grand_total))
        if getattr(pricing, "currency_code", None):
            add_total("Currency", str(pricing.currency_code))
    else:
        pricing_note = doc.add_paragraph()
        pricing_note.add_run(
            "Pricing: to be confirmed separately — please contact us for unit pricing "
            "against the above model numbers."
        ).italic = True

    doc.add_paragraph()
    doc.add_paragraph("Terms & Conditions: as per our standard terms.")
    doc.add_paragraph()
    doc.add_paragraph("For Pune Techtrol Pvt. Ltd.")

    filename = quotation_docx_filename(getattr(case, "internal_ref", None), revision_no)
    out_path = os.path.join(QUOTATIONS_DIR, filename)
    doc.save(out_path)
    return f"quotations/{filename}"


def draft_email_text(case, quote_lines):
    """Returns (subject, body_text) for the OutboundMessage draft."""
    subject = f"Offer for {case.project_name or case.internal_ref} \u2014 {case.internal_ref}"

    item_lines = "\n".join(
        f"  {_letter(i)}) {line.model_code or 'TBD'} \u2014 {line.description or ''}"
        for i, line in enumerate(quote_lines)
    )

    body = (
        "Dear Sir / Madam,\n\n"
        "Thank you for your enquiry. Please find the quotation below for your reference:\n\n"
        f"{item_lines}\n\n"
        "The full offer with technical specifications is attached.\n\n"
        "Kindly review and let us know if you need any clarification before placing the order.\n\n"
        "Regards,\n"
        "Pune Techtrol Pvt. Ltd."
    )
    return subject, body
