from app.database import SessionLocal
from app.models.inquiry_case import InquiryCase
from app.models.extract import ExtractedLineItem
from app.models.match import ProductRecommendation
from decimal import Decimal

db = SessionLocal()

case = db.query(InquiryCase).filter_by(internal_ref="OTL-1788173173").first()
if not case:
    print("Case not found — check the internal_ref matches what you got back")
else:
    item = ExtractedLineItem(
        case_id=case.case_id, line_no=1, customer_tag_no="LG-01",
        description="Reflex flat glass level gauge, PP wetted",
        product_type="Level Gauge", qty=Decimal("2"), uom="NOS", moc="PP",
    )
    db.add(item)
    db.flush()

    rec = ProductRecommendation(
        case_id=case.case_id, line_item_id=item.line_item_id, rank_no=1,
        match_level="A", model_code="RFG-LPF2321233AB1W1", confidence=Decimal("0.86"),
        rationale="Reflex gauge, PP wetted, matches spec.",
    )
    db.add(rec)
    db.commit()
    print("Added matched product to", case.internal_ref)