import { useState, useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { usePolling } from "../api/usePolling";
import ProductMatchCard from "../components/ProductMatchCard";

function statusClass(status) {
  return `status-pill status-${(status || "").toLowerCase()}`;
}

function confidenceClass(conf) {
  if (conf === null || conf === undefined) return "conf-none";
  const n = parseFloat(conf);
  if (n >= 0.8) return "conf-high";
  if (n >= 0.5) return "conf-mid";
  return "conf-low";
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

export default function CaseDetail() {
  const { caseId } = useParams();
  const navigate = useNavigate();
  const { data: caseData, loading, error, refresh } = usePolling(
    () => api.caseDetail(caseId),
    12000
  );

  const [tab, setTab] = useState("overview"); // overview | items
  const [documents, setDocuments] = useState(null);
  const [enquiryEmail, setEnquiryEmail] = useState(null);
  const [docsError, setDocsError] = useState("");

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

  async function handleDownloadDoc(doc) {
    try {
      await api.downloadBlob(`/api/documents/download/${doc.document_id}`, doc.file_name);
    } catch (e) {
      setDocsError(e.message || "Download failed");
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

  return (
    <div className="page">
      <Link className="back-link" to="/cases">&larr; All cases</Link>

      <div className="case-detail-head">
        <div>
          <div className="case-header">
            <h1 className="page-title">{caseData.internal_ref}</h1>
            <span className={statusClass(caseData.status)}>{caseData.status}</span>
          </div>
          <p className="case-meta">
            {caseData.customer_name || "Unknown customer"}
            {caseData.project_name ? ` · ${caseData.project_name}` : ""}
          </p>
        </div>
        {caseData.quotation && (
          <button className="btn btn-approve" onClick={() => navigate(`/cases/${caseId}/quotation`)}>
            View Quotation (Draft)
          </button>
        )}
      </div>

      <div className="detail-tabs">
        <button className={`detail-tab ${tab === "overview" ? "active" : ""}`} onClick={() => setTab("overview")}>
          Overview
        </button>
        <button className={`detail-tab ${tab === "items" ? "active" : ""}`} onClick={() => setTab("items")}>
          Line Items ({caseData.line_items?.length || 0})
        </button>
      </div>

      {tab === "overview" && (
        <div>
          <div className="overview-card" style={{ marginBottom: 20 }}>
            <h3 className="modal-section-heading">Case Summary</h3>
            <dl className="summary-list">
              <div><dt>Customer / Project</dt><dd>{caseData.customer_name || "—"}{caseData.project_name ? ` · ${caseData.project_name}` : ""}</dd></div>
              <div><dt>Received On</dt><dd>{formatDateTime(caseData.enq_received_at)}</dd></div>
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
            <h3 className="modal-section-heading">Original Enquiry</h3>
            {docsError && <div className="flash flash-error">{docsError}</div>}
            {documents === null ? (
              <p className="no-recs">Loading…</p>
            ) : documents.length > 0 ? (
              <div className="doc-list">
                {documents.map((doc) => (
                  <div className="doc-row" key={doc.document_id}>
                    <div className="doc-row-left">
                      <span className="doc-icon">{docIcon(doc.content_type)}</span>
                      <div>
                        <div className="doc-name">{doc.file_name}</div>
                        <div className="doc-meta">{formatBytes(doc.size_bytes)}</div>
                      </div>
                    </div>
                    <button className="btn btn-small" onClick={() => handleDownloadDoc(doc)}>Download</button>
                  </div>
                ))}
              </div>
            ) : enquiryEmail ? (
              <div className="enquiry-email-card">
                <div className="enquiry-email-meta">
                  <span><strong>From:</strong> {enquiryEmail.sender_email || "—"}</span>
                  <span><strong>Subject:</strong> {enquiryEmail.subject || "—"}</span>
                </div>
                <pre className="enquiry-email-body">{enquiryEmail.body_text || "(no body text)"}</pre>
                <p className="enquiry-email-note">No documents were attached — showing the enquiry email itself.</p>
              </div>
            ) : (
              <p className="no-recs">No documents or enquiry email on file for this case.</p>
            )}
          </div>
        </div>
      )}
  
      {tab === "items" && (
        <div>
          {caseData.line_items && caseData.line_items.length > 0 ? (
            caseData.line_items.map((item) => (
              <ProductMatchCard
                key={item.line_item_id}
                item={item}
                onChanged={refresh}
                onQuotationReady={() => navigate(`/cases/${caseId}/quotation`)}
              />
            ))
          ) : (
            <div className="empty-state"><p>No extracted line items for this case yet.</p></div>
          )}
        </div>
      )}
    </div>
  );
}