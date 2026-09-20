import { useState, useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { formatDateTime } from "../utils/dateFormat";
import { usePolling } from "../api/usePolling";
import ProductMatchCard from "../components/ProductMatchCard";
import PdfViewerModal from "../components/PdfViewerModal";
import GenerateQuotationModal from "../components/GenerateQuotationModal";

function statusClass(status) {
  return `status-pill status-${(status || "").toLowerCase()}`;
}

function docIcon(contentType) {
  if (!contentType) return "📄";
  if (contentType.includes("pdf")) return "📕";
  if (contentType.includes("word")) return "📝";
  if (contentType.includes("sheet") || contentType.includes("excel")) return "📊";
  if (contentType.includes("image")) return "🖼️";
  return "📄";
}

function formatBytes(n) {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function topRecommendation(item) {
  const recs = item.recommendations || [];
  if (recs.length === 0) return null;
  const approved = recs.filter((r) => r.is_selected_by_engineer === true);
  if (approved.length > 0) return approved[0];
  return [...recs].sort((a, b) => a.rank_no - b.rank_no)[0];
}

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "products", label: "Products & Matching" },
  { key: "quotation", label: "Quotation" },
  { key: "communication", label: "Communication" },
  { key: "history", label: "History" },
];

export default function CaseDetail() {
  const { caseId } = useParams();
  const navigate = useNavigate();
  const { data: caseData, loading, error, refresh } = usePolling(
    () => api.caseDetail(caseId),
    12000
  );

  const [tab, setTab] = useState("overview");
  const [documents, setDocuments] = useState(null);
  const [enquiryEmail, setEnquiryEmail] = useState(null);
  const [docsError, setDocsError] = useState("");
  const [viewingDoc, setViewingDoc] = useState(null);
  const [revisionsData, setRevisionsData] = useState(null);
  const [communication, setCommunication] = useState(null);
  const [expandedComm, setExpandedComm] = useState(null);

  // Quotation tab state
  const [quotation, setQuotation] = useState(null);
  const [quotationError, setQuotationError] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [editingEmail, setEditingEmail] = useState(false);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    api.caseDocuments(caseId)
      .then((docs) => {
        setDocuments(docs);
        if (!docs || docs.length === 0) {
          api.enquiryEmail(caseId).then(setEnquiryEmail).catch(() => setEnquiryEmail(null));
        }
      })
      .catch((e) => setDocsError(e.message || "Could not load enquiry documents"));
  }, [caseId]);

  useEffect(() => {
    api.caseRevisions(caseId).then(setRevisionsData).catch(() => setRevisionsData(null));
  }, [caseId]);

  useEffect(() => {
    api.caseCommunication(caseId).then(setCommunication).catch(() => setCommunication([]));
  }, [caseId]);

  function loadQuotation() {
    api.quotationDetail(caseId)
      .then((d) => { setQuotation(d); setQuotationError(""); })
      .catch((e) => setQuotationError(e.message || "No quotation generated yet, approve every line item first."));
  }

  useEffect(() => {
    loadQuotation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);

  async function handleDownloadDoc(doc) {
    try {
      await api.downloadBlob(`/api/documents/download/${doc.document_id}`, doc.file_name);
    } catch (e) {
      setDocsError(e.message || "Download failed");
    }
  }

  function handleQuotationReady() {
    refresh();
    loadQuotation();
    setTab("quotation");
  }

  async function handleDownloadQuotation() {
    if (!quotation?.quotation?.docx_blob_uri) return;
    const filename = quotation.quotation.docx_blob_uri.split("/").pop();
    setDownloading(true);
    try {
      await api.downloadBlob(`/api/quotations/download/${filename}`, filename);
    } catch (e) {
      setQuotationError(e.message || "Download failed");
    } finally {
      setDownloading(false);
    }
  }

  function handleGenerated(result) {
    setQuotation(result);
    setShowGenerateModal(false);
  }

  function startEditEmail() {
    setEmailSubject(quotation.outbound.subject || "");
    setEmailBody(quotation.outbound.body_text || "");
    setEditingEmail(true);
  }

  async function handleSaveEmail(e) {
    e.preventDefault();
    setSavingEmail(true);
    try {
      await api.updateDraftEmail(caseId, { subject: emailSubject, body_text: emailBody });
      setEditingEmail(false);
      loadQuotation();
    } catch (e) {
      setQuotationError(e.message || "Failed to save email");
    } finally {
      setSavingEmail(false);
    }
  }

  async function handleMarkSent() {
    setSending(true);
    try {
      await api.markQuotationSent(caseId);
      loadQuotation();
      api.caseCommunication(caseId).then(setCommunication).catch(() => {});
    } catch (e) {
      setQuotationError(e.message || "Failed to mark as sent");
    } finally {
      setSending(false);
    }
  }

  if (loading && !caseData) {
    return <div className="page"><div className="loading-state">Loading…</div></div>;
  }
  if (error && !caseData) {
    return <div className="page"><div className="flash flash-error">{error}</div></div>;
  }
  if (!caseData) return null;

  const itemsToReview = (caseData.line_items || []).filter((item) => {
    const top = topRecommendation(item);
    return !top || top.is_selected_by_engineer !== true;
  }).length;

  const isGenerated = quotation?.quotation?.status === "GENERATED" && quotation?.quotation?.docx_blob_uri;

  return (
    <div className="page">
      <Link className="back-link" to="/cases">&larr; All cases</Link>

      <div className="case-detail-head">
        <div>
          <div className="case-header">
            <h1 className="page-title">{caseData.internal_ref}</h1>
            <span className={statusClass(caseData.status)}>{caseData.status}</span>
            {caseData.revision_count > 1 && (
              <span className="state-pill" style={{ background: "var(--neutral-tint)", color: "var(--muted)" }}>
                R{caseData.revision_no} · Current
              </span>
            )}
          </div>
          <p className="case-meta">
            {caseData.customer_name || "Unknown customer"}
            {caseData.project_name ? ` · ${caseData.project_name}` : ""}
          </p>
        </div>
        {isGenerated && (
          <button className="btn btn-approve" onClick={() => setTab("quotation")}>
            View Latest Quotation →
          </button>
        )}
      </div>

      <div className="detail-tabs">
        {TABS.map((t) => (
          <button key={t.key} className={`detail-tab ${tab === t.key ? "active" : ""}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ---------- OVERVIEW ---------- */}
      {tab === "overview" && (
        <div>
          <div className="overview-card" style={{ marginBottom: 20 }}>
            <h3 className="modal-section-heading">Case Information</h3>
            <dl className="summary-list">
              <div><dt>Customer / Project</dt><dd>{caseData.customer_name || "—"}{caseData.project_name ? ` · ${caseData.project_name}` : ""}</dd></div>
              <div><dt>Received</dt><dd>{formatDateTime(caseData.enq_received_at)}</dd></div>
              <div><dt>Current Status</dt><dd><span className={statusClass(caseData.status)}>{caseData.status}</span></dd></div>
              {caseData.revision_count > 1 && (
                <div><dt>Current Version</dt><dd>R{caseData.revision_no} ({caseData.revision_count} versions)</dd></div>
              )}
            </dl>

            {caseData.status_history && caseData.status_history.length > 0 && (
              <>
                <h3 className="modal-section-heading" style={{ marginTop: 18 }}>Timeline</h3>
                <div className="status-timeline">
                  {caseData.status_history.map((h, i) => (
                    <div className="timeline-row" key={i}>
                      <span className={`status-pill status-${h.to_status.toLowerCase()}`}>{h.to_status}</span>
                      <span className="timeline-time">{formatDateTime(h.changed_at)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="overview-card">
            <h3 className="modal-section-heading">
              Original Enquiry
              {revisionsData?.revisions?.length > 1 && (
                <span style={{ fontWeight: 400, fontSize: "0.8rem", color: "var(--muted)", marginLeft: 8 }}>
                  (all {revisionsData.revisions.length} revisions combined)
                </span>
              )}
            </h3>
            {docsError && <div className="flash flash-error">{docsError}</div>}
            {(() => {
              const combinedDocs = (revisionsData?.revisions?.length > 1 && revisionsData?.documents)
                ? revisionsData.documents
                : documents;
              if (combinedDocs === null) return <p className="no-recs">Loading…</p>;
              if (combinedDocs.length > 0) {
                return (
                  <div className="doc-list">
                    {combinedDocs.map((doc) => (
                      <div className="doc-row" key={doc.document_id}>
                        <div className="doc-row-left">
                          <span className="doc-icon">{docIcon(doc.content_type)}</span>
                          <div>
                            <div className="doc-name">{doc.file_name}</div>
                            <div className="doc-meta">{formatBytes(doc.size_bytes)}</div>
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          {doc.content_type === "application/pdf" && (
                            <button className="btn btn-small" onClick={() => setViewingDoc(doc)}>Preview</button>
                          )}
                          <button className="btn btn-small" onClick={() => handleDownloadDoc(doc)}>Download</button>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              }
              if (enquiryEmail) {
                return (
                  <div className="enquiry-email-card">
                    <div className="enquiry-email-meta">
                      <span><strong>From:</strong> {enquiryEmail.sender_email || "—"}</span>
                      <span><strong>Subject:</strong> {enquiryEmail.subject || "—"}</span>
                    </div>
                    <pre className="enquiry-email-body">{enquiryEmail.body_text || "(no body text)"}</pre>
                    <p className="enquiry-email-note">No documents were attached — showing the enquiry email itself.</p>
                  </div>
                );
              }
              return <p className="no-recs">No documents or enquiry email on file for this case.</p>;
            })()}
          </div>
        </div>
      )}

      {/* ---------- PRODUCTS & MATCHING ---------- */}
      {tab === "products" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <p className="page-sub" style={{ margin: 0 }}>{itemsToReview} of {caseData.line_items?.length || 0} items need a decision</p>
          </div>
          {caseData.line_items && caseData.line_items.length > 0 ? (
            caseData.line_items.map((item) => (
              <ProductMatchCard
                key={item.line_item_id}
                item={item}
                onChanged={refresh}
                onQuotationReady={handleQuotationReady}
              />
            ))
          ) : (
            <div className="empty-state"><p>No extracted line items for this case yet.</p></div>
          )}
        </div>
      )}

      {/* ---------- QUOTATION ---------- */}
      {tab === "quotation" && (
        <div>
          {quotationError ? (
            <div className="flash flash-info">{quotationError}</div>
          ) : !quotation ? (
            <div className="loading-state">Loading…</div>
          ) : (
            <>
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
                    Click "Generate Quotation" to review line items, enter pricing, and approve before the final document is created.
                  </p>
                  <h3 className="modal-section-heading" style={{ marginTop: 18 }}>Line items (preview)</h3>
                  <table className="data-table">
                    <thead>
                      <tr><th>#</th><th>Model</th><th>Description</th><th>Qty</th><th>Spec</th></tr>
                    </thead>
                    <tbody>
                      {quotation.lines.map((line) => (
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
                        <div className="quote-doc-label">Generated document · R{quotation.quotation.revision_no}</div>
                        <div className="quote-doc-filename">{quotation.quotation.docx_blob_uri.split("/").pop()}</div>
                      </div>
                      <button className="btn btn-edit" onClick={handleDownloadQuotation} disabled={downloading}>
                        {downloading ? "Downloading…" : "Download .docx"}
                      </button>
                    </div>
                  </div>

                  <h3 className="modal-section-heading">Line Items</h3>
                  <table className="data-table">
                    <thead>
                      <tr><th>#</th><th>Model</th><th>Description</th><th>Qty</th><th>Spec</th></tr>
                    </thead>
                    <tbody>
                      {quotation.lines.map((line) => (
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

                  {quotation.outbound && (
                    quotation.outbound.send_status === "SENT" ? (
                      <>
                        <h3 className="modal-section-heading" style={{ marginTop: 20 }}>Customer Communication</h3>
                        <div className="email-draft-card">
                          <div className="approved-note" style={{ fontSize: "0.95rem", marginBottom: 10 }}>✓ Quotation Sent</div>
                          <div className="email-field"><span>To</span> {quotation.outbound.to_emails?.join(", ") || "—"}</div>
                          <div className="email-field"><span>Subject</span> {quotation.outbound.subject}</div>
                          <div className="email-field"><span>Sent</span> {quotation.outbound.sent_at ? new Date(quotation.outbound.sent_at).toLocaleString() : "—"}</div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 20, marginBottom: 12 }}>
                          <h3 className="modal-section-heading" style={{ margin: 0 }}>Quotation Ready - Email Draft Prepared</h3>
                          <div style={{ display: "flex", gap: 8 }}>
                            {!editingEmail && <button className="btn btn-edit" onClick={startEditEmail}>✎ Edit Email</button>}
                            <button className="btn btn-approve" onClick={handleMarkSent} disabled={sending}>
                              {sending ? "Marking…" : "Send Quotation"}
                            </button>
                          </div>
                        </div>
                        {editingEmail ? (
                          <form className="email-draft-card" onSubmit={handleSaveEmail}>
                            <label style={{ display: "block", fontSize: "0.78rem", color: "var(--muted)", marginBottom: 4 }}>Subject</label>
                            <input value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)}
                              style={{ width: "100%", padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 7, marginBottom: 14 }} />
                            <label style={{ display: "block", fontSize: "0.78rem", color: "var(--muted)", marginBottom: 4 }}>Body</label>
                            <textarea value={emailBody} onChange={(e) => setEmailBody(e.target.value)} rows={10}
                              style={{ width: "100%", padding: "10px", border: "1px solid var(--border)", borderRadius: 7, resize: "vertical" }} />
                            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                              <button type="submit" className="btn btn-save" disabled={savingEmail}>{savingEmail ? "Saving…" : "Save changes"}</button>
                              <button type="button" className="btn btn-edit" onClick={() => setEditingEmail(false)}>Cancel</button>
                            </div>
                          </form>
                        ) : (
                          <div className="email-draft-card">
                            <div className="email-field"><span>To</span> {quotation.outbound.to_emails?.join(", ") || "—"}</div>
                            <div className="email-field"><span>Subject</span> {quotation.outbound.subject}</div>
                            <hr />
                            <pre className="email-body">{quotation.outbound.body_text}</pre>
                          </div>
                        )}
                      </>
                    )
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* ---------- COMMUNICATION ---------- */}
      {tab === "communication" && (
        <div>
          {communication === null ? (
            <div className="loading-state">Loading…</div>
          ) : communication.length === 0 ? (
            <div className="empty-state"><p>No communication history yet.</p></div>
          ) : (
            <div className="status-timeline">
              {communication.map((entry, i) => (
                <div key={i} className="overview-card" style={{ marginBottom: 10, padding: "12px 16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
                    onClick={() => setExpandedComm(expandedComm === i ? null : i)}>
                    <div>
                      <span className="state-pill" style={{
                        background: entry.entry_type === "QUOTATION_SENT" ? "var(--success-tint)" : entry.entry_type === "ENQUIRY_RECEIVED" ? "var(--neutral-tint)" : "var(--warn-tint)",
                        color: entry.entry_type === "QUOTATION_SENT" ? "var(--success)" : entry.entry_type === "ENQUIRY_RECEIVED" ? "var(--muted)" : "var(--warn)",
                      }}>
                        {entry.entry_type === "ENQUIRY_RECEIVED" ? "Enquiry Received" : entry.entry_type === "QUOTATION_SENT" ? "Quotation Sent" : "Quotation Drafted"}
                      </span>
                      {!entry.is_current_revision && <span style={{ fontSize: "0.75rem", color: "var(--muted)", marginLeft: 8 }}>R{entry.revision_no} · Superseded</span>}
                    </div>
                    <span className="timeline-time">{formatDateTime(entry.timestamp)}</span>
                  </div>
                  {expandedComm === i && (
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px dashed var(--border)", fontSize: "0.85rem" }}>
                      {entry.from_email && <div className="email-field"><span>From</span> {entry.from_email}</div>}
                      {entry.to_emails && <div className="email-field"><span>To</span> {entry.to_emails.join(", ")}</div>}
                      <div className="email-field"><span>Subject</span> {entry.subject || "—"}</div>
                      <pre className="email-body" style={{ marginTop: 8 }}>{entry.body_text || "(no content)"}</pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ---------- HISTORY ---------- */}
      {tab === "history" && (
        <div>
          <h3 className="modal-section-heading">Status History</h3>
          {caseData.status_history && caseData.status_history.length > 0 ? (
            <div className="status-timeline">
              {caseData.status_history.map((h, i) => (
                <div className="timeline-row" key={i}>
                  <span className={`status-pill status-${h.to_status.toLowerCase()}`}>{h.from_status || "—"} → {h.to_status}</span>
                  <span className="timeline-time">{formatDateTime(h.changed_at)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="no-recs">No history recorded yet.</p>
          )}

          {revisionsData && revisionsData.revisions && revisionsData.revisions.length > 1 && (
            <>
              <h3 className="modal-section-heading" style={{ marginTop: 24 }}>Quotation Revisions</h3>
              <table className="data-table">
                <thead>
                  <tr><th>Revision</th><th>Ref</th><th>Status</th><th>Received</th><th></th></tr>
                </thead>
                <tbody>
                  {revisionsData.revisions.slice().reverse().map((rev) => {
                    const isCurrent = rev.case_id === parseInt(caseId);
                    return (
                      <tr key={rev.case_id} style={isCurrent ? { background: "var(--brand-tint)" } : {}}>
                        <td>
                          R{rev.revision_no}
                          {isCurrent && (
                            <span style={{ color: "var(--success)", fontWeight: 700, marginLeft: 6 }}>
                              ● Currently Viewing
                            </span>
                          )}
                        </td>
                        <td>{rev.internal_ref}</td>
                        <td><span className={statusClass(rev.status)}>{rev.status}</span></td>
                        <td>{formatDateTime(rev.enq_received_at)}</td>
                        <td>
                          {!isCurrent && (
                            <Link className="link-btn" to={`/cases/${rev.case_id}`}>View this revision →</Link>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}

      {viewingDoc && (
        <PdfViewerModal
          path={`/api/documents/download/${viewingDoc.document_id}`}
          filename={viewingDoc.file_name}
          onClose={() => setViewingDoc(null)}
        />
      )}

      {showGenerateModal && quotation && (
        <GenerateQuotationModal
          caseId={caseId}
          lines={quotation.lines}
          onClose={() => setShowGenerateModal(false)}
          onGenerated={handleGenerated}
        />
      )}
    </div>
  );
}