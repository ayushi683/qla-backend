import { useState, useMemo, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import {
  Search,
  X,
  Calendar,
  Play,
  ArrowUpRight,
  CheckCircle2,
  Layers,
  RefreshCw,
  SlidersHorizontal,
  Folder,
  Building2,
  Check,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight
} from "lucide-react";
import { api } from "../api/client";
import { usePolling } from "../api/usePolling";
import { formatDate } from "../utils/dateFormat";

function statusClass(status) {
  return `cases-status-badge cases-status-${(status || "").toLowerCase()}`;
}

function confidenceTier(conf) {
  if (conf === null || conf === undefined) return "none";
  const n = parseFloat(conf);
  if (n >= 0.8) return "high";
  if (n >= 0.5) return "mid";
  return "low";
}

function getPageNumbers(current, total) {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
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
  const { data: cases, loading, error, reload } = usePolling(() => api.cases(), 12000);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(() => {
    try {
      const saved = sessionStorage.getItem("qla_cases_page");
      const parsed = parseInt(saved, 10);
      return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
    } catch {
      return 1;
    }
  });
  const [aiRunningId, setAiRunningId] = useState(null);
  const [aiResults, setAiResults] = useState({});
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchProgress, setBatchProgress] = useState(null);
  const tableWrapRef = useRef(null);
  const PAGE_SIZE = 15;

  // Real-time status counts derived from loaded cases
  const statusCounts = useMemo(() => {
    if (!cases) return { all: 0, RECEIVED: 0, IN_REVIEW: 0, QUOTED: 0 };
    const counts = { all: cases.length, RECEIVED: 0, IN_REVIEW: 0, QUOTED: 0 };
    cases.forEach((c) => {
      const s = (c.status || "").toUpperCase();
      if (counts[s] !== undefined) counts[s]++;
    });
    return counts;
  }, [cases]);

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

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setPage(1);
    try {
      sessionStorage.setItem("qla_cases_page", "1");
    } catch {
      // ignore
    }
  }, [search, dateFrom, dateTo, statusFilter]);

  useEffect(() => {
    if (totalPages > 0 && page > totalPages) {
      setPage(totalPages);
      try {
        sessionStorage.setItem("qla_cases_page", String(totalPages));
      } catch {
        // ignore
      }
    }
  }, [page, totalPages]);

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > totalPages || newPage === page) return;
    setPage(newPage);
    try {
      sessionStorage.setItem("qla_cases_page", String(newPage));
    } catch {
      // ignore
    }
    if (tableWrapRef.current) {
      tableWrapRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  useEffect(() => {
    function handleClickOutside(e) {
      if (tableWrapRef.current && !tableWrapRef.current.contains(e.target)) {
        setSelectedIds(new Set());
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function clearDates() {
    setDateFrom("");
    setDateTo("");
  }

  function resetAllFilters() {
    setSearch("");
    setDateFrom("");
    setDateTo("");
    setStatusFilter("all");
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

  function toggleSelect(caseId) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(caseId)) next.delete(caseId);
      else next.add(caseId);
      return next;
    });
  }

  function toggleSelectAllOnPage() {
    const pageIds = paginated.map((c) => c.case_id);
    const allSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        pageIds.forEach((id) => next.delete(id));
      } else {
        pageIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }

  async function handleRunSelected() {
    const ids = Array.from(selectedIds);
    setBatchRunning(true);
    setBatchProgress({ done: 0, total: ids.length });
    for (let i = 0; i < ids.length; i++) {
      const caseId = ids[i];
      setAiRunningId(caseId);
      try {
        const result = await api.runAiMatch(caseId);
        setAiResults((prev) => ({ ...prev, [caseId]: result }));
      } catch (e) {
        setAiResults((prev) => ({ ...prev, [caseId]: { status: "error", raw_message: e.message } }));
      }
      setBatchProgress({ done: i + 1, total: ids.length });
    }
    setAiRunningId(null);
    setBatchRunning(false);
    setSelectedIds(new Set());
  }

  const hasActiveFilters = Boolean(search.trim() || dateFrom || dateTo || statusFilter !== "all");

  return (
    <div className="page cases-page">
      {/* 1. Header Section */}
      <div className="cases-header">
        <div>
          <div className="cases-title-row">
            <h1 className="page-title" style={{ margin: 0 }}>Inquiry Cases</h1>
            <span className="cases-count-badge">
              <Layers size={13} />
              {cases ? `${cases.length} Total Records` : "Loading..."}
            </span>
          </div>
          <p className="page-sub" style={{ marginTop: 4 }}>
            Monitor lifecycle status, filter customer inquiries, and execute automated AI spec matching.
          </p>
        </div>
      </div>

      {/* 2. Interactive Status Filter Tabs */}
      <div className="cases-status-tabs">
        <button
          className={`cases-tab-btn ${statusFilter === "all" ? "active" : ""}`}
          onClick={() => setStatusFilter("all")}
        >
          All Inquiries
          <span className="cases-tab-count">{statusCounts.all}</span>
        </button>

        <button
          className={`cases-tab-btn ${statusFilter === "RECEIVED" ? "active" : ""}`}
          onClick={() => setStatusFilter("RECEIVED")}
        >
          <span className="cases-dot cases-dot-amber" />
          Received
          <span className="cases-tab-count">{statusCounts.RECEIVED}</span>
        </button>

        <button
          className={`cases-tab-btn ${statusFilter === "IN_REVIEW" ? "active" : ""}`}
          onClick={() => setStatusFilter("IN_REVIEW")}
        >
          <span className="cases-dot cases-dot-blue" />
          In Review
          <span className="cases-tab-count">{statusCounts.IN_REVIEW}</span>
        </button>

        <button
          className={`cases-tab-btn ${statusFilter === "QUOTED" ? "active" : ""}`}
          onClick={() => setStatusFilter("QUOTED")}
        >
          <span className="cases-dot cases-dot-emerald" />
          Quoted
          <span className="cases-tab-count">{statusCounts.QUOTED}</span>
        </button>
      </div>

      {/* 3. Search & Filter Bar */}
      <div className="cases-filter-card">
        <div className="cases-filter-left">
          {/* Search Input with Icon & Clear */}
          <div className="cases-search-wrapper">
            <Search size={16} className="cases-search-icon" />
            <input
              type="text"
              className="cases-search-input"
              placeholder="Search by case ref, customer, or project…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                className="cases-search-clear"
                onClick={() => setSearch("")}
                title="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Date Range Picker */}
          <div className="cases-date-group">
            <Calendar size={14} style={{ color: "var(--muted)" }} />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              title="From date"
            />
            <span className="cases-date-sep">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              title="To date"
            />
          </div>
        </div>

        <div className="cases-filter-right">
          {hasActiveFilters && (
            <button className="cases-reset-btn" onClick={resetAllFilters}>
              <X size={13} />
              Reset Filters
            </button>
          )}

          <div className="cases-results-info">
            Showing <strong>{filtered.length}</strong> {filtered.length === 1 ? "case" : "cases"}
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="flash flash-error" style={{ marginBottom: 16 }}>
          <AlertCircle size={15} style={{ display: "inline", verticalAlign: "middle", marginRight: 6 }} />
          {error}
        </div>
      )}

      {/* 4. Table & Batch Operations */}
      <div ref={tableWrapRef}>
        {/* Floating Batch Action Bar */}
        {selectedIds.size > 0 && (
          <div className="cases-batch-toolbar" onMouseDown={(e) => e.stopPropagation()}>
            <div className="cases-batch-badge">
              <CheckCircle2 size={16} />
              <span>{selectedIds.size} case{selectedIds.size > 1 ? "s" : ""} selected</span>
              <button
                className="cases-batch-clear-link"
                onClick={() => setSelectedIds(new Set())}
              >
                Deselect all
              </button>
            </div>

            <div className="cases-batch-actions">
              <button
                className="cases-batch-btn"
                onClick={handleRunSelected}
                disabled={batchRunning}
              >
                <Play size={13} fill="currentColor" />
                {batchRunning
                  ? `Running ${batchProgress.done}/${batchProgress.total}…`
                  : `Run Selected AI Match (${selectedIds.size})`}
              </button>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && !cases ? (
          <div className="cases-table-card">
            <div className="cases-empty-card">
              <RefreshCw size={28} className="spin" style={{ color: "var(--brand)" }} />
              <p className="cases-empty-sub">Loading inquiry cases…</p>
            </div>
          </div>
        ) : filtered.length > 0 ? (
          <div className="cases-table-card">
            <div className="cases-table-responsive">
              <table className="cases-modern-table">
                <thead>
                  <tr>
                    <th style={{ width: 42 }}>
                      <input
                        type="checkbox"
                        className="cases-checkbox"
                        checked={paginated.length > 0 && paginated.every((c) => selectedIds.has(c.case_id))}
                        onChange={toggleSelectAllOnPage}
                        title="Select all on this page"
                      />
                    </th>
                    <th style={{ minWidth: 160 }}>Case Reference</th>
                    <th style={{ width: 130 }}>Status</th>
                    <th style={{ minWidth: 220 }}>Customer & Project</th>
                    <th style={{ width: 130 }}>Received</th>
                    {/* Hidden for now: <th style={{ width: 150 }}>AI Match Conf.</th> */}
                    <th style={{ width: 200, textAlign: "center" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((c) => {
                    const isSelected = selectedIds.has(c.case_id);
                    const conf = c.match_confidence;
                    const tier = confidenceTier(conf);

                    return (
                      <tr key={c.case_id} className={isSelected ? "row-selected" : ""}>
                        {/* 1. Selection Checkbox */}
                        <td>
                          <input
                            type="checkbox"
                            className="cases-checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(c.case_id)}
                          />
                        </td>

                        {/* 2. Reference & Revision */}
                        <td>
                          <Link to={`/cases/${c.case_id}`} className="cases-ref-tag">
                            {c.internal_ref || "UNTITLED"}
                          </Link>
                          {c.revision_count > 1 && (
                            <div className="cases-revision-chip">
                              <span>R{c.revision_no}</span>
                              <span>·</span>
                              <span>{c.revision_count} versions</span>
                            </div>
                          )}
                        </td>

                        {/* 3. Status Badge */}
                        <td>
                          <span className={statusClass(c.status)}>
                            <span
                              className="cases-dot"
                              style={{
                                background:
                                  (c.status || "").toUpperCase() === "QUOTED"
                                    ? "#10b981"
                                    : (c.status || "").toUpperCase() === "IN_REVIEW"
                                    ? "#3b82f6"
                                    : "#f59e0b"
                              }}
                            />
                            {c.status || "UNKNOWN"}
                          </span>
                        </td>

                        {/* 4. Customer & Project */}
                        <td>
                          <div className="cases-cust-name">{c.customer_name || "—"}</div>
                          {c.project_name && (
                            <div className="cases-proj-name">
                              <Folder size={12} style={{ opacity: 0.6 }} />
                              {c.project_name}
                            </div>
                          )}
                        </td>

                        {/* 5. Received Date (DD/MM/YYYY) */}
                        <td style={{ color: "var(--ink-soft)", whiteSpace: "nowrap" }}>
                          {formatDate(c.enq_received_at)}
                        </td>

                        {/* 6. AI Match Confidence (Hidden for now)
                        <td>
                          {conf !== null && conf !== undefined ? (
                            <span className={`cases-conf-pill cases-conf-${tier}`}>
                              <span
                                className="cases-dot"
                                style={{
                                  background:
                                    tier === "high"
                                      ? "#10b981"
                                      : tier === "mid"
                                      ? "#f59e0b"
                                      : "#ef4444"
                                }}
                              />
                              {Math.round(parseFloat(conf) * 100)}% Match
                            </span>
                          ) : (
                            <span className="cases-conf-pill cases-conf-none">—</span>
                          )}
                        </td>
                        */}

                        {/* 7. Actions */}
                        <td>
                          <div className="cases-action-group">
                            <Link
                              className="cases-btn-open"
                              to={`/cases/${c.case_id}`}
                              title="Open inquiry details"
                            >
                              Open
                              <ArrowUpRight size={13} />
                            </Link>

                            <button
                              className="cases-btn-ai"
                              disabled={aiRunningId === c.case_id || batchRunning}
                              onClick={() => handleRunAiMatch(c.case_id)}
                              title="Run AI technical specification match"
                            >
                              <Play size={11} fill="currentColor" />
                              {aiRunningId === c.case_id ? "Running…" : "Run AI"}
                            </button>
                          </div>

                          {/* AI Result Notice */}
                          {aiResults[c.case_id] && (
                            <div style={{ textAlign: "right" }}>
                              <span
                                className={`cases-ai-pill-result ${
                                  aiResults[c.case_id].status === "error"
                                    ? "cases-ai-result-err"
                                    : "cases-ai-result-ok"
                                }`}
                              >
                                {aiResults[c.case_id].status === "error"
                                  ? aiResults[c.case_id].raw_message
                                  : `${aiResults[c.case_id].decision} (${aiResults[c.case_id].items_matched || 0} matched)`}
                              </span>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {filtered.length > 0 && (
              <div className="cases-pagination-wrap">
                <div className="cases-pagination-info">
                  <span>
                    Showing <span className="cases-pagination-num">{(page - 1) * PAGE_SIZE + 1}</span>–
                    <span className="cases-pagination-num">{Math.min(page * PAGE_SIZE, filtered.length)}</span> of{" "}
                    <span className="cases-pagination-num">{filtered.length}</span> cases
                  </span>
                  <span className="cases-pagination-badge">15 / page</span>
                </div>

                {totalPages > 1 && (
                  <div className="cases-pagination-btns">
                    {/* First Page */}
                    <button
                      type="button"
                      className="cases-page-btn cases-page-btn-nav"
                      disabled={page === 1}
                      onClick={() => handlePageChange(1)}
                      title="First page"
                      aria-label="First page"
                    >
                      <ChevronsLeft size={15} />
                    </button>

                    {/* Previous Page */}
                    <button
                      type="button"
                      className="cases-page-btn cases-page-btn-nav"
                      disabled={page === 1}
                      onClick={() => handlePageChange(page - 1)}
                      title="Previous page"
                      aria-label="Previous page"
                    >
                      <ChevronLeft size={15} />
                      <span>Prev</span>
                    </button>

                    {/* Page Numbers */}
                    {getPageNumbers(page, totalPages).map((p, i) =>
                      p === "..." ? (
                        <span key={"dots-" + i} className="cases-pagination-dots">
                          …
                        </span>
                      ) : (
                        <button
                          key={p}
                          type="button"
                          className={`cases-page-btn ${p === page ? "active" : ""}`}
                          onClick={() => handlePageChange(p)}
                          aria-current={p === page ? "page" : undefined}
                        >
                          {p}
                        </button>
                      )
                    )}

                    {/* Next Page */}
                    <button
                      type="button"
                      className="cases-page-btn cases-page-btn-nav"
                      disabled={page === totalPages}
                      onClick={() => handlePageChange(page + 1)}
                      title="Next page"
                      aria-label="Next page"
                    >
                      <span>Next</span>
                      <ChevronRight size={15} />
                    </button>

                    {/* Last Page */}
                    <button
                      type="button"
                      className="cases-page-btn cases-page-btn-nav"
                      disabled={page === totalPages}
                      onClick={() => handlePageChange(totalPages)}
                      title="Last page"
                      aria-label="Last page"
                    >
                      <ChevronsRight size={15} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          /* Empty State */
          <div className="cases-table-card">
            <div className="cases-empty-card">
              <div className="cases-empty-icon">
                <Layers size={26} />
              </div>
              <h3 className="cases-empty-title">
                {hasActiveFilters ? "No matching inquiries found" : "No cases yet"}
              </h3>
              <p className="cases-empty-sub">
                {hasActiveFilters
                  ? "Try adjusting your search criteria, clearing the date filters, or switching status tabs."
                  : "New inquiries will appear here automatically as they are received."}
              </p>
              {hasActiveFilters && (
                <button
                  className="cases-reset-btn"
                  style={{ marginTop: 8 }}
                  onClick={resetAllFilters}
                >
                  <X size={13} />
                  Clear All Filters
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}