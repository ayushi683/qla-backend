from app.database import SessionLocal
from app.models.inquiry_case import InquiryCase

db = SessionLocal()
case = db.query(InquiryCase).filter_by(internal_ref="PTPL-2627-8388").first()
if case:
    print("Found! case_id =", case.case_id)
else:
    print("NOT FOUND for this internal_ref")

case42 = db.query(InquiryCase).filter_by(case_id=42).first()
if case42:
    print("case_id 42 belongs to:", case42.internal_ref)
else:
    print("No case with case_id=42 exists at all")

db.close()