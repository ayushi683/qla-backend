"""Resolve every attachment that belongs to an enquiry (qtnno + fyear).

Original Enquiry must show revision packs and non-PDF/XLSX files, not
only the documents stored on the currently opened case row.
"""
from __future__ import annotations

import glob
import os
import re
import shutil
from typing import Iterable

from sqlalchemy.orm import Session

from app.models.document import InquiryDocument
from app.models.email import EmailMessage
from app.models.inquiry_case import InquiryCase
from app.schemas import DocumentOut

BACKEND_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INSTANCE_DIR = os.path.join(BACKEND_ROOT, "instance")
ENQUIRY_DOCS_DIR = os.path.join(INSTANCE_DIR, "enquiry_docs")
NETWORK_BASE = os.environ.get("QUOTATION_FILES_ROOT", r"F:\Data\Common\Quotation")

_SKIP_NAMES = {"thumbs.db", "desktop.ini", ".ds_store"}
_SKIP_PREFIXES = ("~$", ".")

# Never send Techtrol price lists / issued quotations into the matching API.
_PRICE_QUOTE_RE = re.compile(
    r"(?i)(^|[^a-z0-9])"
    r"(prices?|pricelist|price[\s_\-]*list|quotations?|quotes?)"
    r"([^a-z0-9]|$)"
)
_SPREADSHEET_EXT = {".xlsx", ".xls", ".xlsm", ".csv", ".ods"}

_CONTENT_TYPES = {
    "pdf": "application/pdf",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "xlsm": "application/vnd.ms-excel.sheet.macroEnabled.12",
    "xls": "application/vnd.ms-excel",
    "csv": "text/csv",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "doc": "application/msword",
    "rtf": "application/rtf",
    "txt": "text/plain",
    "png": "image/png",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "gif": "image/gif",
    "tif": "image/tiff",
    "tiff": "image/tiff",
    "bmp": "image/bmp",
    "webp": "image/webp",
    "zip": "application/zip",
    "rar": "application/vnd.rar",
    "7z": "application/x-7z-compressed",
    "msg": "application/vnd.ms-outlook",
    "eml": "message/rfc822",
    "dwg": "image/vnd.dwg",
    "dxf": "image/vnd.dxf",
    "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "ppt": "application/vnd.ms-powerpoint",
    "html": "text/html",
    "htm": "text/html",
    "xml": "application/xml",
    "json": "application/json",
}


def resolve_document_disk_path(doc: InquiryDocument) -> str | None:
    candidates = []
    for rel in (doc.blob_uri, doc.relative_path):
        if not rel:
            continue
        rel_norm = str(rel).replace("/", os.sep).replace("\\", os.sep)
        if os.path.isabs(rel_norm):
            candidates.append(rel_norm)
        else:
            candidates.append(os.path.join(INSTANCE_DIR, rel_norm.lstrip("\\/")))
    if doc.case_id and doc.file_name:
        candidates.append(os.path.join(ENQUIRY_DOCS_DIR, str(doc.case_id), doc.file_name))
    seen = set()
    for path in candidates:
        key = os.path.normcase(os.path.abspath(path))
        if key in seen:
            continue
        seen.add(key)
        if os.path.isfile(path):
            return path
    return None


def content_type_for(filename: str) -> str:
    ext = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""
    return _CONTENT_TYPES.get(ext, "application/octet-stream")


def is_price_or_quotation_file(name: str) -> bool:
    """True for PRICE.xlsx / quotation drafts — never send these to the AI matcher."""
    base = os.path.basename(name or "")
    if not base or base.startswith("~$"):
        return False
    stem, ext = os.path.splitext(base.lower())
    if ext == ".doc" and re.fullmatch(r"0*\d{3,6}", stem):
        return True
    if re.search(r"(?i)(?:^|[_\-])corr(?:[_\-.]|$)", base) and ext == ".pdf":
        return True
    if _PRICE_QUOTE_RE.search(base):
        return True
    if ext in _SPREADSHEET_EXT and "price" in stem:
        return True
    return False


def _is_keep_file(name: str) -> bool:
    if not name or name.lower() in _SKIP_NAMES:
        return False
    return not name.startswith(_SKIP_PREFIXES)


def _qtn_int(qtnno: str | None) -> int | None:
    if qtnno is None:
        return None
    digits = re.sub(r"\D", "", str(qtnno))
    if not digits:
        return None
    try:
        return int(digits)
    except ValueError:
        return None


def filename_belongs_to_qtn(filename: str, qtnno: str | None) -> bool:
    """True when a stored filename is for this quotation number.

    Accepts 4545-ENQ.pdf, 4545_R1.xlsx, 4545R2-details.doc, 04545-corr.pdf.
    Rejects neighbouring numbers such as 45450-ENQ.pdf.
    """
    qtn = _qtn_int(qtnno)
    if qtn is None:
        return False
    stem = os.path.basename(filename)
    return re.match(rf"^0*{qtn}(?!\d)", stem, flags=re.IGNORECASE) is not None


