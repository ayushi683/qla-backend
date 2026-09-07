# QLA Admin API (FastAPI backend)

This replaces the earlier Flask version with a JSON API, so a separate
React frontend (built with Cursor or otherwise) can talk to it.

Same database schema (`app/models/*`, unchanged from the shared
`models.zip`), same business logic (review queue, approve/reject/edit,
automatic quotation generation) — just exposed as REST endpoints
instead of server-rendered HTML pages.

## Run locally (without Docker)

```bash
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
python seed.py                  # creates DB + demo admin + demo cases
uvicorn app.main:app --reload --port 8000
```

API docs (auto-generated): **http://127.0.0.1:8000/docs**

## Run with Docker

```bash
docker compose up --build
```

This runs `seed.py` then starts the API on port 8000. The `instance/`
folder (SQLite DB + generated quotation `.docx` files) is mounted as a
volume, so data survives container restarts.

## Auth

Login returns a JWT:
```
POST /api/auth/login
{ "email": "admin@techtrol.com", "password": "admin123" }
→ { "access_token": "...", "user": {...} }
```

Every other endpoint requires `Authorization: Bearer <token>`.

Same rule as before: only `role == "ADMIN"` can log in with a password.
Other roles are expected to use Outlook/Microsoft login, which isn't
built here (needs Azure app registration credentials — separate task).

## Endpoints

| Method | Path | What it does |
|---|---|---|
| POST | `/api/auth/login` | Log in, get a JWT |
| GET | `/api/auth/me` | Current user info |
| GET | `/api/review-queue` | Line items still needing a decision (pending or rejected) |
| GET | `/api/cases` | All cases |
| GET | `/api/cases/{id}` | One case + its line items + recommendations + quotation summary |
| POST | `/api/recommendations/{id}/approve` | Approve a match (may trigger quotation generation) |
| POST | `/api/recommendations/{id}/reject` | Reject a match |
| POST | `/api/recommendations/{id}/edit` | Manually correct model_code/rationale |
| POST | `/api/line-items/{line_item_id}/pick/{recommendation_id}` | Promote an alternative candidate to the top spot |
| GET | `/api/cases/{id}/quotation` | The generated quotation (lines + draft email) |
| GET | `/api/quotations/download/{filename}` | Download the generated `.docx` |
| GET | `/api/cases/{id}/documents` | List of enquiry documents (PDFs etc.) attached to a case |
| GET | `/api/documents/download/{document_id}` | Download an enquiry document |
| POST | `/api/enquiries/ingest` | **Not for the frontend** — called by the Outlook listener service (separate API-key auth, not user JWT) to register a new enquiry |

See **CURSOR_HANDOFF.md** (in the parent folder) for the full frontend
build spec — screens, design direction, and example request/response
payloads for each endpoint.

## What this does NOT include

- Outlook/Microsoft OAuth login for non-admin roles
- Actually sending the drafted email (it's saved as `send_status="PENDING"` only)
- A pricing engine (quotations list model numbers/specs only, `pricing_blank=True`)
- The AI extraction/matching model itself, or the Outlook email listener
  (both built separately, write into the same database)
