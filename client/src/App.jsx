import React, { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'

// Eager: the landing page and the sign-in screen are the first thing anybody
// sees, so splitting them would add a round trip to the one interaction that
// must feel instant.
import LandingPage from './pages/LangingPage'
import Login from './pages/Login'

// Everything else loads on demand (NFR-PERF-04).
//
// The production bundle was a single ~2 MB chunk, so a student opening their
// dashboard downloaded the whole admin console, the supervisor dashboards and the
// TipTap editor stack before seeing anything. Route-level splitting means each
// role fetches only the pages it can actually reach. Roles are enforced by
// ProtectedRoute, so this is a loading concern, not a security boundary.
// Helper for safe lazy loading with retry on connection error / server restart
const safeLazy = (importFn) =>
  lazy(async () => {
    try {
      const module = await importFn()
      sessionStorage.removeItem('retry-lazy-reload')
      return module
    } catch (error) {
      console.error('Dynamic import error:', error)
      const reloaded = sessionStorage.getItem('retry-lazy-reload')
      if (!reloaded) {
        sessionStorage.setItem('retry-lazy-reload', 'true')
        window.location.reload()
        return new Promise((resolve, reject) => {
          setTimeout(() => {
            importFn().then(resolve).catch(reject)
          }, 1000)
        })
      }
      sessionStorage.removeItem('retry-lazy-reload')
      throw error
    }
  })

const StudentDashboard = safeLazy(() => import('./pages/StudentDashboard'))
const MyReports = safeLazy(() => import('./pages/MyReports'))
const AIFeedback = safeLazy(() => import('./pages/AIFeedback'))
const SupervisorDashboard = safeLazy(() => import('./pages/SupervisorDashboard'))
const SupervisorReviews = safeLazy(() => import('./pages/SupervisorReviews'))
const ReportLibrary = safeLazy(() => import('./pages/ReportLibrary'))
const ReportAnalysis = safeLazy(() => import('./pages/ReportAnalysis'))
const ProfessionalSupervisorDashboard = safeLazy(() => import('./pages/ProfessionalSupervisorDashboard'))
const AdminDashboard = safeLazy(() => import('./pages/admin/AdminDashboard'))
const AdminOverview = safeLazy(() => import('./pages/admin/AdminOverview'))
const AdminUsers = safeLazy(() => import('./pages/admin/AdminUsers'))
const AdminStudents = safeLazy(() => import('./pages/admin/AdminStudents'))
const AdminSupervisors = safeLazy(() => import('./pages/admin/AdminSupervisors'))
const AdminInternships = safeLazy(() => import('./pages/admin/AdminInternships'))
const AdminTimeline = safeLazy(() => import('./pages/admin/AdminTimeline'))
const AdminReports = safeLazy(() => import('./pages/admin/AdminReports'))
const AdminAIAnalysis = safeLazy(() => import('./pages/admin/AdminAIAnalysis'))
const AdminMeetings = safeLazy(() => import('./pages/admin/AdminMeetings'))
const AdminDefenseAlerts = safeLazy(() => import('./pages/admin/AdminDefenseAlerts'))
const AdminNotifications = safeLazy(() => import('./pages/admin/AdminNotifications'))
const AdminSettings = safeLazy(() => import('./pages/admin/AdminSettings'))
const MySupervisors = safeLazy(() => import('./pages/MySupervisors'))
const Settings = safeLazy(() => import('./pages/Settings'))
const ChangePassword = safeLazy(() => import('./pages/ChangePassword'))
const ForgotPassword = safeLazy(() => import('./pages/ForgotPassword'))
const Onboarding = safeLazy(() => import('./pages/Onboarding'))
const WritingWorkspace = safeLazy(() => import('./pages/WritingWorkspace'))
const PdfWorkspace = safeLazy(() => import('./pages/PdfWorkspace'))

// Shown while a route's chunk is fetched. Deliberately neutral rather than a
// skeleton: the alternative is a flash of a layout the incoming page may not use.
const RouteFallback = () => (
  <div
    className="min-h-screen flex items-center justify-center"
    style={{ backgroundColor: 'var(--bg)', color: 'var(--text-muted)' }}
  >
    <div className="text-center">
      <div className="h-8 w-8 mx-auto animate-spin rounded-full border-4 border-[#F5A623] border-t-transparent" />
      <p className="mt-3 text-sm">Loading…</p>
    </div>
  </div>
)

function App() {
  return (
    <BrowserRouter>
      {/* One Suspense boundary for the whole route table: a lazy route suspends
          until its chunk arrives, and the fallback covers that gap. */}
      <Suspense fallback={<RouteFallback />}>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />

        {/* Student Only Routes */}
        <Route path="/student/dashboard" element={
          <ProtectedRoute allowedRoles={['student']}>
            <StudentDashboard />
          </ProtectedRoute>
        } />
        <Route path="/my-reports" element={
          <ProtectedRoute allowedRoles={['student']}>
            <MyReports />
          </ProtectedRoute>
        } />
        <Route path="/ai-analysis" element={
          <ProtectedRoute allowedRoles={['student']}>
            <AIFeedback />
          </ProtectedRoute>
        } />
        <Route path="/ai-analysis/:id" element={
          <ProtectedRoute allowedRoles={['student']}>
            <AIFeedback />
          </ProtectedRoute>
        } />
        <Route path="/ai-feedback" element={
          <ProtectedRoute allowedRoles={['student']}>
            <AIFeedback />
          </ProtectedRoute>
        } />
        <Route path="/supervisors" element={
          <ProtectedRoute allowedRoles={['student']}>
            <MySupervisors />
          </ProtectedRoute>
        } />

        {/* Workspace Route (Student editing, Supervisor/Admin view) */}
        <Route path="/writing-workspace" element={
          <ProtectedRoute allowedRoles={['student', 'academic_supervisor', 'professional_supervisor', 'admin']}>
            <WritingWorkspace />
          </ProtectedRoute>
        } />
        <Route path="/workspace" element={
          <ProtectedRoute allowedRoles={['student', 'academic_supervisor', 'professional_supervisor', 'admin']}>
            <WritingWorkspace />
          </ProtectedRoute>
        } />
        <Route path="/workspace/:id" element={
          <ProtectedRoute allowedRoles={['student', 'academic_supervisor', 'professional_supervisor', 'admin']}>
            <WritingWorkspace />
          </ProtectedRoute>
        } />

        {/* PDF workspace: the same collaboration model as the writing workspace,
            for reports that are PDFs. Its document is the file itself - the
            structure is read out of the PDF and every save writes the
            regenerated PDF back over it - so a PDF report never becomes stored
            editor content. */}
        <Route path="/pdf-workspace" element={
          <ProtectedRoute allowedRoles={['student', 'academic_supervisor', 'professional_supervisor', 'admin']}>
            <PdfWorkspace />
          </ProtectedRoute>
        } />
        <Route path="/pdf-workspace/:id" element={
          <ProtectedRoute allowedRoles={['student', 'academic_supervisor', 'professional_supervisor', 'admin']}>
            <PdfWorkspace />
          </ProtectedRoute>
        } />

        {/* Academic Supervisor Route */}
        <Route path="/supervisor" element={
          <ProtectedRoute allowedRoles={['academic_supervisor']}>
            <SupervisorDashboard />
          </ProtectedRoute>
        } />

        {/* Professional Supervisor Route */}
        <Route path="/professional-supervisor" element={
          <ProtectedRoute allowedRoles={['professional_supervisor']}>
            <ProfessionalSupervisorDashboard />
          </ProtectedRoute>
        } />

        {/* Shared report-review queue for BOTH supervisor capacities (§4.12).
            The review row decides the capacity, not the account's role, so one
            page serves both. */}
        <Route path="/reviews" element={
          <ProtectedRoute allowedRoles={['academic_supervisor', 'professional_supervisor']}>
            <SupervisorReviews />
          </ProtectedRoute>
        } />

        {/* Virtual library (§4.12 phase 3). Every role may browse it; the server
            returns a different slice to each and withholds the full document
            from anyone not entitled to read it. */}
        <Route path="/library" element={
          <ProtectedRoute allowedRoles={['student', 'academic_supervisor', 'professional_supervisor', 'admin']}>
            <ReportLibrary />
          </ProtectedRoute>
        } />

        {/* Report integrity: score, band, matched sources, exclusions, history
            (§4.12 phases 4-6). Reachable by whoever may already read the report. */}
        <Route path="/plagiarism/:reportId" element={
          <ProtectedRoute allowedRoles={['student', 'academic_supervisor', 'professional_supervisor', 'admin']}>
            <ReportAnalysis />
          </ProtectedRoute>
        } />

        {/* Account Settings Routes */}
        <Route path="/settings" element={
          <ProtectedRoute allowedRoles={['student', 'academic_supervisor', 'professional_supervisor', 'admin']}>
            <Settings />
          </ProtectedRoute>
        } />
        <Route path="/change-password" element={
          <ProtectedRoute allowedRoles={['student', 'academic_supervisor', 'professional_supervisor', 'admin']}>
            <ChangePassword />
          </ProtectedRoute>
        } />

        {/* Profile onboarding gate for supervisor accounts created on demand.
            ProtectedRoute redirects here whenever `requiresOnboarding` is set. */}
        <Route path="/onboarding" element={
          <ProtectedRoute allowedRoles={['academic_supervisor', 'professional_supervisor']}>
            <Onboarding />
          </ProtectedRoute>
        } />
        
        {/* Admin Routes (Strictly Admin Only) */}
        <Route path="/admin" element={
          <ProtectedRoute allowedRoles={['admin']}>
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
      </Suspense>
    </BrowserRouter>
  )
}

export default App
