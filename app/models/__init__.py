"""
Import every model class here so SQLAlchemy's mapper configuration
can resolve all the string-based relationship() references
(e.g. Mapped["InquiryCase"]) across files. Order mostly doesn't matter
for SQLAlchemy 2.0 declarative mapping, but we group related ones together
for readability.
"""

from app.models.base import Base, utcnow  # noqa: F401

from app.models.party import Party  # noqa: F401
from app.models.user import AppUser, Permission, UserPermission, UserLoginEvent  # noqa: F401

from app.models.inquiry_case import InquiryCase, CaseStatusHistory  # noqa: F401
from app.models.email import EmailThread, EmailMessage  # noqa: F401
from app.models.document import InquiryDocument  # noqa: F401
from app.models.extract import ExtractedLineItem  # noqa: F401
from app.models.match import CatalogueProduct, ProductRecommendation, EvidenceCitation  # noqa: F401

from app.models.quotation import QuotationDraft, QuotationLine  # noqa: F401
from app.models.approval import ApprovalRecord  # noqa: F401
from app.models.pricing import PricingSnapshot, PricingLine  # noqa: F401
from app.models.outbound import OutboundMessage  # noqa: F401
from app.models.erp import ErpSyncJob  # noqa: F401
from app.models.portal import PortalSubmission  # noqa: F401
from app.models.feedback import FeedbackEvent  # noqa: F401
from app.models.fingerprint import FingerprintIndex  # noqa: F401
from app.models.legacy_backlog import BacklogCase, CaseDocument, CaseEvent  # noqa: F401
from app.models.telemetry import TokenUsage, AuditLog  # noqa: F401

__all__ = [
    "Base", "utcnow",
    "Party",
    "AppUser", "Permission", "UserPermission", "UserLoginEvent",
    "InquiryCase", "CaseStatusHistory",
    "EmailThread", "EmailMessage",
    "InquiryDocument",
    "ExtractedLineItem",
    "CatalogueProduct", "ProductRecommendation", "EvidenceCitation",
    "QuotationDraft", "QuotationLine",
    "ApprovalRecord",
    "PricingSnapshot", "PricingLine",
    "OutboundMessage",
    "ErpSyncJob",
    "PortalSubmission",
    "FeedbackEvent",
    "FingerprintIndex",
    "BacklogCase", "CaseDocument", "CaseEvent",
    "TokenUsage", "AuditLog",
]
