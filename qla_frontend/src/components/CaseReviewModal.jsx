import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import ProductMatchCard from "./ProductMatchCard";
import PdfViewerModal from "./PdfViewerModal";

function docIcon(contentType, fileName) {
  const ct = (contentType || "").toLowerCase();
  const name = (fileName || "").toLowerCase();
  if (ct.includes("pdf") || name.endsWith(".pdf")) return "📕";
  if (ct.includes("word") || name.endsWith(".doc") || name.endsWith(".docx") || name.endsWith(".rtf")) return "📝";
  if (ct.includes("sheet") || ct.includes("excel") || /\.xlsx?$/.test(name) || name.endsWith(".csv")) return "📊";
  if (ct.includes("image") || /\.(png|jpe?g|gif|tiff?|bmp|webp)$/.test(name)) return "🖼️";
  if (ct.includes("zip") || /\.(zip|rar|7z)$/.test(name)) return "📦";
  if (name.endsWith(".msg") || name.endsWith(".eml") || ct.includes("outlook")) return "✉️";
  if (name.endsWith(".dwg") || name.endsWith(".dxf")) return "📐";
  return "📄";
}

function isPdfDoc(doc) {
  const ct = (doc?.content_type || "").toLowerCase();
  const name = (doc?.file_name || "").toLowerCase();
  return ct.includes("pdf") || name.endsWith(".pdf");
}

export default function CaseReviewModal({ caseId, onClose, onChanged, onRejected }) {
  const navigate = useNavigate();
  const [caseData, setCaseData] = useState(null);
  const [documents, setDocuments] = useState(null);
  const [enquiryEmail, setEnquiryEmail] = useState(null);
  const [error, setError] = useState("");
  const [viewingDoc, setViewingDoc] = useState(null);

  async function loadAll() {
    try {
      const c = await api.caseDetail(caseId);
      setCaseData(c);
    } catch (e) {
      setError(e.message || "Failed to load case");
    }
    let docs = [];
    try {
      docs = await api.caseDocuments(caseId);
      setDocuments(docs);
    } catch {
      setDocuments([]);
    }
    if (!docs || docs.length === 0) {
      try {
        const email = await api.enquiryEmail(caseId);
        setEnquiryEmail(email);
      } catch {
        setEnquiryEmail(null);
      }
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);

  function handleChanged() {
    loadAll();
    onChanged?.();
  }

  async function handleDownloadDoc(doc) {
    try {
      await api.downloadBlob(`/api/documents/download/${doc.document_id}`, doc.file_name);
    } catch (e) {
      setError(e.message || "Download failed");
    }
  }

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <div>
              <span className="modal-case-ref">{caseData?.internal_ref || "…"}</span>
              <div className="modal-case-sub">
                {caseData?.customer_name || ""} {caseData?.project_name ? `· ${caseData.project_name}` : ""}
              </div>
            </div>
            <button className="modal-close" onClick={onClose}>×</button>
          </div>

          {error && <div className="flash flash-error" style={{ margin: "0 24px" }}>{error}</div>}

          <div className="modal-body">
            <h3 className="modal-section-heading">Original Enquiry</h3>
            {documents === null ? (
              <p className="no-recs">Loading…</p>
            ) : documents.length > 0 ? (
              <div className="doc-list" style={{ marginBottom: 20 }}>
                {documents.map((doc) => (
                  <div className="doc-row" key={doc.document_id}>
                    <div className="doc-row-left">
                      <span className="doc-icon">{docIcon(doc.content_type, doc.file_name)}</span>
                      <div>
                        <div className="doc-name">{doc.file_name}</div>
                        {doc.revision_tag || doc.revision_no ? (
                          <div className="doc-meta">{doc.revision_tag || `R${doc.revision_no}`}</div>
                        ) : null}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      {isPdfDoc(doc) && (
                        <button className="btn btn-small" onClick={() => setViewingDoc(doc)}>View</button>
                      )}
                      <button className="btn btn-small" onClick={() => handleDownloadDoc(doc)}>Download</button>
                    </div>
                  </div>
                ))}
              </div>
            ) : enquiryEmail ? (
              <div className="enquiry-email-card" style={{ marginBottom: 20 }}>
                <div className="enquiry-email-meta">
                  <span><strong>From:</strong> {enquiryEmail.sender_email || "—"}</span>
                  <span><strong>Subject:</strong> {enquiryEmail.subject || "—"}</span>
                </div>
                <pre className="enquiry-email-body">{enquiryEmail.body_text || "(no body text)"}</pre>
                <p className="enquiry-email-note">No documents were attached, showing the enquiry email itself.</p>
              </div>
            ) : (
              <p className="no-recs" style={{ marginBottom: 20 }}>No documents or enquiry email on file for this case.</p>
            )}

            <h3 className="modal-section-heading">Matched Products</h3>
            {!caseData ? (
              <p className="no-recs">Loading…</p>
            ) : caseData.line_items && caseData.line_items.length > 0 ? (
              caseData.line_items.map((item) => (
                <ProductMatchCard
                  key={item.line_item_id}
                  item={item}
                  onChanged={handleChanged}
                  onRejected={onRejected}
                onQuotationReady={() => {
                  onClose();
                  navigate(`/cases/${caseId}`);
                }}
                />
              ))
            ) : (
              <p className="no-recs">No line items for this case.</p>
            )}
          </div>

          <div className="modal-footer">
            <button className="btn btn-edit" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>

      {viewingDoc && (
        <PdfViewerModal
          path={`/api/documents/download/${viewingDoc.document_id}`}
          filename={viewingDoc.file_name}
          onClose={() => setViewingDoc(null)}
        />
      )}
    </>
  );
}