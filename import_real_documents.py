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


def build_file_index(fyear_dashed):
    """
    Scans the entire fyear folder ONCE and builds a lookup:
    {qtnno_padded: [list of full file paths]}
    This replaces doing a fresh glob search per-case (745 times),
    which was the slow part — now we walk the drive just once.
    """
    fyear_folder = os.path.join(NETWORK_BASE, fyear_dashed)
    index = {}
    if not os.path.isdir(fyear_folder):
        print("fyear folder not found: " + fyear_folder)
        return index

    print("Scanning " + fyear_folder + " (this happens once)...")
    for root, dirs, files in os.walk(fyear_folder):
        for filename in files:
            # filenames look like "0025-ENQ.pdf" — grab the leading digits.
            prefix = filename.split("-")[0]
            if prefix.isdigit():
                key = prefix.zfill(4)
                index.setdefault(key, []).append(os.path.join(root, filename))
    print("Scan complete. Found files for " + str(len(index)) + " distinct QTN numbers.")
    return index


def main():
    db = SessionLocal()

    cases = db.query(InquiryCase).filter(
        InquiryCase.qtnno.isnot(None), InquiryCase.fyear.isnot(None)
    ).all()
    print("Checking " + str(len(cases)) + " cases with qtnno/fyear set...")

    # Group cases by fyear so we only scan each fyear folder once.
    by_fyear = {}
    for case in cases:
        by_fyear.setdefault(case.fyear, []).append(case)

    linked = 0
    already_had_docs = 0
    not_found = 0

    for fyear, fyear_cases in by_fyear.items():
        fyear_str = str(fyear)
        fyear_dashed = fyear_str[:2] + "-" + fyear_str[2:] if len(fyear_str) == 4 and "-" not in fyear_str else fyear_str

        file_index = build_file_index(fyear_dashed)

        for case in fyear_cases:
            existing_docs = db.query(InquiryDocument).filter_by(case_id=case.case_id).count()
            if existing_docs > 0:
                already_had_docs += 1
                continue

            qtnno_padded = str(case.qtnno).zfill(4)
            matched_files = file_index.get(qtnno_padded, [])

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