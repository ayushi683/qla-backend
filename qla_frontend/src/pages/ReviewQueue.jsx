import { useState, useMemo, useRef, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Search,
  ChevronDown,
  Calendar,
  Check,
  RotateCcw,
  Layers,
  Clock,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  RefreshCw,
  X,
  Inbox,
  Building2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight
} from "lucide-react";
import { api } from "../api/client";
import { usePolling } from "../api/usePolling";
import { formatDate } from "../utils/dateFormat";
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

function getPageNumbers(current, total) {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  if (current <= 4) {
    return [1, 2, 3, 4, 5, "...", total];
  }
  if (current >= total - 3) {
    return [1, "...", total - 4, total - 3, total - 2, total - 1, total];
  }
  return [1, "...", current - 1, current, current + 1, "...", total];
}

export default function ReviewQueue() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: cases, loading, error, refresh } = usePolling(() => api.reviewQueueCases(), 12000);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [typeFilter, setTypeFilter] = useState("all"); // "all" | "pending" | "rejected"
  const [openDropdown, setOpenDropdown] = useState(null);
  const [openCaseId, setOpenCaseId] = useState(null);
  const [toast, setToast] = useState(null);
  const [sortBy, setSortBy] = useState("newest");
  const dropdownRef = useRef(null);
  const tableWrapRef = useRef(null);

  const [page, setPage] = useState(() => {
    const fromUrl = parseInt(searchParams.get("page"), 10);
    if (!isNaN(fromUrl) && fromUrl > 0) return fromUrl;
    try {
      const saved = sessionStorage.getItem("qla_review_page");
      const parsed = parseInt(saved, 10);
      return !isNaN(parsed) && parsed > 0 ? parsed : 1;
    } catch {
      return 1;
    }
  });
  const [pageSize, setPageSize] = useState(() => {
    try {
      const saved = sessionStorage.getItem("qla_review_pagesize");
      const parsed = parseInt(saved, 10);
      return [10, 15, 20].includes(parsed) ? parsed : 15;
    } catch {
      return 15;
    }
  });
  const [jumpPage, setJumpPage] = useState("");

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpenDropdown(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const pendingCount = useMemo(() => cases?.filter((c) => c.has_pending).length || 0, [cases]);
  const rejectedCount = useMemo(() => cases?.filter((c) => c.has_rejected).length || 0, [cases]);

  const filtered = useMemo(() => {
    if (!cases) return [];
    let rows = cases;

    if (typeFilter === "pending") {
      rows = rows.filter((c) => c.has_pending);
    } else if (typeFilter === "rejected") {
      rows = rows.filter((c) => c.has_rejected);
    }

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
  }, [cases, typeFilter, search, categoryFilter, dateFrom, dateTo, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = useMemo(() => {
    const safePage = Math.max(1, Math.min(page, totalPages));
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize, totalPages]);

  // Sync `page` state whenever the URL's ?page= changes (browser
  // back/forward, or a direct link like /review-queue?page=3).
  useEffect(() => {
    const fromUrl = parseInt(searchParams.get("page"), 10);
    if (!isNaN(fromUrl) && fromUrl > 0 && fromUrl !== page) {
      setPage(fromUrl);
      try {
        sessionStorage.setItem("qla_review_page", String(fromUrl));
      } catch {
        // ignore
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Reset to page 1 whenever a filter actually changes value (not on
  // every re-render — StrictMode-safe via value comparison).
  const prevFiltersRef = useRef({ search, categoryFilter, dateFrom, dateTo, typeFilter, sortBy });
  useEffect(() => {
    const prev = prevFiltersRef.current;
    const changed =
      prev.search !== search ||
      prev.categoryFilter !== categoryFilter ||
      prev.dateFrom !== dateFrom ||
      prev.dateTo !== dateTo ||
      prev.typeFilter !== typeFilter ||
      prev.sortBy !== sortBy;

    if (changed) {
      prevFiltersRef.current = { search, categoryFilter, dateFrom, dateTo, typeFilter, sortBy };
      setPage(1);
      try {
        sessionStorage.setItem("qla_review_page", "1");
      } catch {
        // ignore
      }
      setSearchParams((prev2) => {
        const next = new URLSearchParams(prev2);
        next.set("page", "1");
        return next;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, categoryFilter, dateFrom, dateTo, typeFilter, sortBy]);

  useEffect(() => {
    if (cases === null || cases === undefined) return; // still loading — don't clamp yet
    if (totalPages > 0 && page > totalPages) {
      setPage(totalPages);
      try {
        sessionStorage.setItem("qla_review_page", String(totalPages));
      } catch {
        // ignore
      }
    }
  }, [cases, page, totalPages]);

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > totalPages || newPage === page) return;
    setPage(newPage);
    try {
      sessionStorage.setItem("qla_review_page", String(newPage));
    } catch {
      // ignore
    }
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("page", String(newPage));
      return next;
    });
    if (tableWrapRef.current) {
      tableWrapRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const activeFilterCount = [
    search,
    categoryFilter,
    dateFrom,
    dateTo,
    typeFilter !== "all" ? typeFilter : null,
  ].filter(Boolean).length;

  function resetFilters() {
    setSearch("");
    setCategoryFilter("");
    setDateFrom("");
    setDateTo("");
    setTypeFilter("all");
    setSortBy("newest");
  }

  function showToast(message) {
    setToast(message);
    setTimeout(() => setToast(null), 5000);
  }

  function handleRejected(tagLabel) {
    showToast(`${tagLabel} needs a decision`);
    refresh();
  }

  return (
    <div className="page review-queue-page">
      {toast && (
        <div className="toast-notif">
          <AlertTriangle size={16} className="toast-icon" />
          <div>
            <div className="toast-title">{toast}</div>
          </div>
          <button className="toast-close" onClick={() => setToast(null)}>×</button>
        </div>
      )}

      <div className="review-header">
        <div>
          <div className="review-title-row">
            <h1 className="page-title" style={{ margin: 0 }}>Review Queue</h1>
            <span className="review-count-badge">
              <Inbox size={13} />
              {cases ? `${cases.length} Total Pending` : "Loading…"}
            </span>
          </div>
          <p className="page-sub" style={{ marginTop: 4 }}>
            Inquiry cases with line items awaiting engineer approval or alternative model decisions.
          </p>
        </div>

        <button
          type="button"
          className="review-refresh-btn"
          onClick={refresh}
          title="Refresh queue"
        >
          <RefreshCw size={13} className={loading ? "spin" : ""} />
          <span>Refresh</span>
        </button>
      </div>

      <div className="review-metrics-grid">
        <div
          className={`review-metric-card ${typeFilter === "all" ? "active" : ""}`}
          onClick={() => setTypeFilter("all")}
          role="button"
          tabIndex={0}
        >
          <div className="review-metric-header">
            <span className="review-metric-title">Total in Queue</span>
            <div className="review-metric-icon review-metric-icon-neutral">
              <Layers size={18} />
            </div>
          </div>
          <div className="review-metric-body">
            <span className="review-metric-val">{cases?.length ?? 0}</span>
            <span className="review-metric-hint">All open review cases</span>
          </div>
        </div>

        <div
          className={`review-metric-card ${typeFilter === "pending" ? "active" : ""}`}
          onClick={() => setTypeFilter(typeFilter === "pending" ? "all" : "pending")}
          role="button"
          tabIndex={0}
        >
          <div className="review-metric-header">
            <span className="review-metric-title">Pending Review</span>
            <div className="review-metric-icon review-metric-icon-amber">
              <Clock size={18} />
            </div>
          </div>
          <div className="review-metric-body">
            <span className="review-metric-val">{pendingCount}</span>
            <span className="review-metric-hint">Awaiting your approval</span>
          </div>
        </div>

        <div
          className={`review-metric-card ${typeFilter === "rejected" ? "active" : ""}`}
          onClick={() => setTypeFilter(typeFilter === "rejected" ? "all" : "rejected")}
          role="button"
          tabIndex={0}
        >
          <div className="review-metric-header">
            <span className="review-metric-title">Needs Decision</span>
            <div className="review-metric-icon review-metric-icon-rose">
              <AlertTriangle size={18} />
            </div>
          </div>
          <div className="review-metric-body">
            <span className="review-metric-val">{rejectedCount}</span>
            <span className="review-metric-hint">Rejected / needs alternative</span>
          </div>
        </div>
      </div>

      <div className="review-status-tabs">
        <button
          type="button"
          className={`review-tab-btn ${typeFilter === "all" ? "active" : ""}`}
          onClick={() => setTypeFilter("all")}
        >
          All Cases
          <span className="review-tab-count">{cases?.length ?? 0}</span>
        </button>

        <button
          type="button"
          className={`review-tab-btn ${typeFilter === "pending" ? "active" : ""}`}
          onClick={() => setTypeFilter("pending")}
        >
          <span className="review-tab-dot review-tab-dot-amber" />
          Pending Review
          <span className="review-tab-count">{pendingCount}</span>
        </button>

        <button
          type="button"
          className={`review-tab-btn ${typeFilter === "rejected" ? "active" : ""}`}
          onClick={() => setTypeFilter("rejected")}
        >
          <span className="review-tab-dot review-tab-dot-rose" />
          Needs Decision
          <span className="review-tab-count">{rejectedCount}</span>
        </button>
      </div>

      <div className="filter-bar" ref={dropdownRef}>
        <div className="filter-search-wrap">
          <Search size={15} className="filter-search-icon" />
          <input
            type="text"
            className="search-input filter-search-input"
            placeholder="Search by case ref, customer, or project…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              className="cases-search-clear"
              onClick={() => setSearch("")}
              title="Clear search"
            >
              <X size={13} />
            </button>
          )}
        </div>

        <div className="filter-pill-wrap">
          <button
            type="button"
            className={`filter-pill ${categoryFilter ? "filter-pill-active" : ""}`}
            onClick={() => setOpenDropdown(openDropdown === "category" ? null : "category")}
          >
            <span>Category{categoryFilter ? `: ${categoryFilter}` : ""}</span>
            <ChevronDown size={14} className={`dropdown-chevron ${openDropdown === "category" ? "open" : ""}`} />
          </button>
          {openDropdown === "category" && (
            <div className="filter-dropdown-panel">
              <button
                type="button"
                className={`filter-option ${categoryFilter === "" ? "active" : ""}`}
                onClick={() => { setCategoryFilter(""); setOpenDropdown(null); }}
              >
                <span>All Categories</span>
                {categoryFilter === "" && <Check size={13} className="check-icon" />}
              </button>
              {CATEGORY_OPTIONS.map((c) => (
                <button
                  type="button"
                  key={c}
                  className={`filter-option ${categoryFilter === c ? "active" : ""}`}
                  onClick={() => { setCategoryFilter(c); setOpenDropdown(null); }}
                >
                  <span>{c}</span>
                  {categoryFilter === c && <Check size={13} className="check-icon" />}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="filter-pill-wrap">
          <button
            type="button"
            className={`filter-pill ${(dateFrom || dateTo) ? "filter-pill-active" : ""}`}
            onClick={() => setOpenDropdown(openDropdown === "date" ? null : "date")}
          >
            <Calendar size={13} />
            <span>Date Range</span>
            <ChevronDown size={14} className={`dropdown-chevron ${openDropdown === "date" ? "open" : ""}`} />
          </button>
          {openDropdown === "date" && (
            <div className="filter-dropdown-panel filter-dropdown-date">
              <div className="filter-date-row">
                <label>From Date</label>
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              </div>
              <div className="filter-date-row">
                <label>To Date</label>
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              </div>
            </div>
          )}
        </div>

        <select className="status-filter-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
          <option value="newest">Sort: Newest first</option>
          <option value="oldest">Sort: Oldest first</option>
        </select>

        {activeFilterCount > 0 && (
          <button type="button" className="filter-reset-link" onClick={resetFilters}>
            <RotateCcw size={12} />
            <span>Reset Filters</span>
          </button>
        )}
      </div>

      {error && <div className="flash flash-error">{error}</div>}

      <div className="review-table-card" ref={tableWrapRef}>
        {loading && !cases ? (
          <div className="loading-state" style={{ padding: "48px 20px" }}>
            <RefreshCw size={22} className="spin" style={{ color: "var(--brand)", marginBottom: 8 }} />
            <div>Loading Review Queue…</div>
          </div>
        ) : filtered.length > 0 ? (
          <>
            <div className="review-table-scroll">
              <table className="review-modern-table">
                <thead>
                  <tr>
                    <th>Case Reference</th>
                    <th>Customer & Project</th>
                    <th>Category</th>
                    <th>Received</th>
                    <th>Top Match Conf.</th>
                    <th>Lifecycle Status</th>
                    <th style={{ textAlign: "right" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((c) => {
                    const isRejectedNeedsDecision = c.has_rejected && !c.has_pending;
                    const confPct = c.top_confidence !== null && c.top_confidence !== undefined
                      ? Math.round(parseFloat(c.top_confidence) * 100)
                      : null;

                    return (
                      <tr
                        key={c.case_id}
                        className={`review-table-row ${isRejectedNeedsDecision ? "row-needs-decision" : ""}`}
                      >
                        <td>
                          <div className="review-ref-cell">
                            <span className="review-ref-badge">{c.internal_ref}</span>
                            {c.revision_count > 1 && (
                              <span className="review-rev-pill">R{c.revision_no} ({c.revision_count}v)</span>
                            )}
                          </div>
                        </td>

                        <td>
                          <div className="review-customer-cell">
                            <span className="review-cust-name">{c.customer_name || "—"}</span>
                            {c.project_name && (
                              <span className="review-proj-sub">
                                <Building2 size={11} style={{ marginRight: 3, verticalAlign: "middle" }} />
                                {c.project_name}
                              </span>
                            )}
                          </div>
                        </td>

                        <td>
                          <span className="review-category-badge">{c.category || "General"}</span>
                        </td>

                        <td className="review-date-cell">
                          {formatDate(c.enq_received_at)}
                        </td>

                        <td>
                          {confPct !== null ? (
                            <div className="review-conf-wrap">
                              <span className={`confidence-badge ${confidenceClass(c.top_confidence)}`}>
                                {confPct}%
                              </span>
                            </div>
                          ) : (
                            <span style={{ color: "var(--muted)" }}>—</span>
                          )}
                        </td>

                        <td>
                          <div className="review-status-wrap">
                            <span className={statusClass(c.status)}>{c.status}</span>
                            {isRejectedNeedsDecision && (
                              <span className="review-warn-pill">
                                <AlertTriangle size={11} />
                                Needs Decision
                              </span>
                            )}
                          </div>
                        </td>

                        <td style={{ textAlign: "right" }}>
                          <button
                            type="button"
                            className="review-action-btn"
                            onClick={() => setOpenCaseId(c.case_id)}
                          >
                            <span>Review Case</span>
                            <ArrowUpRight size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="cases-pagination-wrap">
              <div className="cases-pagination-info">
                <span>
                  Showing <span className="cases-pagination-num">{(Math.min(page, totalPages) - 1) * pageSize + 1}</span>–
                  <span className="cases-pagination-num">{Math.min(page * pageSize, filtered.length)}</span> of{" "}
                  <span className="cases-pagination-num">{filtered.length}</span> cases
                </span>

                <div className="cases-pagesize-wrap">
                  <select
                    className="cases-pagesize-select"
                    value={pageSize}
                    onChange={(e) => {
                      const newSize = Number(e.target.value);
                      setPageSize(newSize);
                      setPage(1);
                      try {
                        sessionStorage.setItem("qla_review_pagesize", String(newSize));
                        sessionStorage.setItem("qla_review_page", "1");
                      } catch {}
                      setSearchParams((prev) => {
                        const next = new URLSearchParams(prev);
                        next.set("page", "1");
                        return next;
                      });
                    }}
                    title="Select records per page"
                  >
                    <option value={15}>15 / page (Default)</option>
                    <option value={10}>10 / page</option>
                    <option value={20}>20 / page</option>
                  </select>
                </div>
              </div>

              <div className="cases-pagination-controls-group">
                <div className="cases-pagination-btns">
                  <button
                    type="button"
                    className="cases-page-btn cases-page-btn-nav"
                    disabled={page <= 1}
                    onClick={() => handlePageChange(1)}
                    title="First page"
                    aria-label="First page"
                  >
                    <ChevronsLeft size={15} />
                  </button>

                  <button
                    type="button"
                    className="cases-page-btn cases-page-btn-nav"
                    disabled={page <= 1}
                    onClick={() => handlePageChange(page - 1)}
                    title="Previous page"
                    aria-label="Previous page"
                  >
                    <ChevronLeft size={15} />
                    <span>Prev</span>
                  </button>

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

                  <button
                    type="button"
                    className="cases-page-btn cases-page-btn-nav"
                    disabled={page >= totalPages}
                    onClick={() => handlePageChange(page + 1)}
                    title="Next page"
                    aria-label="Next page"
                  >
                    <span>Next</span>
                    <ChevronRight size={15} />
                  </button>

                  <button
                    type="button"
                    className="cases-page-btn cases-page-btn-nav"
                    disabled={page >= totalPages}
                    onClick={() => handlePageChange(totalPages)}
                    title="Last page"
                    aria-label="Last page"
                  >
                    <ChevronsRight size={15} />
                  </button>
                </div>

                {totalPages > 1 && (
                  <div className="cases-page-jump-box">
                    <span>Go to</span>
                    <input
                      type="number"
                      min={1}
                      max={totalPages}
                      value={jumpPage}
                      onChange={(e) => setJumpPage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const val = parseInt(jumpPage, 10);
                          if (val >= 1 && val <= totalPages) {
                            handlePageChange(val);
                            setJumpPage("");
                          }
                        }
                      }}
                      placeholder={String(page)}
                      className="cases-jump-input"
                    />
                    <button
                      type="button"
                      className="cases-jump-btn"
                      onClick={() => {
                        const val = parseInt(jumpPage, 10);
                        if (val >= 1 && val <= totalPages) {
                          handlePageChange(val);
                          setJumpPage("");
                        }
                      }}
                    >
                      Go
                    </button>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="review-empty-state">
            <div className="review-empty-icon">
              {search.trim() || activeFilterCount > 0 ? (
                <Inbox size={28} />
              ) : (
                <CheckCircle2 size={30} style={{ color: "var(--brand)" }} />
              )}
            </div>
            <h3 className="review-empty-title">
              {search.trim() || activeFilterCount > 0
                ? "No matching queue cases"
                : "Queue is clear"}
            </h3>
            <p className="review-empty-sub">
              {search.trim() || activeFilterCount > 0
                ? "Try clearing your filters or changing your search criteria."
                : "All automated product matches have been reviewed and approved."}
            </p>
            {activeFilterCount > 0 && (
              <button
                type="button"
                className="cases-reset-btn"
                style={{ marginTop: 12 }}
                onClick={resetFilters}
              >
                <RotateCcw size={12} />
                <span>Reset All Filters</span>
              </button>
            )}
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