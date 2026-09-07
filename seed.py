from datetime import datetime, timezone
from decimal import Decimal
import json
import os

from app.database import SessionLocal, init_db
from app.security import hash_password
from app.models.user import AppUser
from app.models.party import Party
from app.models.inquiry_case import InquiryCase
from app.models.extract import ExtractedLineItem
from app.models.match import ProductRecommendation
from app.models.email import EmailThread, EmailMessage
from app.models.document import InquiryDocument

init_db()
db = SessionLocal()

if not db.query(AppUser).filter_by(email="admin@techtrol.com").first():
    admin = AppUser(
        email="admin@techtrol.com", display_name="Admin", role="ADMIN",
        is_enabled=True, allow_password_login=True, allow_outlook_login=True,
        password_hash=hash_password("admin123"),
    )
    db.add(admin)
    print("Created admin login: admin@techtrol.com / admin123  (change this password!)")

if not db.query(InquiryCase).filter_by(internal_ref="DEMO-0001").first():
    customer = Party(party_type="CUSTOMER", display_name="Demo Customer Pvt Ltd", email="buyer@democustomer.com")
    db.add(customer)
    db.flush()

    case = InquiryCase(
        internal_ref="DEMO-0001", status="RECEIVED", project_name="Demo ETP Project",
        enq_no_customer="DC/ENQ/2026/01", enq_received_at=datetime.now(timezone.utc),
        match_confidence=Decimal("0.87"), customer_party_id=customer.party_id,
    )
    db.add(case)
    db.flush()

    item1 = ExtractedLineItem(
        case_id=case.case_id, line_no=1, customer_tag_no="LS-01",
        description="Float type level switch, guard pipe, SS316 wetted",
        product_type="Level Switch", qty=Decimal("2"), uom="NOS", moc="SS316",
    )
    item2 = ExtractedLineItem(
        case_id=case.case_id, line_no=2, customer_tag_no="LG-01",
        description="Float & board type level gauge, PP wetted",
        product_type="Level Gauge", qty=Decimal("1"), uom="NOS", range_text="0-6000mm",
    )
    db.add_all([item1, item2])
    db.flush()

    item3 = ExtractedLineItem(
        case_id=case.case_id, line_no=3, customer_tag_no="LT-01",
        description="Radar level transmitter, 2\" flange, 4-20mA + HART",
        product_type="Level Transmitter", qty=Decimal("1"), uom="NOS", range_text="0-2800mm",
    )
    db.add(item3)
    db.flush()

    recs = [
        ProductRecommendation(
            case_id=case.case_id, line_item_id=item1.line_item_id, rank_no=1,
            match_level="A", model_code="FGSO-J21DSD1SW", confidence=Decimal("0.91"),
            rationale="Guided float switch, SS316 wetted, matches guard-pipe spec.",
        ),
        ProductRecommendation(
            case_id=case.case_id, line_item_id=item1.line_item_id, rank_no=2,
            match_level="B", model_code="DS-CJSM1MSWW", confidence=Decimal("0.42"),
            rationale="Displacer-type alternative — different technology than requested.",
        ),
        ProductRecommendation(
            case_id=case.case_id, line_item_id=item2.line_item_id, rank_no=1,
            match_level="A", model_code="FBG-FP1WWG1PO1256GW", confidence=Decimal("0.95"),
            rationale="Float & board gauge, PP wetted, range matches.",
            is_selected_by_engineer=True,
        ),
        ProductRecommendation(
            case_id=case.case_id, line_item_id=item3.line_item_id, rank_no=1,
            match_level="C", model_code="TUS-ULTRANXT-2W", confidence=Decimal("0.38"),
            rationale="Ultrasonic transmitter — low confidence, enquiry asked for radar.",
            is_selected_by_engineer=False,
        ),
        ProductRecommendation(
            case_id=case.case_id, line_item_id=item3.line_item_id, rank_no=2,
            match_level="A", model_code="TRD-INTROL91-1021W", confidence=Decimal("0.88"),
            rationale="26GHz radar transmitter, 2\" flange — matches enquiry's radar request.",
        ),
    ]
    db.add_all(recs)
    print("Created demo case DEMO-0001 with 3 line items and 5 recommendations "
          "(one pending, one approved, one rejected).")

