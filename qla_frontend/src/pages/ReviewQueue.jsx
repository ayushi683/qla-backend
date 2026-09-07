import { useState, useMemo } from "react";
import { api } from "../api/client";
import { usePolling } from "../api/usePolling";
import CaseReviewModal from "../components/CaseReviewModal";

function confidenceClass(conf) {
  if (conf === null || conf === undefined) return "conf-none";
  const n = parseFloat(conf);
  if (n >= 0.8) return "conf-high";
  if (n >= 0.5) return "conf-mid";
  return "conf-low";
}

export default function ReviewQueue() {
  const { data: cases, loading, error, refresh } = usePolling(() => api.reviewQueueCases(), 12000);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("all"); // all | pending | rejected
  const [openCaseId, setOpenCaseId] = useState(null);
  const [toast, setToast] = useState(null);

  const filtered = useMemo(() => {
    if (!cases) return [];
    let rows = cases;
    if (tab === "pending") rows = rows.filter((c) => c.has_pending);
    if (tab === "rejected") rows = rows.filter((c) => c.has_rejected);
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (c) =>
          (c.internal_ref || "").toLowerCase().includes(q) ||
          (c.customer_name || "").toLowerCase().includes(q) ||
          (c.project_name || "").toLowerCase().includes(q)
      );
    }
    return rows;
  }, [cases, tab, search]);

  const pendingCount = cases?.filter((c) => c.has_pending).length || 0;
  const rejectedCount = cases?.filter((c) => c.has_rejected).length || 0;

  function showToast(message) {
    setToast(message);
    setTimeout(() => setToast(null), 5000);
  }

  function handleRejected(tagLabel) {
    showToast(`${tagLabel} needs a decision`);
    refresh();
  }

  return (
    <div className="page">
      {toast && (
        <div className="toast-notif">
          <span className="toast-icon">⚠</span>
          <div>
            <div className="toast-title">{toast}</div>
            <div className="toast-sub">This case is pending your review.</div>
          </div>
          <button className="toast-close" onClick={() => setToast(null)}>×</button>
        </div>
      )}

      <div className="page-head">
        <div>
          <h1 className="page-title">Review Queue</h1>
          <p className="page-sub">Cases with products still needing your decision.</p>
        </div>
      </div>

      <div className="stat-cards">
        <div className="stat-card">
          <div className="stat-icon stat-icon-pending">📋</div>
          <div>
            <div className="stat-value">{pendingCount}</div>
            <div className="stat-label">Pending Review</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-icon-rejected">⚠</div>
          <div>
            <div className="stat-value">{rejectedCount}</div>
            <div className="stat-label">Rejected — Needs Decision</div>
          </div>
        </div>
      </div>

      <div className="table-controls">
        <input
          type="text"
          className="search-input"
          placeholder="Search by case ref or company name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="filter-tabs">
        <button className={`filter-tab ${tab === "all" ? "active" : ""}`} onClick={() => setTab("all")}>All</button>
        <button className={`filter-tab ${tab === "pending" ? "active" : ""}`} onClick={() => setTab("pending")}>Pending</button>
        <button className={`filter-tab ${tab === "rejected" ? "active" : ""}`} onClick={() => setTab("rejected")}>Rejected</button>
      </div>

      {error && <div className="flash flash-error">{error}</div>}

      {loading && !cases ? (
        <div className="loading-state">Loading…</div>
      ) : filtered.length > 0 ? (
        <table className="data-table case-summary-table">
          <thead>
            <tr>
              <th>Case Ref</th>
              <th>Customer / Project</th>
              <th>Items</th>
              <th>Top Match Confidence</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.case_id} className={c.has_rejected && !c.has_pending ? "row-rejected" : ""}>
                <td>{c.internal_ref}</td>
                <td>
                  <div className="cell-primary">{c.customer_name || "—"}</div>
                  <div className="cell-secondary">{c.project_name || ""}</div>
                </td>
                <td>{c.items_count}</td>
                <td>
                  {c.top_confidence !== null && c.top_confidence !== undefined ? (
                    <span className={`confidence-badge ${confidenceClass(c.top_confidence)}`}>
                      {Math.round(parseFloat(c.top_confidence) * 100)}%
                    </span>
                  ) : "—"}
                </td>
                <td>
                  <button className="btn btn-approve" onClick={() => setOpenCaseId(c.case_id)}>
                    View Details →
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="empty-state">
          <p>{search.trim() ? "No cases match your search." : "Nothing pending review."}</p>
        </div>
      )}

      {openCaseId && (
        <CaseReviewModal
          caseId={openCaseId}
          onClose={() => setOpenCaseId(null)}
          onChanged={refresh}
          onRejected={handleRejected}
        />
      )}
    </div>
  );
}