import logging
import os

import requests

try:
    from dotenv import load_dotenv

    load_dotenv()
except Exception:
    pass

logger = logging.getLogger(__name__)

AI_MODEL_BASE_URL = os.environ.get("AI_MODEL_API_URL", "http://127.0.0.1:8100").rstrip("/")
# Identify + Azure DI + catalogue search routinely exceeds 40s.
AI_CONNECT_TIMEOUT = float(os.environ.get("AI_MODEL_CONNECT_TIMEOUT", "8"))
AI_READ_TIMEOUT = float(os.environ.get("AI_MODEL_READ_TIMEOUT", "300"))


class AiMatchError(Exception):
    """Raised when the pipeline on :8100 cannot be used."""

    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


def _base_url() -> str:
    return os.environ.get("AI_MODEL_API_URL", AI_MODEL_BASE_URL).rstrip("/")


def ping_ai_service() -> str | None:
    """Return None if healthy, otherwise a short reason."""
    url = _base_url() + "/health"
    try:
        response = requests.get(url, timeout=(AI_CONNECT_TIMEOUT, 8))
        if response.status_code >= 400:
            return f"AI matching service health check failed ({response.status_code}) at {url}."
        return None
    except requests.exceptions.ConnectionError:
        return (
            f"Could not connect to the AI matching service at {_base_url()}. "
            "Start it with start_all.bat (port 8100) and retry."
        )
    except requests.exceptions.Timeout:
        return f"AI matching service at {_base_url()} did not answer /health in time."
    except requests.exceptions.RequestException as exc:
        return f"AI matching service health check failed: {exc}"


def identify_product(files, email_text="", subject="", from_email="", top_families=6):
    """
    Calls the QLA pipeline identify-product API.
    'files' is a list of (filename, file_bytes, content_type) tuples.
    Returns parsed JSON. Raises AiMatchError on failure.
    """
    unreachable = ping_ai_service()
    if unreachable:
        logger.error("%s", unreachable)
        raise AiMatchError(unreachable)

    from app.enquiry_documents import is_price_or_quotation_file

    files = [
        (filename, file_bytes, content_type)
        for filename, file_bytes, content_type in (files or [])
        if not is_price_or_quotation_file(filename)
    ]

    url = _base_url() + "/api/v1/identify-product"
    data = {
        "email_text": email_text or "",
        "subject": subject or "",
        "from_email": from_email or "",
        "top_families": str(top_families),
    }
    file_payload = [
        ("attachments", (filename, file_bytes, content_type or "application/octet-stream"))
        for filename, file_bytes, content_type in files
    ]

    try:
        logger.info(
            "identify-product POST %s files=%s",
            url,
            [fn for fn, _b, _t in files],
        )
        response = requests.post(
            url,
            data=data,
            files=file_payload,
            timeout=(AI_CONNECT_TIMEOUT, AI_READ_TIMEOUT),
        )
        if response.status_code >= 400:
            detail = response.text[:400].strip() or response.reason
            raise AiMatchError(
                f"AI matching service returned HTTP {response.status_code}: {detail}"
            )
        return response.json()
    except AiMatchError:
        raise
    except requests.exceptions.Timeout:
        msg = (
            f"AI matching timed out after {int(AI_READ_TIMEOUT)}s. "
            "The service is running but the enquiry pack is still processing — retry once."
        )
        logger.error("%s", msg)
        raise AiMatchError(msg) from None
    except requests.exceptions.ConnectionError:
        msg = (
            f"Could not reach the AI matching service at {_base_url()}. "
            "Confirm port 8100 is running."
        )
        logger.error("%s", msg)
        raise AiMatchError(msg) from None
    except requests.exceptions.RequestException as exc:
        logger.exception("AI model call failed")
        raise AiMatchError(f"AI matching request failed: {exc}") from exc
    except ValueError as exc:
        raise AiMatchError(f"AI matching service returned invalid JSON: {exc}") from exc
