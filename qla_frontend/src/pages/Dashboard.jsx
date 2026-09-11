import { useState, useEffect } from "react";
import { api } from "../api/client";

const CATEGORY_COLORS = ["#173404", "#3B6D11", "#639922", "#97C459", "#C0DD97"];

function formatTimeAgo(iso) {
  if (!iso) return "";
  const diffMs = Date.now() - new Date(iso).getTime();
  const hrs = Math.floor(diffMs / (1000 * 60 * 60));
  if (hrs < 1) return "Just now";
  if (hrs === 1) return "1 hour ago";
  if (hrs < 24) return `${hrs} hours ago`;
  const days = Math.floor(hrs / 24);
  return days === 1 ? "1 day ago" : `${days} days ago`;
}

function DonutChart({ data }) {
  const [animate, setAnimate] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setAnimate(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const total = data.reduce((sum, d) => sum + d.count, 0) || 1;
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  let offsetSoFar = 0;

  return (
    <div className="donut-wrap">
      <div className="donut-chart-svg-wrap">
        <svg viewBox="0 0 140 140" width="140" height="140">
          <circle cx="70" cy="70" r={radius} fill="none" stroke="var(--neutral-tint)" strokeWidth="18" />
          {data.map((d, i) => {
            const pct = d.count / total;
            const dash = pct * circumference;
            const gap = circumference - dash;
            const rotation = (offsetSoFar / total) * 360 - 90;
            offsetSoFar += d.count;
            return (
              <circle
                key={d.category}
                cx="70" cy="70" r={radius} fill="none"
                stroke={CATEGORY_COLORS[i % CATEGORY_COLORS.length]}
                strokeWidth="18"
                strokeDasharray={`${animate ? dash : 0} ${animate ? gap : circumference}`}
                strokeDashoffset="0"
                transform={`rotate(${rotation} 70 70)`}
                style={{ transition: `stroke-dasharray 0.9s ease ${i * 0.12}s` }}
              />
            );
          })}
        </svg>
        <div className="donut-hole">
          <div className="donut-total">{total}</div>
          <div className="donut-total-label">cases</div>
        </div>
      </div>
      <div className="donut-legend">
        {data.map((d, i) => (
          <div key={d.category} className="donut-legend-row">
            <span className="donut-dot" style={{ background: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }} />
            <span className="donut-legend-label">{d.category}</span>
            <span className="donut-legend-value">
              {d.count} ({((d.count / total) * 100).toFixed(1)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}


function EngineerBar({ row, max }) {
  const [animate, setAnimate] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setAnimate(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const total = row.approved + row.rejected;
  const approvedPct = animate ? (row.approved / max) * 100 : 0;
  const rejectedPct = animate ? (row.rejected / max) * 100 : 0;
  return (
    <div className="engineer-bar-row">
      <div className="engineer-bar-name">{row.engineer}</div>
      <div className="engineer-bar-track">
        <div className="engineer-bar-approved" style={{ width: `${approvedPct}%` }}>
          {row.approved > 0 && animate && <span>{row.approved}</span>}
        </div>
        <div className="engineer-bar-rejected" style={{ width: `${rejectedPct}%` }}>
          {row.rejected > 0 && animate && <span>{row.rejected}</span>}
        </div>
      </div>
      <div className="engineer-bar-total">{total}</div>
    </div>
  );
}

export default function Dashboard() {
  const [insights, setInsights] = useState(null);
  const [error, setError] = useState("");
  const [showRejectionDetail, setShowRejectionDetail] = useState(false);

  useEffect(() => {
    api.getInsights().then(setInsights).catch((e) => setError(e.message || "Failed to load dashboard"));
  }, []);

  if (error) return <div className="page"><div className="flash flash-error">{error}</div></div>;
  if (!insights) return <div className="page"><div className="loading-state">Loading…</div></div>;

  const engineers = insights.engineer_performance || [];
  const maxDecisions = Math.max(...engineers.map((e) => e.approved + e.rejected), 1);
  const activity = insights.recent_activity || [];

  return (
    <div className="page">
      <h1 className="page-title">Dashboard</h1>
      <p className="page-sub">Overview across all categories.</p>

      <div className="stat-cards" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-icon stat-icon-pending">↓</div>
          <div>
            <div className="stat-value">{insights.incoming_today}</div>
            <div className="stat-label">Incoming Today ({insights.incoming_total} total)</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: "var(--success-tint)", color: "var(--success)" }}>↑</div>
          <div>
            <div className="stat-value">{insights.quotations_sent_today}</div>
            <div className="stat-label">Quoted Today ({insights.quotations_sent_total} total)</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-icon-rejected">⏳</div>
          <div>
            <div className="stat-value">{insights.under_review}</div>
            <div className="stat-label">Under Review</div>
          </div>
        </div>
        <div
          className="stat-card stat-card-clickable"
          onClick={() => setShowRejectionDetail((v) => !v)}
        >
          <div className="stat-icon" style={{ background: "var(--danger-tint)", color: "var(--danger)" }}>✗</div>
          <div>
            <div className="stat-value">{insights.rejection_rate}%</div>
            <div className="stat-label">Rejection Rate</div>
          </div>
          {showRejectionDetail && (
            <div className="rejection-popover" onClick={(e) => e.stopPropagation()}>
              <div className="rejection-popover-head">
                <span>Rejection Rate Details</span>
                <button onClick={() => setShowRejectionDetail(false)}>×</button>
              </div>
              <div className="rejection-popover-body">
                <div className="rejection-donut" style={{
                  background: `conic-gradient(var(--danger) 0% ${insights.rejection_rate}%, var(--neutral-tint) ${insights.rejection_rate}% 100%)`
                }}>
                  <div className="rejection-donut-hole">
                    <div className="rejection-donut-pct">{insights.rejection_rate}%</div>
                    <div className="rejection-donut-label">Rejected</div>
                  </div>
                </div>
                <div className="rejection-popover-rows">
                  <div className="rejection-row"><span className="dot dot-danger" />Rejected<b>{insights.rejected_count}</b></div>
                  <div className="rejection-row"><span className="dot dot-success" />Approved<b>{insights.approved_count}</b></div>
                  <div className="rejection-row"><span className="dot dot-muted" />Under Review<b>{insights.under_review_count}</b></div>
                </div>
              </div>
              <div className="rejection-popover-footer">
                <span>Total Enquiries</span>
                <b>{insights.total_enquiries}</b>
              </div>
              <a href="/cases" className="rejection-popover-link">View all cases →</a>
            </div>
          )}
        </div>
      </div>

      <div className="dashboard-grid">
        {insights.by_category && insights.by_category.length > 0 && (
          <div className="overview-card">
            <h2 className="section-heading" style={{ marginTop: 0 }}>Cases by Category</h2>
            <DonutChart data={insights.by_category} />
            <table className="data-table" style={{ marginTop: 16 }}>
              <thead><tr><th>Category</th><th>Cases</th></tr></thead>
              <tbody>
                {insights.by_category.map((row) => (
                  <tr key={row.category}>
                    <td>{row.category}</td>
                    <td>{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {engineers.length > 0 && (
          <div className="overview-card">
            <h2 className="section-heading" style={{ marginTop: 0 }}>Engineer Performance</h2>
            <div className="engineer-bars">
              {engineers
                .sort((a, b) => (b.approved + b.rejected) - (a.approved + a.rejected))
                .map((row) => (
                  <EngineerBar key={row.engineer} row={row} max={maxDecisions} />
                ))}
            </div>
            <table className="data-table" style={{ marginTop: 16 }}>
              <thead><tr><th>Engineer</th><th>Approved</th><th>Rejected</th><th>Total</th></tr></thead>
              <tbody>
                {engineers.map((row) => (
                  <tr key={row.engineer}>
                    <td>{row.engineer}</td>
                    <td>{row.approved}</td>
                    <td>{row.rejected}</td>
                    <td>{row.approved + row.rejected}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="dashboard-grid" style={{ marginTop: 20 }}>
        <div className="overview-card">
          <div className="dashboard-section-head">
            <h2 className="section-heading" style={{ margin: 0 }}>Recent Activity</h2>
            <a href="/cases" className="link-btn">View all →</a>
          </div>
          {activity.length === 0 ? (
            <p className="no-recs">No recent activity.</p>
          ) : (
            <div className="activity-feed">
              {activity.map((a, i) => (
                <div key={i} className="activity-row">
                  <div className="activity-icon">{a.icon || "📄"}</div>
                  <div className="activity-main">
                    <div className="activity-title">{a.title}</div>
                    <div className="activity-sub">{a.subtitle}</div>
                  </div>
                  <div className="activity-time">{formatTimeAgo(a.timestamp)}</div>
                  <span className={`status-pill status-${(a.status || "").toLowerCase()}`}>{a.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="overview-card">
          <h2 className="section-heading" style={{ marginTop: 0 }}>Quick Actions</h2>
          <div className="quick-actions-grid">
            <a href="/review-queue" className="quick-action-card">
              <div>
                <div className="quick-action-title">Review Queue</div>
                <div className="quick-action-sub">Cases requiring your decision</div>
              </div>
              <span>→</span>
            </a>
            <a href="/cases" className="quick-action-card">
              <div>
                <div className="quick-action-title">All Cases</div>
                <div className="quick-action-sub">View and manage all enquiries</div>
              </div>
              <span>→</span>
            </a>
            <a href="/cases" className="quick-action-card">
              <div>
                <div className="quick-action-title">Generate Quotation</div>
                <div className="quick-action-sub">Create quotations for approved cases</div>
              </div>
              <span>→</span>
            </a>
            <a href="/users" className="quick-action-card">
              <div>
                <div className="quick-action-title">Manage Users</div>
                <div className="quick-action-sub">Add or update user access</div>
              </div>
              <span>→</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}