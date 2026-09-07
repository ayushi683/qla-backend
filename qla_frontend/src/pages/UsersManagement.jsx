import { useState, useEffect } from "react";
import { api } from "../api/client";

export default function UsersManagement() {
  const [users, setUsers] = useState(null);
  const [error, setError] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("ENGINEER");
  const [newCategory, setNewCategory] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const data = await api.listUsers();
      setUsers(data);
    } catch (e) {
      setError(e.message || "Failed to load users");
    }
  }

  useEffect(() => { load(); }, []);

  async function handleAdd(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.createUser({
        email: newEmail, display_name: newName, role: newRole,
      });
      setNewEmail(""); setNewName(""); setNewRole("ENGINEER"); setNewCategory("");
      setShowAdd(false);
      load();
    } catch (e) {
      setError(e.message || "Failed to create user");
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleEnabled(user) {
    try {
      await api.updateUser(user.user_id, { is_enabled: !user.is_enabled });
      load();
    } catch (e) {
      setError(e.message || "Failed to update user");
    }
  }

  async function handleRoleChange(user, role) {
    try {
      await api.updateUser(user.user_id, { role });
      load();
    } catch (e) {
      setError(e.message || "Failed to update user");
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Users</h1>
          <p className="page-sub">Manage who can access the admin panel.</p>
        </div>
        <button className="btn btn-approve" onClick={() => setShowAdd(!showAdd)}>
          {showAdd ? "Cancel" : "+ Add User"}
        </button>
      </div>

      {error && <div className="flash flash-error">{error}</div>}

      {showAdd && (
        <form className="add-user-form" onSubmit={handleAdd}>
          <div className="add-user-fields">
            <div>
              <label>Email</label>
              <input type="email" required value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
            </div>
            <div>
              <label>Display Name</label>
              <input type="text" required value={newName} onChange={(e) => setNewName(e.target.value)} />
            </div>
            <div>
              <label>Role</label>
              <select value={newRole} onChange={(e) => setNewRole(e.target.value)}>
                <option value="ENGINEER">Engineer</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>
          </div>
          <button type="submit" className="btn btn-save" disabled={busy}>
            {busy ? "Creating…" : "Create User"}
          </button>
          <p className="add-user-note">
            Engineers log in via Outlook (no password). Admins log in with email + password (set separately).
          </p>
        </form>
      )}

      {users === null ? (
        <div className="loading-state">Loading…</div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Category</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.user_id}>
                <td>{u.display_name}</td>
                <td>{u.email}</td>
                <td>
                  <select value={u.role} onChange={(e) => handleRoleChange(u, e.target.value)} className="inline-select">
                    <option value="ENGINEER">Engineer</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </td>
                <td>{u.category || "—"}</td>
                <td>
                  <span className={`status-pill ${u.is_enabled ? "status-approved" : "status-received"}`}>
                    {u.is_enabled ? "Active" : "Disabled"}
                  </span>
                </td>
                <td>
                  <button className="btn btn-small" onClick={() => handleToggleEnabled(u)}>
                    {u.is_enabled ? "Disable" : "Enable"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}