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
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor, Twips

QUOTATIONS_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "instance", "quotations"
)
_ASSET_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets", "letterhead")
HEADER_IMAGE = os.path.join(_ASSET_DIR, "header.jpg")
FOOTER_IMAGE = os.path.join(_ASSET_DIR, "footer.png")


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


# Commercial block taken from the issued offer sample test_sample/7449.docx.
_STANDARD_TERMS = (
    ("Price Basis", "Ex-works Bhosari"),
    ("Pkg & Fwdg", "3% extra (Corrugated box)"),
    ("Freight / Dispatch", "To Pay basis / By Road"),
    ("GST", "18% IGST extra"),
    ("Delivery", (
        "11 weeks after receipt of technical & commercial clear PO / drawing approval / "
        "manufacturing clearance / 30% advance. Any changes thereafter will affect the price / delivery."
    )),
    ("Payment", "30% advance and balance against PI"),
    ("Inspection", "Free for 10% of ordered Qty or 2 nos. whichever is higher. Additional Qty will be charged @ Rs 500/- each."),
    ("Transit Insurance", "Not Included."),
    ("PO Cancellation", "30% of PO Amount."),
    ("Documentation", "Warranty & Test Certificate"),
    ("Validity", "45 Days"),
    ("Warranty", "12 months from dispatch against manufacturing defects"),
    ("Purchase Order", (
        "On Pune Techtrol Pvt Ltd J-52/7, MIDC, Bhosari, Pune – 411026 "
        "at agreed terms and conditions. Email to mktg@punetechtrol.com"
    )),
)

_FOOTER_LINES = (
    "HSN Code 90261020 for Level Gauges, Switches, Transmitters & 90269000 for Spares",
    "www.punetechtrol.com",
    "CIN: U31909PN1991PTC063403    GSTIN: 27AABCP1274H1ZI",
)


def _indian_fy(when: datetime) -> str:
    year = when.year
    if when.month < 4:
        start = year - 1
    else:
        start = year
    return f"{str(start)[-2:]}-{str(start + 1)[-2:]}"


def _offer_no(case, when: datetime) -> str:
    raw = (getattr(case, "qtnno", None) or getattr(case, "internal_ref", None) or "0000").strip()
    digits = "".join(ch for ch in raw if ch.isdigit()) or raw
    if digits.isdigit():
        digits = digits.zfill(5)
    fy = (getattr(case, "fyear", None) or "").strip() or _indian_fy(when)
    return f"PTLD/{digits}/{fy}"


def _rupee(value) -> str:
    """Sample style: 88,045/-  (blank when price is not yet entered)."""
    if value in (None, ""):
        return ""
    try:
        n = float(value)
    except (TypeError, ValueError):
        return str(value)
    whole = int(round(n))
    return f"{whole:,}/-"


def _spec_rows(line) -> list[tuple[str, str]]:
    rows: list[tuple[str, str]] = [("Model No.", (getattr(line, "model_code", None) or "").strip() or "—")]
    raw = (getattr(line, "technical_spec_text", None) or "").strip()
    if not raw:
        return rows
    chunks = [part.strip() for part in raw.replace(" | ", "\n").splitlines() if part.strip()]
    labeled = []
    free = []
    for chunk in chunks:
        if ":" in chunk:
            label, value = chunk.split(":", 1)
            label, value = label.strip(), value.strip()
            if label and value and label.lower() not in {"model no.", "model no", "model"}:
                labeled.append((label, value))
                continue
        free.append(chunk)
    rows.extend(labeled)
    if free and not labeled:
        rows.append(("Specification", "; ".join(free)))
    elif free:
        rows.append(("Remark", "; ".join(free)))
    return rows


def _set_run(paragraph, text, *, bold=False, size=10):
    run = paragraph.add_run(text)
    run.bold = bold
    run.font.size = Pt(size)
    run.font.name = "Calibri"
    return run


def _add_field(paragraph, instruction: str):
    """Insert a Word field (PAGE / NUMPAGES) so the footer numbers each page."""
    begin = paragraph.add_run()
    fc1 = OxmlElement("w:fldChar")
    fc1.set(qn("w:fldCharType"), "begin")
    begin._r.append(fc1)

    instr = paragraph.add_run()
    it = OxmlElement("w:instrText")
    it.set(qn("xml:space"), "preserve")
    it.text = instruction
    instr._r.append(it)

    separate = paragraph.add_run()
    fc2 = OxmlElement("w:fldChar")
    fc2.set(qn("w:fldCharType"), "separate")
    separate._r.append(fc2)

    shown = paragraph.add_run("1")
    shown.bold = True
    shown.font.size = Pt(12)

    end = paragraph.add_run()
    fc3 = OxmlElement("w:fldChar")
    fc3.set(qn("w:fldCharType"), "end")
    end._r.append(fc3)


