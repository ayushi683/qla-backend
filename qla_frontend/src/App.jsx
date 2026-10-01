import React, { Component } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Sidebar from "./components/Sidebar";
import Login from "./pages/Login";
import ReviewQueue from "./pages/ReviewQueue";
import CasesList from "./pages/CasesList";
import CaseDetail from "./pages/CaseDetail";
import UsersManagement from "./pages/UsersManagement";
import Dashboard from "./pages/Dashboard";
import MasterHub from "./pages/master/MasterHub";
import CatalogManagement from "./pages/master/CatalogManagement";
import AdminSettings from "./pages/master/AdminSettings";
import SuperAdminDashboard from "./pages/SuperAdminDashboard";

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            background: "#f8fafc",
            fontFamily: "var(--font-sans, system-ui, sans-serif)",
            color: "#0f172a",
          }}
        >
          <div
            style={{
              maxWidth: 480,
              width: "100%",
              background: "#ffffff",
              padding: 32,
              borderRadius: 12,
              boxShadow: "0 10px 25px -5px rgba(0,0,0,0.06)",
              border: "1px solid #e2e8f0",
              textAlign: "center",
            }}
          >
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: 8, color: "#991b1b" }}>
              Something went wrong
            </h2>
            <p style={{ fontSize: "0.85rem", color: "#64748b", marginBottom: 20 }}>
              {this.state.error?.message || "An unexpected error occurred while rendering the page."}
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                background: "var(--brand, #16694a)",
                color: "#ffffff",
                border: "none",
                padding: "9px 20px",
                borderRadius: 8,
                fontWeight: 600,
                cursor: "pointer",
                fontSize: "0.85rem",
              }}
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function RequireAuth({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function Layout({ children }) {
  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-content">{children}</main>
    </div>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <Layout><ReviewQueue /></Layout>
          </RequireAuth>
        }
      />
      <Route
        path="/cases"
        element={
          <RequireAuth>
            <Layout><CasesList /></Layout>
          </RequireAuth>
        }
      />
      <Route
        path="/cases/:caseId"
        element={
          <RequireAuth>
            <Layout><CaseDetail /></Layout>
          </RequireAuth>
        }
      />
      <Route
        path="/users"
        element={<Navigate to="/master/users" replace />}
      />
      <Route
        path="/dashboard"
        element={
          <RequireAuth>
            <Layout><Dashboard /></Layout>
          </RequireAuth>
        }
      />

      {/* Master Section Routes */}
      <Route
        path="/super-admin"
        element={
          <RequireAuth>
            <Layout><SuperAdminDashboard /></Layout>
          </RequireAuth>
        }
      />
      <Route
        path="/super-admin/users"
        element={
          <RequireAuth>
            <Layout><UsersManagement /></Layout>
          </RequireAuth>
        }
      />
      <Route
        path="/super-admin/settings"
        element={
          <RequireAuth>
            <Layout><AdminSettings /></Layout>
          </RequireAuth>
        }
      />
      <Route
        path="/master/dashboard"
        element={<Navigate to="/super-admin" replace />}
      />
      <Route
        path="/admin/dashboard"
        element={<Navigate to="/super-admin" replace />}
      />
      <Route
        path="/master"
        element={
          <RequireAuth>
            <Layout><MasterHub /></Layout>
          </RequireAuth>
        }
      />
      <Route
        path="/master/catalog"
        element={
          <RequireAuth>
            <Layout><CatalogManagement /></Layout>
          </RequireAuth>
        }
      />
      <Route
        path="/master/users"
        element={
          <RequireAuth>
            <Layout><UsersManagement /></Layout>
          </RequireAuth>
        }
      />
      <Route
        path="/master/settings"
        element={
          <RequireAuth>
            <Layout><AdminSettings /></Layout>
          </RequireAuth>
        }
      />
      <Route
        path="/admin/settings"
        element={<Navigate to="/master/settings" replace />}
      />
      
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ErrorBoundary>
          <AppRoutes />
        </ErrorBoundary>
      </AuthProvider>
    </BrowserRouter>
  );
}
