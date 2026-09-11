import pyodbc
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation

from app.database import SessionLocal, init_db
from app.models.party import Party
from app.models.inquiry_case import InquiryCase
from app.models.extract import ExtractedLineItem
from app.models.match import ProductRecommendation

src = pyodbc.connect("DRIVER={ODBC Driver 18 for SQL Server};SERVER=10.0.1.211;DATABASE=PTPLDATA;UID=sa;PWD=Ganesh&1984;TrustServerCertificate=yes;Encrypt=no;")
cursor = src.cursor()

cursor.execute("SELECT QTNID, FYEAR, QTNNO, QTNDT, REVNO, CU_CODE, CU_NAME, CU_EMAIL, Category, ENQNO, ENQDT, TOTMDL, TOTQTY, PROJECT, ENGCODE FROM QTNHEAD WHERE QTNDT IS NULL ORDER BY FYEAR, QTNNO, REVNO")
rows = cursor.fetchall()

init_db()
db = SessionLocal()

imported = 0
skipped = 0

for r in rows:
    qtnid, fyear, qtnno, qtndt, revno, cu_code, cu_name, cu_email, category, enqno_text, enqdt, totmdl, totqty, project, engcode = r

    revno_val = revno if revno is not None else 0
    internal_ref = "PTPL-" + str(fyear) + "-" + str(qtnno) + "-R" + str(revno_val)

    if db.query(InquiryCase).filter_by(internal_ref=internal_ref).first():
        skipped += 1
        continue

    customer_name = cu_name or ("Customer " + str(cu_code))
    customer = db.query(Party).filter_by(display_name=customer_name).first()
    if not customer:
        customer = Party(party_type="CUSTOMER", display_name=customer_name, email=cu_email or None)
        db.add(customer)
        db.flush()

    case_category = None
    if category:
        cat_upper = str(category).strip().upper()
        if cat_upper == "MRO":
            case_category = "OEM,MRO"
        elif cat_upper == "CP":
            case_category = "CP"
        elif cat_upper in ("EPC", "EXPORT"):
            case_category = "EPC,EXPORT"
        else:
            case_category = cat_upper

    case = InquiryCase(
        internal_ref=internal_ref,
        status="RECEIVED",
        source_type="BACKLOG",
        qtnno=str(qtnno),
        fyear=str(fyear),
        revision_no=revno_val,
        project_name=project or None,
        enq_no_customer=(enqno_text or "")[:80] if enqno_text else None,
        enq_received_at=enqdt if enqdt else (qtndt if qtndt else datetime.now(timezone.utc)),
        category=case_category,
        customer_party_id=customer.party_id,
    )
    db.add(case)
    db.flush()

    try:
        qty_val = Decimal(str(totqty)) if totqty not in (None, "") else Decimal("1")
    except InvalidOperation:
        qty_val = Decimal("1")

    description_text = (enqno_text or "Item from historical quotation")[:500]

    line = ExtractedLineItem(
        case_id=case.case_id,
        line_no=1,
        description=description_text,
        qty=qty_val,
        uom="NOS",
    )
    db.add(line)
    db.flush()

    if totmdl:
        rec = ProductRecommendation(
            case_id=case.case_id,
            line_item_id=line.line_item_id,
            rank_no=1,
            match_level="A",
            model_code=str(totmdl)[:120],
            confidence=Decimal("0.75"),
            rationale="Matched model from historical PTPL quotation data (backlog import).",
        )
        db.add(rec)

    imported += 1
    db.commit()
    print("Imported " + internal_ref + " (rev " + str(revno_val) + ") - " + customer_name)

db.commit()
db.close()
src.close()
print("")
print("Done. Imported: " + str(imported) + ", Skipped: " + str(skipped))