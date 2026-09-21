import { useState, useEffect, useRef } from "react";
import { MoreVertical, Shield, UserX, UserCheck, Trash2 } from "lucide-react";
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
  const [openMenuId, setOpenMenuId] = useState(null);
  const menuRef = useRef(null);

  async function load() {
    try {
      const data = await api.listUsers();
      setUsers(data);
    } catch (e) {
      setError(e.message || "Failed to load users");
    }
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpenMenuId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleAdd(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.createUser({
        email: newEmail,
        display_name: newName,
        role: newRole,
        category: newCategory.trim() || undefined,
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
    setOpenMenuId(null);
  }

  async function handleRoleChange(user, role) {
    try {
      await api.updateUser(user.user_id, { role });
      load();
    } catch (e) {
      setError(e.message || "Failed to update user");
    }
    setOpenMenuId(null);
  }

  async function handleDelete(user) {
    if (!window.confirm(`Are you sure you want to delete user "${user.display_name}" (${user.email})?`)) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api.deleteUser(user.user_id);
      load();
    } catch (e) {
      if (e.message && (e.message.includes("405") || e.message.includes("Not Allowed"))) {
        setError("Delete endpoint (DELETE /api/users/{id}) is pending on the backend. You can use 'Disable User' to revoke access in the meantime.");
      } else {
        setError(e.message || "Failed to delete user");
      }
    } finally {
      setBusy(false);
      setOpenMenuId(null);
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Users</h1>
          <p className="page-sub">Manage access and permissions.</p>
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
            <div>
              <label>Category</label>
              <input
                type="text"
                list="category-suggestions"
                placeholder="e.g. OEM,MRO or CP"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
              />
              <datalist id="category-suggestions">
                <option value="OEM,MRO" />
                <option value="CP" />
                <option value="EPC,EXPORT" />
                <option value="PROJECT" />
                <option value="DISTRIBUTED_PRODUCTS" />
                <option value="ULTRASONIC" />
              </datalist>
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
                <td>{u.role}</td>
                <td>{u.category || "—"}</td>
                <td>
                  <span className={`status-pill ${u.is_enabled ? "status-approved" : "status-received"}`}>
                    {u.is_enabled ? "Active" : "Disabled"}
                  </span>
                </td>
                <td style={{ position: "relative" }}>
                  <button
                    type="button"
                    className="action-menu-trigger"
                    onClick={() => setOpenMenuId(openMenuId === u.user_id ? null : u.user_id)}
                    title="User actions"
                  >
                    <MoreVertical size={16} />
                  </button>
                  {openMenuId === u.user_id && (
                    <div className="action-menu" ref={menuRef}>
                      <button
                        type="button"
                        className="action-menu-item"
                        onClick={() => handleRoleChange(u, u.role === "ADMIN" ? "ENGINEER" : "ADMIN")}
                      >
                        <Shield size={14} className="action-menu-icon" />
                        <span>Change Role → {u.role === "ADMIN" ? "Engineer" : "Admin"}</span>
                      </button>
                      <button
                        type="button"
                        className={`action-menu-item ${u.is_enabled ? "action-menu-warning" : "action-menu-success"}`}
                        onClick={() => handleToggleEnabled(u)}
                      >
                        {u.is_enabled ? <UserX size={14} className="action-menu-icon" /> : <UserCheck size={14} className="action-menu-icon" />}
                        <span>{u.is_enabled ? "Disable User" : "Enable User"}</span>
                      </button>
                      <button
                        type="button"
                        className="action-menu-item action-menu-danger"
                        onClick={() => handleDelete(u)}
                      >
                        <Trash2 size={14} className="action-menu-icon" />
                        <span>Delete User</span>
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}