def _apply_letterhead(section) -> None:
    """Header and footer artwork copied from test_sample/7449.docx."""
    section.header_distance = Inches(0.1)
    section.footer_distance = Inches(0.1)
    # Sample letterhead is ~1.5in tall; keep the body below it.
    section.top_margin = Inches(1.85)
    section.bottom_margin = Inches(1.45)

    header = section.header
    header.is_linked_to_previous = False
    hp = header.paragraphs[0]
    hp.alignment = WD_ALIGN_PARAGRAPH.CENTER
    hp.paragraph_format.space_before = Twips(0)
    hp.paragraph_format.space_after = Twips(0)
    if os.path.isfile(HEADER_IMAGE):
        hp.add_run().add_picture(HEADER_IMAGE, width=Inches(6.97))

    footer = section.footer
    footer.is_linked_to_previous = False
    page = footer.paragraphs[0]
    page.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    label = page.add_run("Page: ")
    label.bold = True
    label.font.size = Pt(12)
    _add_field(page, " PAGE ")
    of_run = page.add_run(" of ")
    of_run.bold = True
    of_run.font.size = Pt(12)
    _add_field(page, ' NUMPAGES \\# "0" ')

    if os.path.isfile(FOOTER_IMAGE):
        logo = footer.add_paragraph()
        logo.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        logo.paragraph_format.space_before = Twips(0)
        logo.paragraph_format.space_after = Twips(0)
        logo.add_run().add_picture(FOOTER_IMAGE, width=Inches(2.09))

    for line in _FOOTER_LINES:
        fp = footer.add_paragraph()
        fp.alignment = WD_ALIGN_PARAGRAPH.LEFT
        fp.paragraph_format.space_before = Twips(0)
        fp.paragraph_format.space_after = Twips(0)
        run = _set_run(fp, line, bold=True, size=11)
        run.font.color.rgb = RGBColor(0x00, 0x66, 0x00)


def _shade_header_row(row):
    from docx.oxml import OxmlElement
    from docx.oxml.ns import qn

    for cell in row.cells:
        tc = cell._tc
        tcPr = tc.get_or_add_tcPr()
        shd = OxmlElement("w:shd")
        shd.set(qn("w:fill"), "D9E2F3")
        tcPr.append(shd)


