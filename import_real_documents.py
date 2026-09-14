import os
import glob

from app.database import SessionLocal
from app.models.inquiry_case import InquiryCase
from app.models.document import InquiryDocument
from app.models.email import EmailMessage

NETWORK_BASE = r"F:\Data\Common\Quotation"
ENQUIRY_DOCS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "instance", "enquiry_docs")


def content_type_for(filepath):
    ext = filepath.lower().rsplit(".", 1)[-1] if "." in filepath else ""
    return {
        "pdf": "application/pdf",
        "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "xls": "application/vnd.ms-excel",
        "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "doc": "application/msword",
    }.get(ext, "application/octet-stream")


def find_enquiry_files(fyear, qtnno):
    """
    Files for a given QTN number live directly inside a batch-range
    folder (e.g. 26-27/0001-0100/0025-ENQ.pdf, 0025-something.xlsx),
    NOT inside a per-enquiry subfolder. We match every file whose name
    starts with the zero-padded QTN number followed by a dash.
    """
    fyear_str = str(fyear)
    if len(fyear_str) == 4 and "-" not in fyear_str:
        fyear_dashed = fyear_str[:2] + "-" + fyear_str[2:]
    else:
        fyear_dashed = fyear_str

    fyear_folder = os.path.join(NETWORK_BASE, fyear_dashed)
    if not os.path.isdir(fyear_folder):
        print("  (fyear folder not found: " + fyear_folder + ")")
        return []

    qtnno_padded = str(qtnno).zfill(4)
    pattern = os.path.join(fyear_folder, "*", qtnno_padded + "-*")
    matches = glob.glob(pattern)
    return [m for m in matches if os.path.isfile(m)]


def main():
    db = SessionLocal()

    cases = db.query(InquiryCase).filter(
        InquiryCase.qtnno.isnot(None), InquiryCase.fyear.isnot(None)
    ).all()

    print("Checking " + str(len(cases)) + " cases with qtnno/fyear set...")

    linked = 0
    already_had_docs = 0
    not_found = 0

    for case in cases:
        existing_docs = db.query(InquiryDocument).filter_by(case_id=case.case_id).count()
        if existing_docs > 0:
            already_had_docs += 1
            continue

        matched_files = find_enquiry_files(case.fyear, case.qtnno)
        if not matched_files:
            not_found += 1
            continue

        case_dir = os.path.join(ENQUIRY_DOCS_DIR, str(case.case_id))
        os.makedirs(case_dir, exist_ok=True)

        message = db.query(EmailMessage).filter_by(case_id=case.case_id, direction="INBOUND").first()
        message_id = message.message_id if message else None

        for src_path in matched_files:
            filename = os.path.basename(src_path)
            dest_path = os.path.join(case_dir, filename)
            with open(src_path, "rb") as f:
                content = f.read()
            with open(dest_path, "wb") as f:
                f.write(content)

            db.add(InquiryDocument(
                case_id=case.case_id, message_id=message_id, file_name=filename,
                relative_path=os.path.join("enquiry_docs", str(case.case_id), filename),
                blob_uri=os.path.join("enquiry_docs", str(case.case_id), filename),
                doc_role="ENQUIRY", content_type=content_type_for(filename), size_bytes=len(content),
            ))

        db.commit()
        linked += 1
        print("Linked " + str(len(matched_files)) + " file(s) to " + case.internal_ref + " (QTN " + case.qtnno + ")")

    db.close()
    print("")
    print("Done. Linked: " + str(linked) + ", Already had docs: " + str(already_had_docs) + ", Not found: " + str(not_found))


if __name__ == "__main__":
    main()