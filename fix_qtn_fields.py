from app.database import SessionLocal
from app.models.inquiry_case import InquiryCase

db = SessionLocal()

cases = db.query(InquiryCase).filter(
    InquiryCase.source_type == "BACKLOG",
    InquiryCase.qtnno.is_(None),
).all()

print("Fixing " + str(len(cases)) + " cases...")

fixed = 0
skipped = 0

for case in cases:
    parts = case.internal_ref.split("-")
    if len(parts) >= 3 and parts[0] == "PTPL":
        fyear = parts[1]
        qtnno = parts[2]
        case.qtnno = qtnno
        case.fyear = fyear
        fixed += 1
    else:
        skipped += 1

db.commit()
db.close()
print("Fixed: " + str(fixed) + ", Skipped (unexpected format): " + str(skipped))