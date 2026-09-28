import { useState, useMemo, useRef, useEffect } from "react";
import { api } from "../api/client";
import { otherRecommendations, topRecommendation, uniqueRecommendations } from "../utils/recommendations";

const FEEDBACK_REASONS = [
  { value: "WRONG_FAMILY", label: "Wrong product family" },
  { value: "INCOMPLETE_SPEC_MATCH", label: "Incomplete/incorrect specs matched" },
  { value: "BETTER_ALTERNATIVE", label: "Better alternative exists" },
  { value: "DUPLICATE_SUGGESTION", label: "Duplicate/redundant suggestion" },
  { value: "OTHER", label: "Other" },
];

const REJECT_REASONS = [
  { value: "WRONG_MODEL", label: "Wrong model" },
  { value: "SPEC_MISMATCH", label: "Specification mismatch" },
  { value: "NOT_MANUFACTURED", label: "Not manufactured" },
  { value: "INCORRECT_CONNECTION", label: "Incorrect connection" },
  { value: "OTHER", label: "Other" },
];

function shownModel(rec) {
  const code = String(rec?.model_code || "").trim();
  const family = String(rec?.family_code || "").trim();
  if (!code || code.toUpperCase() === family.toUpperCase()) return "—";
  return code;
}

function confidenceClass(conf) {
  if (conf === null || conf === undefined) return "conf-none";
  const n = parseFloat(conf);
  if (n >= 0.8) return "conf-high";
  if (n >= 0.5) return "conf-mid";
  return "conf-low";
}

function confidencePercent(conf) {
  if (conf === null || conf === undefined) return null;
  return Math.round(parseFloat(conf) * 100);
}

