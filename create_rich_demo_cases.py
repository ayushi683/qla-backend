"""
One-off script: creates 3 rich demo cases, each with MULTIPLE product
line items, and each line item having MULTIPLE AI-suggested
recommendations (1 top pick + 2-3 alternates) — good for testing
Approve/Reject/Edit, "Add to quotation", bulk-select, and the
feedback flow end-to-end.

Run from the project root (venv activated):
    python create_rich_demo_cases.py
"""
from decimal import Decimal
from datetime import datetime, timezone

from app.database import SessionLocal
from app.models.inquiry_case import InquiryCase, CaseStatusHistory
from app.models.extract import ExtractedLineItem
from app.models.match import ProductRecommendation

db = SessionLocal()

DEMO_CASES = [
    {
        "ref": "DEMO-RICH-01",
        "project": "Effluent Plant Instrumentation",
        "category": "OEM,MRO",
        "items": [
            {
                "tag": "LT-101",
                "desc": "Level transmitter, radar type, 4-20mA + HART",
                "product_type": "Level Transmitter",
                "qty": "2",
                "recs": [
                    ("TRD-INTROL91-1121W", "Level Transmitter", "0.91", "Best match: radar, correct signal, correct flange."),
                    ("TRD-INTROL91-1122W", "Level Transmitter", "0.76", "Close alternative — different process connection."),
                    ("TRD-INTROL92-1121W", "Level Transmitter", "0.58", "Alternative series, slightly lower accuracy class."),
                ],
            },
            {
                "tag": "LG-201",
                "desc": "Reflex glass level gauge, high pressure, SS316",
                "product_type": "Reflex Glass Gauge",
                "qty": "1",
                "recs": [
                    ("RFG-LPF2321233AB1W1", "Reflex Glass Gauge", "0.82", "Correct pressure rating and material."),
                    ("RFG-LPF2321233AB1W2", "Reflex Glass Gauge", "0.64", "Alternative gasket material."),
                ],
            },
            {
                "tag": "LS-301",
                "desc": "Float type level switch, single point, PP wetted",
                "product_type": "Level Switch",
                "qty": "3",
                "recs": [
                    ("FGSO-J21EPD1WW", "Level Switch", "0.85", "Correct wetted parts and mounting."),
                    ("FGSO-J21EPD1WX", "Level Switch", "0.71", "Alternative connection size."),
                    ("FGSO-J22EPD1WW", "Level Switch", "0.44", "Different float diameter."),
                ],
            },
        ],
    },
    {
        "ref": "DEMO-RICH-02",
        "project": "Ammonia Storage Monitoring",
        "category": "CP",
        "items": [
            {
                "tag": "PT-101",
                "desc": "Pressure transmitter, 0-10 bar, 4-20mA",
                "product_type": "Pressure Transmitter",
                "qty": "4",
                "recs": [
                    ("PTX-5072-TA-A1CAAHS", "Pressure Transmitter", "0.93", "Exact range and output match."),
                    ("PTX-5072-TA-A1CAAHT", "Pressure Transmitter", "0.79", "Alternative process connection."),
                ],
            },
            {
                "tag": "TT-201",
                "desc": "Temperature transmitter, RTD input, 4-20mA",
                "product_type": "Temperature Transmitter",
                "qty": "2",
                "recs": [
                    ("TTX-300-RTD-4W", "Temperature Transmitter", "0.88", "Correct RTD wiring and output."),
                    ("TTX-300-RTD-2W", "Temperature Transmitter", "0.55", "2-wire alternative, lower accuracy."),
                    ("TTX-310-RTD-4W", "Temperature Transmitter", "0.47", "Different housing type."),
                ],
            },
        ],
    },
    {
        "ref": "DEMO-RICH-03",
        "project": "Acid Storage Tank Farm",
        "category": "EPC,EXPORT",
        "items": [
            {
                "tag": "FT-101",
                "desc": "Flow transmitter, electromagnetic, 3-inch line",
                "product_type": "Flow Transmitter",
                "qty": "2",
                "recs": [
                    ("MAG-3000-3IN-SS", "Flow Transmitter", "0.90", "Correct size and wetted material."),
                    ("MAG-3000-3IN-HC", "Flow Transmitter", "0.68", "Hastelloy liner for higher corrosion resistance."),
                ],
            },
            {
                "tag": "LI-201",
                "desc": "Level indicator, tubular type, borosilicate glass",
                "product_type": "Level Indicator",
                "qty": "6",
                "recs": [
                    ("TTG-1PA2P31121W", "Level Indicator", "0.87", "Standard borosilicate, correct pressure class."),
                    ("TTG-1PA2P31122W", "Level Indicator", "0.73", "Alternative end-block material."),
                    ("TTG-1PA3P31121W", "Level Indicator", "0.51", "Different mounting orientation."),
                ],
            },
        ],
    },
]

def build_case(spec):
    case = InquiryCase(
        internal_ref=spec["ref"],
        status="RECEIVED",
        project_name=spec["project"],
        category=spec["category"],
        enq_received_at=datetime.now(timezone.utc),
    )
    db.add(case)
    db.flush()

    db.add(CaseStatusHistory(
        case_id=case.case_id, from_status=None, to_status="RECEIVED",
        changed_by="demo-script",
    ))

    for line_no, item_spec in enumerate(spec["items"], start=1):
        line = ExtractedLineItem(
            case_id=case.case_id,
            line_no=line_no,
            customer_tag_no=item_spec["tag"],
            description=item_spec["desc"],
            product_type=item_spec["product_type"],
            qty=Decimal(item_spec["qty"]),
            uom="NOS",
            extraction_method="ai-match",
        )
        db.add(line)
        db.flush()

        for rank, (model_code, family_code, conf, rationale) in enumerate(item_spec["recs"], start=1):
            db.add(ProductRecommendation(
                case_id=case.case_id,
                line_item_id=line.line_item_id,
                rank_no=rank,
                match_level="A" if rank == 1 else "B",
                family_code=family_code,
                model_code=model_code,
                confidence=Decimal(conf),
                rationale=rationale,
                is_selected_by_engineer=None,
                decided_by=None,
            ))

    return case


try:
    created = []
    for spec in DEMO_CASES:
        case = build_case(spec)
        created.append((case.internal_ref, len(spec["items"])))

    db.commit()

    print("✅ Created rich demo cases:")
    for ref, n_items in created:
        print(f"   {ref} — {n_items} line items, each with multiple suggestions")
    print("\nGo to All Cases or Review Queue and open any DEMO-RICH-* case to test:")
    print("  - Approve / Reject / Edit / Undo on individual items")
    print("  - Multi-select checkboxes + bulk Approve/Reject")
    print("  - 'Add to quotation' on alternates (InlineAlternates section)")
    print("  - Feedback capture on Reject / Edit")

except Exception as e:
    db.rollback()
    print(f"❌ Failed: {e}")
    raise
finally:
    db.close()