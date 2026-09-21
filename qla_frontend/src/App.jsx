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
      
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