function RejectSuggestionModal({ item, topRec, allCaseItems, onClose, onConfirm, busy, error }) {
  const [selectedReasons, setSelectedReasons] = useState(new Set());
  const [suggestedModel, setSuggestedModel] = useState("");
  const [localError, setLocalError] = useState("");

  // Gather suggested products across this case (shows 3 if 3 are suggested, 1 if 1 is suggested)
  const availableProducts = useMemo(() => {
    const items = (allCaseItems && allCaseItems.length > 0) ? allCaseItems : (item ? [item] : []);
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
              isCurrent: item && it.line_item_id === item.line_item_id,
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
            isCurrent: item && it.line_item_id === item.line_item_id,
          });
        }
      }
    });

    return list;
  }, [allCaseItems, item]);

  // Selected products state with checkboxes (starts unselected so user can suggest correct item)
  const [selectedProducts, setSelectedProducts] = useState(new Set());
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [productFeedback, setProductFeedback] = useState("");
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

  function toggleReason(value) {
    setSelectedReasons((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }

  function handleConfirm() {
    if (!productFeedback.trim()) {
      setLocalError("Please enter feedback for the selected product(s).");
      return;
    }
    setLocalError("");

    // Fallback reason code if no chips were clicked
    const reasons = selectedReasons.size > 0 ? Array.from(selectedReasons).join(",") : "SPEC_MISMATCH";

    const selectedCodes = Array.from(selectedProducts)
      .map((id) => availableProducts.find((p) => p.id === id)?.code)
      .filter(Boolean)
      .join(", ");

    // Backend wiring untouched: passes standard fields expected by api.submitFeedback
    onConfirm({
      reasonCode: reasons,
      comment: productFeedback.trim(),
      suggestedModel: suggestedModel.trim() || selectedCodes || null,
    });
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel reject-modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="qgm-header">
          <h3 className="qgm-title">Reject suggestion</h3>
          <button className="qgm-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="qgm-body">
          <div className="edit-drawer-product-card" style={{ marginBottom: 14 }}>
            <span className="edit-drawer-product-icon">📦</span>
            <div>
              <div className="edit-drawer-product-title">
                {item.product_type || item.description || `Line ${item.line_no}`}
              </div>
              <div className="edit-drawer-product-sub">
                <code>{topRec?.model_code || topRec?.family_code || "—"}</code>
                <span style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
                  Qty {item.qty} {item.uom}
                </span>
              </div>
            </div>
          </div>

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
              title="Click to select suggested / correct items"
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

          {/* 3. Reason Chips (Optional quick tags) */}
          <p className="qgm-section-label" style={{ marginTop: 4 }}>Reason Category (optional)</p>
          <div className="reject-reason-chips">
            {REJECT_REASONS.map((r) => (
              <button
                type="button"
                key={r.value}
                className={`reject-reason-chip ${selectedReasons.has(r.value) ? "selected" : ""}`}
                onClick={() => toggleReason(r.value)}
              >
                {selectedReasons.has(r.value) && <span className="reject-reason-check">✓</span>}
                {r.label}
              </button>
            ))}
          </div>

          {/* 4. Suggest Correct Model (Optional) */}
          <label className="edit-drawer-label" style={{ marginTop: 10 }}>Suggest correct model (optional)</label>
          <div className="edit-drawer-search-input">
            <input
              value={suggestedModel}
              onChange={(e) => setSuggestedModel(e.target.value)}
              placeholder="Search product catalog by model number or name…"
            />
          </div>

          {(localError || error) && (
            <div className="flash flash-error" style={{ marginTop: 12 }}>{localError || error}</div>
          )}
        </div>

        <div className="qgm-footer">
          <button className="btn btn-outline" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn btn-reject-solid" onClick={handleConfirm} disabled={busy}>
            {busy ? "Saving…" : "Reject & save feedback"}
          </button>
        </div>
      </div>
    </div>
  );
}

function EditSuggestionDrawer({ item, topRec, otherRecs, onClose, onSaved, onReject }) {
  const [modelCode, setModelCode] = useState(topRec?.model_code || "");
  const [notes, setNotes] = useState(topRec?.rationale || "");
  const [reasonCode, setReasonCode] = useState("");
  const [showAlternatives, setShowAlternatives] = useState(true);
  const [quoteAltIds, setQuoteAltIds] = useState(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const confPct = confidencePercent(topRec?.confidence);

  function toggleQuoteAlt(recId) {
    setQuoteAltIds((prev) => {
      const next = new Set(prev);
      if (next.has(recId)) next.delete(recId);
      else next.add(recId);
      return next;
    });
  }

  async function handleUseAsPrimary(recId) {
    setBusy(true);
    setError("");
    try {
      await api.pickAlternative(item.line_item_id, recId);
      onSaved();
    } catch (e) {
      setError(e.message || "Failed to switch primary match");
    } finally {
      setBusy(false);
    }
  }

  async function handleSave() {
    if (!reasonCode) {
      setError("Please select a reason for the change.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (modelCode !== topRec?.model_code || notes !== topRec?.rationale) {
        await api.edit(topRec.recommendation_id, { model_code: modelCode, rationale: notes });
      }

      await api.submitFeedback(item.case_id, {
        line_item_id: item.line_item_id,
        recommendation_id: topRec?.recommendation_id,
        ai_model_code: topRec?.model_code || topRec?.family_code,
        engineer_model_code: modelCode !== topRec?.model_code ? modelCode : null,
        reason_code: reasonCode,
        comment: notes || null,
      });

      for (const recId of quoteAltIds) {
        await api.approveAsNewItem(recId);
      }

      onSaved();
    } catch (e) {
      setError(e.message || "Failed to save changes");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="edit-drawer-overlay" onClick={onClose}>
      <div className="edit-drawer-panel" onClick={(e) => e.stopPropagation()}>
        <div className="edit-drawer-header">
          <h3>Edit suggestion</h3>
          <button className="edit-drawer-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="edit-drawer-body">
          <div className="edit-drawer-product-card">
            <span className="edit-drawer-product-icon">📦</span>
            <div>
              <div className="edit-drawer-product-title">
                {item.product_type || item.description || `Line ${item.line_no}`}
              </div>
              <div className="edit-drawer-product-sub">
                <code>{shownModel(topRec)}</code>
                {confPct !== null && (
                  <span className={`confidence-badge ${confidenceClass(topRec?.confidence)}`}>
                    {confPct}% match
                  </span>
                )}
              </div>
            </div>
          </div>

          <label className="edit-drawer-label">Model number</label>
          <div className="edit-drawer-search-input">
            <input value={modelCode} onChange={(e) => setModelCode(e.target.value)} placeholder="Search or enter model code" />
          </div>

          <label className="edit-drawer-label">Notes (optional)</label>
          <textarea
            rows={3}
            className="edit-drawer-textarea"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add notes about this product…"
          />

          <label className="edit-drawer-label">
            Reason for change <span className="edit-drawer-required">(required)</span>
          </label>
          <select
            className="edit-drawer-select"
            value={reasonCode}
            onChange={(e) => setReasonCode(e.target.value)}
          >
            <option value="">Select a reason…</option>
            {FEEDBACK_REASONS.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>

          {reasonCode && (
            <div className="edit-drawer-warn">
              ⚠ Changes require approval again.
            </div>
          )}

          {error && <div className="flash flash-error" style={{ marginTop: 10 }}>{error}</div>}

          {otherRecs.length > 0 && (
            <div className="edit-drawer-alts">
              <button
                type="button"
                className="edit-drawer-alts-toggle"
                onClick={() => setShowAlternatives((v) => !v)}
              >
                {showAlternatives ? "▾" : "▸"} Alternatives
              </button>
              {showAlternatives && (
                <div className="edit-drawer-alts-list">
                  {otherRecs.map((rec) => (
                    <div className="edit-drawer-alt-row" key={rec.recommendation_id}>
                      <span className="edit-drawer-product-icon">📦</span>
                      <div className="edit-drawer-alt-main">
                        <div className="edit-drawer-alt-title">
                          {rec.family_code || item.product_type || "Alternative"}
                        </div>
                        <div className="edit-drawer-alt-sub">
                          <code>{shownModel(rec)}</code>
                          {confidencePercent(rec.confidence) !== null && (
                            <span className={`confidence-badge ${confidenceClass(rec.confidence)}`}>
                              {confidencePercent(rec.confidence)}%
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        className="btn btn-small"
                        disabled={busy}
                        onClick={() => handleUseAsPrimary(rec.recommendation_id)}
                      >
                        Use as primary
                      </button>
                      <label className="edit-drawer-alt-checkbox">
                        <input
                          type="checkbox"
                          checked={quoteAltIds.has(rec.recommendation_id)}
                          disabled={busy}
                          onChange={() => toggleQuoteAlt(rec.recommendation_id)}
                        />
                        Add to quotation
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="edit-drawer-footer">
          {topRec?.is_selected_by_engineer !== false && (
            <button className="btn btn-reject" onClick={onReject} disabled={busy}>
              Reject this match
            </button>
          )}
          <div style={{ display: "flex", gap: 10, marginLeft: topRec?.is_selected_by_engineer === false ? "auto" : 0 }}>
            <button className="btn btn-outline" onClick={onClose} disabled={busy}>Cancel</button>
            <button className="btn qgm-primary" onClick={handleSave} disabled={busy}>
              {busy ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function InlineAlternates({ item, topRec, otherRecs, onChanged }) {
  const [checkedIds, setCheckedIds] = useState(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function toggleCheck(recId) {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(recId)) next.delete(recId);
      else next.add(recId);
      return next;
    });
  }

  async function handleUseAsPrimary(recId) {
    setBusy(true);
    setError("");
    try {
      await api.pickAlternative(item.line_item_id, recId);
      onChanged?.();
    } catch (e) {
      setError(e.message || "Failed to switch primary match");
    } finally {
      setBusy(false);
    }
  }

  async function handleAddToQuotation() {
    setBusy(true);
    setError("");
    try {
      for (const recId of checkedIds) {
        await api.approveAsNewItem(recId);
      }
      setCheckedIds(new Set());
      onChanged?.();
    } catch (e) {
      setError(e.message || "Failed to add to quotation");
    } finally {
      setBusy(false);
    }
  }

  if (otherRecs.length === 0) return null;

  return (
    <div className="inline-alts-wrap">
      {otherRecs.length > 0 && (
        <div className="inline-alts-others">
          <p className="inline-alts-others-label">
            {otherRecs.length} other suggested match{otherRecs.length > 1 ? "es" : ""} for this product
          </p>
          {otherRecs.map((rec) => (
            <div className="inline-alts-row" key={rec.recommendation_id}>
              <label className="inline-alts-checkbox">
                <input
                  type="checkbox"
                  checked={checkedIds.has(rec.recommendation_id)}
                  disabled={busy}
                  onChange={() => toggleCheck(rec.recommendation_id)}
                />
              </label>
              <div className="inline-alts-row-main">
                <code>{shownModel(rec)}</code>
                {confidencePercent(rec.confidence) !== null && (
                  <span className={`confidence-badge ${confidenceClass(rec.confidence)}`}>
                    {confidencePercent(rec.confidence)}%
                  </span>
                )}
                <span className="inline-alts-rationale">{rec.rationale || "—"}</span>
              </div>
              <button className="btn btn-small" disabled={busy} onClick={() => handleUseAsPrimary(rec.recommendation_id)}>
                Use as primary
              </button>
            </div>
          ))}
          <div className="inline-alts-footer-row">
            <label className="inline-alts-checkbox-label">
              <input type="checkbox" checked={checkedIds.size > 0} readOnly disabled />
              Also quote this model
            </label>
            <button
              className="btn btn-approve"
              disabled={busy || checkedIds.size === 0}
              onClick={handleAddToQuotation}
            >
              Add to quotation
            </button>
          </div>
        </div>
      )}
      {error && <div className="flash flash-error" style={{ marginTop: 8 }}>{error}</div>}
    </div>
  );
}

export default function ProductMatchCard({
  item,
  allCaseItems,
  onChanged,
  onRejected,
  onQuotationReady,
  selectable,
  isSelected,
  onToggleSelect,
  variant = "compact",
}) {
  const [error, setError] = useState("");
  const [busyGlobal, setBusyGlobal] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);

  const topRec = topRecommendation(item);
  const otherRecs = otherRecommendations(item, topRec);

  async function runAction(fn) {
    setBusyGlobal(true);
    setError("");
    try {
      await fn();
      onChanged?.();
    } catch (e) {
      setError(e.message || "Something went wrong");
    } finally {
      setBusyGlobal(false);
    }
  }

  function handleApprove() {
    runAction(async () => {
      const result = await api.approve(topRec.recommendation_id);
      if (result?.quotation_generated) onQuotationReady?.();
    });
  }
  
  function handleUndo() {
    runAction(() => api.resetDecision(topRec.recommendation_id));
  }

  async function handleConfirmReject({ reasonCode, comment, suggestedModel }) {
    await runAction(async () => {
      await api.reject(topRec.recommendation_id);
      await api.submitFeedback(item.case_id, {
        line_item_id: item.line_item_id,
        recommendation_id: topRec.recommendation_id,
        ai_model_code: topRec.model_code || topRec.family_code,
        engineer_model_code: suggestedModel,
        reason_code: reasonCode,
        comment,
      });
      onRejected?.(item.customer_tag_no || `Line ${item.line_no}`);
    });
    setShowRejectModal(false);
  }

  function handleDrawerSaved() {
    setShowDrawer(false);
    onChanged?.();
  }

  if (!topRec) {
    return (
      <div className="modal-product-row">
        <div className="modal-product-title">{item.customer_tag_no || `Line ${item.line_no}`}</div>
        <p className="no-recs">No product matches found yet.</p>
      </div>
    );
  }

  const isApproved = topRec.is_selected_by_engineer === true;
  const isRejected = topRec.is_selected_by_engineer === false;
  const isPending = !isApproved && !isRejected;
  const showInline = variant === "full" && isPending;

  return (
    <div className={`modal-product-row-v2 ${isRejected ? "is-rejected" : ""}`}>
      <div className="modal-product-row-v2-top">
        {selectable && (
          <input
            type="checkbox"
            className="modal-product-checkbox"
            checked={isSelected}
            onChange={() => onToggleSelect(item.line_item_id)}
          />
        )}
        <div className="modal-product-icon">📦</div>
        <div className="modal-product-main">
          <div className="modal-product-title">
            {item.product_type || item.description || item.customer_tag_no || `Line ${item.line_no}`}
          </div>
          <div className="modal-product-desc">
            {item.description && item.product_type && item.description !== item.product_type ? `${item.description} · ` : ""}
            {item.qty ? `Qty ${item.qty} ${item.uom || ""}` : ""}
          </div>
          <div className="modal-product-match-line">
            <code>{topRec.model_code || topRec.family_code || "—"}</code>
            <span className={`confidence-badge ${confidenceClass(topRec.confidence)}`}>
              {confidencePercent(topRec.confidence) !== null ? `${confidencePercent(topRec.confidence)}%` : "No score"}
            </span>
            {isPending && <span className="needs-review-pill">Needs review</span>}
          </div>
        </div>

        <div className="modal-product-actions-v2">
          {isApproved ? (
            <>
              <span className="approved-note">✓ Approved</span>
              <button className="btn btn-small" disabled={busyGlobal} onClick={handleUndo}>Undo</button>
            </>
          ) : isRejected ? (
            <>
              <span className="rejected-note">✗ Rejected</span>
              <button className="btn btn-small" disabled={busyGlobal} onClick={handleUndo}>Undo</button>
            </>
          ) : (
            <>
              <button className="btn btn-approve" disabled={busyGlobal} onClick={handleApprove}>Approve</button>
              <button className="btn btn-reject" disabled={busyGlobal} onClick={() => setShowRejectModal(true)}>Reject</button>
            </>
          )}
          <button className="btn btn-edit" disabled={busyGlobal} onClick={() => setShowDrawer(true)}>
            Edit
          </button>
        </div>
      </div>

      {error && <div className="flash flash-error" style={{ marginTop: 6 }}>{error}</div>}

      {isRejected && (
        <p className="rejected-hint">This match was rejected. Edit it, or pick an alternative below.</p>
      )}

      {showInline && (
        <InlineAlternates item={item} topRec={topRec} otherRecs={otherRecs} onChanged={onChanged} />
      )}

      {showDrawer && (
        <EditSuggestionDrawer
          item={item}
          topRec={topRec}
          otherRecs={otherRecs}
          onClose={() => setShowDrawer(false)}
          onSaved={handleDrawerSaved}
          onReject={() => {
            setShowDrawer(false);
            setShowRejectModal(true);
          }}
        />
      )}

      {showRejectModal && (
        <RejectSuggestionModal
          item={item}
          topRec={topRec}
          allCaseItems={allCaseItems}
          onClose={() => setShowRejectModal(false)}
          onConfirm={handleConfirmReject}
          busy={busyGlobal}
          error={error}
        />
      )}
    </div>
  );
}