if not db.query(InquiryCase).filter_by(internal_ref="DEMO-0002").first():
    customer2 = Party(party_type="CUSTOMER", display_name="Zen Adsorptions Pvt Ltd", email="purchase@zenadsorptions.com")
    db.add(customer2)
    db.flush()

    case2 = InquiryCase(
        internal_ref="DEMO-0002", status="RECEIVED", project_name="Effluent Recycle System",
        enq_no_customer="ZAD/ENQ/2026/07", enq_received_at=datetime.now(timezone.utc),
        match_confidence=Decimal("0.79"), customer_party_id=customer2.party_id,
    )
    db.add(case2)
    db.flush()

    c2_item1 = ExtractedLineItem(
        case_id=case2.case_id, line_no=1, customer_tag_no="LG-05",
        description="Reflex flat glass level gauge, 98% H2SO4 service",
        product_type="Level Gauge", qty=Decimal("3"), uom="NOS", moc="PVDF/PTFE",
    )
    c2_item2 = ExtractedLineItem(
        case_id=case2.case_id, line_no=2, customer_tag_no="LS-12",
        description="Magnetic float pivoted level switch, non-guided",
        product_type="Level Switch", qty=Decimal("4"), uom="NOS", moc="PP",
    )
    db.add_all([c2_item1, c2_item2])
    db.flush()

    recs2 = [
        ProductRecommendation(
            case_id=case2.case_id, line_item_id=c2_item1.line_item_id, rank_no=1,
            match_level="A", model_code="RFG-LPF2321233AB1W1", confidence=Decimal("0.83"),
            rationale="Reflex gauge with PVDF/PTFE wetted parts, matches H2SO4 service.",
        ),
        ProductRecommendation(
            case_id=case2.case_id, line_item_id=c2_item1.line_item_id, rank_no=2,
            match_level="B", model_code="FBG-FP1WWG1PO1256GW", confidence=Decimal("0.35"),
            rationale="Float & board gauge — PP wetted, not compatible with 98% H2SO4.",
        ),
        ProductRecommendation(
            case_id=case2.case_id, line_item_id=c2_item2.line_item_id, rank_no=1,
            match_level="A", model_code="FPS-JP2C2SRWW", confidence=Decimal("0.90"),
            rationale="Magnetic float pivoted switch, PP wetted, non-guided as specified.",
        ),
    ]
    db.add_all(recs2)
    print("Created demo case DEMO-0002 with 2 line items and 3 recommendations (all pending).")

