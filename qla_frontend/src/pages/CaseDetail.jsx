import { useState, useEffect, useMemo, useRef } from "react";
import { Link, useParams, useLocation } from "react-router-dom";
import {
  Play,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Info,
  Layers,
  FileText,
  MessageSquare,
  History
} from "lucide-react";
import { api } from "../api/client";
import { formatDateTime } from "../utils/dateFormat";
import { usePolling } from "../api/usePolling";
import ProductMatchCard from "../components/ProductMatchCard";
import PdfViewerModal from "../components/PdfViewerModal";
import GenerateQuotationModal from "../components/GenerateQuotationModal";
import { topRecommendation, uniqueRecommendations } from "../utils/recommendations";
import { topRecommendation as getTopRec } from "../utils/recommendations";

function statusClass(status) {
  return `status-pill status-${(status || "").toLowerCase()}`;
}

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

function docRevisionLabel(doc) {
  if (doc?.revision_tag) return doc.revision_tag;
  if (doc?.revision_no) return `R${doc.revision_no}`;
  return "";
}

function mergeDocumentLists(...lists) {
  const byId = new Map();
  for (const list of lists) {
    for (const doc of list || []) {
      if (doc?.document_id != null) byId.set(doc.document_id, doc);
    }
  }
  return Array.from(byId.values());
}

function formatBytes(n) {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatAiResult(result) {
  const identified = result.items_identified ?? result.items_matched ?? 0;
  const matched = result.items_matched ?? 0;
  if (result.needs_details || result.decision === "PRODUCTS_MATCHED_NEED_DETAILS") {
    return `${identified} product${identified === 1 ? "" : "s"} identified — model details needed`;
  }
  if (result.decision === "PRODUCTS_MATCHED") {
    return `${matched} product${matched === 1 ? "" : "s"} matched`;
  }
  return `${result.decision || "done"} (${identified} identified)`;
}

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "products", label: "Products & Matching" },
  { key: "quotation", label: "Quotation" },
];

const BULK_REJECT_REASONS = [
  { value: "WRONG_MODEL", label: "Wrong model" },
  { value: "SPEC_MISMATCH", label: "Specification mismatch" },
  { value: "NOT_MANUFACTURED", label: "Not manufactured" },
  { value: "OTHER", label: "Other" },
];

