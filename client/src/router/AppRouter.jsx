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
import WritingWorkspace from "../pages/WritingWorkspace";
import ProtectedRoute from "../components/ProtectedRoute";

const AppRouter = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/change-password" element={<ChangePassword />} />
        <Route
          path="/student/dashboard"
          element={
            <ProtectedRoute allowedRoles={["student"]}>
              <StudentDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/my-reports"
          element={
            <ProtectedRoute allowedRoles={["student"]}>
              <MyReports />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ai-analysis"
          element={
            <ProtectedRoute allowedRoles={["student", "academic_supervisor", "professional_supervisor"]}>
              <AIFeedback />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ai-analysis/:id"
          element={
            <ProtectedRoute allowedRoles={["student", "academic_supervisor", "professional_supervisor"]}>
              <AIFeedback />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ai-feedback"
          element={
            <ProtectedRoute allowedRoles={["student", "academic_supervisor", "professional_supervisor"]}>
              <AIFeedback />
            </ProtectedRoute>
          }
        />
        <Route
          path="/supervisor"
          element={
            <ProtectedRoute allowedRoles={["academic_supervisor"]}>
              <SupervisorDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/supervisors"
          element={
            <ProtectedRoute allowedRoles={["academic_supervisor"]}>
              <SupervisorDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={["admin"]}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute allowedRoles={["student", "academic_supervisor", "professional_supervisor", "admin"]}>
              <Settings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/workspace"
          element={
            <ProtectedRoute allowedRoles={["student", "academic_supervisor", "professional_supervisor"]}>
              <WritingWorkspace />
            </ProtectedRoute>
          }
        />
        <Route
          path="/workspace/:id"
          element={
            <ProtectedRoute allowedRoles={["student", "academic_supervisor", "professional_supervisor"]}>
              <WritingWorkspace />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default AppRouter;

