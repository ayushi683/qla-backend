import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import {
  Inbox,
  Send,
  Clock,
  AlertTriangle,
  TrendingUp,
  ArrowRight,
  ArrowUpRight,
  RefreshCw,
  FileText,
  Users,
  CheckSquare,
  Target,
  Zap,
  BarChart3,
  PieChart,
  Activity,
  CheckCircle2,
  XCircle,
  Building2,
  Tag,
  ChevronRight,
} from "lucide-react";

// Brand green harmonious palette
const CATEGORY_COLORS = [
  "#16694a", // Primary brand emerald
  "#0d4a33", // Dark brand forest
  "#10b981", // Bright emerald
  "#22c55e", // Fresh leaf green
  "#14b8a6", // Teal green
  "#84cc16", // Lime green
  "#64748b", // Neutral slate
];

function formatTimeAgo(iso) {
  if (!iso) return "Recent";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / (1000 * 60));
  if (mins < 60) return `${Math.max(mins, 1)}m ago`;
  const hrs = Math.floor(diffMs / (1000 * 60 * 60));
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return days === 1 ? "Yesterday" : `${days}d ago`;
}

function DonutChart({ data, hoveredCategory, onHoverCategory }) {
  const [animate, setAnimate] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setAnimate(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const total = data.reduce((sum, d) => sum + d.count, 0) || 1;
  const radius = 62;
  const circumference = 2 * Math.PI * radius;
  let offsetSoFar = 0;

  return (
    <div className="donut-container">
      <div className="donut-svg-wrap">
        <svg viewBox="0 0 160 160" width="150" height="150">
          <circle
            cx="80"
            cy="80"
            r={radius}
            fill="none"
            stroke="var(--neutral-tint)"
            strokeWidth="20"
          />
          {data.map((d, i) => {
            const pct = d.count / total;
            const dash = pct * circumference;
            const gap = circumference - dash;
            const rotation = (offsetSoFar / total) * 360 - 90;
            offsetSoFar += d.count;
            const isHovered = hoveredCategory === d.category;
            const color = CATEGORY_COLORS[i % CATEGORY_COLORS.length];

            return (
              <circle
                key={d.category}
                cx="80"
                cy="80"
                r={radius}
                fill="none"
                stroke={color}
                strokeWidth={isHovered ? "24" : "20"}
                strokeDasharray={`${animate ? dash : 0} ${animate ? gap : circumference}`}
                strokeDashoffset="0"
                transform={`rotate(${rotation} 80 80)`}
                style={{
                  transition: "stroke-dasharray 0.9s cubic-bezier(0.16, 1, 0.3, 1), stroke-width 0.2s ease",
                  cursor: "pointer",
                  filter: isHovered ? "drop-shadow(0 2px 6px rgba(0,0,0,0.15))" : "none",
                }}
                onMouseEnter={() => onHoverCategory && onHoverCategory(d.category)}
                onMouseLeave={() => onHoverCategory && onHoverCategory(null)}
              />
            );
          })}
        </svg>
        <div className="donut-hole-center">
          <span className="donut-hole-count">{total}</span>
          <span className="donut-hole-sub">Enquiries</span>
        </div>
      </div>

      <div className="donut-legend-list">
        {data.map((d, i) => {
          const isHovered = hoveredCategory === d.category;
          const color = CATEGORY_COLORS[i % CATEGORY_COLORS.length];
          const pct = ((d.count / total) * 100).toFixed(1);

          return (
            <div
              key={d.category}
              className="donut-legend-item"
              style={{
                background: isHovered ? "var(--brand-tint)" : "transparent",
                fontWeight: isHovered ? 600 : 400,
                cursor: "pointer",
              }}
              onMouseEnter={() => onHoverCategory && onHoverCategory(d.category)}
              onMouseLeave={() => onHoverCategory && onHoverCategory(null)}
            >
              <span className="donut-color-pill" style={{ background: color }} />
              <span className="donut-label-text">{d.category}</span>
              <span className="donut-value-text">{d.count}</span>
              <span className="donut-pct-text">{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [insights, setInsights] = useState(null);
  const [recentCases, setRecentCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [showRejectionDetail, setShowRejectionDetail] = useState(false);
  const [hoveredCategory, setHoveredCategory] = useState(null);

  const loadData = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    setError("");

    try {
      const [insightsRes, casesRes] = await Promise.all([
        api.getInsights().catch((err) => {
          console.warn("Could not fetch insights:", err);
          return null;
        }),
        api.cases().catch((err) => {
          console.warn("Could not fetch cases:", err);
          return [];
        }),
      ]);

      if (insightsRes) {
        setInsights(insightsRes);
      }
      if (Array.isArray(casesRes)) {
        setRecentCases(casesRes.slice(0, 5));
      }
    } catch (err) {
      setError(err.message || "Failed to load dashboard data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="page">
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "340px", gap: 14 }}>
          <RefreshCw className="spin-icon" size={32} style={{ color: "var(--brand)", animation: "spin 1s linear infinite" }} />
          <div style={{ fontSize: "0.95rem", color: "var(--muted)", fontWeight: 500 }}>Loading live dashboard analytics…</div>
        </div>
      </div>
    );
  }

  if (error && !insights) {
    return (
      <div className="page">
        <div className="flash flash-error">
          <AlertTriangle size={18} />
          <span>{error}</span>
          <button onClick={() => loadData(true)} className="link-btn" style={{ marginLeft: "auto" }}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  const incomingToday = insights?.incoming_today || 0;
  const incomingTotal = insights?.incoming_total || 0;
  const quotationsToday = insights?.quotations_sent_today || 0;
  const quotationsTotal = insights?.quotations_sent_total || 0;
  const underReview = insights?.under_review || 0;
  const rejectionRate = insights?.rejection_rate || 0;

  // Pipeline conversion rate
  const quotationRate = incomingTotal > 0 ? Math.round((quotationsTotal / incomingTotal) * 100) : 0;

  const categories = insights?.by_category || [];
  const engineers = (insights?.engineer_performance || []).sort(
    (a, b) => (b.approved + b.rejected) - (a.approved + a.rejected)
  );
  const maxDecisions = Math.max(...engineers.map((e) => e.approved + e.rejected), 1);

  return (
    <div className="page dashboard-page">
      {/* 1. Header with Live Status Banner */}
      <div className="dashboard-header">
        <div className="dashboard-header-left">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h1 className="page-title" style={{ margin: 0 }}>Executive Dashboard</h1>
            <span className="dashboard-status-pill">
              <span className="dashboard-status-dot" />
              Live System
            </span>
          </div>
          <p className="page-sub">
            Real-time analytics, review queue status, and quotation tracking for Pune Techtrol.
          </p>
        </div>

        <div className="dashboard-actions">
          <button
            className="dashboard-btn-refresh"
            onClick={() => loadData(true)}
            disabled={refreshing}
            title="Refresh dashboard metrics"
          >
            <RefreshCw
              size={14}
              className={refreshing ? "spin-icon" : ""}
              style={refreshing ? { animation: "spin 0.8s linear infinite" } : {}}
            />
            {refreshing ? "Updating…" : "Refresh"}
          </button>
        </div>
      </div>

      {error && <div className="flash flash-warn" style={{ marginBottom: 16 }}>{error}</div>}

      {/* 2. Top Metric KPI Cards */}
      <div className="stat-cards">
        {/* Card 1: Incoming Enquiries */}
        <div className="stat-card">
          <div className="stat-card-top">
            <span className="stat-label">Incoming Enquiries</span>
            <div className="stat-icon-wrap" style={{ background: "var(--brand-tint)", color: "var(--brand)" }}>
              <Inbox size={18} />
            </div>
          </div>
          <div>
            <div className="stat-value">{incomingToday}</div>
            <div className="stat-sub">
              <TrendingUp size={13} style={{ color: "var(--brand)" }} />
              <span>Today</span>
              <span style={{ color: "var(--border)" }}>•</span>
              <b>{incomingTotal}</b> all-time
            </div>
            <div className="stat-progress">
              <div
                className="stat-progress-bar"
                style={{
                  background: "var(--brand)",
                  width: `${Math.min((incomingToday / Math.max(incomingTotal, 1)) * 100, 100)}%`,
                }}
              />
            </div>
          </div>
        </div>

        {/* Card 2: Quotations Sent */}
        <div className="stat-card">
          <div className="stat-card-top">
            <span className="stat-label">Quotations Generated</span>
            <div className="stat-icon-wrap" style={{ background: "rgba(16, 185, 129, 0.12)", color: "#059669" }}>
              <Send size={18} />
            </div>
          </div>
          <div>
            <div className="stat-value">{quotationsToday}</div>
            <div className="stat-sub">
              <CheckCircle2 size={13} style={{ color: "#059669" }} />
              <span>Sent today</span>
              <span style={{ color: "var(--border)" }}>•</span>
              <b>{quotationsTotal}</b> total
            </div>
            <div className="stat-progress">
              <div
                className="stat-progress-bar"
                style={{
                  background: "#10b981",
                  width: `${Math.min((quotationsTotal / Math.max(incomingTotal, 1)) * 100, 100)}%`,
                }}
              />
            </div>
          </div>
        </div>

        {/* Card 3: Items Under Review */}
        <div className="stat-card">
          <div className="stat-card-top">
            <span className="stat-label">Pending Decision</span>
            <div className="stat-icon-wrap" style={{ background: "var(--warn-tint)", color: "var(--warn)" }}>
              <Clock size={18} />
            </div>
          </div>
          <div>
            <div className="stat-value" style={{ color: underReview > 0 ? "var(--warn)" : "var(--ink)" }}>
              {underReview}
            </div>
            <div className="stat-sub">
              <span>Items waiting in review queue</span>
            </div>
            <div className="stat-progress">
              <div
                className="stat-progress-bar"
                style={{
                  background: "var(--warn)",
                  width: underReview > 0 ? "65%" : "0%",
                }}
              />
            </div>
          </div>
        </div>

        {/* Card 4: AI Rejection Rate (Interactive) */}
        <div
          className="stat-card stat-card-clickable"
          onClick={() => setShowRejectionDetail((v) => !v)}
          title="Click to view rejection details"
        >
          <div className="stat-card-top">
            <span className="stat-label">AI Rejection Rate</span>
            <div
              className="stat-icon-wrap"
              style={{
                background: rejectionRate > 20 ? "var(--danger-tint)" : "var(--brand-tint)",
                color: rejectionRate > 20 ? "var(--danger)" : "var(--brand)",
              }}
            >
              {rejectionRate > 20 ? <AlertTriangle size={18} /> : <Target size={18} />}
            </div>
          </div>
          <div>
            <div className="stat-value">{rejectionRate}%</div>
            <div className="stat-sub">
              <span>{rejectionRate <= 15 ? "High match accuracy" : "Requires attention"}</span>
              <span style={{ marginLeft: "auto", fontSize: "0.72rem", color: "var(--brand)" }}>
                Details ▾
              </span>
            </div>
            <div className="stat-progress">
              <div
                className="stat-progress-bar"
                style={{
                  background: rejectionRate > 20 ? "var(--danger)" : "var(--brand)",
                  width: `${Math.min(rejectionRate, 100)}%`,
                }}
              />
            </div>
          </div>

          {/* Rejection Popover Details */}
          {showRejectionDetail && (
            <div className="rejection-popover" onClick={(e) => e.stopPropagation()}>
              <div className="rejection-popover-head">
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Target size={16} style={{ color: "var(--brand)" }} />
                  Recommendation Accuracy
                </span>
                <button onClick={() => setShowRejectionDetail(false)}>×</button>
              </div>
              <div className="rejection-popover-body">
                <div className="rejection-row">
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <XCircle size={14} style={{ color: "var(--danger)" }} />
                    Rejection Rate
                  </span>
                  <b>{rejectionRate}%</b>
                </div>
                <div className="rejection-row">
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <CheckCircle2 size={14} style={{ color: "var(--brand)" }} />
                    Acceptance Rate
                  </span>
                  <b>{(100 - rejectionRate).toFixed(1)}%</b>
                </div>
                <div className="rejection-row">
                  <span>Pending Decisions</span>
                  <b>{underReview}</b>
                </div>
              </div>
              <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
                <Link to="/" className="case-ref-link" style={{ fontSize: "0.8rem" }}>
                  Open Review Queue to resolve pending items →
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. Middle Grid: Category Breakdown + Engineer Performance */}
      <div className="dashboard-grid" style={{ marginBottom: 24 }}>
        {/* Category Breakdown Card */}
        <div className="dashboard-card">
          <div className="dashboard-card-head">
            <h2 className="dashboard-card-title">
              <PieChart size={18} style={{ color: "var(--brand)" }} />
              Enquiries by Category
            </h2>
            <Link to="/cases" className="dashboard-card-action">
              All Cases <ArrowRight size={14} />
            </Link>
          </div>

          {categories.length === 0 ? (
            <div style={{ padding: "30px 0", textAlign: "center", color: "var(--muted)", fontSize: "0.88rem" }}>
              No categories assigned yet.
            </div>
          ) : (
            <DonutChart
              data={categories}
              hoveredCategory={hoveredCategory}
              onHoverCategory={setHoveredCategory}
            />
          )}
        </div>

        {/* Engineer Review Performance */}
        <div className="dashboard-card">
          <div className="dashboard-card-head">
            <h2 className="dashboard-card-title">
              <BarChart3 size={18} style={{ color: "var(--brand)" }} />
              Engineer Activity & Approvals
            </h2>
            <span className="stat-badge">{engineers.length} Active Engineers</span>
          </div>

          {engineers.length === 0 ? (
            <div style={{ padding: "30px 0", textAlign: "center", color: "var(--muted)", fontSize: "0.88rem" }}>
              No decisions recorded yet. Decisions made in the Review Queue will appear here.
            </div>
          ) : (
            <div className="engineer-list">
              {engineers.slice(0, 5).map((row, idx) => {
                const total = row.approved + row.rejected;
                const approvedPct = total > 0 ? Math.round((row.approved / total) * 100) : 0;
                const approvedWidth = (row.approved / maxDecisions) * 100;
                const rejectedWidth = (row.rejected / maxDecisions) * 100;

                return (
                  <div key={row.engineer} className="engineer-item">
                    <div className="engineer-meta">
                      <span className="engineer-name">
                        {idx === 0 && <span title="Top Reviewer">⭐</span>}
                        {row.engineer}
                      </span>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span className="engineer-badge">{approvedPct}% Approved</span>
                        <span className="engineer-counts">
                          {row.approved} approved · {row.rejected} rejected
                        </span>
                      </div>
                    </div>
                    <div className="engineer-bar-wrapper">
                      <div
                        className="engineer-fill-approved"
                        style={{ width: `${approvedWidth}%` }}
                        title={`${row.approved} Approved`}
                      />
                      <div
                        className="engineer-fill-rejected"
                        style={{ width: `${rejectedWidth}%` }}
                        title={`${row.rejected} Rejected`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 4. Bottom Grid: Pipeline Funnel + Urgent Attention Items */}
      <div className="dashboard-grid">
        {/* Priority Action Items Card */}
        <div className="dashboard-card">
          <div className="dashboard-card-head">
            <h2 className="dashboard-card-title">
              <AlertTriangle size={18} style={{ color: "var(--warn)" }} />
              Items Requiring Immediate Review
            </h2>
            <Link to="/" className="dashboard-card-action">
              Go to Review Queue <ArrowRight size={13} />
            </Link>
          </div>

          <p style={{ fontSize: "0.82rem", color: "var(--muted)", margin: "0 0 14px" }}>
            The following enquiries have pending engineer decisions or rejected AI matches waiting to be resolved:
          </p>

            <div className="urgent-items-list">
              {recentCases
                .filter((c) => c.has_pending || c.has_rejected || c.status === "UNDER_REVIEW")
                .slice(0, 3)
                .map((c) => (
                  <div key={c.case_id} className="urgent-item-row">
                    <div className="urgent-item-left">
                      <span
                        className="urgent-item-badge"
                        style={{
                          background: c.has_rejected ? "var(--danger-tint)" : "var(--warn-tint)",
                          color: c.has_rejected ? "var(--danger)" : "var(--warn)",
                        }}
                      >
                        {c.has_rejected ? "Rejected Match" : "Review Needed"}
                      </span>
                      <div className="urgent-item-info">
                        <span className="urgent-item-title">{c.customer_name || "Customer Inquiry"}</span>
                        <span className="urgent-item-sub">
                          {c.internal_ref} · {c.category || "General"}
                        </span>
                      </div>
                    </div>

                    <Link
                      to={`/cases/${c.case_id}`}
                      className="btn btn-sm btn-outline"
                      style={{ padding: "4px 10px", fontSize: "0.78rem", whiteSpace: "nowrap" }}
                    >
                      Resolve →
                    </Link>
                  </div>
                ))}

              {recentCases.filter((c) => c.has_pending || c.has_rejected || c.status === "UNDER_REVIEW").length ===
                0 && (
                <div
                  style={{
                    padding: "16px",
                    textAlign: "center",
                    fontSize: "0.82rem",
                    color: "var(--brand)",
                    background: "var(--brand-tint)",
                    borderRadius: "8px",
                  }}
                >
                  ✓ All received items have been reviewed! No blocked inquiries.
                </div>
              )}
            </div>
        </div>

        {/* Quick Action Navigation */}
        <div className="dashboard-card">
          <div className="dashboard-card-head">
            <h2 className="dashboard-card-title">
              <Zap size={18} style={{ color: "var(--brand)" }} />
              Quick Workspace Actions
            </h2>
          </div>

          <div className="quick-action-grid">
            <Link to="/" className="quick-action-tile">
              <div className="quick-action-icon">
                <CheckSquare size={20} />
              </div>
              <div>
                <div className="quick-action-title">Review Queue</div>
                <div className="quick-action-desc">Verify AI model matches & line items</div>
              </div>
            </Link>

            <Link to="/cases" className="quick-action-tile">
              <div className="quick-action-icon">
                <FileText size={20} />
              </div>
              <div>
                <div className="quick-action-title">All Cases & Inquiries</div>
                <div className="quick-action-desc">Search, filter, and inspect quotations</div>
              </div>
            </Link>

            <Link to="/users" className="quick-action-tile">
              <div className="quick-action-icon">
                <Users size={20} />
              </div>
              <div>
                <div className="quick-action-title">Engineer Assignments</div>
                <div className="quick-action-desc">Manage categories and user permissions</div>
              </div>
            </Link>

            <Link to="/cases" className="quick-action-tile">
              <div className="quick-action-icon">
                <Send size={20} />
              </div>
              <div>
                <div className="quick-action-title">Generate Quotations</div>
                <div className="quick-action-desc">Build docx and dispatch draft emails</div>
              </div>
            </Link>
          </div>

          {/* Quick Summary Banner */}
          <div
            style={{
              marginTop: "auto",
              paddingTop: 18,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: "0.82rem",
              color: "var(--muted)",
              borderTop: "1px solid var(--border)",
            }}
          >
            <span>Quotation Conversion Pipeline</span>
            <b style={{ color: "var(--brand)", fontSize: "0.95rem" }}>{quotationRate}% quoted</b>
          </div>
        </div>
      </div>
    </div>
  );
}