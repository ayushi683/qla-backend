import { useState } from "react";
import {
  Sliders,
  Sparkles,
  FileSpreadsheet,
  Save,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  SlidersHorizontal,
  RefreshCw,
  Building,
  Shield,
  Layers,
  Percent,
  Clock,
  Plus,
  Trash2,
  X
} from "lucide-react";

export default function AdminSettings() {
  const [activeTab, setActiveTab] = useState("ai"); // ai, quotation, categories
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  // Settings state
  const [aiSettings, setAiSettings] = useState({
    highConfidenceThreshold: 80,
    midConfidenceThreshold: 50,
    autoApproveAbove90: false,
    maxRecommendationsPerLine: 3,
    fuzzyModelSearch: true,
    prioritizeExactTagMatch: true,
  });

  const [quoteDefaults, setQuoteDefaults] = useState({
    currency: "INR",
    taxPct: 18,
    validityDays: 30,
    freightTerms: "Ex-Works Pune / Freight extra at actuals",
    paymentTerms: "100% advance against Proforma Invoice",
    deliveryPeriod: "4 to 6 weeks from approval of technical specs",
    warrantyPeriod: "18 months from supply or 12 months from commissioning",
  });

  const [categories, setCategories] = useState([
    { id: 1, code: "OEM,MRO", name: "OEM & Maintenance/Repair", enabled: true, autoAssignRole: "ENGINEER" },
    { id: 2, code: "CP", name: "Channel Partner / Distributor", enabled: true, autoAssignRole: "ENGINEER" },
    { id: 3, code: "EPC,EXPORT", name: "EPC & International Export", enabled: true, autoAssignRole: "ADMIN" },
    { id: 4, code: "PROJECT", name: "Turnkey Projects & Solutions", enabled: true, autoAssignRole: "ADMIN" },
    { id: 5, code: "DISTRIBUTED_PRODUCTS", name: "Distributed Allied Products", enabled: true, autoAssignRole: "ENGINEER" },
    { id: 6, code: "ULTRASONIC", name: "Ultrasonic & Flow Metering", enabled: true, autoAssignRole: "ENGINEER" },
  ]);

  // Modal state for Add Category
  const [showAddCatModal, setShowAddCatModal] = useState(false);
  const [newCatData, setNewCatData] = useState({
    code: "",
    name: "",
    autoAssignRole: "ENGINEER",
  });

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }

  function handleSaveAll(e) {
    e.preventDefault();
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      showToast("Master admin settings saved successfully");
    }, 600);
  }

  function toggleCategory(id) {
    setCategories(
      categories.map((c) => (c.id === id ? { ...c, enabled: !c.enabled } : c))
    );
  }

  function handleCreateCategory(e) {
    e.preventDefault();
    if (!newCatData.code.trim() || !newCatData.name.trim()) {
      showToast("Please enter both category code and display name.");
      return;
    }
    const cleanCode = newCatData.code.trim().toUpperCase().replace(/\s+/g, "_");
    if (categories.some((c) => c.code === cleanCode)) {
      showToast(`Category code "${cleanCode}" already exists.`);
      return;
    }
    const newCat = {
      id: Date.now(),
      code: cleanCode,
      name: newCatData.name.trim(),
      enabled: true,
      autoAssignRole: newCatData.autoAssignRole || "ENGINEER",
    };
    setCategories([...categories, newCat]);
    setShowAddCatModal(false);
    setNewCatData({ code: "", name: "", autoAssignRole: "ENGINEER" });
    showToast(`Category "${cleanCode}" created successfully`);
  }

  function handleDeleteCategory(id, code) {
    if (window.confirm(`Are you sure you want to remove the category "${code}"?`)) {
      setCategories(categories.filter((c) => c.id !== id));
      showToast(`Category "${code}" removed`);
    }
  }

  return (
    <div className="page admin-settings-page">
      {/* Toast */}
      {toast && (
        <div className="toast-notif">
          <CheckCircle2 size={16} className="toast-icon" style={{ color: "var(--brand)" }} />
          <div>
            <div className="toast-title">{toast}</div>
          </div>
          <button className="toast-close" onClick={() => setToast(null)}>×</button>
        </div>
      )}

      {/* Header */}
      <div className="catalog-header">
        <div>
          <div className="catalog-title-row">
            <h1 className="page-title" style={{ margin: 0 }}>System & Admin Settings</h1>
            <span className="catalog-badge">
              <Shield size={13} />
              Admin Configuration
            </span>
          </div>
          <p className="page-sub" style={{ marginTop: 4 }}>
            Configure automated AI match confidence thresholds, quotation defaults, and category rules.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-approve"
          onClick={handleSaveAll}
          disabled={saving}
        >
          {saving ? <RefreshCw size={14} className="spin" /> : <Save size={14} />}
          <span>{saving ? "Saving…" : "Save All Settings"}</span>
        </button>
      </div>

      {/* Tabs Navigation */}
      <div className="settings-nav-tabs">
        <button
          type="button"
          className={`settings-nav-tab ${activeTab === "ai" ? "active" : ""}`}
          onClick={() => setActiveTab("ai")}
        >
          <SlidersHorizontal size={15} />
          <span>AI Matching Rules</span>
        </button>

        <button
          type="button"
          className={`settings-nav-tab ${activeTab === "quotation" ? "active" : ""}`}
          onClick={() => setActiveTab("quotation")}
        >
          <FileSpreadsheet size={15} />
          <span>Commercial & Quotation Defaults</span>
        </button>

        <button
          type="button"
          className={`settings-nav-tab ${activeTab === "categories" ? "active" : ""}`}
          onClick={() => setActiveTab("categories")}
        >
          <Layers size={15} />
          <span>Business Categories</span>
        </button>
      </div>

      {/* Main Settings Form */}
      <form onSubmit={handleSaveAll}>
        {/* TAB 1: AI MATCHING RULES */}
        {activeTab === "ai" && (
          <div className="settings-section-card">
            <div className="settings-card-header">
              <div>
                <h3 className="settings-card-title">AI Recommendation Engine Rules</h3>
                <p className="settings-card-desc">
                  Tune confidence intervals, match ranking thresholds, and automatic selection logic.
                </p>
              </div>
            </div>

            <div className="settings-grid">
              <div className="settings-field-group">
                <label className="settings-label">
                  High Confidence Green Threshold (%)
                  <span className="settings-hint">Matches above this percentage are flagged as High Confidence.</span>
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <input
                    type="range"
                    min="60"
                    max="95"
                    value={aiSettings.highConfidenceThreshold}
                    onChange={(e) =>
                      setAiSettings({ ...aiSettings, highConfidenceThreshold: Number(e.target.value) })
                    }
                    style={{ flex: 1 }}
                  />
                  <span className="settings-range-val">{aiSettings.highConfidenceThreshold}%</span>
                </div>
              </div>

              <div className="settings-field-group">
                <label className="settings-label">
                  Medium Confidence Amber Threshold (%)
                  <span className="settings-hint">Matches between medium and high are flagged for careful engineer check.</span>
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <input
                    type="range"
                    min="30"
                    max="70"
                    value={aiSettings.midConfidenceThreshold}
                    onChange={(e) =>
                      setAiSettings({ ...aiSettings, midConfidenceThreshold: Number(e.target.value) })
                    }
                    style={{ flex: 1 }}
                  />
                  <span className="settings-range-val">{aiSettings.midConfidenceThreshold}%</span>
                </div>
              </div>

              <div className="settings-field-group">
                <label className="settings-label">Maximum Recommendations per Line Item</label>
                <select
                  value={aiSettings.maxRecommendationsPerLine}
                  onChange={(e) =>
                    setAiSettings({ ...aiSettings, maxRecommendationsPerLine: Number(e.target.value) })
                  }
                  className="catalog-form-input"
                >
                  <option value={1}>1 (Top Match Only)</option>
                  <option value={3}>3 (Top + 2 Alternatives)</option>
                  <option value={5}>5 (Comprehensive Candidate Pool)</option>
                </select>
              </div>

              <div className="settings-field-group">
                <label className="settings-label">Model Prefix Fuzzy Match</label>
                <select
                  value={aiSettings.fuzzyModelSearch ? "true" : "false"}
                  onChange={(e) =>
                    setAiSettings({ ...aiSettings, fuzzyModelSearch: e.target.value === "true" })
                  }
                  className="catalog-form-input"
                >
                  <option value="true">Enabled (Allow typos and minor spacing differences)</option>
                  <option value="false">Strict (Exact model code prefix match only)</option>
                </select>
              </div>

              <div className="settings-checkbox-row" style={{ gridColumn: "span 2" }}>
                <label className="settings-checkbox-label">
                  <input
                    type="checkbox"
                    checked={aiSettings.prioritizeExactTagMatch}
                    onChange={(e) =>
                      setAiSettings({ ...aiSettings, prioritizeExactTagMatch: e.target.checked })
                    }
                  />
                  <div>
                    <span className="settings-check-title">Prioritize Customer Tag Number Exact Mentions</span>
                    <span className="settings-check-sub">
                      When inquiry contains explicit tag numbers (e.g. LT-101), cross-reference with previous revision history.
                    </span>
                  </div>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: COMMERCIAL & QUOTATION DEFAULTS */}
        {activeTab === "quotation" && (
          <div className="settings-section-card">
            <div className="settings-card-header">
              <div>
                <h3 className="settings-card-title">Commercial & Quotation Document Defaults</h3>
                <p className="settings-card-desc">
                  Default values auto-populated during quotation generation in DOCX format.
                </p>
              </div>
            </div>

            <div className="settings-grid">
              <div className="settings-field-group">
                <label className="settings-label">Default Currency</label>
                <select
                  value={quoteDefaults.currency}
                  onChange={(e) => setQuoteDefaults({ ...quoteDefaults, currency: e.target.value })}
                  className="catalog-form-input"
                >
                  <option value="INR">INR (₹ Indian Rupee)</option>
                  <option value="USD">USD ($ US Dollar)</option>
                  <option value="EUR">EUR (€ Euro)</option>
                </select>
              </div>

              <div className="settings-field-group">
                <label className="settings-label">Default GST Tax Rate (%)</label>
                <input
                  type="number"
                  value={quoteDefaults.taxPct}
                  onChange={(e) =>
                    setQuoteDefaults({ ...quoteDefaults, taxPct: Number(e.target.value) })
                  }
                  className="catalog-form-input"
                />
              </div>

              <div className="settings-field-group">
                <label className="settings-label">Quotation Validity</label>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="number"
                    value={quoteDefaults.validityDays}
                    onChange={(e) =>
                      setQuoteDefaults({ ...quoteDefaults, validityDays: Number(e.target.value) })
                    }
                    className="catalog-form-input"
                  />
                  <span style={{ fontSize: "0.85rem", color: "var(--muted)" }}>Days</span>
                </div>
              </div>

              <div className="settings-field-group">
                <label className="settings-label">Standard Payment Terms</label>
                <input
                  type="text"
                  value={quoteDefaults.paymentTerms}
                  onChange={(e) =>
                    setQuoteDefaults({ ...quoteDefaults, paymentTerms: e.target.value })
                  }
                  className="catalog-form-input"
                />
              </div>

              <div className="settings-field-group" style={{ gridColumn: "span 2" }}>
                <label className="settings-label">Standard Freight Terms</label>
                <input
                  type="text"
                  value={quoteDefaults.freightTerms}
                  onChange={(e) =>
                    setQuoteDefaults({ ...quoteDefaults, freightTerms: e.target.value })
                  }
                  className="catalog-form-input"
                />
              </div>

              <div className="settings-field-group">
                <label className="settings-label">Standard Delivery Period</label>
                <input
                  type="text"
                  value={quoteDefaults.deliveryPeriod}
                  onChange={(e) =>
                    setQuoteDefaults({ ...quoteDefaults, deliveryPeriod: e.target.value })
                  }
                  className="catalog-form-input"
                />
              </div>

              <div className="settings-field-group">
                <label className="settings-label">Standard Warranty Period</label>
                <input
                  type="text"
                  value={quoteDefaults.warrantyPeriod}
                  onChange={(e) =>
                    setQuoteDefaults({ ...quoteDefaults, warrantyPeriod: e.target.value })
                  }
                  className="catalog-form-input"
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: BUSINESS CATEGORIES */}
        {activeTab === "categories" && (
          <div className="settings-section-card">
            <div className="settings-card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 className="settings-card-title">Business Categories & Auto-Routing</h3>
                <p className="settings-card-desc">
                  Active business classifications used for engineer user allocation and case filtering.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-approve"
                style={{ padding: "6px 14px", fontSize: "0.82rem" }}
                onClick={() => setShowAddCatModal(true)}
              >
                <Plus size={14} />
                <span>Add Category</span>
              </button>
            </div>

            <div className="settings-cat-list">
              {categories.map((cat) => (
                <div key={cat.id} className="settings-cat-row">
                  <div className="settings-cat-info">
                    <span className="settings-cat-code">{cat.code}</span>
                    <span className="settings-cat-name">{cat.name}</span>
                  </div>

                  <div className="settings-cat-actions">
                    <span className="settings-cat-role-badge">
                      Assigned: {cat.autoAssignRole}
                    </span>
                    <button
                      type="button"
                      className={`catalog-status-toggle ${cat.enabled ? "is-active" : "is-inactive"}`}
                      onClick={() => toggleCategory(cat.id)}
                    >
                      <span className="catalog-status-dot" />
                      {cat.enabled ? "Enabled" : "Disabled"}
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline"
                      style={{ padding: "5px 8px", color: "var(--danger)", borderColor: "#fecaca" }}
                      onClick={() => handleDeleteCategory(cat.id, cat.code)}
                      title={`Remove ${cat.code}`}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bottom Save Bar */}
        <div className="settings-bottom-bar">
          <span style={{ fontSize: "0.84rem", color: "var(--muted)" }}>
            Changes will take effect immediately across all engineer workspaces.
          </span>
          <button type="submit" className="btn btn-approve" disabled={saving}>
            {saving ? <RefreshCw size={14} className="spin" /> : <Save size={14} />}
            <span>{saving ? "Saving Changes…" : "Save Changes"}</span>
          </button>
        </div>
      </form>

      {/* Add Business Category Modal */}
      {showAddCatModal && (
        <div className="modal-overlay" onClick={() => setShowAddCatModal(false)}>
          <div className="modal-panel" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
            <div className="model-modal-header">
              <div className="model-modal-header-left">
                <div className="model-modal-icon-badge">
                  <Layers size={18} />
                </div>
                <div>
                  <h3 className="model-modal-title">Add Business Category</h3>
                  <p className="model-modal-sub" style={{ margin: 0 }}>
                    Create a new classification for routing & product grouping.
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="model-modal-close"
                onClick={() => setShowAddCatModal(false)}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateCategory}>
              <div className="model-modal-body" style={{ padding: "20px 24px" }}>
                <div className="model-field" style={{ marginBottom: 14 }}>
                  <label className="model-field-label">
                    Category Code <span className="model-req">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. DENSITY, ANALYTICAL, GAS"
                    value={newCatData.code}
                    onChange={(e) =>
                      setNewCatData({ ...newCatData, code: e.target.value.toUpperCase() })
                    }
                    className="model-field-input model-code-input"
                    autoFocus
                  />
                  <span className="model-field-hint">Unique short code used in routing and filter tags.</span>
                </div>

                <div className="model-field" style={{ marginBottom: 14 }}>
                  <label className="model-field-label">
                    Display Name <span className="model-req">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Density & Viscosity Instruments"
                    value={newCatData.name}
                    onChange={(e) => setNewCatData({ ...newCatData, name: e.target.value })}
                    className="model-field-input"
                  />
                </div>

                <div className="model-field">
                  <label className="model-field-label">Auto-Assign Target Role</label>
                  <select
                    value={newCatData.autoAssignRole}
                    onChange={(e) => setNewCatData({ ...newCatData, autoAssignRole: e.target.value })}
                    className="model-field-select"
                  >
                    <option value="ENGINEER">ENGINEER (Application Engineer)</option>
                    <option value="ADMIN">ADMIN (Senior Lead / Manager)</option>
                    <option value="REVIEWER">REVIEWER (Technical Review Desk)</option>
                  </select>
                  <span className="model-field-hint">Incoming inquiries matching this category will route to this pool.</span>
                </div>
              </div>

              <div className="model-modal-footer">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setShowAddCatModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-approve">
                  <Plus size={14} />
                  <span>Create Category</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