def related_cases(db: Session, case: InquiryCase) -> list[InquiryCase]:
    if case.qtnno and case.fyear:
        siblings = (
            db.query(InquiryCase)
            .filter_by(qtnno=case.qtnno, fyear=case.fyear)
            .order_by(InquiryCase.revision_no, InquiryCase.case_id)
            .all()
        )
        if siblings:
            return siblings
    return [case]


def _fyear_dashed(fyear: str) -> str:
    fyear_str = str(fyear)
    if len(fyear_str) == 4 and "-" not in fyear_str:
        return fyear_str[:2] + "-" + fyear_str[2:]
    return fyear_str


def find_enquiry_files(fyear, qtnno) -> list[str]:
    """Every file on the quotation share for this QTN, including revision folders."""
    fyear_folder = os.path.join(NETWORK_BASE, _fyear_dashed(str(fyear)))
    if not os.path.isdir(fyear_folder):
        return []

    qtn = _qtn_int(str(qtnno))
    if qtn is None:
        return []
    padded = str(qtn).zfill(4)
    found: list[str] = []

    for batch_dir in glob.glob(os.path.join(fyear_folder, "*")):
        if not os.path.isdir(batch_dir):
            continue
        try:
            names = os.listdir(batch_dir)
        except OSError:
            continue
        for name in names:
            path = os.path.join(batch_dir, name)
            if os.path.isfile(path):
                if filename_belongs_to_qtn(name, padded) and _is_keep_file(name):
                    found.append(path)
                continue
            if os.path.isdir(path) and filename_belongs_to_qtn(name, padded):
                for root, _dirs, files in os.walk(path):
                    for fname in files:
                        if _is_keep_file(fname):
                            found.append(os.path.join(root, fname))

    uniq: dict[str, str] = {}
    for path in found:
        uniq[os.path.normcase(os.path.abspath(path))] = path
    return list(uniq.values())


def _revision_tag_from_name(filename: str) -> str | None:
    match = re.search(r"(?:^|[^A-Z0-9])R(?:EV)?[\s._-]*(\d+)\b", filename, flags=re.IGNORECASE)
    if match:
        return f"R{int(match.group(1))}"
    return None


def _message_id_for(db: Session, case_id: int) -> int | None:
    message = (
        db.query(EmailMessage)
        .filter_by(case_id=case_id, direction="INBOUND")
        .first()
    )
    return message.message_id if message else None


def _register_file(
    db: Session,
    case: InquiryCase,
    src_path: str,
    filename: str | None = None,
    copy_into_case_dir: bool = True,
) -> InquiryDocument | None:
    filename = os.path.basename(filename or src_path)
    if not _is_keep_file(filename):
        return None

    case_dir = os.path.join(ENQUIRY_DOCS_DIR, str(case.case_id))
    os.makedirs(case_dir, exist_ok=True)

    if copy_into_case_dir:
        dest_path = os.path.join(case_dir, filename)
        src_abs = os.path.abspath(src_path)
        dest_abs = os.path.abspath(dest_path)
        if src_abs != dest_abs:
            if not os.path.isfile(src_path):
                return None
            shutil.copy2(src_path, dest_path)
        relative = os.path.join("enquiry_docs", str(case.case_id), filename)
    else:
        dest_path = src_path
        try:
            relative = os.path.relpath(os.path.abspath(src_path), INSTANCE_DIR)
        except ValueError:
            relative = os.path.join("enquiry_docs", str(case.case_id), filename)

    if not os.path.isfile(dest_path):
        return None
    size_bytes = os.path.getsize(dest_path)
    existing = (
        db.query(InquiryDocument)
        .filter_by(case_id=case.case_id, file_name=filename)
        .first()
    )
    if existing:
        if not existing.blob_uri:
            existing.blob_uri = relative
            existing.relative_path = relative
        if not existing.size_bytes:
            existing.size_bytes = size_bytes
        if not existing.content_type:
            existing.content_type = content_type_for(filename)
        if not existing.revision_tag:
            existing.revision_tag = _revision_tag_from_name(filename)
        return existing

    doc = InquiryDocument(
        case_id=case.case_id,
        message_id=_message_id_for(db, case.case_id),
        file_name=filename,
        relative_path=relative,
        blob_uri=relative,
        doc_role="ENQUIRY",
        content_type=content_type_for(filename),
        size_bytes=size_bytes,
        revision_tag=_revision_tag_from_name(filename),
        is_docx_skipped=False,
    )
    db.add(doc)
    db.flush()
    return doc


def _sync_case_folder(db: Session, case: InquiryCase) -> None:
    case_dir = os.path.join(ENQUIRY_DOCS_DIR, str(case.case_id))
    if not os.path.isdir(case_dir):
        return
    for root, _dirs, files in os.walk(case_dir):
        for name in files:
            path = os.path.join(root, name)
            if os.path.isfile(path):
                _register_file(db, case, path, filename=name, copy_into_case_dir=False)


