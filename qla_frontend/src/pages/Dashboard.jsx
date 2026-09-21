import { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
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
  Award,
} from "lucide-react";

// Cohesive, professional palette (tones of brand emerald and neutral slate)
const CATEGORY_COLORS = [
  "#16694a", // Pune Techtrol primary dark green
  "#23865c", // Mid emerald
  "#2f9e6d", // Forest green
  "#48bb78", // Sage green
  "#334155", // Slate dark
  "#475569", // Slate medium
  "#64748b", // Slate muted
];

// Two-tone palette for personal pipeline (Pending vs Quoted)
const PIPELINE_COLORS = ["#64748b", "#16694a"];

function getInitials(name) {
  if (!name) return "EN";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

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

function DonutChart({ data, hoveredCategory, onHoverCategory, colors }) {
  const [animate, setAnimate] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setAnimate(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const total = data.reduce((sum, d) => sum + d.count, 0) || 0;
  const radius = 62;
  const circumference = 2 * Math.PI * radius;
  let offsetSoFar = 0;

  const activeItem = data.find((d) => d.category === hoveredCategory);
  const displayCount = activeItem ? activeItem.count : total;
  const displayLabel = activeItem ? activeItem.category : "Total Enquiries";
  const displayPct = activeItem && total > 0 ? `${((activeItem.count / total) * 100).toFixed(1)}%` : null;

  return (
    <div className="donut-container">
      <div className="donut-svg-wrap">
        <svg viewBox="0 0 160 160" width="160" height="160" className="donut-svg">
          {/* Subtle background track */}
          <circle
            cx="80"
            cy="80"
            r={radius}
            fill="none"
            stroke="rgba(0, 0, 0, 0.05)"
            strokeWidth="18"
          />
          {data.map((d, i) => {
            const pct = total > 0 ? d.count / total : 0;
            const dash = pct * circumference;
            const gap = circumference - dash;
            const rotation = total > 0 ? (offsetSoFar / total) * 360 - 90 : -90;
            offsetSoFar += d.count;
            const isHovered = hoveredCategory === d.category;
            const palette = colors || CATEGORY_COLORS;
            const color = palette[i % palette.length];

            return (
              <circle
                key={d.category}
                cx="80"
                cy="80"
                r={radius}
                fill="none"
                stroke={color}
                strokeWidth={isHovered ? "22" : "18"}
                strokeDasharray={`${animate ? dash : 0} ${gap}`}
                strokeDashoffset="0"
                transform={`rotate(${rotation} 80 80)`}
                style={{
                  transition: "stroke-dasharray 0.9s cubic-bezier(0.16, 1, 0.3, 1), stroke-width 0.2s ease, filter 0.2s ease",
                  cursor: "pointer",
                  filter: isHovered ? "drop-shadow(0 4px 8px rgba(0,0,0,0.22))" : "none",
                }}
                onMouseEnter={() => onHoverCategory && onHoverCategory(d.category)}
                onMouseLeave={() => onHoverCategory && onHoverCategory(null)}
              />
            );
          })}
        </svg>
        <div className="donut-hole-center">
          <span className="donut-hole-count">{displayCount}</span>
          <span className="donut-hole-sub" title={displayLabel}>{displayLabel}</span>
          {displayPct && <span className="donut-hole-pct">{displayPct}</span>}
        </div>
      </div>

      <div className="donut-legend-list">
        {data.map((d, i) => {
          const isHovered = hoveredCategory === d.category;
          const palette = colors || CATEGORY_COLORS;
          const color = palette[i % palette.length];
          const pct = total > 0 ? ((d.count / total) * 100).toFixed(1) : 0;

          return (
            <div
              key={d.category}
              className={`donut-legend-item ${isHovered ? "is-hovered" : ""}`}
              onMouseEnter={() => onHoverCategory && onHoverCategory(d.category)}
              onMouseLeave={() => onHoverCategory && onHoverCategory(null)}
            >
              <span className="donut-color-pill" style={{ background: color }} />
              <div className="donut-legend-info">
                <span className="donut-label-text">{d.category}</span>
                <div className="donut-legend-bar-track">
                  <div
                    className="donut-legend-bar-fill"
                    style={{
                      width: `${pct}%`,
                      background: color,
                    }}
                  />
                </div>
              </div>
              <div className="donut-legend-stat">
                <span className="donut-value-text">{d.count}</span>
                <span className="donut-pct-text">{pct}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [insights, setInsights] = useState(null);
  const [recentCases, setRecentCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [showRejectionDetail, setShowRejectionDetail] = useState(false);
  const [hoveredCategory, setHoveredCategory] = useState(null);
  const [barsAnimate, setBarsAnimate] = useState(false);

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

  const engineers = (insights?.engineer_performance || []).sort(
    (a, b) => (b.approved + b.rejected) - (a.approved + a.rejected)
  );

  useEffect(() => {
    if (!loading && engineers.length > 0) {
      const t = requestAnimationFrame(() => setBarsAnimate(true));
      return () => cancelAnimationFrame(t);
    }
  }, [loading, engineers.length]);

  if (loading) {
    return (
      <div className="page dashboard-page">
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "380px", gap: 14 }}>
          <RefreshCw className="spin-icon" size={32} style={{ color: "var(--brand)", animation: "spin 1s linear infinite" }} />
          <div style={{ fontSize: "0.95rem", color: "var(--muted)", fontWeight: 500 }}>Loading live dashboard analytics…</div>
        </div>
      </div>
    );
  }

  if (error && !insights) {
    return (
      <div className="page dashboard-page">
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

  const quotationRate = incomingTotal > 0 ? Math.round((quotationsTotal / incomingTotal) * 100) : 0;

  const categories = insights?.by_category || [];
  const maxDecisions = Math.max(...engineers.map((e) => e.approved + e.rejected), 1);

  return (
    <div className="page dashboard-page">
      {/* 1. Header with Live Status Banner */}
      <div className="dashboard-header-card">
        <div className="dashboard-header-left">
          <div className="dashboard-org-tag">
            <Building2 size={13} />
            <span>PUNE TECHTROL · OPERATIONS INTELLIGENCE</span>
          </div>
          <div className="dashboard-title-row">
            <h1 className="dashboard-hero-title">
              {user?.role === "ADMIN" ? "Executive Dashboard" : "My Dashboard"}
            </h1>
            <span className="dashboard-status-pill">
              <span className="dashboard-status-pulse" />
              Live Telemetry
            </span>
          </div>
          <p className="dashboard-hero-sub">
            {user?.role === "ADMIN"
              ? "Real-time analytics, review queue status, and quotation tracking for Pune Techtrol."
              : `Here's what's on your plate and how you're doing — ${user?.category || "your category"}.`}
          </p>
        </div>

        <div className="dashboard-header-actions">
          <div className="dashboard-sync-indicator">
            <Clock size={12} />
            <span>Live Updates</span>
          </div>
          <button
            className="dashboard-btn-refresh-modern"
            onClick={() => loadData(true)}
            disabled={refreshing}
            title="Refresh dashboard metrics"
          >
            <RefreshCw
              size={14}
              className={refreshing ? "spin-icon" : ""}
              style={refreshing ? { animation: "spin 0.8s linear infinite" } : {}}
            />
            <span>{refreshing ? "Updating…" : "Refresh"}</span>
          </button>
        </div>
      </div>

      {error && <div className="flash flash-warn" style={{ marginBottom: 16 }}>{error}</div>}

      {/* 2. Top Metric KPI Cards */}
      <div className="stat-cards">
        {/* Card 1: Incoming Enquiries */}
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-label">Incoming Enquiries</span>
            <div className="stat-icon-wrap">
              <Inbox size={18} />
            </div>
          </div>
          <div className="stat-card-body">
            <div className="stat-value-group">
              <span className="stat-value">{incomingToday}</span>
              <span className="stat-sub-unit">enquiries</span>
            </div>
            <div className="stat-meta-row">
              <span className="stat-meta-highlight">+{incomingToday} today</span>
              <span className="stat-bullet">•</span>
              <span className="stat-text-muted">{incomingTotal} total</span>
            </div>
            <div className="stat-progress">
              <div
                className="stat-progress-bar"
                style={{
                  background: "#16694a",
                  width: `${Math.min((incomingToday / Math.max(incomingTotal, 1)) * 100, 100)}%`,
                }}
              />
            </div>
          </div>
        </div>

        {/* Card 2: Quotations Generated */}
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-label">Quotations Generated</span>
            <div className="stat-icon-wrap">
              <Send size={18} />
            </div>
          </div>
          <div className="stat-card-body">
            <div className="stat-value-group">
              <span className="stat-value">{quotationsToday}</span>
              <span className="stat-sub-unit">generated</span>
            </div>
            <div className="stat-meta-row">
              <span className="stat-meta-highlight">+{quotationsToday} today</span>
              <span className="stat-bullet">•</span>
              <span className="stat-meta-rate">{quotationRate}% Quoted</span>
            </div>
            <div className="stat-progress">
              <div
                className="stat-progress-bar"
                style={{
                  background: "#16694a",
                  width: `${Math.min((quotationsTotal / Math.max(incomingTotal, 1)) * 100, 100)}%`,
                }}
              />
            </div>
          </div>
        </div>

        {/* Card 3: Pending Decisions */}
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-label">Pending Review</span>
            <div className="stat-icon-wrap">
              <Clock size={18} />
            </div>
          </div>
          <div className="stat-card-body">
            <div className="stat-value-group">
              <span className="stat-value" style={{ color: underReview > 0 ? "#b45309" : "var(--ink)" }}>
                {underReview}
              </span>
              <span className="stat-sub-unit">awaiting review</span>
            </div>
            <div className="stat-meta-row" style={{ justifyContent: "space-between" }}>
              <span className="stat-text-muted">Awaiting decision</span>
              <Link to="/" className="stat-link-action">
                Review Queue <ArrowRight size={12} />
              </Link>
            </div>
            <div className="stat-progress">
              <div
                className="stat-progress-bar"
                style={{
                  background: underReview > 0 ? "#d97706" : "#cbd5e1",
                  width: underReview > 0 ? "70%" : "0%",
                }}
              />
            </div>
          </div>
        </div>

        {/* Card 4: AI Match Precision */}
        <div
          className="stat-card stat-card-clickable"
          onClick={() => setShowRejectionDetail((v) => !v)}
          title="Click to view precision details"
        >
          <div className="stat-card-header">
            <span className="stat-label">AI Match Precision</span>
            <div className="stat-icon-wrap">
              <Target size={18} />
            </div>
          </div>
          <div className="stat-card-body">
            <div className="stat-value-group">
              <span className="stat-value" style={{ color: rejectionRate > 20 ? "var(--danger)" : "var(--ink)" }}>
                {rejectionRate > 0 ? (100 - rejectionRate).toFixed(1) : 100}%
              </span>
              <span className="stat-sub-unit">precision</span>
            </div>
            <div className="stat-meta-row">
              <span className="stat-text-muted">
                {rejectionRate <= 15 ? "High Precision" : "Needs Attention"}
              </span>
              <span className="stat-details-trigger">
                Breakdown ▾
              </span>
            </div>
            <div className="stat-progress">
              <div
                className="stat-progress-bar"
                style={{
                  background: rejectionRate > 20 ? "var(--danger)" : "#16694a",
                  width: `${Math.min(100 - rejectionRate, 100)}%`,
                }}
              />
            </div>
          </div>

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
                    <CheckCircle2 size={14} style={{ color: "var(--brand)" }} />
                    Acceptance Rate
                  </span>
                  <b>{(100 - rejectionRate).toFixed(1)}%</b>
                </div>
                <div className="rejection-row">
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <XCircle size={14} style={{ color: "var(--danger)" }} />
                    Rejection Rate
                  </span>
                  <b>{rejectionRate}%</b>
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

      {/* 3b. Engineer-only: My Pipeline Overview + My Recent Activity */}
      {user?.role !== "ADMIN" && (
        <div className="dashboard-grid" style={{ marginBottom: 24 }}>
          <div className="dashboard-card">
            <div className="dashboard-card-head">
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div className="dashboard-card-icon-wrap">
                  <PieChart size={18} />
                </div>
                <h2 className="dashboard-card-title">
                  My Pipeline — {user?.category || "My Category"}
                </h2>
              </div>
            </div>
            {(insights?.pipeline_breakdown || []).every((d) => d.count === 0) ? (
              <div style={{ padding: "40px 0", textAlign: "center", color: "var(--muted)", fontSize: "0.88rem" }}>
                No enquiries recorded yet.
              </div>
            ) : (
              <DonutChart
                data={insights?.pipeline_breakdown || []}
                hoveredCategory={hoveredCategory}
                onHoverCategory={setHoveredCategory}
                colors={PIPELINE_COLORS}
              />
            )}
          </div>

          <div className="dashboard-card">
            <div className="dashboard-card-head">
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div className="dashboard-card-icon-wrap">
                  <Activity size={18} />
                </div>
                <h2 className="dashboard-card-title">
                  My Recent Activity
                </h2>
              </div>
              <Link to="/cases" className="dashboard-card-action">
                View all <ArrowRight size={14} />
              </Link>
            </div>
            {recentCases.length === 0 ? (
              <div style={{ padding: "40px 0", textAlign: "center", color: "var(--muted)", fontSize: "0.88rem" }}>
                No recent enquiries in your category.
              </div>
            ) : (
              <div className="urgent-items-list">
                {recentCases.slice(0, 5).map((c) => (
                  <div key={c.case_id} className="urgent-item-row">
                    <div className="urgent-item-left">
                      <div className="urgent-item-info">
                        <span className="urgent-item-title">{c.customer_name || "Customer Inquiry"}</span>
                        <span className="urgent-item-sub">{c.internal_ref} · {c.status}</span>
                      </div>
                    </div>
                    <Link to={`/cases/${c.case_id}`} className="btn btn-sm btn-outline" style={{ padding: "4px 12px", fontSize: "0.78rem" }}>
                      Open →
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. Middle Grid: Category Breakdown + Engineer Performance (Admin only) */}
      {user?.role === "ADMIN" && (
        <div className="dashboard-grid" style={{ marginBottom: 24 }}>
          <div className="dashboard-card">
            <div className="dashboard-card-head">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div className="dashboard-card-icon-wrap">
                  <PieChart size={18} />
                </div>
                <div>
                  <h2 className="dashboard-card-title">Enquiries by Category</h2>
                  <span className="dashboard-card-subtitle">Distribution across engineering product lines</span>
                </div>
              </div>
              <Link to="/cases" className="dashboard-card-action">
                All Cases <ArrowRight size={14} />
              </Link>
            </div>

            {categories.length === 0 ? (
              <div style={{ padding: "40px 0", textAlign: "center", color: "var(--muted)", fontSize: "0.88rem" }}>
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

          <div className="dashboard-card">
            <div className="dashboard-card-head">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div className="dashboard-card-icon-wrap">
                  <BarChart3 size={18} />
                </div>
                <div>
                  <h2 className="dashboard-card-title">Engineer Activity & Performance</h2>
                  <span className="dashboard-card-subtitle">Team review decisions & acceptance ratio</span>
                </div>
              </div>
              <span className="stat-badge">{engineers.length} Reviewers</span>
            </div>

            {engineers.length === 0 ? (
              <div style={{ padding: "40px 0", textAlign: "center", color: "var(--muted)", fontSize: "0.88rem" }}>
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
                      <div className="engineer-top-row">
                        <div className="engineer-left-col">
                          <div className="engineer-avatar">
                            {getInitials(row.engineer)}
                          </div>
                          <div className="engineer-details">
                            <div className="engineer-name-row">
                              <span className="engineer-name">{row.engineer}</span>
                              {idx === 0 && (
                                <span className="top-reviewer-pill">
                                  Top Reviewer
                                </span>
                              )}
                            </div>
                            <span className="engineer-sub-meta">
                              {total} total evaluation{total === 1 ? "" : "s"}
                            </span>
                          </div>
                        </div>

                        <div className="engineer-right-col">
                          <div className="engineer-metric-badge">
                            <span className="engineer-badge-pct">{approvedPct}%</span>
                            <span className="engineer-badge-label">Approved</span>
                          </div>
                          <div className="engineer-counts-row">
                            <span className="count-approved">
                              <CheckCircle2 size={12} /> {row.approved}
                            </span>
                            <span className="count-sep">/</span>
                            <span className="count-rejected">
                              <XCircle size={12} /> {row.rejected}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="engineer-bar-wrapper">
                        <div
                          className="engineer-fill-approved"
                          style={{ width: barsAnimate ? `${approvedWidth}%` : "0%" }}
                          title={`${row.approved} Approved (${approvedPct}%)`}
                        />
                        <div
                          className="engineer-fill-rejected"
                          style={{ width: barsAnimate ? `${rejectedWidth}%` : "0%" }}
                          title={`${row.rejected} Rejected (${100 - approvedPct}%)`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}