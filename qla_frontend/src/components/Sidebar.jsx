import { useState, useEffect } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  LayoutDashboard,
  ClipboardList,
  FolderOpen,
  Users,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
} from "lucide-react";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", Icon: LayoutDashboard, adminOnly: true },
  { to: "/", end: true, label: "Review Queue", Icon: ClipboardList },
  { to: "/cases", label: "All Cases", Icon: FolderOpen },
  { to: "/users", label: "Users", Icon: Users, adminOnly: true },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile sidebar whenever route changes
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  if (!user) return null;

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <>
      {/* 1. Mobile Top Navigation Bar */}
      <header className="mobile-header">
        <button
          type="button"
          className="mobile-header-btn"
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation menu"
        >
          <Menu size={22} />
        </button>
        <span className="mobile-brand">QLA Admin</span>
        <div className="mobile-user-badge">{user.role}</div>
      </header>

      {/* 2. Mobile Backdrop Overlay */}
      {mobileOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* 3. Sidebar (Desktop collapsible, Mobile off-canvas drawer) */}
      <aside
        className={`sidebar ${desktopCollapsed ? "sidebar-collapsed" : ""} ${
          mobileOpen ? "sidebar-mobile-open" : ""
        }`}
      >
        <div className="sidebar-top">
          {/* Toggle for desktop only */}
          <button
            type="button"
            className="sidebar-toggle desktop-only"
            onClick={() => setDesktopCollapsed(!desktopCollapsed)}
            title={desktopCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {desktopCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>

          <span className="sidebar-brand">QLA Admin</span>

          {/* Close button for mobile drawer */}
          <button
            type="button"
            className="sidebar-close-btn mobile-only"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation menu"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.filter((item) => !item.adminOnly || user.role === "ADMIN").map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}
              title={desktopCollapsed ? item.label : undefined}
              onClick={() => setMobileOpen(false)}
            >
              <span className="sidebar-icon">
                <item.Icon size={18} />
              </span>
              <span className="sidebar-label">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-user">
            <span className="sidebar-user-name">{user.display_name}</span>
            <span className="sidebar-user-role">{user.role}</span>
          </div>

          <button
            type="button"
            className="sidebar-logout"
            onClick={handleLogout}
            title={desktopCollapsed ? "Log out" : undefined}
          >
            <span className="sidebar-icon">
              <LogOut size={18} />
            </span>
            <span className="sidebar-logout-text">Log out</span>
          </button>
        </div>
      </aside>
    </>
  );
}