import { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";

function statusClass(status) {
  return `status-pill status-${(status || "").toLowerCase()}`;
}

export default function QuotationDetail() {
  const { caseId } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);

  const [editing, setEditing] = useState(false);
  const [subject, setSubject] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [saving, setSaving] = useState(false);

  function load() {
    api.quotationDetail(caseId)
      .then(setData)
      .catch((e) => setError(e.message || "No quotation generated yet for this case — approve every line item first."));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);

  async function handleDownload() {
    if (!data?.quotation?.docx_blob_uri) return;
    const filename = data.quotation.docx_blob_uri.split("/").pop();
    setDownloading(true);
    try {
      await api.downloadBlob(`/api/quotations/download/${filename}`, filename);
    } catch (e) {
      setError(e.message || "Download failed");
    } finally {
      setDownloading(false);
    }
  }

  function startEdit() {
    setSubject(data.outbound.subject || "");
    setBodyText(data.outbound.body_text || "");
    setEditing(true);
  }

  async function handleSaveEmail(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api.updateDraftEmail(caseId, { subject, body_text: bodyText });
      setEditing(false);
      load();
    } catch (e) {
      setError(e.message || "Failed to save email");
    } finally {
      setSaving(false);
    }
  }

  if (error) {
    return (
      <div className="page">
        <Link className="back-link" to={`/cases/${caseId}`}>&larr; Back to case</Link>
        <div className="flash flash-info">{error}</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="page">
        <div className="loading-state">Loading…</div>
      </div>
    );
  }

  const { case: caseInfo, quotation, lines, outbound } = data;
  const filename = quotation.docx_blob_uri ? quotation.docx_blob_uri.split("/").pop() : null;

  return (
    <div className="page">
      <Link className="back-link" to={`/cases/${caseId}`}>&larr; {caseInfo.internal_ref}</Link>

      <div className="case-header">
        <h1 className="page-title">Quotation — {caseInfo.internal_ref} R{quotation.revision_no}</h1>
        <span className={statusClass(quotation.status)}>{quotation.status}</span>
      </div>
      <p className="case-meta">{caseInfo.project_name || "No project name"}</p>

      <div className="quote-doc-card">
        <div className="quote-doc-head">
          <div>
            <div className="quote-doc-label">Generated document</div>
            <div className="quote-doc-filename">{filename || "Not generated"}</div>
          </div>
          {filename && (
            <button className="btn btn-approve" onClick={handleDownload} disabled={downloading}>
              {downloading ? "Downloading…" : "Download .docx"}
            </button>
          )}
        </div>
        {quotation.pricing_blank && (
          <p className="pricing-note">⚠ Pricing not included — this document lists model numbers and specs only. Pricing needs to be added separately before sending.</p>
        )}
      </div>

      <h2 className="section-heading">Line items</h2>
      <table className="data-table">
        <thead>
          <tr><th>#</th><th>Model</th><th>Description</th><th>Qty</th><th>Spec</th></tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.line_no}>
              <td>{line.line_no}</td>
              <td><code>{line.model_code || "—"}</code></td>
              <td>{line.description || "—"}</td>
              <td>{line.qty || "—"} {line.uom}</td>
              <td className="alt-rationale">{line.technical_spec_text || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {outbound && (
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 26, marginBottom: 12 }}>
            <h2 className="section-heading" style={{ margin: 0 }}>Draft email</h2>
            {!editing && (
              <button className="btn btn-approve" onClick={startEdit} style={{ padding: "8px 18px" }}>
                ✎ Edit Email
              </button>
            )}
          </div>

          {error && <div className="flash flash-error">{error}</div>}

          {editing ? (
            <form className="email-draft-card" onSubmit={handleSaveEmail}>
              <label style={{ display: "block", fontSize: "0.78rem", color: "var(--muted)", marginBottom: 4 }}>Subject</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                style={{ width: "100%", padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 7, marginBottom: 14, fontFamily: "inherit", fontSize: "0.9rem" }}
              />
              <label style={{ display: "block", fontSize: "0.78rem", color: "var(--muted)", marginBottom: 4 }}>Body</label>
              <textarea
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
                rows={12}
                style={{ width: "100%", padding: "10px", border: "1px solid var(--border)", borderRadius: 7, fontFamily: "inherit", fontSize: "0.9rem", resize: "vertical" }}
              />
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button type="submit" className="btn btn-save" disabled={saving}>
                  {saving ? "Saving…" : "Save changes"}
                </button>
                <button type="button" className="btn btn-edit" onClick={() => setEditing(false)}>Cancel</button>
              </div>
            </form>
          ) : (
            <div className="email-draft-card">
              <div className="email-field"><span>To</span> {outbound.to_emails?.length ? outbound.to_emails.join(", ") : "— (customer email not on file)"}</div>
              <div className="email-field"><span>Subject</span> {outbound.subject}</div>
              <hr />
              <pre className="email-body">{outbound.body_text}</pre>
              <div className="email-status">
                Status: <span className="state-pill state-pending">{outbound.send_status}</span>
                {" "}— this is a draft only. Sending isn't wired up yet.
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}