def build_quotation_docx(case, quote_lines, revision_no, pricing=None):
    """Write a Techtrol offer in the layout of test_sample/7449.docx.

    quote_lines: model_code, description, qty, uom, technical_spec_text.
    Returns a posix relative path under instance/quotations.
    """
    os.makedirs(QUOTATIONS_DIR, exist_ok=True)
    when = datetime.now()
    offer_no = _offer_no(case, when)
    offer_date = when.strftime("%d/%m/%Y")

    price_by_line: dict[int, object] = {}
    if pricing is not None:
        for pl in getattr(pricing, "lines", None) or []:
            qid = getattr(pl, "quote_line_id", None)
            if qid is not None:
                price_by_line[int(qid)] = pl

    customer = getattr(case, "customer", None)
    customer_name = (
        getattr(customer, "display_name", None)
        or getattr(case, "project_name", None)
        or ""
    )
    customer_email = getattr(customer, "email", None) or ""
    customer_phone = getattr(customer, "phone", None) or ""

    doc = Document()
    section = doc.sections[0]
    section.page_width = Inches(8.27)
    section.page_height = Inches(11.69)
    section.left_margin = Inches(0.7)
    section.right_margin = Inches(0.6)
    _apply_letterhead(section)

    intro = doc.add_table(rows=8, cols=4)
    intro.style = "Table Grid"

    def _put(r, c, text, *, bold=False, span=1):
        cell = intro.cell(r, c)
        cell.text = ""
        _set_run(cell.paragraphs[0], text, bold=bold, size=10)
        if span > 1:
            cell.merge(intro.cell(r, c + span - 1))

    _put(0, 0, customer_name or "Customer", bold=True, span=2)
    _put(0, 2, offer_no, bold=True, span=2)
    _put(1, 0, getattr(case, "project_name", None) or "", span=2)
    _put(1, 2, offer_date, span=2)
    _put(2, 0, "", span=2)
    _put(2, 2, "", span=2)
    _put(3, 0, f"Ph.: {customer_phone}".rstrip() if customer_phone else "Ph.:")
    _put(3, 1, "Email:")
    _put(3, 2, customer_email, span=2)
    attn = getattr(case, "enq_no_customer", None) or ""
    _put(4, 0, "Kind Attn.:", bold=True)
    _put(4, 1, attn, span=3)
    _put(5, 0, "Dear Sirs,", span=4)
    _put(6, 0, "Techtrol Level Instruments for Liquids & Solids Since 1984", bold=True, span=4)
    enq_bits = ["YOUR ENQUIRY"]
    if getattr(case, "enq_no_customer", None):
        enq_bits.append(str(case.enq_no_customer))
    if getattr(case, "enq_received_at", None):
        enq_bits.append(case.enq_received_at.strftime("Dt %d/%m/%Y"))
    _put(7, 0, " : ".join(enq_bits) if len(enq_bits) > 1 else enq_bits[0], span=4)

    lead = doc.add_paragraph()
    _set_run(lead, "We appreciate your enquiry and are pleased to quote herewith.", size=11)

    for i, line in enumerate(quote_lines):
        title = doc.add_paragraph()
        _set_run(
            title,
            f"{_letter(i)})  \u201cTechtrol\u201d {line.description or 'Item'}",
            bold=True,
            size=12,
        )

        spec = doc.add_table(rows=0, cols=2)
        spec.style = "Table Grid"
        for label, value in _spec_rows(line):
            row = spec.add_row()
            row.cells[0].text = ""
            row.cells[1].text = ""
            _set_run(row.cells[0].paragraphs[0], f"{label} :", bold=True, size=9)
            _set_run(row.cells[1].paragraphs[0], value, size=9)
            row.cells[0].width = Inches(2.6)
            row.cells[1].width = Inches(4.3)

        pl = price_by_line.get(int(getattr(line, "quote_line_id", 0) or 0))
        unit = getattr(pl, "unit_price", None) if pl is not None else None
        grid = doc.add_table(rows=2, cols=5)
        grid.style = "Table Grid"
        headers = ("Sr. No.", "Tag No.", "Service", "Qty. Nos.", "Unit Price (Rs)")
        values = (
            "1",
            "--",
            (line.description or "")[:80],
            str(line.qty) if getattr(line, "qty", None) else "",
            _rupee(unit),
        )
        for col, text in enumerate(headers):
            grid.rows[0].cells[col].text = ""
            _set_run(grid.rows[0].cells[col].paragraphs[0], text, bold=True, size=8)
        _shade_header_row(grid.rows[0])
        for col, text in enumerate(values):
            grid.rows[1].cells[col].text = ""
            _set_run(grid.rows[1].cells[col].paragraphs[0], text, size=9)

        note = doc.add_paragraph()
        _set_run(note, "All other specifications as per enclosed technical leaflet.", size=9)
        doc.add_paragraph()

    terms_head = doc.add_paragraph()
    _set_run(terms_head, "Terms & Conditions:", bold=True, size=12)
    terms = doc.add_table(rows=0, cols=2)
    terms.style = "Table Grid"
    for label, value in _STANDARD_TERMS:
        row = terms.add_row()
        row.cells[0].text = ""
        row.cells[1].text = ""
        _set_run(row.cells[0].paragraphs[0], f"{label} :", bold=True, size=9)
        _set_run(row.cells[1].paragraphs[0], value, size=9)
        row.cells[0].width = Inches(1.8)
        row.cells[1].width = Inches(5.1)

    doc.add_paragraph()
    hope = doc.add_paragraph()
    _set_run(hope, "Note : Please reconfirm Price and Delivery after validity period", size=10)
    hope2 = doc.add_paragraph()
    _set_run(hope2, "We hope, you will find our offer competitive and look forward to your purchase order.", size=10)
    thanks = doc.add_paragraph()
    _set_run(thanks, "Thanking you.", size=10)
    yours = doc.add_paragraph()
    _set_run(yours, "Yours faithfully,", size=10)
    sign = doc.add_paragraph()
    _set_run(sign, "For Pune Techtrol Pvt. Ltd", bold=True, size=11)

    if pricing is not None and getattr(pricing, "grand_total", None) is not None:
        extra = doc.add_paragraph()
        bits = [f"Grand Total: {_rupee(pricing.grand_total)}"]
        if getattr(pricing, "discount_pct", None):
            bits.append(f"Discount {pricing.discount_pct}%")
        if getattr(pricing, "tax_pct", None):
            bits.append(f"Tax {pricing.tax_pct}%")
        _set_run(extra, "  |  ".join(bits), size=10)

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
        "We appreciate your enquiry and are pleased to quote herewith.\n\n"
        f"{item_lines}\n\n"
        "The full offer with technical specifications is attached.\n\n"
        "Kindly review and let us know if you need any clarification before placing the order.\n\n"
        "Regards,\n"
        "Pune Techtrol Pvt. Ltd."
    )
    return subject, body
