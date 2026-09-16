import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";

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

function topRecommendation(item) {
  const recs = item.recommendations || [];
  if (recs.length === 0) return null;
  const approved = recs.filter((r) => r.is_selected_by_engineer === true);
  if (approved.length > 0) return approved[0];
  return [...recs].sort((a, b) => a.rank_no - b.rank_no)[0];
}

export default function ReviewCard({ item, showCase = false, onChanged }) {
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [modelCode, setModelCode] = useState("");
  const [rationale, setRationale] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const topRec = topRecommendation(item);
  const otherRecs = (item.recommendations || [])
    .filter((r) => !topRec || r.recommendation_id !== topRec.recommendation_id)
    .sort((a, b) => a.rank_no - b.rank_no);

  function startEdit() {
    setModelCode(topRec?.model_code || "");
    setRationale(topRec?.rationale || "");
    setEditing(true);
  }

  async function runAction(fn) {
    setBusy(true);
    setError("");
    try {
      await fn();
      onChanged?.();
    } catch (e) {
      setError(e.message || "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  function handleApprove() {
    runAction(async () => {
      const result = await api.approve(topRec.recommendation_id);
      if (result?.quotation_generated) {
        navigate(`/cases/${item.case_id}/quotation`);
      }
    });
  }

  function handleReject() {
    runAction(() => api.reject(topRec.recommendation_id));
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

  let stateLabel = null;
  if (topRec) {
    if (topRec.is_selected_by_engineer === true) {
      stateLabel = <span className="state-pill state-approved">Approved</span>;
    } else if (topRec.is_selected_by_engineer === false) {
      stateLabel = <span className="state-pill state-rejected">Rejected: needs a decision</span>;
    } else {
      stateLabel = <span className="state-pill state-pending">Pending review</span>;
    }
  }

  return (
    <div className="review-card">
      <div className="review-card-top">
        <div className="review-card-title">
          <span className="tag-chip">{item.customer_tag_no || "no tag"}</span>
          {showCase && (
            <Link className="case-link" to={`/cases/${item.case_id}`}>
              Case #{item.case_id}
            </Link>
          )}
        </div>
        {stateLabel}
      </div>

      <p className="review-card-desc">{item.description || item.equipment_name || "No description extracted"}</p>

      <div className="review-card-specs">
        {item.product_type && <span className="spec-chip">{item.product_type}</span>}
        {item.qty && <span className="spec-chip">Qty {item.qty} {item.uom}</span>}
        {item.range_text && <span className="spec-chip">{item.range_text}</span>}
        {item.moc && <span className="spec-chip">MOC {item.moc}</span>}
      </div>

      {error && <div className="flash flash-error" style={{ marginBottom: 10 }}>{error}</div>}

      {topRec ? (
        <div className="match-panel">
          <div className="match-main">
            <div className="match-model">
              <code>{topRec.model_code || topRec.family_code || "—"}</code>
              <span className={`confidence-badge ${confidenceClass(topRec.confidence)}`}>
                {confidencePercent(topRec.confidence) !== null
                  ? `${confidencePercent(topRec.confidence)}% Match Quality`
                  : "No score"}
              </span>
            </div>
            <p className="match-rationale">{topRec.rationale || "No rationale given."}</p>
            <p className="confidence-help">
              Match Quality shows how well the AI thinks this product fits, a higher number means a better match. Check this along with the description before deciding.
            </p>
          </div>

          <div className="match-actions">
            {topRec.is_selected_by_engineer !== true ? (
              <>
                <button className="btn btn-approve" disabled={busy} onClick={handleApprove}>✓ Approve</button>
                <button className="btn btn-reject" disabled={busy} onClick={handleReject}>✗ Reject</button>
              </>
            ) : (
              <span className="approved-note">✓ Confirmed match</span>
            )}
            <button className="btn btn-edit" disabled={busy} onClick={() => (editing ? setEditing(false) : startEdit())}>
              {editing ? "Cancel" : "Edit"}
            </button>
          </div>

          {editing && (
            <form className="edit-form" onSubmit={handleSaveEdit}>
              <label>Model code</label>
              <input value={modelCode} onChange={(e) => setModelCode(e.target.value)} />
              <label>Rationale / notes</label>
              <textarea rows={2} value={rationale} onChange={(e) => setRationale(e.target.value)} />
              <button type="submit" className="btn btn-save" disabled={busy}>Save changes</button>
            </form>
          )}

          {otherRecs.length > 0 && (
            <div className="alt-matches">
              <p className="alt-matches-label">{otherRecs.length} other suggested match{otherRecs.length > 1 ? "es" : ""}:</p>
              <table className="alt-table">
                <tbody>
                  {otherRecs.map((rec) => (
                    <tr key={rec.recommendation_id}>
                      <td>#{rec.rank_no}</td>
                      <td><code>{rec.model_code || rec.family_code || "—"}</code></td>
                      <td>
                        <span className={`confidence-badge ${confidenceClass(rec.confidence)}`}>
                          {confidencePercent(rec.confidence) !== null ? `${confidencePercent(rec.confidence)}%` : "—"}
                        </span>
                      </td>
                      <td className="alt-rationale">{rec.rationale || "—"}</td>
                      <td>
                        <button className="btn btn-small" disabled={busy} onClick={() => handleUseInstead(rec.recommendation_id)}>
                          Use this instead
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <p className="no-recs">No product matches found for this line item yet.</p>
      )}
    </div>
  );
}