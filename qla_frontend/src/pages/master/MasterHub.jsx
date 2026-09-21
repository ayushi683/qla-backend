import { Link } from "react-router-dom";
import {
  BookOpen,
  Users,
  ArrowRight,
  ShieldCheck,
  Package,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  Layers,
  Sparkles
} from "lucide-react";

export default function MasterHub() {
  return (
    <div className="page master-hub-page">
      {/* Header */}
      <div className="catalog-header">
        <div>
          <div className="catalog-title-row">
            <h1 className="page-title" style={{ margin: 0 }}>Master Administration</h1>
            <span className="catalog-badge">
              <ShieldCheck size={13} />
              Admin Master Data
            </span>
          </div>
          <p className="page-sub" style={{ marginTop: 4 }}>
            Centralized management for engineering catalog models and team access permissions.
          </p>
        </div>
      </div>

      {/* 2 Core Master Cards */}
      <div className="master-cards-grid">
        {/* 1. Catalog Master Card */}
        <div className="master-card">
          <div className="master-card-top">
            <div className="master-card-icon master-icon-catalog">
              <Package size={22} />
            </div>
            <span className="master-card-badge">Catalog Engine</span>
          </div>

          <h3 className="master-card-title">Product Catalog Master</h3>
          <p className="master-card-desc">
            Maintain standard model prefixes, sensing principles (Magnetic Float, Radar 80GHz, Tuning Fork), technical descriptions, and base catalog pricing.
          </p>

          <div className="master-card-stats">
            <div className="master-stat-item">
              <span className="master-stat-num">8</span>
              <span className="master-stat-label">Model Prefixes</span>
            </div>
            <div className="master-stat-item">
              <span className="master-stat-num">5</span>
              <span className="master-stat-label">Categories</span>
            </div>
            <div className="master-stat-item">
              <span className="master-stat-num">100%</span>
              <span className="master-stat-label">AI Indexed</span>
            </div>
          </div>

          <div className="master-card-footer">
            <Link to="/master/catalog" className="btn btn-approve" style={{ width: "100%", justifyContent: "center" }}>
              <span>Manage Catalog Models</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>

        {/* 2. Users Management Card */}
        <div className="master-card">
          <div className="master-card-top">
            <div className="master-card-icon master-icon-users">
              <Users size={22} />
            </div>
            <span className="master-card-badge">Access & Teams</span>
          </div>

          <h3 className="master-card-title">User Management & Roles</h3>
          <p className="master-card-desc">
            Configure application engineers and admin accounts. Assign business categories (Level, Flow, Pressure, Temperature), toggle active status, or manage credentials.
          </p>

          <div className="master-card-stats">
            <div className="master-stat-item">
              <span className="master-stat-num">Role</span>
              <span className="master-stat-label">Admin / Engineer</span>
            </div>
            <div className="master-stat-item">
              <span className="master-stat-num">6</span>
              <span className="master-stat-label">Category Types</span>
            </div>
            <div className="master-stat-item">
              <span className="master-stat-num">Active</span>
              <span className="master-stat-label">Live Control</span>
            </div>
          </div>

          <div className="master-card-footer">
            <Link to="/master/users" className="btn btn-approve" style={{ width: "100%", justifyContent: "center" }}>
              <span>Manage Users & Categories</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </div>

      {/* Quick Reference Summary */}
      <div className="master-info-card">
        <div className="master-info-left">
          <div className="master-info-icon">
            <CheckCircle2 size={24} style={{ color: "var(--brand)" }} />
          </div>
          <div>
            <h4 style={{ margin: "0 0 4px", fontSize: "0.95rem", color: "var(--ink)" }}>
              Master Data Hierarchy in QLA
            </h4>
            <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--muted)", lineHeight: 1.4 }}>
              Catalog models and sensing principles directly inform the automated LLM recommendation engine. Any updates to product prefixes or categories will automatically apply to newly extracted inquiry specifications.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
