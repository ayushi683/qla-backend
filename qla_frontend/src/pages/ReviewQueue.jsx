import { useState, useMemo, useRef, useEffect } from "react";
import { api } from "../api/client";
import { usePolling } from "../api/usePolling";
import CaseReviewModal from "../components/CaseReviewModal";

const CATEGORY_OPTIONS = ["OEM", "MRO", "CP", "EPC", "EXPORT", "DISTRIBUTED_PRODUCTS", "PROJECT", "ULTRASONIC"];

function confidenceClass(conf) {
  if (conf === null || conf === undefined) return "conf-none";
  const n = parseFloat(conf);
  if (n >= 0.8) return "conf-high";
  if (n >= 0.5) return "conf-mid";
  return "conf-low";
}

function statusClass(status) {
  return `status-pill status-${(status || "").toLowerCase()}`;
}

export default function ReviewQueue() {
  const { data: cases, loading, error, refresh } = usePolling(() => api.reviewQueueCases(), 12000);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [openDropdown, setOpenDropdown] = useState(null); // "category" | "date" | null
  const [openCaseId, setOpenCaseId] = useState(null);
  const [toast, setToast] = useState(null);
  const [sortBy, setSortBy] = useState("newest");
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkRunning, setBulkRunning] = useState(false);
  const dropdownRef = useRef(null);
  const tableWrapRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpenDropdown(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    function handleClickOutsideTable(e) {
      if (tableWrapRef.current && !tableWrapRef.current.contains(e.target)) {
        setSelectedIds(new Set());
      }
    }
    document.addEventListener("mousedown", handleClickOutsideTable);
    return () => document.removeEventListener("mousedown", handleClickOutsideTable);
  }, []);

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
    if (categoryFilter) {
      rows = rows.filter((c) => (c.category || "").toUpperCase().includes(categoryFilter));
    }
    if (dateFrom) {
      rows = rows.filter((c) => c.enq_received_at && c.enq_received_at.slice(0, 10) >= dateFrom);
    }
    if (dateTo) {
      rows = rows.filter((c) => c.enq_received_at && c.enq_received_at.slice(0, 10) <= dateTo);
    }
    rows = [...rows].sort((a, b) => {
      const da = a.enq_received_at || "";
      const db_ = b.enq_received_at || "";
      return sortBy === "newest" ? db_.localeCompare(da) : da.localeCompare(db_);
    });
    return rows;
  }, [cases, search, categoryFilter, dateFrom, dateTo, sortBy]);

  const pendingCount = cases?.filter((c) => c.has_pending).length || 0;
  const rejectedCount = cases?.filter((c) => c.has_rejected).length || 0;
  const activeFilterCount = [search, categoryFilter, dateFrom, dateTo].filter(Boolean).length;

  function resetFilters() {
    setSearch(""); setCategoryFilter(""); setDateFrom(""); setDateTo("");
  }

  function showToast(message) {
    setToast(message);
    setTimeout(() => setToast(null), 5000);
  }

  function handleRejected(tagLabel) {
    showToast(`${tagLabel} needs a decision`);
    refresh();
  }

  function toggleSelect(caseId) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(caseId)) next.delete(caseId); else next.add(caseId);
      return next;
    });
  }

  function toggleSelectAll() {
    const allSelected = filtered.length > 0 && filtered.every((c) => selectedIds.has(c.case_id));
    setSelectedIds(allSelected ? new Set() : new Set(filtered.map((c) => c.case_id)));
  }

  async function handleRunSelectedAiMatch() {
    setBulkRunning(true);
    try {
      const result = await api.bulkAiMatch(Array.from(selectedIds));
      const doneCount = result.results.filter((r) => r.status === "done").length;
      showToast(`AI match run on ${doneCount}/${result.results.length} cases`);
      refresh();
    } catch (e) {
      showToast("Bulk AI match failed: " + e.message);
    } finally {
      setBulkRunning(false);
      setSelectedIds(new Set());
    }
  }

  return (
    <div className="page">
      {toast && (
        <div className="toast-notif">
          <span className="toast-icon">⚠</span>
          <div><div className="toast-title">{toast}</div></div>
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
          <div><div className="stat-value">{pendingCount}</div><div className="stat-label">Pending Review</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-icon-rejected">⚠</div>
          <div><div className="stat-value">{rejectedCount}</div><div className="stat-label">Rejected: Needs Decision</div></div>
        </div>
      </div>

      {/* ---------- FILTER BAR ---------- */}
      <div className="filter-bar" ref={dropdownRef}>
        <div className="filter-search-wrap">
          <span className="filter-search-icon">🔍</span>
          <input
            type="text"
            className="search-input filter-search-input"
            placeholder="Search by reference, customer, model, or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="filter-pill-wrap">
          <button className={`filter-pill ${categoryFilter ? "filter-pill-active" : ""}`} onClick={() => setOpenDropdown(openDropdown === "category" ? null : "category")}>
            Category{categoryFilter ? `: ${categoryFilter}` : ""} <span className="chevron">▾</span>
          </button>
          {openDropdown === "category" && (
            <div className="filter-dropdown-panel">
              <button className="filter-option" onClick={() => { setCategoryFilter(""); setOpenDropdown(null); }}>All</button>
              {CATEGORY_OPTIONS.map((c) => (
                <button key={c} className="filter-option" onClick={() => { setCategoryFilter(c); setOpenDropdown(null); }}>{c}</button>
              ))}
            </div>
          )}
        </div>

        <div className="filter-pill-wrap">
          <button className={`filter-pill ${(dateFrom || dateTo) ? "filter-pill-active" : ""}`} onClick={() => setOpenDropdown(openDropdown === "date" ? null : "date")}>
            Date Range <span className="chevron">▾</span>
          </button>
          {openDropdown === "date" && (
            <div className="filter-dropdown-panel filter-dropdown-date">
              <label>From</label>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              <label>To</label>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
          )}
        </div>

        <select className="status-filter-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
          <option value="newest">Sort: Newest first</option>
          <option value="oldest">Sort: Oldest first</option>
        </select>

        {activeFilterCount > 0 && (
          <button className="filter-reset-link" onClick={resetFilters}>Reset</button>
        )}
      </div>

      {error && <div className="flash flash-error">{error}</div>}

      <div ref={tableWrapRef}>
        {selectedIds.size > 0 && (
          <div className="batch-action-bar" onMouseDown={(e) => e.stopPropagation()}>
            <span>{selectedIds.size} case{selectedIds.size > 1 ? "s" : ""} selected</span>
            <button className="btn btn-approve" onClick={handleRunSelectedAiMatch} disabled={bulkRunning}>
              {bulkRunning ? "Running…" : `Run AI Match on Selected (${selectedIds.size})`}
            </button>
          </div>
        )}

        {loading && !cases ? (
          <div className="loading-state">Loading…</div>
        ) : filtered.length > 0 ? (
          <table className="data-table case-summary-table">
            <thead>
              <tr>
                <th style={{ width: 32 }}>
                  <input
                    type="checkbox"
                    checked={filtered.length > 0 && filtered.every((c) => selectedIds.has(c.case_id))}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th>Case Ref</th>
                <th>Customer </th>
                <th>Category</th>
                
                <th>Received</th>
                <th>Top Match Confidence</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.case_id} className={c.has_rejected && !c.has_pending ? "row-rejected" : ""}>
                  <td>
                    <input type="checkbox" checked={selectedIds.has(c.case_id)} onChange={() => toggleSelect(c.case_id)} />
                  </td>
                  <td>
                    <div className="cell-primary">{c.internal_ref}</div>
                    {c.revision_count > 1 && (
                      <div className="cell-secondary">R{c.revision_no} · {c.revision_count} versions</div>
                    )}
                  </td>
                  <td>
                    <div className="cell-primary">{c.customer_name || "—"}</div>
 
                  </td>
                  <td>{c.category || "—"}</td>
                  <td>{c.enq_received_at ? new Date(c.enq_received_at).toLocaleDateString() : "—"}</td>
                  <td>
                    {c.top_confidence !== null && c.top_confidence !== undefined ? (
                      <span className={`confidence-badge ${confidenceClass(c.top_confidence)}`}>
                        {Math.round(parseFloat(c.top_confidence) * 100)}%
                      </span>
                    ) : "—"}
                  </td>
                  <td><span className={statusClass(c.status)}>{c.status}</span></td>
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
            <p>{search.trim() || activeFilterCount > 0 ? "No cases match your filters." : "Nothing pending review."}</p>
          </div>
        )}
      </div>

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