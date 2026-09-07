import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Topbar from "./components/Topbar";
import Login from "./pages/Login";
import ReviewQueue from "./pages/ReviewQueue";
import CasesList from "./pages/CasesList";
import CaseDetail from "./pages/CaseDetail";
import QuotationDetail from "./pages/QuotationDetail";
import UsersManagement from "./pages/UsersManagement";

function RequireAuth({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function Layout({ children }) {
  return (
    <>
      <Topbar />
      {children}
    </>
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
        path="/cases/:caseId/quotation"
        element={
          <RequireAuth>
            <Layout><QuotationDetail /></Layout>
          </RequireAuth>
        }
      />
      <Route
        path="/users"
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
