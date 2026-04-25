import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { AuthProvider, AuthContext } from "./context/AuthContext";
import { useContext, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Resume from "./pages/Resume";
import Jobs from "./pages/Jobs";
import Layout from "./layouts/Layout";
import { Toaster } from "react-hot-toast";
import api from "./services/api";

const ProtectedRoute = () => {
  const { token, loading } = useContext(AuthContext);
  if (loading) return <div>Loading...</div>;
  return token ? <Outlet /> : <Navigate to="/login" replace />;
};

const ResumeGate = () => {
  const location = useLocation();
  const [checking, setChecking] = useState(true);
  const [hasResume, setHasResume] = useState(false);

  useEffect(() => {
    const checkResume = async () => {
      try {
        const { data } = await api.get('/resumes');
        setHasResume(Array.isArray(data) && data.length > 0);
      } catch {
        setHasResume(false);
      } finally {
        setChecking(false);
      }
    };

    checkResume();
  }, []);

  if (checking) return <div>Checking profile...</div>;

  if (!hasResume && location.pathname !== '/resume') {
    return <Navigate to="/resume" replace state={{ onboarding: true }} />;
  }

  return <Outlet />;
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<Layout />}>
              <Route path="resume" element={<Resume />} />

              <Route element={<ResumeGate />}>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="jobs" element={<Jobs />} />
              </Route>
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
export default App;
