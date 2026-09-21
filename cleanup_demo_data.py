from app.database import SessionLocal
from app.models.inquiry_case import InquiryCase, CaseStatusHistory
from app.models.extract import ExtractedLineItem
from app.models.match import ProductRecommendation
from app.models.document import InquiryDocument
from app.models.email import EmailThread, EmailMessage
from app.models.quotation import QuotationDraft, QuotationLine
from app.models.outbound import OutboundMessage
from app.models.pricing import PricingSnapshot, PricingLine

db = SessionLocal()

# Delete anything NOT from the real PTPL import — i.e. everything
# whose internal_ref does not start with "PTPL-".
all_cases = db.query(InquiryCase).all()
test_cases = [c for c in all_cases if not c.internal_ref.startswith("PTPL-")]

print("Found " + str(len(test_cases)) + " non-PTPL (demo/real/test) cases to remove.")

for case in test_cases:
    line_items = db.query(ExtractedLineItem).filter_by(case_id=case.case_id).all()
    for li in line_items:
        db.query(ProductRecommendation).filter_by(line_item_id=li.line_item_id).delete()

    drafts = db.query(QuotationDraft).filter_by(case_id=case.case_id).all()
    for d in drafts:
        quote_lines = db.query(QuotationLine).filter_by(draft_id=d.draft_id).all()
        for ql in quote_lines:
            db.query(PricingLine).filter_by(quote_line_id=ql.quote_line_id).delete()
        db.query(QuotationLine).filter_by(draft_id=d.draft_id).delete()
        db.query(PricingSnapshot).filter_by(draft_id=d.draft_id).delete()
        db.query(OutboundMessage).filter_by(draft_id=d.draft_id).delete()

    db.query(ExtractedLineItem).filter_by(case_id=case.case_id).delete()
    db.query(InquiryDocument).filter_by(case_id=case.case_id).delete()
    db.query(CaseStatusHistory).filter_by(case_id=case.case_id).delete()

    threads = db.query(EmailThread).filter_by(case_id=case.case_id).all()
    for t in threads:
        db.query(EmailMessage).filter_by(thread_id=t.thread_id).delete()
        db.delete(t)

    db.delete(case)
    print("Removed " + case.internal_ref)

db.commit()
db.close()
print("Done. Cleanup complete — only real PTPL-* cases remain.")