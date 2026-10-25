import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import "@/App.css";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import Landing from "@/pages/Landing";
import Auth from "@/pages/Auth";
import Dashboard from "@/pages/Dashboard";
import NewReport from "@/pages/NewReport";
import ReportDetail from "@/pages/ReportDetail";

const Protected = ({ children }) => {
  const { user, checking } = useAuth();
  if (checking)
    return (
      <div className="min-h-screen grid place-items-center bg-canvas">
        <p className="text-sm text-ink-muted">Checking your session…</p>
      </div>
    );
  return user ? children : <Navigate to="/auth" replace />;
};

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster position="top-center" richColors />
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/auth" element={<Auth />} />
          <Route
            path="/dashboard"
            element={
              <Protected>
                <Dashboard />
              </Protected>
            }
          />
          <Route
            path="/report"
            element={
              <Protected>
                <NewReport />
              </Protected>
            }
          />
          <Route
            path="/reports/:id"
            element={
              <Protected>
                <ReportDetail />
              </Protected>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
