import { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { usePolling } from "../api/usePolling";

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

function getPageNumbers(current, total) {
  const delta = 1;
  const range = [];
  for (let i = Math.max(2, current - delta); i <= Math.min(total - 1, current + delta); i++) {
    range.push(i);
  }
  if (current - delta > 2) range.unshift("...");
  if (current + delta < total - 1) range.push("...");
  range.unshift(1);
  if (total > 1) range.push(total);
  return range;
}

export default function CasesList() {
  const { data: cases, loading, error } = usePolling(() => api.cases(), 12000);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [aiRunningId, setAiRunningId] = useState(null);
  const [aiResults, setAiResults] = useState({});
  const PAGE_SIZE = 12;

  const filtered = useMemo(() => {
    if (!cases) return [];
    let rows = cases;
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (c) =>
          (c.internal_ref || "").toLowerCase().includes(q) ||
          (c.customer_name || "").toLowerCase().includes(q) ||
          (c.project_name || "").toLowerCase().includes(q)
      );
    }
    if (dateFrom) {
      rows = rows.filter((c) => c.enq_received_at && c.enq_received_at.slice(0, 10) >= dateFrom);
    }
    if (dateTo) {
      rows = rows.filter((c) => c.enq_received_at && c.enq_received_at.slice(0, 10) <= dateTo);
    }
    if (statusFilter !== "all") {
      rows = rows.filter((c) => (c.status || "").toUpperCase() === statusFilter);
    }
    return rows;
  }, [cases, search, dateFrom, dateTo, statusFilter]);

  useEffect(() => {
    setPage(1);
  }, [search, dateFrom, dateTo, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function clearDates() {
    setDateFrom("");
    setDateTo("");
  }

  async function handleRunAiMatch(caseId) {
    setAiRunningId(caseId);
    try {
      const result = await api.runAiMatch(caseId);
      setAiResults((prev) => ({ ...prev, [caseId]: result }));
    } catch (e) {
      setAiResults((prev) => ({ ...prev, [caseId]: { status: "error", raw_message: e.message } }));
    } finally {
      setAiRunningId(null);
    }
  }

  return (
    <div className="page">
      <h1 className="page-title">Inquiry Cases</h1>

      <div className="cases-controls">
        <input
          type="text"
          className="search-input"
          placeholder="Search by case ref, customer or project…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="date-range-picker">
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          <span className="date-range-sep">to</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          {(dateFrom || dateTo) && (
            <button className="btn btn-small" onClick={clearDates}>Clear</button>
          )}
        </div>
        <select className="status-filter-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All Statuses</option>
          <option value="RECEIVED">Received</option>
          <option value="IN_REVIEW">In Review</option>
          <option value="QUOTED">Quoted</option>
        </select>
      </div>

      {error && <div className="flash flash-error">{error}</div>}

      {loading && !cases ? (
        <div className="loading-state">Loading…</div>
      ) : filtered.length > 0 ? (
        <>
          <table className="data-table">
            <thead>
              <tr>
                <th>Ref</th>
                <th>Status</th>
                <th>Customer / Project</th>
                <th>Received</th>
                <th>Match Confidence</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((c) => (
                <tr key={c.case_id}>
                  <td>{c.internal_ref}</td>
                  <td><span className={statusClass(c.status)}>{c.status}</span></td>
                  <td>
                    <div className="cell-primary">{c.customer_name || "—"}</div>
                    <div className="cell-secondary">{c.project_name || ""}</div>
                  </td>
                  <td>{c.enq_received_at ? new Date(c.enq_received_at).toLocaleDateString() : "—"}</td>
                  <td>
                    {c.match_confidence !== null && c.match_confidence !== undefined ? (
                      <span className={`confidence-badge ${confidenceClass(c.match_confidence)}`}>
                        {Math.round(parseFloat(c.match_confidence) * 100)}%
                      </span>
                    ) : "—"}
                  </td>
                  <td>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <div>
                        <Link className="link-btn" to={`/cases/${c.case_id}`}>Open</Link>
                        {c.status === "QUOTED" && (
                          <>
                            {" · "}
                            <Link className="link-btn" to={`/cases/${c.case_id}/quotation`}>View Quotation</Link>
                          </>
                        )}
                      </div>
                      <button
                        className="btn btn-small"
                        disabled={aiRunningId === c.case_id}
                        onClick={() => handleRunAiMatch(c.case_id)}
                      >
                        {aiRunningId === c.case_id ? "Running… (~20s)" : "Run AI Match"}
                      </button>
                      {aiResults[c.case_id] && (
                        <div style={{ fontSize: "0.72rem", color: aiResults[c.case_id].status === "error" ? "var(--danger)" : "var(--muted)" }}>
                          {aiResults[c.case_id].status === "error"
                            ? aiResults[c.case_id].raw_message
                            : `${aiResults[c.case_id].decision} — ${aiResults[c.case_id].items_matched} matched`}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="pagination">
              <button disabled={page === 1} onClick={() => setPage(page - 1)}>‹ Prev</button>
              {getPageNumbers(page, totalPages).map((p, i) =>
                p === "..." ? (
                  <span key={"dots-" + i} className="pagination-dots">…</span>
                ) : (
                  <button key={p} className={p === page ? "active" : ""} onClick={() => setPage(p)}>{p}</button>
                )
              )}
              <button disabled={page === totalPages} onClick={() => setPage(page + 1)}>Next ›</button>
            </div>
          )}
        </>
      ) : (
        <div className="empty-state">
          <p>{search.trim() || dateFrom || dateTo ? "No cases match your filters." : "No cases yet."}</p>
        </div>
      )}
    </div>
  );
}