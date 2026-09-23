
from decimal import Decimal
from datetime import datetime, timezone

from app.database import SessionLocal
from app.models.inquiry_case import InquiryCase, CaseStatusHistory
from app.models.extract import ExtractedLineItem
from app.models.match import ProductRecommendation

db = SessionLocal()

try:
    case = InquiryCase(
        internal_ref="DEMO-FEEDBACK-TEST",
        status="RECEIVED",
        project_name="Feedback Dropdown Test",
        category="OEM,MRO",
        enq_received_at=datetime.now(timezone.utc),
    )
    db.add(case)
    db.flush()  # get case.case_id before commit

    db.add(CaseStatusHistory(
        case_id=case.case_id, from_status=None, to_status="RECEIVED",
        changed_by="demo-script",
    ))

    line = ExtractedLineItem(
        case_id=case.case_id,
        line_no=1,
        customer_tag_no="LT-101",
        description="Level transmitter, radar type, 4-20mA + HART",
        product_type="Level Transmitter",
        qty=Decimal("2"),
        uom="NOS",
        extraction_method="ai-match",
    )
    db.add(line)
    db.flush()

    # Top match (rank 1) + 3 alternates (rank 2-4) — this is what makes
    # "otherRecs.length > 0" true on the frontend, so the feedback
    # dropdown appears.
    recommendations = [
        {
            "rank_no": 1, "model_code": "TRD-INTROL91-1121W",
            "family_code": "Level Transmitter", "confidence": Decimal("0.91"),
            "rationale": "Best match: radar type, correct output signal, matches flange size.",
        },
        {
            "rank_no": 2, "model_code": "TRD-INTROL91-1122W",
            "family_code": "Level Transmitter", "confidence": Decimal("0.76"),
            "rationale": "Close alternative — slightly different process connection.",
        },
        {
            "rank_no": 3, "model_code": "MLG-SSAS4BBW2A2BTEWAWWW",
            "family_code": "Magnetic Level Gauge", "confidence": Decimal("0.58"),
            "rationale": "Different technology (magnetic vs radar) but overlapping use-case.",
        },
        {
            "rank_no": 4, "model_code": "RFG-LPF2321233AB1W1",
            "family_code": "Reflex Glass Gauge", "confidence": Decimal("0.34"),
            "rationale": "Lower-cost alternative, lower pressure rating than requested.",
        },
    ]

    for rec in recommendations:
        db.add(ProductRecommendation(
            case_id=case.case_id,
            line_item_id=line.line_item_id,
            rank_no=rec["rank_no"],
            match_level="A" if rec["rank_no"] == 1 else "B",
            family_code=rec["family_code"],
            model_code=rec["model_code"],
            confidence=rec["confidence"],
            rationale=rec["rationale"],
            is_selected_by_engineer=None,
            decided_by=None,
        ))

    db.commit()
    print(f"✅ Created demo case: {case.internal_ref} (case_id={case.case_id})")
    print(f"   Line item: {line.description} (line_item_id={line.line_item_id})")
    print(f"   {len(recommendations)} recommendations added (1 top match + 3 alternates)")
    print("\nGo to Review Queue or All Cases → open DEMO-FEEDBACK-TEST → Products & Matching tab")
    print("→ Reject or Edit the top match → the feedback form should now show the")
    print("  'Which suggested product should have been picked?' dropdown with 3 options.")

except Exception as e:
    db.rollback()
    print(f"❌ Failed: {e}")
    raise
finally:
    db.close()