function BulkRejectModal({ count, selectedItemIds, allCaseItems, onClose, onConfirm, busy }) {
  const [reasonCode, setReasonCode] = useState("SPEC_MISMATCH");
  const [productFeedback, setProductFeedback] = useState("");
  const [err, setErr] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Gather suggested products across this case (shows 3 if 3 are suggested, 1 if 1 is suggested)
  const availableProducts = useMemo(() => {
    const items = allCaseItems || [];
    const list = [];
    const seenIds = new Set();

    items.forEach((it, idx) => {
      const top = topRecommendation(it);
      const recs = uniqueRecommendations(it?.recommendations || []);

      if (recs.length > 0) {
        recs.forEach((r) => {
          const id = String(r.recommendation_id);
          if (!seenIds.has(id)) {
            seenIds.add(id);
            list.push({
              id,
              lineItemId: it.line_item_id,
              code: r.model_code || r.family_code || `Product ${idx + 1}`,
              family: r.family_code || it.product_type || it.description || "Instrument",
              lineLabel: it.product_type || it.description || `Line ${it.line_no || idx + 1}`,
              isPrimary: top && r.recommendation_id === top.recommendation_id,
            });
          }
        });
      } else if (top) {
        const id = String(top.recommendation_id);
        if (!seenIds.has(id)) {
          seenIds.add(id);
          list.push({
            id,
            lineItemId: it.line_item_id,
            code: top.model_code || top.family_code || `Product ${idx + 1}`,
            family: top.family_code || it.product_type || it.description || "Instrument",
            lineLabel: it.product_type || it.description || `Line ${it.line_no || idx + 1}`,
            isPrimary: true,
          });
        }
      }
    });

    return list;
  }, [allCaseItems]);

  // Selected products state with checkboxes (starts unselected so user can suggest correct item)
  const [selectedProducts, setSelectedProducts] = useState(new Set());

  function toggleProduct(id) {
    setSelectedProducts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function handleConfirm() {
    if (!productFeedback.trim()) {
      setErr("Please enter feedback for the selected product(s).");
      return;
    }
    setErr("");
    onConfirm(reasonCode || "SPEC_MISMATCH", productFeedback.trim());
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel reject-modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="qgm-header">
          <h3 className="qgm-title">Reject {count} selected item{count > 1 ? "s" : ""}</h3>
          <button className="qgm-close" onClick={onClose}>×</button>
        </div>
        <div className="qgm-body">
          {/* 1. Multi-Select Suggested Products Dropdown with Checkboxes */}
          <div className="reject-multiselect-container" ref={dropdownRef}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <label className="edit-drawer-label" style={{ margin: 0 }}>
                Suggest Correct Item / Alternate <span style={{ fontWeight: 400, color: "var(--muted)" }}>(Optional)</span>
              </label>
              {selectedProducts.size > 0 && (
                <span style={{ fontSize: "0.75rem", color: "var(--brand-dark)", fontWeight: 600 }}>
                  {selectedProducts.size} of {availableProducts.length} selected
                </span>
              )}
            </div>

            <div
              className={`reject-multiselect-trigger ${dropdownOpen ? "open" : ""}`}
              onClick={() => setDropdownOpen((v) => !v)}
              title="Click to view all suggested products and toggle checkboxes"
            >
              <div className="reject-multiselect-summary">
                {selectedProducts.size === 0 ? (
                  <span className="placeholder">Select correct / suggested item…</span>
                ) : (
                  <div className="reject-selected-tags">
                    {availableProducts
                      .filter((p) => selectedProducts.has(p.id))
                      .map((p) => (
                        <span key={p.id} className="reject-tag-pill">
                          {p.code}
                        </span>
                      ))}
                  </div>
                )}
              </div>
              <span className="reject-dropdown-arrow">{dropdownOpen ? "▲" : "▼"}</span>
            </div>

            {dropdownOpen && (
              <div className="reject-multiselect-menu">
                <div className="reject-multiselect-menu-header">
                  <span>Suggested options ({availableProducts.length})</span>
                  <button
                    type="button"
                    className="reject-select-all-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (selectedProducts.size === availableProducts.length) {
                        setSelectedProducts(new Set([availableProducts[0]?.id]));
                      } else {
                        setSelectedProducts(new Set(availableProducts.map((p) => p.id)));
                      }
                    }}
                  >
                    {selectedProducts.size === availableProducts.length ? "Reset Selection" : "Select All"}
                  </button>
                </div>
                <div className="reject-multiselect-items">
                  {availableProducts.map((p) => {
                    const isChecked = selectedProducts.has(p.id);
                    return (
                      <label
                        key={p.id}
                        className={`reject-multiselect-item ${isChecked ? "checked" : ""}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleProduct(p.id)}
                        />
                        <div className="reject-item-details">
                          <div className="reject-item-code">
                            <span>{p.code}</span>
                            {p.isPrimary && <span className="reject-primary-pill">Primary</span>}
                          </div>
                          <div className="reject-item-family">{p.family}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 2. Single Input for Feedback */}
          <div style={{ marginBottom: 14 }}>
            <label className="edit-drawer-label">
              Feedback <span className="edit-drawer-required">(required)</span>
            </label>
            <input
              type="text"
              className="edit-drawer-input"
              value={productFeedback}
              onChange={(e) => setProductFeedback(e.target.value)}
              placeholder="Write feedback for selected product(s)..."
              style={{
                width: "100%",
                padding: "9px 12px",
                borderRadius: "8px",
                border: "1px solid var(--border)",
                fontSize: "0.85rem",
                color: "var(--ink)",
                background: "var(--card)",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* 3. Reason Code */}
          <p className="qgm-section-label">Reason (applies to all selected)</p>
          <select className="edit-drawer-select" value={reasonCode} onChange={(e) => setReasonCode(e.target.value)}>
            {BULK_REJECT_REASONS.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>

          {err && <div className="flash flash-error" style={{ marginTop: 10 }}>{err}</div>}
        </div>
        <div className="qgm-footer">
          <button className="btn btn-outline" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn btn-reject-solid" onClick={handleConfirm} disabled={busy}>
            {busy ? "Rejecting…" : `Reject ${selectedProducts.size} items`}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CaseDetail() {
  const { caseId } = useParams();
  const location = useLocation();
  const fromPage = location.state?.fromPage;
  const { data: caseData, loading, error, refresh } = usePolling(
    () => api.caseDetail(caseId),
    12000
  );

  const [collapsedSections, setCollapsedSections] = useState({
    overview: false,
    products: false,
    quotation: false,
  });
  const [activeNav, setActiveNav] = useState("overview");

  function toggleSection(secKey) {
    setCollapsedSections((prev) => ({
      ...prev,
      [secKey]: !prev[secKey],
    }));
  }

  const allCollapsed = Object.values(collapsedSections).every(Boolean);

  function toggleAllSections() {
    if (allCollapsed) {
      setCollapsedSections({
        overview: false,
        products: false,
        quotation: false,
      });
    } else {
      setCollapsedSections({
        overview: true,
        products: true,
        quotation: true,
      });
    }
  }

  function scrollToSection(secKey) {
    setActiveNav(secKey);
    setCollapsedSections((prev) => ({ ...prev, [secKey]: false }));
    setTimeout(() => {
      const el = document.getElementById(`case-sec-${secKey}`);
      if (el) {
        const yOffset = -70;
        const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
        window.scrollTo({ top: y, behavior: "smooth" });
      }
    }, 40);
  }
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
  const [aiRunning, setAiRunning] = useState(false);
  const [productsRefreshing, setProductsRefreshing] = useState(false);
  const [aiError, setAiError] = useState("");
  const [aiMessage, setAiMessage] = useState("");

  const [selectedItems, setSelectedItems] = useState(new Set());
  const [bulkActing, setBulkActing] = useState(false);
  const [showBulkRejectModal, setShowBulkRejectModal] = useState(false);

  useEffect(() => {
    setAiError("");
    setAiMessage("");
    setActiveNav("overview");
    refresh();
  }, [caseId, refresh]);

  useEffect(() => {
    let cancelled = false;
    setDocsError("");
    Promise.all([
      api.caseDocuments(caseId).catch((e) => {
        if (!cancelled) setDocsError(e.message || "Could not load enquiry documents");
        return [];
      }),
      api.caseRevisions(caseId).catch(() => null),
    ]).then(([docs, revisions]) => {
      if (cancelled) return;
      setRevisionsData(revisions);
      const merged = mergeDocumentLists(docs, revisions?.documents);
      setDocuments(merged);
      if (!merged.length) {
        api.enquiryEmail(caseId).then((email) => {
          if (!cancelled) setEnquiryEmail(email);
        }).catch(() => {
          if (!cancelled) setEnquiryEmail(null);
        });
      }
    });
    return () => { cancelled = true; };
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
    scrollToSection("quotation");
  }

  async function handleDownloadQuotation() {
    setDownloading(true);
    try {
      const filename = (quotation?.quotation?.docx_blob_uri || "quotation.docx")
        .replaceAll("\\", "/")
        .split("/")
        .pop();
      await api.downloadBlob(`/api/cases/${caseId}/quotation/download`, filename);
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

  async function handleRunAiMatch() {
    setAiRunning(true);
    setAiError("");
    setAiMessage("");
    try {
      const result = await api.runAiMatch(caseId);
      if (result?.status === "error") {
        setAiError(result.raw_message || result.error || "AI match failed");
        return;
      }
      setAiMessage(formatAiResult(result || {}));
      scrollToSection("products");
      setProductsRefreshing(true);
      await refresh();
    } catch (e) {
      setAiError(e.message || "AI match failed");
    } finally {
      setAiRunning(false);
      setProductsRefreshing(false);
    }
  }

    function toggleItemSelect(lineItemId) {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(lineItemId)) next.delete(lineItemId);
      else next.add(lineItemId);
      return next;
    });
  }

  async function handleBulkApprove() {
    setBulkActing(true);
    try {
      let anyQuotationGenerated = false;
      for (const lineItemId of selectedItems) {
        const lineItem = (caseData.line_items || []).find((i) => i.line_item_id === lineItemId);
        const top = topRecommendation(lineItem);
        if (!top || top.is_selected_by_engineer === true) continue;
        const result = await api.approve(top.recommendation_id);
        if (result?.quotation_generated) anyQuotationGenerated = true;
      }
      setSelectedItems(new Set());
      await refresh();
      if (anyQuotationGenerated) handleQuotationReady();
    } catch (e) {
      setAiError(e.message || "Bulk approve failed");
    } finally {
      setBulkActing(false);
    }
  }

  async function handleBulkReject(reasonCode, comment) {
    setBulkActing(true);
    try {
      for (const lineItemId of selectedItems) {
        const lineItem = (caseData.line_items || []).find((i) => i.line_item_id === lineItemId);
        const top = topRecommendation(lineItem);
        if (!top || top.is_selected_by_engineer === false) continue;
        await api.reject(top.recommendation_id);
        await api.submitFeedback(caseId, {
          line_item_id: lineItemId,
          recommendation_id: top.recommendation_id,
          ai_model_code: top.model_code || top.family_code,
          reason_code: reasonCode,
          comment: comment || null,
        });
      }
      setSelectedItems(new Set());
      setShowBulkRejectModal(false);
      await refresh();
    } catch (e) {
      setAiError(e.message || "Bulk reject failed");
    } finally {
      setBulkActing(false);
    }
  }

  const matchingBusy = aiRunning || productsRefreshing;

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
      <Link className="back-link" to={fromPage ? `/cases?page=${fromPage}` : "/cases"}>
  &larr; All cases
</Link>

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
          <button className="btn btn-approve" onClick={() => scrollToSection("quotation")}>
            View Latest Quotation →
          </button>
        )}
      </div>

      {/* Sticky Navigation Bar */}
      <div className="case-sections-nav">
        <div className="case-nav-tabs-group">
          {[
            { key: "overview", label: "Overview", Icon: Info, badge: caseData?.status },
            { key: "products", label: "Products & Matching", Icon: Layers, badge: caseData?.line_items?.length ? `${caseData.line_items.length}` : null },
            { key: "quotation", label: "Quotation", Icon: FileText, badge: isGenerated ? `R${quotation?.quotation?.revision_no || caseData.revision_no}` : "Draft" },
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              className={`case-nav-tab ${activeNav === item.key ? "active" : ""}`}
              onClick={() => scrollToSection(item.key)}
            >
              <item.Icon size={14} />
              <span>{item.label}</span>
              {item.badge && (
                <span className="case-nav-tab-badge">{item.badge}</span>
              )}
            </button>
          ))}
        </div>

        <div className="case-nav-actions-group">
          <button
            type="button"
            className="case-expand-toggle-btn"
            onClick={toggleAllSections}
            title={allCollapsed ? "Expand all sections" : "Collapse all sections"}
          >
            <ChevronsUpDown size={14} />
            <span>{allCollapsed ? "Expand All" : "Collapse All"}</span>
          </button>

          <button
            type="button"
            className="cases-btn-ai"
            disabled={matchingBusy}
            onClick={handleRunAiMatch}
            title="Run AI technical specification match"
          >
            {aiRunning ? <RefreshCw size={13} className="spin" /> : <Play size={13} fill="currentColor" />}
            {aiRunning ? "Running AI…" : "Run AI"}
          </button>
        </div>
      </div>

      {/* ============================================================
          1. OVERVIEW SECTION
         ============================================================ */}
      <div id="case-sec-overview" className={`case-collapsible-section ${activeNav === "overview" ? "is-focused-section" : ""}`}>
        <button
          type="button"
          className="case-section-header-btn"
          onClick={() => toggleSection("overview")}
          aria-expanded={!collapsedSections.overview}
        >
          <div className="case-section-header-left">
            <div className="case-section-icon-wrap">
              <Info size={18} />
            </div>
            <div>
              <h2 className="case-section-title">Overview & Case Information</h2>
            </div>
          </div>

          <div className="case-section-header-right">
            <span className="case-section-badge-summary">
              {caseData.status} {caseData.revision_count > 1 ? `· R${caseData.revision_no}` : ""}
            </span>
            <div className="case-section-chevron">
              {collapsedSections.overview ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
            </div>
          </div>
        </button>

        {!collapsedSections.overview && (
          <div className="case-section-body">
            <div className="matching-area" style={{ position: "relative" }}>
              {matchingBusy && (
                <div className="case-ai-overlay" role="status" aria-live="polite">
                  <RefreshCw size={28} className="spin" />
                  <p>{aiRunning ? "Running AI match on enquiry files…" : "Refreshing products & matching…"}</p>
                </div>
              )}
              <div className="overview-card" style={{ marginBottom: 20 }}>
                <div className="overview-card-head">
                  <h3 className="modal-section-heading" style={{ margin: 0 }}>Case Information</h3>
                  {caseData.status !== "RECEIVED" && (
                    <span className="state-pill" style={{ background: "var(--success-tint)", color: "var(--success)", whiteSpace: "nowrap" }}>
                      ✓ Query already run
                    </span>
                  )}
                </div>
                {aiError && <div className="flash flash-error" style={{ marginBottom: 12 }}>{aiError}</div>}
                {aiMessage && !aiError && (
                  <div className="flash flash-success" style={{ marginBottom: 12 }}>{aiMessage}</div>
                )}
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
                              <span className="doc-icon">{docIcon(doc.content_type, doc.file_name)}</span>
                              <div>
                                <div className="doc-name">{doc.file_name}</div>
                                <div className="doc-meta">
                                  {[formatBytes(doc.size_bytes), docRevisionLabel(doc)].filter(Boolean).join(" · ")}
                                </div>
                              </div>
                            </div>
                            <div style={{ display: "flex", gap: 6 }}>
                              {isPdfDoc(doc) && (
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
          </div>
        )}
      </div>

      {/* ============================================================
          2. PRODUCTS & MATCHING SECTION
         ============================================================ */}
      <div id="case-sec-products" className={`case-collapsible-section ${activeNav === "products" ? "is-focused-section" : ""}`}>
        <button
          type="button"
          className="case-section-header-btn"
          onClick={() => toggleSection("products")}
          aria-expanded={!collapsedSections.products}
        >
          <div className="case-section-header-left">
            <div className="case-section-icon-wrap" style={{ background: "rgba(37, 99, 235, 0.09)", color: "#2563eb" }}>
              <Layers size={18} />
            </div>
            <div>
              <h2 className="case-section-title">Products & Technical Matching</h2>
            </div>
          </div>

          <div className="case-section-header-right">
            <span className="case-section-badge-summary">
              {itemsToReview > 0 ? `${itemsToReview} need decision` : "All decided"} ({caseData.line_items?.length || 0} total)
            </span>
            <div className="case-section-chevron">
              {collapsedSections.products ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
            </div>
          </div>
        </button>

        {!collapsedSections.products && (
          <div className="case-section-body">
            <div className="matching-area" style={{ position: "relative" }}>
              {matchingBusy && (
                <div className="case-ai-overlay" role="status" aria-live="polite">
                  <RefreshCw size={28} className="spin" />
                  <p>{aiRunning ? "Running AI match on enquiry files…" : "Refreshing products & matching…"}</p>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <p className="page-sub" style={{ margin: 0 }}>{itemsToReview} of {caseData.line_items?.length || 0} items need a decision</p>
              </div>
              {matchingBusy && !caseData.line_items?.length ? (
                <div className="loading-state">Fetching latest match results…</div>
              ) : caseData.line_items && caseData.line_items.length > 0 ? (
                <>
                  {selectedItems.size > 0 && (
                    <div className="bulk-decision-bar">
                      <span className="bulk-decision-count">{selectedItems.size} item{selectedItems.size > 1 ? "s" : ""} selected</span>
                      <button className="btn btn-approve" disabled={bulkActing} onClick={handleBulkApprove}>
                        {bulkActing ? "Working…" : "Approve Selected"}
                      </button>
                      <button className="btn btn-reject" disabled={bulkActing} onClick={() => setShowBulkRejectModal(true)}>
                        Reject Selected
                      </button>
                      <button className="btn btn-edit" disabled={bulkActing} onClick={() => setSelectedItems(new Set())}>
                        Clear
                      </button>
                    </div>
                  )}
                  {caseData.line_items.map((item) => (
                    <ProductMatchCard
                      key={item.line_item_id}
                      item={item}
                      allCaseItems={caseData.line_items}
                      onChanged={refresh}
                      onQuotationReady={handleQuotationReady}
                      selectable
                      isSelected={selectedItems.has(item.line_item_id)}
                      onToggleSelect={toggleItemSelect}
                      variant="full"
                    />
                  ))}
                </>
              ) : (
                <div className="empty-state"><p>No extracted line items for this case yet.</p></div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ============================================================
          3. QUOTATION SECTION
         ============================================================ */}
      <div id="case-sec-quotation" className={`case-collapsible-section ${activeNav === "quotation" ? "is-focused-section" : ""}`}>
        <button
          type="button"
          className="case-section-header-btn"
          onClick={() => toggleSection("quotation")}
          aria-expanded={!collapsedSections.quotation}
        >
          <div className="case-section-header-left">
            <div className="case-section-icon-wrap" style={{ background: "rgba(16, 185, 129, 0.1)", color: "#10b981" }}>
              <FileText size={18} />
            </div>
            <div>
              <h2 className="case-section-title">Quotation & Commercial Documents</h2>
            </div>
          </div>

          <div className="case-section-header-right">
            <span className="case-section-badge-summary">
              {isGenerated ? `Generated · R${quotation?.quotation?.revision_no || caseData.revision_no}` : "Draft Not Generated"}
            </span>
            <div className="case-section-chevron">
              {collapsedSections.quotation ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
            </div>
          </div>
        </button>

        {!collapsedSections.quotation && (
          <div className="case-section-body">
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
                        {(quotation?.lines || []).map((line) => (
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
                          <div className="quote-doc-filename">
                            {(quotation.quotation.docx_blob_uri || "").replaceAll("\\", "/").split("/").pop()}
                          </div>
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
                        {(quotation?.lines || []).map((line) => (
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
      </div>

      {/* ============================================================
          4. COMMUNICATION & 5. HISTORY SECTIONS (Hidden as requested)
         ============================================================ */}
      {false && (
        <>
          <div id="case-sec-communication" className={`case-collapsible-section ${activeNav === "communication" ? "is-focused-section" : ""}`}>
            <button
              type="button"
              className="case-section-header-btn"
              onClick={() => toggleSection("communication")}
              aria-expanded={!collapsedSections.communication}
            >
              <div className="case-section-header-left">
                <div className="case-section-icon-wrap" style={{ background: "rgba(245, 158, 11, 0.1)", color: "#d97706" }}>
                  <MessageSquare size={18} />
                </div>
                <div>
                  <h2 className="case-section-title">Customer Communication</h2>
                </div>
              </div>

              <div className="case-section-header-right">
                <span className="case-section-badge-summary">
                  {communication ? `${communication.length} Messages` : "0 Messages"}
                </span>
                <div className="case-section-chevron">
                  {collapsedSections.communication ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
                </div>
              </div>
            </button>

            {!collapsedSections.communication && (
              <div className="case-section-body">
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
          </div>

          <div id="case-sec-history" className={`case-collapsible-section ${activeNav === "history" ? "is-focused-section" : ""}`}>
            <button
              type="button"
              className="case-section-header-btn"
              onClick={() => toggleSection("history")}
              aria-expanded={!collapsedSections.history}
            >
              <div className="case-section-header-left">
                <div className="case-section-icon-wrap" style={{ background: "rgba(100, 116, 139, 0.1)", color: "#475569" }}>
                  <History size={18} />
                </div>
                <div>
                  <h2 className="case-section-title">Status History & Quotation Revisions</h2>
                </div>
              </div>

              <div className="case-section-header-right">
                <span className="case-section-badge-summary">
                  {caseData.status_history ? `${caseData.status_history.length} Timeline Events` : "History"}
                </span>
                <div className="case-section-chevron">
                  {collapsedSections.history ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
                </div>
              </div>
            </button>

            {!collapsedSections.history && (
              <div className="case-section-body">
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
          </div>
        </>
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

            {showBulkRejectModal && (
        <BulkRejectModal
          count={selectedItems.size}
          selectedItemIds={selectedItems}
          allCaseItems={caseData?.line_items}
          onClose={() => setShowBulkRejectModal(false)}
          onConfirm={handleBulkReject}
          busy={bulkActing}
        />
      )}
    </div>
  );
}