import { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import GenerateQuotationModal from "../components/GenerateQuotationModal";

function statusClass(status) {
  return `status-pill status-${(status || "").toLowerCase()}`;
}

export default function QuotationDetail() {
  const { caseId } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [documents, setDocuments] = useState(null);

  const [editing, setEditing] = useState(false);
  const [subject, setSubject] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  function load() {
    api.quotationDetail(caseId)
      .then(setData)
      .catch((e) => setError(e.message || "No quotation generated yet for this case, approve every line item first."));
    api.caseDocuments(caseId).then(setDocuments).catch(() => setDocuments([]));
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

  function handleGenerated(result) {
    setData(result);
    setShowGenerateModal(false);
  }

  async function handleMarkSent() {
    setSending(true);
    setError("");
    try {
      await api.markQuotationSent(caseId);
      load();
    } catch (e) {
      setError(e.message || "Failed to mark as sent");
    } finally {
      setSending(false);
    }
  }

  function startEditEmail() {
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
    return <div className="page"><div className="loading-state">Loading…</div></div>;
  }

  const { case: caseInfo, quotation, lines, outbound } = data;
  const isGenerated = quotation.status === "GENERATED" && quotation.docx_blob_uri;
  const filename = quotation.docx_blob_uri ? quotation.docx_blob_uri.split("/").pop() : null;

  return (
    <div className="page">
      <Link className="back-link" to={`/cases/${caseId}`}>&larr; {caseInfo.internal_ref}</Link>

      <div className="case-header">
        <h1 className="page-title">Quotation - {caseInfo.internal_ref} R{quotation.revision_no}</h1>
        <span className={statusClass(quotation.status)}>{quotation.status}</span>
      </div>
      <p className="case-meta">{caseInfo.project_name || "No project name"}</p>

      {error && <div className="flash flash-error">{error}</div>}

      {documents && documents.length > 0 && (
        <>
          <h2 className="section-heading">Original Enquiry Documents</h2>
          <div className="doc-list" style={{ marginBottom: 10 }}>
            {documents.map((doc) => (
              <div className="doc-row" key={doc.document_id}>
                <div className="doc-row-left">
                  <span className="doc-icon">📄</span>
                  <div className="doc-name">{doc.file_name}</div>
                </div>
                <button
                  className="btn btn-small"
                  onClick={() => api.downloadBlob(`/api/documents/download/${doc.document_id}`, doc.file_name)}
                >
                  Download
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {!isGenerated ? (
        <div className="quote-doc-card">
          <div className="quote-doc-head">
            <div>
              <div className="quote-doc-label">Status</div>
              <div className="quote-doc-filename">Draft not generated yet</div>
            </div>
            <button className="btn btn-approve" onClick={() => setShowGenerateModal(true)}>
              Generate Quotation
            </button>
          </div>
          <p className="pricing-note">
            Click "Generate Quotation" to review the line items, enter pricing, and approve before the final document is created.
          </p>

          <h2 className="section-heading">Line items (preview)</h2>
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
        </div>
      ) : (
        <>
          <div className="quote-doc-card">
            <div className="quote-doc-head">
              <div>
                <div className="quote-doc-label">Generated document</div>
                <div className="quote-doc-filename">{filename}</div>
              </div>
              <button className="btn btn-approve" onClick={handleDownload} disabled={downloading}>
                {downloading ? "Downloading…" : "Download .docx"}
              </button>
            </div>
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
        </>
      )}

      {outbound && isGenerated && (
        <>
          {outbound.send_status === "SENT" ? (
            <>
              <h2 className="section-heading">Customer Communication</h2>
              <div className="email-draft-card">
                <div className="approved-note" style={{ fontSize: "0.95rem", marginBottom: 10 }}>
                  ✓ Quotation Sent
                </div>
                <div className="email-field"><span>To</span> {outbound.to_emails?.length ? outbound.to_emails.join(", ") : "—"}</div>
                <div className="email-field"><span>Subject</span> {outbound.subject}</div>
                <div className="email-field"><span>Sent</span> {outbound.sent_at ? new Date(outbound.sent_at).toLocaleString() : "—"}</div>
                <hr />
                <pre className="email-body">{outbound.body_text}</pre>
              </div>
            </>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 26, marginBottom: 12 }}>
                <h2 className="section-heading" style={{ margin: 0 }}>Quotation Ready - Email Draft Prepared</h2>
                <div style={{ display: "flex", gap: 8 }}>
                  {!editing && (
                    <button className="btn btn-edit" onClick={startEditEmail}>✎ Edit Email</button>
                  )}
                  <button className="btn btn-approve" onClick={handleMarkSent} disabled={sending}>
                    {sending ? "Marking…" : "Send Quotation"}
                  </button>
                </div>
              </div>

              {editing ? (
                <form className="email-draft-card" onSubmit={handleSaveEmail}>
                  <label style={{ display: "block", fontSize: "0.78rem", color: "var(--muted)", marginBottom: 4 }}>Subject</label>
                  <input
                    type="text" value={subject} onChange={(e) => setSubject(e.target.value)}
                    style={{ width: "100%", padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 7, marginBottom: 14, fontFamily: "inherit", fontSize: "0.9rem" }}
                  />
                  <label style={{ display: "block", fontSize: "0.78rem", color: "var(--muted)", marginBottom: 4 }}>Body</label>
                  <textarea
                    value={bodyText} onChange={(e) => setBodyText(e.target.value)} rows={12}
                    style={{ width: "100%", padding: "10px", border: "1px solid var(--border)", borderRadius: 7, fontFamily: "inherit", fontSize: "0.9rem", resize: "vertical" }}
                  />
                  <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                    <button type="submit" className="btn btn-save" disabled={saving}>{saving ? "Saving…" : "Save changes"}</button>
                    <button type="button" className="btn btn-edit" onClick={() => setEditing(false)}>Cancel</button>
                  </div>
                </form>
              ) : (
                <div className="email-draft-card">
                  <div className="email-field"><span>To</span> {outbound.to_emails?.length ? outbound.to_emails.join(", ") : "— (customer email not on file)"}</div>
                  <div className="email-field"><span>Subject</span> {outbound.subject}</div>
                  <hr />
                  <pre className="email-body">{outbound.body_text}</pre>
                  <p style={{ fontSize: "0.78rem", color: "var(--muted)", marginTop: 10 }}>
                    Note: actual email sending isn't wired up yet - "Send Quotation" marks this as sent once you've sent it externally (e.g. via Outlook).
                  </p>
                </div>
              )}
            </>
          )}
        </>
      )}

      {showGenerateModal && (
        <GenerateQuotationModal
          caseId={caseId}
          lines={lines}
          onClose={() => setShowGenerateModal(false)}
          onGenerated={handleGenerated}
        />
      )}
    </div>
  );
}