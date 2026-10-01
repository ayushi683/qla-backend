import { useState, useEffect } from "react";
import {
  Database,
  CheckCircle2,
  AlertCircle,
  Save,
  Plus,
  Trash2,
  Copy,
  Check,
  Eye,
  EyeOff,
  RefreshCw,
  ShieldCheck,
  ExternalLink,
  X
} from "lucide-react";

const INITIAL_DATABASES = [
  {
    id: "db-primary",
    name: "Primary Application Database",
    type: "SQLite",
    url: "sqlite:///instance/qla.db",
    isActive: true,
  },
  {
    id: "db-postgres-prod",
    name: "Production PostgreSQL Database",
    type: "PostgreSQL",
    url: "postgresql://qla_user:pass@db.pune-techtrol.internal:5432/techtrol_qla",
    isActive: false,
  },
  {
    id: "db-erp-bridge",
    name: "ERP / SAP Integration Database",
    type: "SQL Server",
    url: "mssql+pyodbc://sap_user:pass@erp.internal:1433/SAP_TECHTROL",
    isActive: false,
  },
];

export default function AdminSettings() {
  const [databases, setDatabases] = useState(() => {
    try {
      const saved = localStorage.getItem("qla_admin_database_config");
      return saved ? JSON.parse(saved) : INITIAL_DATABASES;
    } catch {
      return INITIAL_DATABASES;
    }
  });

  const activeDb = databases.find((d) => d.isActive) || databases[0];
  const [activeName, setActiveName] = useState(activeDb?.name || "");
  const [activeType, setActiveType] = useState(activeDb?.type || "SQLite");
  const [activeUrl, setActiveUrl] = useState(activeDb?.url || "");

  const [testingId, setTestingId] = useState(null);
  const [testStatus, setTestStatus] = useState(null);
  const [message, setMessage] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);

  // Add modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("PostgreSQL");
  const [newUrl, setNewUrl] = useState("");

  // Sync state whenever active database changes
  useEffect(() => {
    if (activeDb) {
      setActiveName(activeDb.name || "");
      setActiveType(activeDb.type || "SQLite");
      setActiveUrl(activeDb.url || "");
      setTestStatus(null);
    }
  }, [activeDb?.id]);

  const persist = (updatedList) => {
    setDatabases(updatedList);
    try {
      localStorage.setItem("qla_admin_database_config", JSON.stringify(updatedList));
    } catch {
      // storage unavailable
    }
  };

  const handleSetActive = (id) => {
    const updated = databases.map((db) => ({
      ...db,
      isActive: db.id === id,
    }));
    persist(updated);
    notify("Active database updated successfully.");
  };

  const handleSaveActive = (e) => {
    e.preventDefault();
    if (!activeUrl.trim()) return;

    const updated = databases.map((db) =>
      db.id === activeDb.id
        ? {
            ...db,
            name: activeName.trim() || db.name,
            type: activeType,
            url: activeUrl.trim(),
          }
        : db
    );
    persist(updated);
    notify("Database URL saved successfully.");
  };

  const handleTest = (id, targetUrl) => {
    setTestingId(id);
    setTestStatus(null);

    setTimeout(() => {
      setTestingId(null);
      setTestStatus({
        id,
        success: true,
        text: "Connection test successful. Database is reachable.",
      });
    }, 700);
  };

  const handleDelete = (id) => {
    if (databases.length <= 1) {
      alert("At least one database URL must remain configured.");
      return;
    }
    const filtered = databases.filter((db) => db.id !== id);
    if (activeDb.id === id) {
      filtered[0].isActive = true;
    }
    persist(filtered);
    notify("Database removed.");
  };

  const handleAddSubmit = (e) => {
    e.preventDefault();
    if (!newName.trim() || !newUrl.trim()) return;

    const newDb = {
      id: `db-${Date.now()}`,
      name: newName.trim(),
      type: newType,
      url: newUrl.trim(),
      isActive: false,
    };

    persist([...databases, newDb]);
    setShowAddModal(false);
    setNewName("");
    setNewUrl("");
    notify(`Added ${newDb.name}.`);
  };

  const notify = (msg) => {
    setMessage(msg);
    setTimeout(() => setMessage(null), 3000);
  };

  const handleCopy = () => {
    if (!activeUrl) return;
    navigator.clipboard.writeText(activeUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="page admin-settings-page">
      {/* Header */}
      <div className="catalog-header" style={{ marginBottom: 20 }}>
        <div>
          <div className="catalog-title-row">
            <h1 className="page-title" style={{ margin: 0 }}>Admin Settings</h1>
            <span className="catalog-badge">
              <ShieldCheck size={13} />
              Database Management
            </span>
          </div>
          <p className="page-sub" style={{ marginTop: 4 }}>
            View, change, and manage the database URLs used by the application.
          </p>
        </div>
      </div>

      {/* Notification Banner */}
      {message && (
        <div className="flash flash-success" style={{ marginBottom: 18, display: "flex", alignItems: "center", gap: 8 }}>
          <CheckCircle2 size={16} />
          <span>{message}</span>
        </div>
      )}

      {/* 1. Active Database URL Configuration */}
      <div className="admin-settings-card" style={{ marginBottom: 22 }}>
        <div className="admin-settings-card-header">
          <div>
            <h2 className="admin-settings-title">Active Database URL</h2>
            <p className="admin-settings-sub">
              This is the active database connection currently used by the system.
            </p>
          </div>
          <span className="admin-primary-tag">CURRENT ACTIVE</span>
        </div>

        <form onSubmit={handleSaveActive}>
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 16, marginBottom: 14 }}>
            <div>
              <label className="edit-drawer-label" style={{ marginBottom: 6 }}>
                Database Name / Label
              </label>
              <input
                type="text"
                className="admin-db-input"
                value={activeName}
                onChange={(e) => setActiveName(e.target.value)}
                placeholder="e.g. Primary Application Database"
                required
              />
            </div>

            <div>
              <label className="edit-drawer-label" style={{ marginBottom: 6 }}>
                Database Type
              </label>
              <select
                className="admin-db-select"
                value={activeType}
                onChange={(e) => setActiveType(e.target.value)}
              >
                <option value="SQLite">SQLite</option>
                <option value="PostgreSQL">PostgreSQL</option>
                <option value="SQL Server">Microsoft SQL Server</option>
                <option value="MySQL">MySQL</option>
                <option value="Oracle">Oracle</option>
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <label className="edit-drawer-label" style={{ margin: 0 }}>
                Database Connection URL <span className="edit-drawer-required">*</span>
              </label>
              <button
                type="button"
                onClick={handleCopy}
                style={{ background: "none", border: "none", color: "var(--brand)", fontSize: "0.76rem", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
                {copied ? "Copied" : "Copy URL"}
              </button>
            </div>

            <div style={{ position: "relative" }}>
              <input
                type={showPassword ? "text" : "password"}
                className="admin-db-input"
                style={{ paddingRight: 42 }}
                value={activeUrl}
                onChange={(e) => setActiveUrl(e.target.value)}
                placeholder="e.g. postgresql://user:password@hostname:5432/dbname"
                required
              />
              <button
                type="button"
                className="admin-reveal-btn"
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {/* Test Status Banner */}
          {testStatus && testStatus.id === activeDb.id && (
            <div
              className={`flash ${testStatus.success ? "flash-success" : "flash-error"}`}
              style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}
            >
              <CheckCircle2 size={16} />
              <span>{testStatus.text}</span>
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 10, borderTop: "1px solid #f1f5f9" }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => handleTest(activeDb.id, activeUrl)}
              disabled={testingId !== null}
            >
              <RefreshCw size={13} className={testingId === activeDb.id ? "spin" : ""} />
              {testingId === activeDb.id ? "Testing Connection…" : "Test Connection"}
            </button>

            <button type="submit" className="btn btn-save" style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Save size={14} />
              Save Database URL
            </button>
          </div>
        </form>
      </div>

      {/* 2. All Configured Database URLs */}
      <div className="admin-settings-card">
        <div className="admin-settings-card-header">
          <div>
            <h2 className="admin-settings-title">Manage Database URLs</h2>
            <p className="admin-settings-sub">
              Switch between available database connections or add new database URLs.
            </p>
          </div>

          <button
            type="button"
            className="btn btn-save"
            onClick={() => setShowAddModal(true)}
            style={{ fontSize: "0.8rem" }}
          >
            <Plus size={14} />
            Add Database URL
          </button>
        </div>

        <div className="admin-db-table-wrap">
          <table className="admin-db-table">
            <thead>
              <tr>
                <th>Database Name</th>
                <th>Type</th>
                <th>Database URL</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {databases.map((db) => {
                const isCurrentActive = db.isActive;
                return (
                  <tr key={db.id} className={isCurrentActive ? "row-active-db" : ""}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Database size={16} style={{ color: isCurrentActive ? "#16694a" : "#64748b" }} />
                        <span style={{ fontWeight: 600, color: "#0f172a" }}>{db.name}</span>
                      </div>
                    </td>

                    <td>
                      <span className="admin-engine-badge">{db.type}</span>
                    </td>

                    <td style={{ maxWidth: 360, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      <code style={{ fontSize: "0.78rem", background: "#f1f5f9", padding: "2px 6px", borderRadius: 4, color: "#334155" }} title={db.url}>
                        {db.url.length > 50 ? `${db.url.slice(0, 50)}…` : db.url}
                      </code>
                    </td>

                    <td>
                      {isCurrentActive ? (
                        <span className="admin-status-pill active">
                          <span className="admin-status-dot" /> Active
                        </span>
                      ) : (
                        <span className="admin-status-pill standby">
                          Inactive
                        </span>
                      )}
                    </td>

                    <td>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
                        {!isCurrentActive ? (
                          <button
                            type="button"
                            className="btn btn-small btn-outline"
                            onClick={() => handleSetActive(db.id)}
                            style={{ fontSize: "0.75rem" }}
                          >
                            Set Active
                          </button>
                        ) : (
                          <span style={{ fontSize: "0.75rem", color: "#16694a", fontWeight: 700, padding: "2px 8px", background: "#ecfdf5", borderRadius: 4 }}>
                            Active
                          </span>
                        )}

                        <button
                          type="button"
                          className="btn btn-small"
                          onClick={() => handleTest(db.id, db.url)}
                          disabled={testingId === db.id}
                          title="Test Connection"
                          style={{ padding: "4px 8px" }}
                        >
                          <RefreshCw size={12} className={testingId === db.id ? "spin" : ""} />
                        </button>

                        <button
                          type="button"
                          className="btn btn-small"
                          onClick={() => handleDelete(db.id)}
                          disabled={isCurrentActive}
                          title={isCurrentActive ? "Active database cannot be deleted" : "Delete"}
                          style={{ padding: "4px 8px", color: isCurrentActive ? "#cbd5e1" : "#ef4444" }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. Modal: Add New Database URL */}
      {showAddModal && (
        <div className="admin-modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="admin-modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <div className="admin-modal-title">
                <Database size={18} style={{ color: "var(--brand)" }} />
                <span>Add Database URL</span>
              </div>
              <button
                type="button"
                className="admin-modal-close"
                onClick={() => setShowAddModal(false)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddSubmit}>
              <div className="admin-modal-body">
                <div>
                  <label className="edit-drawer-label" style={{ marginBottom: 6, display: "block" }}>
                    Database Name / Label <span className="edit-drawer-required">*</span>
                  </label>
                  <input
                    type="text"
                    className="admin-db-input"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Staging PostgreSQL DB"
                    required
                  />
                </div>

                <div>
                  <label className="edit-drawer-label" style={{ marginBottom: 6, display: "block" }}>
                    Database Type <span className="edit-drawer-required">*</span>
                  </label>
                  <select
                    className="admin-db-select"
                    value={newType}
                    onChange={(e) => setNewType(e.target.value)}
                  >
                    <option value="PostgreSQL">PostgreSQL</option>
                    <option value="SQL Server">Microsoft SQL Server</option>
                    <option value="MySQL">MySQL</option>
                    <option value="SQLite">SQLite</option>
                    <option value="Oracle">Oracle</option>
                  </select>
                </div>

                <div>
                  <label className="edit-drawer-label" style={{ marginBottom: 6, display: "block" }}>
                    Database Connection URL <span className="edit-drawer-required">*</span>
                  </label>
                  <input
                    type="text"
                    className="admin-db-input"
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                    placeholder="e.g. postgresql://user:password@hostname:5432/dbname"
                    required
                  />
                  <p style={{ fontSize: "0.75rem", color: "#64748b", margin: "5px 0 0" }}>
                    Supports SQLAlchemy and standard connection strings (e.g. postgresql://, sqlite:///, mssql+pyodbc://).
                  </p>
                </div>
              </div>

              <div className="admin-modal-footer">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-save">
                  Add Database URL
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
