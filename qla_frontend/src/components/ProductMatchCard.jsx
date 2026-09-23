import { useState } from "react";
import { api } from "../api/client";
import { otherRecommendations, topRecommendation } from "../utils/recommendations";

const FEEDBACK_REASONS = [
  { value: "WRONG_FAMILY", label: "Wrong product family" },
  { value: "INCOMPLETE_SPEC_MATCH", label: "Incomplete/incorrect specs matched" },
  { value: "BETTER_ALTERNATIVE", label: "Better alternative exists" },
  { value: "DUPLICATE_SUGGESTION", label: "Duplicate/redundant suggestion" },
  { value: "OTHER", label: "Other" },
];

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


function shownModel(rec) {
  const code = String(rec?.model_code || "").trim();
  const family = String(rec?.family_code || "").trim();
  if (!code || code.toUpperCase() === family.toUpperCase()) return "—";
  return code;

function FeedbackForm({ onSubmit, onSkip, busy, alternatives }) {
  const [reasonCode, setReasonCode] = useState("");
  const [comment, setComment] = useState("");
  const [correctModelCode, setCorrectModelCode] = useState("");

  return (
    <div className="feedback-form">
      <p className="feedback-form-label">Why wasn't this AI suggestion right? (helps improve future matches)</p>
      <select
        value={reasonCode}
        onChange={(e) => setReasonCode(e.target.value)}
        className="feedback-select"
      >
        <option value="">Select a reason…</option>
        {FEEDBACK_REASONS.map((r) => (
          <option key={r.value} value={r.value}>{r.label}</option>
        ))}
      </select>

      {alternatives && alternatives.length > 0 && (
        <>
          <p className="feedback-form-label" style={{ marginTop: 8 }}>
            Which suggested product should have been picked? (optional)
          </p>
          <select
            value={correctModelCode}
            onChange={(e) => setCorrectModelCode(e.target.value)}
            className="feedback-select"
          >
            <option value="">None / not sure</option>
            {alternatives.map((rec) => (
              <option key={rec.recommendation_id} value={rec.model_code || rec.family_code || ""}>
                {rec.model_code || rec.family_code || "—"}
              </option>
            ))}
          </select>
        </>
      )}

      <textarea
        rows={2}
        placeholder="Optional: add more detail…"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        className="feedback-comment"
      />
      <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
        <button
          className="btn btn-approve"
          disabled={busy || !reasonCode}
          onClick={() => onSubmit(reasonCode, comment, correctModelCode || null)}
        >
          Submit feedback
        </button>
        <button className="btn btn-edit" disabled={busy} onClick={onSkip}>
          Skip
        </button>
      </div>
    </div>
  );
}

export default function ProductMatchCard({ item, onChanged, onRejected, onQuotationReady }) {
  const [editing, setEditing] = useState(false);
  const [modelCode, setModelCode] = useState("");
  const [rationale, setRationale] = useState("");
  const [error, setError] = useState("");
  const [busyGlobal, setBusyGlobal] = useState(false);
  const [addedAltIds, setAddedAltIds] = useState(new Set());
  const [selectedAltIds, setSelectedAltIds] = useState(new Set());
  const [pendingFeedback, setPendingFeedback] = useState(null); // { kind: "reject"|"edit", aiModelCode, engineerModelCode }

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

  function handleReject() {
    runAction(async () => {
      await api.reject(topRec.recommendation_id);
      onRejected?.(item.customer_tag_no || `Line ${item.line_no}`);
    });
    setPendingFeedback({
      kind: "reject",
      aiModelCode: topRec.model_code || topRec.family_code,
      engineerModelCode: null,
    });
  }

  function startEdit() {
    setModelCode(topRec?.model_code || "");
    setRationale(topRec?.rationale || "");
    setEditing(true);
  }

  function handleSaveEdit(e) {
    e.preventDefault();
    const aiModelCode = topRec?.model_code || topRec?.family_code;
    runAction(async () => {
      await api.edit(topRec.recommendation_id, { model_code: modelCode, rationale });
      setEditing(false);
    });
    if (modelCode && modelCode !== aiModelCode) {
      setPendingFeedback({ kind: "edit", aiModelCode, engineerModelCode: modelCode });
    }
  }

  function handleUseInstead(recId) {
    runAction(() => api.pickAlternative(item.line_item_id, recId));
  }

  function handleAddAlternate(recId) {
    runAction(async () => {
      const result = await api.approveAsNewItem(recId);
      setAddedAltIds((prev) => new Set(prev).add(recId));
      if (result?.quotation_generated) onQuotationReady?.();
    });
  }

  function toggleAltSelect(recId) {
  setSelectedAltIds((prev) => {
    const next = new Set(prev);
    if (next.has(recId)) next.delete(recId);
    else next.add(recId);
    return next;
  });
}

async function handleAddSelectedAlternates() {
  const ids = Array.from(selectedAltIds);
  if (ids.length === 0) return;
  await runAction(async () => {
    for (const recId of ids) {
      const result = await api.approveAsNewItem(recId);
      setAddedAltIds((prev) => new Set(prev).add(recId));
      if (result?.quotation_generated) onQuotationReady?.();
    }
    setSelectedAltIds(new Set());
  });
}

  async function submitFeedback(reasonCode, comment, suggestedCorrectModel) {
    if (!pendingFeedback) return;
    try {
      await api.submitFeedback(item.case_id, {
        line_item_id: item.line_item_id,
        recommendation_id: topRec?.recommendation_id,
        ai_model_code: pendingFeedback.aiModelCode,
        engineer_model_code: suggestedCorrectModel || pendingFeedback.engineerModelCode || null,
        reason_code: reasonCode,
        comment: comment || null,
      });
    } catch {
      // non-critical — don't block the workflow if feedback logging fails
    } finally {
      setPendingFeedback(null);
    }
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

  return (
    <div className={`modal-product-row ${isRejected ? "is-rejected" : ""}`}>
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
          <code>{shownModel(topRec)}</code>
          <span className={`confidence-badge ${confidenceClass(topRec.confidence)}`}>
            {confidencePercent(topRec.confidence) !== null ? `${confidencePercent(topRec.confidence)}%` : "No score"}
          </span>
        </div>

        {error && <div className="flash flash-error" style={{ marginTop: 6 }}>{error}</div>}
      </div>
      <div className="modal-product-actions">
        {isApproved ? (
          <span className="approved-note">✓ Approved</span>
        ) : isRejected ? (
          <span className="rejected-note">✗ Rejected</span>
        ) : (
          <>
            <button className="btn btn-approve" disabled={busyGlobal} onClick={handleApprove}>Approve</button>
            <button className="btn btn-reject" disabled={busyGlobal} onClick={handleReject}>Reject</button>
          </>
        )}
        <button className="btn btn-edit" disabled={busyGlobal} onClick={() => (editing ? setEditing(false) : startEdit())}>
          {editing ? "Cancel" : "Edit"}
        </button>
      </div>

      {editing && (
        <form className="edit-form modal-edit-form" onSubmit={handleSaveEdit}>
          <label>Model code</label>
          <input value={modelCode} onChange={(e) => setModelCode(e.target.value)} />
          <label>Rationale / notes</label>
          <textarea rows={2} value={rationale} onChange={(e) => setRationale(e.target.value)} />
          <button type="submit" className="btn btn-save" disabled={busyGlobal}>Save changes</button>
        </form>
      )}

      {pendingFeedback && (
        <FeedbackForm
          busy={busyGlobal}
          onSubmit={submitFeedback}
          onSkip={() => setPendingFeedback(null)}
          alternatives={otherRecs}
        />
      )}

      {isRejected && (
        <p className="rejected-hint">This match was rejected. Edit it, or pick an alternative below.</p>
      )}

      {otherRecs.length > 0 && (
        <div className="modal-alt-matches">
          <div className="disclosure-toggle" style={{ cursor: "default" }}>
            {otherRecs.length} other suggested match{otherRecs.length > 1 ? "es" : ""} for this product
          </div>
          <p style={{ fontSize: "0.76rem", color: "var(--muted)", margin: "2px 0 8px" }}>
            "Use this instead" replaces the current pick.
          </p>
          {otherRecs.map((rec) => {
            const alreadyAdded = addedAltIds.has(rec.recommendation_id);
            return (
              <div className="modal-alt-row" key={rec.recommendation_id}>
                <code>{shownModel(rec)}</code>
                <span className={`confidence-badge ${confidenceClass(rec.confidence)}`}>
                  {confidencePercent(rec.confidence) !== null ? `${confidencePercent(rec.confidence)}%` : "—"}
                </span>
                <span className="modal-alt-rationale">{rec.rationale || "—"}</span>
                <button className="btn btn-small" disabled={busyGlobal} onClick={() => handleUseInstead(rec.recommendation_id)}>
                  Use this instead
                </button>
              </div>
            );
          })}

          <div className="also-quote-section">
            <p className="also-quote-heading">Also quote this</p>
            {otherRecs.map((rec) => {
              const alreadyAdded = addedAltIds.has(rec.recommendation_id);
              return (
                <label
                  key={rec.recommendation_id}
                  className="also-quote-row"
                  style={alreadyAdded ? { opacity: 0.6 } : undefined}
                >
                  <input
                    type="checkbox"
                    checked={selectedAltIds.has(rec.recommendation_id) || alreadyAdded}
                    disabled={busyGlobal || alreadyAdded}
                    onChange={() => toggleAltSelect(rec.recommendation_id)}
                  />
                  <code>{rec.model_code || rec.family_code || "—"}</code>
                  <span className={`confidence-badge ${confidenceClass(rec.confidence)}`}>
                    {confidencePercent(rec.confidence) !== null ? `${confidencePercent(rec.confidence)}%` : "—"}
                  </span>
                  {alreadyAdded && <span style={{ color: "var(--success)", fontSize: "0.76rem", fontWeight: 600 }}>✓ Added</span>}
                </label>
              );
            })}
            <button
              className="btn btn-approve"
              disabled={busyGlobal || selectedAltIds.size === 0}
              onClick={handleAddSelectedAlternates}
              style={{ marginTop: 8, padding: "6px 14px", fontSize: "0.82rem" }}
            >
              Add selected as extra items
            </button>
          </div>
        </div>
      )}
    </div>
  );
}