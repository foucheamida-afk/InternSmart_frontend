import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import LandingPage from './pages/LangingPage'
import Login from './pages/Login'
import StudentDashboard from './pages/StudentDashboard'
import MyReports from './pages/MyReports'
import AIFeedback from './pages/AIFeedback'
import SupervisorDashboard from './pages/SupervisorDashboard'
import ProfessionalSupervisorDashboard from './pages/ProfessionalSupervisorDashboard'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminOverview from './pages/admin/AdminOverview'
import AdminUsers from './pages/admin/AdminUsers'
import AdminStudents from './pages/admin/AdminStudents'
import AdminSupervisors from './pages/admin/AdminSupervisors'
import AdminInternships from './pages/admin/AdminInternships'
import AdminTimeline from './pages/admin/AdminTimeline'
import AdminReports from './pages/admin/AdminReports'
import AdminAIAnalysis from './pages/admin/AdminAIAnalysis'
import AdminMeetings from './pages/admin/AdminMeetings'
import AdminDefenseAlerts from './pages/admin/AdminDefenseAlerts'
import AdminNotifications from './pages/admin/AdminNotifications'
import AdminSettings from './pages/admin/AdminSettings'
import MySupervisors from './pages/MySupervisors'
import Settings from './pages/Settings'
import ChangePassword from './pages/ChangePassword'
import ForgotPassword from './pages/ForgotPassword'
import WritingWorkspace from './pages/WritingWorkspace'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/student/dashboard" element={<StudentDashboard />} />
        <Route path="/my-reports" element={<MyReports />} />
        <Route path="/writing-workspace" element={<WritingWorkspace />} />
        <Route path="/ai-analysis" element={<AIFeedback />} />
        <Route path="/ai-analysis/:id" element={<AIFeedback />} />
        <Route path="/ai-feedback" element={<AIFeedback />} />
        <Route path="/supervisor" element={<SupervisorDashboard />} />
        <Route path="/professional-supervisor" element={<ProfessionalSupervisorDashboard />} />
        <Route path="/supervisors" element={<MySupervisors />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/change-password" element={<ChangePassword />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        
        {/* Admin Routes */}
        <Route path="/admin" element={
          <ProtectedRoute>
            <AdminDashboard />
          </ProtectedRoute>
        }>
          <Route index element={<AdminOverview />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="students" element={<AdminStudents />} />
          <Route path="supervisors" element={<AdminSupervisors />} />
          <Route path="internships" element={<AdminInternships />} />
          <Route path="timeline" element={<AdminTimeline />} />
          <Route path="reports" element={<AdminReports />} />
          <Route path="ai-analysis" element={<AdminAIAnalysis />} />
          <Route path="meetings" element={<AdminMeetings />} />
          <Route path="defense-alerts" element={<AdminDefenseAlerts />} />
          <Route path="notifications" element={<AdminNotifications />} />
          <Route path="settings" element={<AdminSettings />} />
          <Route path="dashboard" element={<AdminOverview />} />
        </Route>
        
        {/* Fallback route */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
