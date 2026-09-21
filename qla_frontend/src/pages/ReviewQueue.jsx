import { useState, useMemo, useRef, useEffect } from "react";
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
  Building2
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

export default function ReviewQueue() {
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

    // Type filter (all vs pending vs rejected)
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
      {/* Toast Notification */}
      {toast && (
        <div className="toast-notif">
          <AlertTriangle size={16} className="toast-icon" />
          <div>
            <div className="toast-title">{toast}</div>
          </div>
          <button className="toast-close" onClick={() => setToast(null)}>×</button>
        </div>
      )}

      {/* 1. Executive Header */}
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

      {/* 2. Interactive KPI / Summary Cards */}
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

      {/* 3. Status Filter Tabs */}
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

      {/* 4. Search & Filter Bar */}
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

      {/* 5. Modern Queue Table */}
      <div className="review-table-card">
        {loading && !cases ? (
          <div className="loading-state" style={{ padding: "48px 20px" }}>
            <RefreshCw size={22} className="spin" style={{ color: "var(--brand)", marginBottom: 8 }} />
            <div>Loading Review Queue…</div>
          </div>
        ) : filtered.length > 0 ? (
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
                {filtered.map((c) => {
                  const isRejectedNeedsDecision = c.has_rejected && !c.has_pending;
                  const confPct = c.top_confidence !== null && c.top_confidence !== undefined
                    ? Math.round(parseFloat(c.top_confidence) * 100)
                    : null;

                  return (
                    <tr
                      key={c.case_id}
                      className={`review-table-row ${isRejectedNeedsDecision ? "row-needs-decision" : ""}`}
                    >
                      {/* Case Ref */}
                      <td>
                        <div className="review-ref-cell">
                          <span className="review-ref-badge">{c.internal_ref}</span>
                          {c.revision_count > 1 && (
                            <span className="review-rev-pill">R{c.revision_no} ({c.revision_count}v)</span>
                          )}
                        </div>
                      </td>

                      {/* Customer & Project */}
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

                      {/* Category */}
                      <td>
                        <span className="review-category-badge">{c.category || "General"}</span>
                      </td>

                      {/* Received Date */}
                      <td className="review-date-cell">
                        {formatDate(c.enq_received_at)}
                      </td>

                      {/* Top Match Confidence */}
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

                      {/* Status + Warning badge if rejected */}
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

                      {/* Action Button */}
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

      {/* Modal Dialog */}
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