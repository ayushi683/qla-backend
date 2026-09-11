import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { LayoutDashboard, ClipboardList, FolderOpen, Users, LogOut, ChevronLeft, ChevronRight } from "lucide-react";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", Icon: LayoutDashboard, adminOnly: true },
  { to: "/", end: true, label: "Review Queue", Icon: ClipboardList },
  { to: "/cases", label: "All Cases", Icon: FolderOpen },
  { to: "/users", label: "Users", Icon: Users, adminOnly: true },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  if (!user) return null;

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <aside className={`sidebar ${collapsed ? "sidebar-collapsed" : ""}`}>
      <div className="sidebar-top">
        <button className="sidebar-toggle" onClick={() => setCollapsed(!collapsed)}>
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
        {!collapsed && <span className="sidebar-brand">QLA Admin</span>}
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.filter((item) => !item.adminOnly || user.role === "ADMIN").map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}
            title={collapsed ? item.label : undefined}
          >
            <span className="sidebar-icon"><item.Icon size={18} /></span>
            {!collapsed && <span className="sidebar-label">{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-bottom">
        {!collapsed && (
          <div className="sidebar-user">{user.display_name} · {user.role}</div>
        )}
        <button className="sidebar-logout" onClick={handleLogout} title={collapsed ? "Log out" : undefined}>
          <span className="sidebar-icon"><LogOut size={18} /></span>
          {!collapsed && <span>Log out</span>}
        </button>
      </div>
    </aside>
  );
}