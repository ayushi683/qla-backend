from app.database import SessionLocal
from app.models.inquiry_case import InquiryCase

db = SessionLocal()

cases = db.query(InquiryCase).filter(
    InquiryCase.internal_ref.like("PTPL-%"),
    InquiryCase.category.like("%,%"),
).all()

print("Fixing " + str(len(cases)) + " cases with comma-joined categories...")

for case in cases:
    # Take just the first category from the comma-joined string.
    first_category = case.category.split(",")[0].strip()
    case.category = first_category

db.commit()
db.close()
print("Done.")