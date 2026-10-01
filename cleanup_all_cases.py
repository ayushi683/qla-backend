"""
One-off script: wipes ALL case-related data (cases, line items,
recommendations, quotations, pricing, feedback, outbound emails,
inbound emails, status history, documents) while leaving Users and
their permissions untouched.

Run from the project root (venv activated):
    python cleanup_all_cases.py
"""
from app.database import SessionLocal
from app.models.feedback import FeedbackEvent
from app.models.pricing import PricingSnapshot, PricingLine
from app.models.outbound import OutboundMessage
from app.models.quotation import QuotationDraft, QuotationLine
from app.models.match import ProductRecommendation
from app.models.extract import ExtractedLineItem
from app.models.email import EmailMessage
from app.models.document import InquiryDocument
from app.models.inquiry_case import InquiryCase, CaseStatusHistory

db = SessionLocal()

try:
    counts = {}

    counts["feedback_event"] = db.query(FeedbackEvent).delete()
    counts["pricing_line"] = db.query(PricingLine).delete()
    counts["pricing_snapshot"] = db.query(PricingSnapshot).delete()
    counts["outbound_message"] = db.query(OutboundMessage).delete()
    counts["quotation_line"] = db.query(QuotationLine).delete()
    counts["quotation_draft"] = db.query(QuotationDraft).delete()
    counts["product_recommendation"] = db.query(ProductRecommendation).delete()
    counts["extracted_line_item"] = db.query(ExtractedLineItem).delete()
    counts["email_message"] = db.query(EmailMessage).delete()
    counts["inquiry_document"] = db.query(InquiryDocument).delete()
    counts["case_status_history"] = db.query(CaseStatusHistory).delete()
    counts["inquiry_case"] = db.query(InquiryCase).delete()

    db.commit()

    print("✅ Cleanup complete. Rows deleted:")
    for table, n in counts.items():
        print(f"   {table}: {n}")
    print("\nUsers table untouched — logins still work.")

except Exception as e:
    db.rollback()
    print(f"❌ Failed: {e}")
    raise
finally:
    db.close()