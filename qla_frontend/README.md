# QLA Admin Panel — Frontend (React)

Talks to the FastAPI backend (`qla_backend`). Built with React + Vite +
React Router — no other framework, no TypeScript.

## Setup

1. **Install Node.js** if you don't have it (v18+): https://nodejs.org

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Check `.env`** — should already have:
   ```
   VITE_API_BASE=http://localhost:8000
   ```
   Change this if your backend runs somewhere else.

4. **Make sure the backend is running first** (in a separate terminal,
   from the `qla_backend` folder — see its own README).

5. **Run the dev server:**
   ```bash
   npm run dev
   ```
   Opens at **http://localhost:5173**

6. **Log in** with `admin@techtrol.com` / `admin123` (created by the
   backend's `seed.py`).

## What's built

- **Login** — email/password, only ADMIN role works (per the backend's rule)
- **Review Queue** (home page) — pending/rejected items, auto-refreshes
  every 12 seconds so new enquiries show up without a manual reload
- **Approve / Reject / Edit** — on every match, with an "Other suggested
  matches" section to switch to an alternative AI candidate
- **All Cases** — full list, click through to any case
- **Case Detail** — every line item for a case (approved ones too),
  plus an **Original Enquiry** section showing real attached documents
  (calls the backend's `/api/cases/{id}/documents` — this is NOT a
  placeholder, it actually works if documents exist for that case)
- **Quotation page** — the generated Word doc (real download, not a
  dead link) + the draft email preview

## Design

- Green theme matching Techtrol's brand (`src/index.css` has all the
  color tokens at the top — change them there to retheme everything)
- Responsive — tested down to mobile width (390px)

## Project structure

```
src/
├── api/
│   ├── client.js       API calls (fetch wrapper + JWT handling)
│   └── usePolling.js   Auto-refresh hook (12s interval)
├── context/
│   └── AuthContext.jsx Login state, shared across the app
├── components/
│   ├── Topbar.jsx       Nav bar
│   └── ReviewCard.jsx   The core card: match + approve/reject/edit/pick
├── pages/
│   ├── Login.jsx
│   ├── ReviewQueue.jsx
│   ├── CasesList.jsx
│   ├── CaseDetail.jsx
│   └── QuotationDetail.jsx
├── App.jsx              Routing + login guard
└── index.css             All styles + color tokens
```

## Build for production

```bash
npm run build
```
Outputs static files to `dist/` — serve with any static host (nginx,
Vercel, Netlify, etc.), just make sure `VITE_API_BASE` points at your
deployed backend before building.

## Known gaps (not built yet, same as the backend's list)

- No Outlook/Microsoft login for non-admin roles
- No "send email" button — the draft email is preview-only
- No pricing shown (backend doesn't have a pricing engine wired in yet)
