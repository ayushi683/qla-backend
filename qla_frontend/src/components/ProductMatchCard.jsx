import { useState } from "react";
import { api } from "../api/client";
import { otherRecommendations, topRecommendation } from "../utils/recommendations";

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
}

export default function ProductMatchCard({ item, onChanged, onRejected, onQuotationReady }) {
  const [editing, setEditing] = useState(false);
  const [modelCode, setModelCode] = useState("");
  const [rationale, setRationale] = useState("");
  const [error, setError] = useState("");
  const [busyGlobal, setBusyGlobal] = useState(false);
  const [addedAltIds, setAddedAltIds] = useState(new Set());

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
  }

  function startEdit() {
    setModelCode(topRec?.model_code || "");
    setRationale(topRec?.rationale || "");
    setEditing(true);
  }

  function handleSaveEdit(e) {
    e.preventDefault();
    runAction(async () => {
      await api.edit(topRec.recommendation_id, { model_code: modelCode, rationale });
      setEditing(false);
    });
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

      {isRejected && (
        <p className="rejected-hint">This match was rejected. Edit it, or pick an alternative below.</p>
      )}

      {otherRecs.length > 0 && (
        <div className="modal-alt-matches">
          <div className="disclosure-toggle" style={{ cursor: "default" }}>
            {otherRecs.length} other suggested match{otherRecs.length > 1 ? "es" : ""} for this product
          </div>
          <p style={{ fontSize: "0.76rem", color: "var(--muted)", margin: "2px 0 8px" }}>
            "Use this instead" replaces the current pick. "Also quote this" adds it as an extra line item alongside the current pick.
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
                <div style={{ display: "flex", gap: 6 }}>
                  <button className="btn btn-small" disabled={busyGlobal} onClick={() => handleUseInstead(rec.recommendation_id)}>
                    Use this instead
                  </button>
                  <button
                    className="btn btn-small"
                    disabled={busyGlobal || alreadyAdded}
                    onClick={() => handleAddAlternate(rec.recommendation_id)}
                    style={alreadyAdded ? { color: "var(--success)", borderColor: "var(--success)" } : undefined}
                  >
                    {alreadyAdded ? "✓ Added" : "Also quote this"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}