if not db.query(InquiryCase).filter_by(internal_ref="DEMO-0003").first():
    customer3 = Party(
        party_type="CUSTOMER", display_name="Sagar Chemicals Pvt Ltd", email="purchase@sagarchemicals.com",
    )
    db.add(customer3)
    db.flush()

    case3 = InquiryCase(
        internal_ref="DEMO-0003", status="RECEIVED", project_name="ETP Upgrade Phase 2",
        enq_no_customer="SCP/ENQ/2026/14", enq_received_at=datetime.now(timezone.utc),
        match_confidence=Decimal("0.81"), customer_party_id=customer3.party_id,
    )
    db.add(case3)
    db.flush()

    c3_item1 = ExtractedLineItem(
        case_id=case3.case_id, line_no=1, customer_tag_no="LS-21",
        description="Float type level switch, guard pipe, PP wetted",
        product_type="Level Switch", qty=Decimal("3"), uom="NOS", moc="PP",
    )
    c3_item2 = ExtractedLineItem(
        case_id=case3.case_id, line_no=2, customer_tag_no="LG-08",
        description="Magnetic level gauge, SS316 wetted, high pressure",
        product_type="Level Gauge", qty=Decimal("2"), uom="NOS", moc="SS316",
    )
    c3_item3 = ExtractedLineItem(
        case_id=case3.case_id, line_no=3, customer_tag_no="LT-04",
        description="Ultrasonic level transmitter, 1.5\" flange, 4-20mA",
        product_type="Level Transmitter", qty=Decimal("2"), uom="NOS", range_text="0-3500mm",
    )
    db.add_all([c3_item1, c3_item2, c3_item3])
    db.flush()

    recs3 = [
        ProductRecommendation(
            case_id=case3.case_id, line_item_id=c3_item1.line_item_id, rank_no=1,
            match_level="A", model_code="FGSO-J21EPD1WW", confidence=Decimal("0.89"),
            rationale="Guided float switch, PP wetted, matches guard-pipe spec.",
        ),
        ProductRecommendation(
            case_id=case3.case_id, line_item_id=c3_item2.line_item_id, rank_no=1,
            match_level="A", model_code="MLG-SSAS4BBW2A2BTEWAWWW", confidence=Decimal("0.77"),
            rationale="Magnetic level gauge, SS316, rated for high pressure service.",
        ),
        ProductRecommendation(
            case_id=case3.case_id, line_item_id=c3_item2.line_item_id, rank_no=2,
            match_level="B", model_code="RFG-LPF2321233AB1W1", confidence=Decimal("0.44"),
            rationale="Reflex glass alternative — lower pressure rating than requested.",
        ),
        ProductRecommendation(
            case_id=case3.case_id, line_item_id=c3_item3.line_item_id, rank_no=1,
            match_level="A", model_code="TUS-ULTRATROL-21", confidence=Decimal("0.92"),
            rationale="Ultrasonic transmitter, 1.5\" flange, matches range and connection.",
        ),
    ]
    db.add_all(recs3)
    print("Created demo case DEMO-0003 with 3 line items, all pending review.")


# --- Helper so adding new demo cases is short, not a big copy-paste block ---
def add_demo_case(ref, customer_name, customer_email, project_name, enq_no, confidence, items):
    if db.query(InquiryCase).filter_by(internal_ref=ref).first():
        return
    customer = Party(party_type="CUSTOMER", display_name=customer_name, email=customer_email)
    db.add(customer)
    db.flush()

    case = InquiryCase(
        internal_ref=ref, status="RECEIVED", project_name=project_name,
        enq_no_customer=enq_no, enq_received_at=datetime.now(timezone.utc),
        match_confidence=Decimal(str(confidence)), customer_party_id=customer.party_id,
    )
    db.add(case)
    db.flush()

    for idx, item in enumerate(items, start=1):
        li = ExtractedLineItem(
            case_id=case.case_id, line_no=idx, customer_tag_no=item["tag"],
            description=item["desc"], product_type=item["type"],
            qty=Decimal(str(item["qty"])), uom=item.get("uom", "NOS"),
            moc=item.get("moc"), range_text=item.get("range_text"),
        )
        db.add(li)
        db.flush()
        for rank, rec in enumerate(item["matches"], start=1):
            db.add(ProductRecommendation(
                case_id=case.case_id, line_item_id=li.line_item_id, rank_no=rank,
                match_level=rec.get("level", "A"), model_code=rec["model"],
                confidence=Decimal(str(rec["conf"])), rationale=rec["why"],
            ))
    print(f"Created demo case {ref} with {len(items)} line items, all pending review.")


# --- Pulls the NEXT enquiry (in order, not random) from demo_queries.json
# each time seed.py runs. Order is based on how many DEMO-xxxx cases
# already exist, so re-running always adds the next one in the file. ---
with open("demo_queries.json") as f:
    QUERY_POOL = json.load(f)