def _target_case_for_file(cases: list[InquiryCase], filename: str, fallback: InquiryCase) -> InquiryCase:
    tag = _revision_tag_from_name(filename)
    if tag:
        rev_no = int(tag[1:])
        for case in cases:
            if (case.revision_no or 0) == rev_no:
                return case
    return fallback


def _sync_network_files(db: Session, cases: list[InquiryCase], fallback: InquiryCase) -> None:
    sample = fallback
    if not sample.qtnno or not sample.fyear:
        return
    if not os.path.isdir(NETWORK_BASE):
        return
    try:
        matched = find_enquiry_files(sample.fyear, sample.qtnno)
    except OSError:
        return

    known_names = set()
    for case in cases:
        case_dir = os.path.join(ENQUIRY_DOCS_DIR, str(case.case_id))
        if os.path.isdir(case_dir):
            try:
                known_names.update(n.lower() for n in os.listdir(case_dir) if _is_keep_file(n))
            except OSError:
                pass
        for doc in db.query(InquiryDocument).filter_by(case_id=case.case_id).all():
            known_names.add(doc.file_name.lower())

    for src_path in matched:
        filename = os.path.basename(src_path)
        if filename.lower() in known_names:
            continue
        target = _target_case_for_file(cases, filename, fallback)
        registered = _register_file(db, target, src_path, filename=filename)
        if registered:
            known_names.add(filename.lower())


def _document_out(doc: InquiryDocument, case_by_id: dict[int, InquiryCase]) -> DocumentOut:
    case = case_by_id.get(doc.case_id)
    payload = DocumentOut.model_validate(doc)
    extra = {}
    if case is not None:
        extra["revision_no"] = case.revision_no or 0
    if doc.revision_tag:
        extra["revision_tag"] = doc.revision_tag
    elif extra.get("revision_no") not in (None, 0):
        extra["revision_tag"] = f"R{extra['revision_no']}"
    if extra:
        payload = payload.model_copy(update=extra)
    return payload


def _dedupe_docs(docs: Iterable[InquiryDocument]) -> list[InquiryDocument]:
    seen: dict[tuple[str, int], InquiryDocument] = {}
    ordered: list[InquiryDocument] = []
    for doc in docs:
        key = (doc.file_name.lower(), int(doc.size_bytes or 0))
        if key in seen:
            continue
        seen[key] = doc
        ordered.append(doc)
    return ordered


def collect_related_documents(db: Session, case: InquiryCase) -> list[InquiryDocument]:
    """Sync then return unique ORM rows for this exact QTN (all revisions)."""
    cases = related_cases(db, case)
    case_by_id = {c.case_id: c for c in cases}

    for sibling in cases:
        _sync_case_folder(db, sibling)
    _sync_network_files(db, cases, case)
    db.commit()

    docs: list[InquiryDocument] = []
    for sibling in cases:
        docs.extend(
            db.query(InquiryDocument)
            .filter_by(case_id=sibling.case_id)
            .order_by(InquiryDocument.created_at, InquiryDocument.document_id)
            .all()
        )

    unique = _dedupe_docs(docs)
    unique.sort(
        key=lambda d: (
            case_by_id.get(d.case_id).revision_no if case_by_id.get(d.case_id) else 0,
            d.file_name.lower(),
        )
    )
    return unique


def list_related_enquiry_documents(db: Session, case: InquiryCase) -> list[DocumentOut]:
    """All enquiry files for this exact QTN (this case + revision siblings)."""
    cases = related_cases(db, case)
    case_by_id = {c.case_id: c for c in cases}
    return [_document_out(d, case_by_id) for d in collect_related_documents(db, case)]


def load_ai_enquiry_files(db: Session, case: InquiryCase) -> tuple[list[tuple[str, bytes, str]], list[str]]:
    """All enquiry attachments for matching, excluding price and quotation files.

    Returns (files_for_api, skipped_names).
    """
    docs = collect_related_documents(db, case)
    cases = related_cases(db, case)

    seen_paths: set[str] = set()
    skipped: list[str] = []
    files_for_api: list[tuple[str, bytes, str]] = []

    def _add_path(path: str, filename: str) -> None:
        if not path or not os.path.isfile(path):
            return
        key = os.path.normcase(os.path.abspath(path))
        if key in seen_paths:
            return
        seen_paths.add(key)
        if is_price_or_quotation_file(filename) or is_price_or_quotation_file(path):
            skipped.append(filename or os.path.basename(path))
            return
        with open(path, "rb") as fh:
            files_for_api.append((filename, fh.read(), content_type_for(filename)))

    for doc in docs:
        _add_path(resolve_document_disk_path(doc) or "", doc.file_name)

    # Disk folders can hold extra specs not yet in the documents table
    for sibling in cases:
        case_dir = os.path.join(ENQUIRY_DOCS_DIR, str(sibling.case_id))
        if not os.path.isdir(case_dir):
            continue
        for root, _dirs, names in os.walk(case_dir):
            for name in names:
                if not _is_keep_file(name):
                    continue
                _add_path(os.path.join(root, name), name)

    return files_for_api, skipped
