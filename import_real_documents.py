import os

from app.database import SessionLocal
from app.enquiry_documents import find_enquiry_files, list_related_enquiry_documents
from app.models.inquiry_case import InquiryCase

NETWORK_BASE = os.environ.get("QUOTATION_FILES_ROOT", r"F:\Data\Common\Quotation")


def main():
    db = SessionLocal()

    cases = db.query(InquiryCase).filter(
        InquiryCase.qtnno.isnot(None), InquiryCase.fyear.isnot(None)
    ).all()

    print("Checking " + str(len(cases)) + " cases with qtnno/fyear set...")

    linked = 0
    refreshed = 0
    not_found = 0

    seen_groups = set()
    for case in cases:
        group = (str(case.qtnno), str(case.fyear))
        if group in seen_groups:
            continue
        seen_groups.add(group)

        matched_files = find_enquiry_files(case.fyear, case.qtnno)
        if not matched_files and not os.path.isdir(os.path.join("instance", "enquiry_docs", str(case.case_id))):
            not_found += 1
            continue

        before = 0
        docs = list_related_enquiry_documents(db, case)
        after = len(docs)
        if after > before:
            linked += 1
            print(
                "Linked/refreshed "
                + str(after)
                + " file(s) for QTN "
                + str(case.qtnno)
                + " ("
                + str(case.fyear)
                + ")"
            )
        else:
            refreshed += 1

    db.close()
    print("")
    print(
        "Done. Groups with files: "
        + str(linked)
        + ", already complete: "
        + str(refreshed)
        + ", not found: "
        + str(not_found)
    )
    print("Share root: " + NETWORK_BASE)


if __name__ == "__main__":
    main()