existing_count = db.query(InquiryCase).filter(InquiryCase.internal_ref.like("DEMO-%")).count()
pool_index = existing_count % len(QUERY_POOL)
next_num = existing_count + 1
new_ref = f"DEMO-{next_num:04d}"

q = QUERY_POOL[pool_index]
add_demo_case(
    new_ref, q["customer_name"], q["customer_email"], q["project_name"],
    q["enq_no"], q["confidence"], q["items"],
)

# --- Real Techtrol engineers, matching their actual "Selection Criteria" ---
REAL_ENGINEERS = [
    ("Rahul Harale", "mktg5@punetechtrol.com", "OEM,MRO"),
    ("Deepali Patharkar", "mktg3@punetechtrol.com", "CP"),
    ("Suvarna Munfan", "sm@punetechtrol.com", "EPC,EXPORT"),
    ("Samiullah Shaikh", "mktg1@punetechtrol.com", "DISTRIBUTED_PRODUCTS"),
    ("Prakash Avhad", "project@punetechtrol.com", "PROJECT"),
    ("Sheena Damodaran", "info@punetechtrol.com", "ULTRASONIC"),
    ("Manisha Bhoje", "mktg7@punetechtrol.com", "OEM,MRO"),
    ("Shweta Jagdale", "mktg4@punetechtrol.com", "CP"),
    ("Swapnil Panale", "mktg6@punetechtrol.com", "OEM,MRO"),
]

for name, email, category in REAL_ENGINEERS:
    if not db.query(AppUser).filter_by(email=email).first():
        db.add(AppUser(
            email=email, display_name=name, role="ENGINEER", category=category,
            is_enabled=True, allow_password_login=False, allow_outlook_login=True,
            password_hash=None,
        ))
print("Added 9 real Techtrol engineers with their categories.")

# Assign categories to existing demo cases so filtering has something to show
# (a single case belongs to ONE category, unlike engineers who can cover multiple)
for ref, cat in [("DEMO-0001", "OEM"), ("DEMO-0002", "CP"), ("DEMO-0003", "PROJECT")]:
    c = db.query(InquiryCase).filter_by(internal_ref=ref).first()
    if c:
        c.category = cat

# --- Real enquiry examples (3 with attachments, 2 email-only) ---
ENQUIRY_DOCS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "instance", "enquiry_docs")

def add_real_enquiry(ref, customer_name, customer_email, project_name, enq_no, category,
                      subject, sender_email, body_text, attachments, items):
    if db.query(InquiryCase).filter_by(internal_ref=ref).first():
        return
    customer = Party(party_type="CUSTOMER", display_name=customer_name, email=customer_email)
    db.add(customer)
    db.flush()

    case = InquiryCase(
        internal_ref=ref, status="RECEIVED", project_name=project_name,
        enq_no_customer=enq_no, enq_received_at=datetime.now(timezone.utc),
        customer_party_id=customer.party_id, category=category,
    )
    db.add(case)
    db.flush()

    thread = EmailThread(
        case_id=case.case_id, mailbox="enquiries@punetechtrol.com",
        subject_normalized=subject, first_message_at=datetime.now(timezone.utc),
        last_message_at=datetime.now(timezone.utc),
    )
    db.add(thread)
    db.flush()

    message = EmailMessage(
        thread_id=thread.thread_id, case_id=case.case_id, direction="INBOUND",
        sender_email=sender_email, subject=subject, body_text=body_text,
        received_at=datetime.now(timezone.utc), has_attachments=bool(attachments),
    )
    db.add(message)
    db.flush()

    if attachments:
        case_dir = os.path.join(ENQUIRY_DOCS_DIR, str(case.case_id))
        os.makedirs(case_dir, exist_ok=True)
        for filename, content_type, content in attachments:
            path = os.path.join(case_dir, filename)
            with open(path, "wb") as f:
                f.write(content)
            db.add(InquiryDocument(
                case_id=case.case_id, message_id=message.message_id, file_name=filename,
                relative_path=os.path.join("enquiry_docs", str(case.case_id), filename),
                blob_uri=os.path.join("enquiry_docs", str(case.case_id), filename),
                doc_role="ENQUIRY", content_type=content_type, size_bytes=len(content),
            ))

    for idx, item in enumerate(items, start=1):
        li = ExtractedLineItem(
            case_id=case.case_id, line_no=idx, customer_tag_no=item["tag"],
            description=item["desc"], product_type=item["type"],
            qty=Decimal(str(item["qty"])), uom=item.get("uom", "NOS"),
            moc=item.get("moc"), range_text=item.get("range_text"),
        )
        db.add(li)
        db.flush()
        for rank, rec in enumerate(item["matches"], start=1):
            db.add(ProductRecommendation(
                case_id=case.case_id, line_item_id=li.line_item_id, rank_no=rank,
                match_level=rec.get("level", "A"), model_code=rec["model"],
                confidence=Decimal(str(rec["conf"])), rationale=rec["why"],
            ))
    print(f"Created {ref} — {customer_name} ({'with attachment' if attachments else 'email-only'}).")


