import os
import requests

AI_MODEL_BASE_URL = os.environ.get("AI_MODEL_API_URL", "http://localhost:8100")


def identify_product(files, email_text="", subject="", from_email="", top_families=6):
    """
    Calls Ninad's AI model. 'files' is a list of (filename, file_bytes, content_type) tuples.
    Requires at least one file. Takes ~20 seconds (intentional delay on his side).
    Returns the parsed JSON response, or None on failure.
    """
    url = AI_MODEL_BASE_URL + "/api/v1/identify-product"

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
        response = requests.post(url, data=data, files=file_payload, timeout=40)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print("AI model call failed:", e)
        return None