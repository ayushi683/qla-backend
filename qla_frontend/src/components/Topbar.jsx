import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Topbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
 
  if (!user) return null;

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <header className="topbar">

      <a className="brand" href="/">QLA Admin</a>
      <nav className="topnav">
        <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : "")}>
          Review Queue
        </NavLink>
        <NavLink to="/cases" className={({ isActive }) => (isActive ? "active" : "")}>
          All Cases
        </NavLink>
        {user.role === "ADMIN" && (
          <NavLink to="/users" className={({ isActive }) => (isActive ? "active" : "")}>
            Users
          </NavLink>
        )}
      </nav>
      <div className="topbar-right">
        <span className="user-chip">{user.display_name} · {user.role}</span>
        <button className="logout-btn" onClick={handleLogout}>Log out</button>
      </div>
    </header>
  );
}