# 1. Mitsubishi Electric — real email + real attachment (PDF)
add_real_enquiry(
    "REAL-3368", "Mitsubishi Electric India Pvt Ltd", "Stanley.Solomon@asia.meap.com",
    "Southern/Northern Link EPC Pipeline Project", "ME/FI/2026", "OEM,MRO",
    subject="Enquiry for Field Instruments _ ME",
    sender_email="Stanley.Solomon@asia.meap.com",
    body_text=(
        "Hello,\n\nKindly refer to the attached details and technical specification of Field Instruments.\n\n"
        "You are requested to submit the techno commercial offer for Field Instruments.\n\n"
        "Please go through the attached documents and revert back if you have any queries.\n\n"
        "Regards,\nStanley F Solomon\nManager-Procurement | SCM"
    ),
    attachments=[("Instruments Tech specification.pdf", "application/pdf",
                  b"%PDF-1.4\n%Sample placeholder for real attachment\n%%EOF")],
    items=[{"tag": "CNS-01", "desc": "Conductivity type level switch, single point",
            "type": "Level Switch", "qty": 8,
            "matches": [{"model": "CNS-TJM1UA3W", "conf": 0.88, "why": "Conductivity probe matches BOM spec."}]}],
)

# 2. L&T ECC — real email + real attachment (Excel)
add_real_enquiry(
    "REAL-1802", "Larsen & Toubro Construction (ECC)", "saishashank@lntecc.com",
    "Ballia & Prayagraj Water Supply Schemes", "L&T/BP/2026", "EPC_EXPORT",
    subject="Enquiry for Level Instrument(s) - Ballia, Prayagraj Packages.",
    sender_email="saishashank@lntecc.com",
    body_text=(
        "Dear Sir,\n\nWe are in process of bidding for the above cited projects falling under Uttar Pradesh state. "
        "The project scope includes Design & Construction of intake works, Raw Water Pumping Main, Water Treatment Plant, "
        "Clear Water Reservoir cum Pump House, Clear Water Transmission & Gravity pipelines, Overhead Tanks and associated "
        "Electromechanical & Instrumentation works.\n\n"
        "In continuation to the above, Level Instruments are to be supplied and erected as a part of Electromechanical "
        "& Instrumentation works.\n\n"
        "So, we request you to provide your best techno-commercial offer for supplying the following components "
        "described in the sheet(s) enclosed.\n\nThanks & Regards,\nSai Shashank Kandregula\nSenior Engineer - Instrumentation"
    ),
    attachments=[("ENQ SPECS - Ballia Package.xlsx",
                  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                  b"PK\x03\x04placeholder xlsx content")],
    items=[{"tag": "CNS-B1", "desc": "Conductivity type level switch for Ballia package",
            "type": "Level Switch", "qty": 5,
            "matches": [{"model": "CNS-IJS3UST3", "conf": 0.91, "why": "Matches Ballia package spec sheet."}]}],
)

