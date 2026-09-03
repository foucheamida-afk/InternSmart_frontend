import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LandingPage from "../pages/LangingPage";
import Login from "../pages/Login";
import StudentDashboard from "../pages/StudentDashboard";
import MyReports from "../pages/MyReports";
import AIFeedback from "../pages/AIFeedback";
import SupervisorDashboard from "../pages/SupervisorDashboard";
import AdminDashboard from "../pages/AdminDashboard";
import ChangePassword from "../pages/ChangePassword";
import Settings from "../pages/Settings";

const AppRouter = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/student/dashboard" element={<StudentDashboard />} />
        <Route path="/my-reports" element={<MyReports />} />
        <Route path="/ai-analysis" element={<AIFeedback />} />
        <Route path="/ai-analysis/:id" element={<AIFeedback />} />
        <Route path="/ai-feedback" element={<AIFeedback />} />
        <Route path="/supervisor" element={<SupervisorDashboard />} />
        <Route path="/supervisors" element={<SupervisorDashboard />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/change-password" element={<ChangePassword />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default AppRouter;

