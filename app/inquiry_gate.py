"""Skip the model for deleted and other closed enquiry numbers.

The list lives with the matcher (data/inquiry_status.json). PTPL-2627-4709
and 4709 are the same enquiry.
"""

from __future__ import annotations

import json
import os
import re
from functools import lru_cache
from pathlib import Path

DELETED_MESSAGE = "This enquiry is deleted."

_STATUS_CANDIDATES = (
    os.environ.get("INQUIRY_STATUS_JSON") or "",
    str(
        Path(__file__).resolve().parents[2]
        / "QLA_STAGING"
        / "testscatelogbasemodel"
        / "data"
        / "inquiry_status.json"
    ),
)


def qtn_key(qtnno: str | None) -> str:
    raw = (qtnno or "").strip().upper()
    raw = re.sub(r"\s+", "", raw)
    raw = re.sub(r"\.0$", "", raw)
    raw = re.sub(r"-?R\d+$", "", raw)
    if raw.isdigit():
        return raw
    match = re.search(r"(\d{3,6})$", raw)
    return match.group(1) if match else raw


@lru_cache
def _table() -> dict[str, str]:
    path = next((Path(p) for p in _STATUS_CANDIDATES if p and Path(p).is_file()), None)
    if path is None:
        return {}
    payload = json.loads(path.read_text(encoding="utf-8"))
    out: dict[str, str] = {}
    rank = {
        "deleted": 8,
        "duplicate_offer": 7,
        "not_quoting": 6,
        "correspondence": 5,
        "no_priority": 4,
        "address_missing": 3,
        "not_clear": 3,
        "non_techtrol": 2,
        "out_of_range": 1,
    }
    for status, values in (payload.get("by_status") or {}).items():
        for qtn in values or []:
            key = qtn_key(str(qtn))
            if not key:
                continue
            prev = out.get(key)
            if prev is None or rank.get(str(status), 0) >= rank.get(prev, 0):
                out[key] = str(status)
    return out


def status_for_case(qtnno: str | None, internal_ref: str | None = None) -> str | None:
    for value in (qtnno, internal_ref):
        found = _table().get(qtn_key(value))
        if found:
            return found
    return None


def block_message(status: str | None) -> str | None:
    return {
        "deleted": DELETED_MESSAGE,
        "non_techtrol": "This product is not available at Techtrol.",
        "out_of_range": "This enquiry is not being quoted.",
        "not_quoting": "This enquiry is not being quoted.",
        "not_clear": "This enquiry is not clear.",
        "no_priority": "This enquiry has no priority.",
        "correspondence": "This enquiry is correspondence.",
        "address_missing": "Customer address is not given.",
        "duplicate_offer": "The same offer is already submitted for this enquiry.",
    }.get(status or "")