# 3. Membrane Group India — real email + real attachment (Excel)
add_real_enquiry(
    "REAL-4006", "Membrane Group India Pvt Ltd", "purchase3@membranegroupindia.com",
    "WTP/STP/ETP Project (P-1215)", "MGI/P-1215", "DISTRIBUTED_PRODUCTS",
    subject="Request for Quotation – Pune (LEVEL GAUGE /LEVEL SWITCH) P - 1215",
    sender_email="purchase3@membranegroupindia.com",
    body_text=(
        "Dear Team,\n\nPlease find attached our requirement for Level Gauge and Level Switch instruments "
        "for the P-1215 project. Kindly share your best techno-commercial offer at the earliest.\n\n"
        "Regards,\nArchana Procurement"
    ),
    attachments=[("ENQUIRY PUNE TECHTROL P-1215.xlsx",
                  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                  b"PK\x03\x04placeholder xlsx content")],
    items=[{"tag": "FBG-01", "desc": "Float & board type level gauge, PP wetted",
            "type": "Level Gauge", "qty": 2,
            "matches": [{"model": "FBG-FN1WWG1M11111AW", "conf": 0.89, "why": "Matches P-1215 spec sheet."}]}],
)

# 4. Unitop Aquacare — real clarification email, NO attachment
add_real_enquiry(
    "REAL-4851", "Unitop Aquacare Ltd", "etpproject2@unitopaquacare.com",
    "ETP Level Switch Clarification (E-5044)", "E-5044", "OEM,MRO",
    subject="RE: PTLW/04851R1/26-27 — E-5044 / FLOAT LEVEL SWITCH - ENQUIRY",
    sender_email="etpproject2@unitopaquacare.com",
    body_text=(
        "Dear Ma'am,\n\nAs discussed, kindly confirm the following points:\n"
        "1. For the FTS-CJ62S model, we require the terminal enclosure with conduit connection considering two "
        "cable entries. However, kindly provide only one cable (L1) of 1.25 m length, as we already have the L2 "
        "cable in stock and will use the same.\n"
        "2. As per the FPS catalogue, we understand that the external chamber accessories are available for the "
        "FPS model. We would like to use the external chamber with the MFPS model as well. Kindly check the "
        "feasibility and confirm.\n\n"
        "If the above points are feasible, kindly share your revised offer accordingly. Also, please include the "
        "external chamber for both MFPS and FPS models for a total quantity of 7 Nos.\n\n"
        "Looking forward to your confirmation and revised offer.\n\nThanks & Regards,\nMrunal Gumgaonkar"
    ),
    attachments=None,
    items=[{"tag": "FTS-CJ62S", "desc": "Float operated tilt level switch with terminal enclosure",
            "type": "Level Switch", "qty": 7,
            "matches": [{"model": "FTS-CJ62S", "conf": 0.94, "why": "Exact model requested by customer in email."}]}],
)

# 5. Autometers Energitec — real short email, NO attachment
add_real_enquiry(
    "REAL-2114", "Autometers Energitec Ltd", "instt1@energitec.co.in",
    "Oil India Assam PRMS — Displacer Switch", "W793", "OEM,MRO",
    subject="RE: PTLW/02114/26-27, Fw: W793 - RFQ for the Supply of Level Gauge & Level Switch",
    sender_email="instt1@energitec.co.in",
    body_text=(
        "Dear Sir,\n\nPlease quote for displacer type magnetic level switch.\n\n"
        "Thanks & Regards\nVineet Chamoli\nAssistant Manager (C&I)"
    ),
    attachments=None,
    items=[{"tag": "DS-01", "desc": "Displacer type magnetic level switch",
            "type": "Level Switch", "qty": 3,
            "matches": [{"model": "DS-CFSA1MSWC", "conf": 0.85, "why": "Displacer type, matches customer's exact request."}]}],
)

db.commit()
db.close()
print("Done.")