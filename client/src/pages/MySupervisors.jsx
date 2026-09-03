import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  X,
  Mail,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Bell,
  LogOut,
  ChevronDown as ChevronDownIcon,
  User,
  Menu,
} from 'lucide-react'
import Sidebar from '../components/Sidebar'
import ThemeToggle from '../components/ThemeToggle'
import '../assets/css/dashboard.css'

const MySupervisors = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedSupervisor, setExpandedSupervisor] = useState(() => {
    const params = new URLSearchParams(location.search)
    return params.get('tab') === 'professional' ? 'professional' : null
  })
  const [feedbackList, setFeedbackList] = useState([])
  const [academicFeedback, setAcademicFeedback] = useState([])
  const [professionalFeedback, setProfessionalFeedback] = useState([])
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const [showProfileOverview, setShowProfileOverview] = useState(false)

  useEffect(() => {
    const fetchStudentProfile = async () => {
      try {
        const token = localStorage.getItem('token')

        if (!token) {
          navigate('/login')
          return
        }

        const response = await fetch('http://localhost:3000/api/students/me', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        })

        const data = await response.json()

        if (!response.ok) {
          console.error('STUDENT PROFILE ERROR:', data)

          if (response.status === 401) {
            localStorage.removeItem('token')
            localStorage.removeItem('user')
            navigate('/login')
            return
          }

          setError(data.message || 'Unable to load student information')
          return
        }

        setUser(data)

        try {
          const fbRes = await fetch('http://localhost:3000/api/students/my-supervisor-feedback', {
            method: 'GET',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          })
          if (fbRes.ok) {
            const fbData = await fbRes.json()
            setAcademicFeedback(fbData.academicFeedback || [])
            setProfessionalFeedback(fbData.professionalFeedback || [])
          }
        } catch (fbError) {
          console.error('FETCH SUPERVISOR FEEDBACK ERROR:', fbError)
        }
      } catch (error) {
        console.error('FETCH STUDENT ERROR:', error)
        setError('Unable to connect to the server.')
      } finally {
        setLoading(false)
      }
    }

    fetchStudentProfile()
  }, [navigate])

  const toggleFeedback = (supervisorType) => {
    setExpandedSupervisor(expandedSupervisor === supervisorType ? null : supervisorType)
  }

  const handleSignOut = () => {
    localStorage.removeItem('user')
    localStorage.removeItem('token')
    navigate('/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg)' }}>
        <div className="text-center">
          <div className="h-8 w-8 mx-auto animate-spin rounded-full border-4 border-[#F5A623] border-t-transparent" />
          <p className="mt-3 text-sm" style={{ color: 'var(--text-muted)' }}>Loading...</p>
        </div>
      </div>
    )
  }

  if (error || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg)' }}>
        <div className="text-center">
          <p style={{ color: '#ef4444' }}>{error || 'Unable to load your profile'}</p>
          <button
            onClick={() => navigate('/student/dashboard')}
            className="mt-4 rounded-lg bg-[#ee9403] px-4 py-2 text-white"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard-wrapper">
      <Sidebar isOpen={isSidebarOpen} onToggle={() => setIsSidebarOpen(!isSidebarOpen)} />

      <div className="dashboard-main">
        <header className="dashboard-header">
          <div className="header-left">
            <button className="mobile-menu-btn" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
              {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            <div className="program-info">
              <span>{user.student.class}</span>
              <span className="separator">•</span>
              <span>{user.student.matricule}</span>
            </div>
          </div>

          <div className="header-right">
            <ThemeToggle />

            <div className="relative">
              <div
                className="user-menu cursor-pointer"
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              >
                <div className="user-avatar">
                  <div className="avatar-placeholder">
                    {user.student.name?.charAt(0)}
                  </div>
                </div>
                <div className="user-info">
                  <div className="user-name">{user.student.name}</div>
                  <div className="user-role">{user.student.role}</div>
                </div>
                <ChevronDownIcon size={16} />
              </div>

              {isUserMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 rounded-xl border p-2 shadow-2xl z-50 text-xs" style={{
                  backgroundColor: 'var(--bg-panel)',
                  borderColor: 'var(--line)',
                  color: 'var(--text)'
                }}>
                  <button
                    onClick={() => {
                      setShowProfileOverview(true)
                      setIsUserMenuOpen(false)
                    }}
                    className="w-full flex items-center gap-2 p-2 rounded hover:bg-white/10 text-left cursor-pointer"
                    style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
                  >
                    <User size={14} /> Profile Overview
                  </button>
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-2 p-2 rounded text-left cursor-pointer mt-1"
                    style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444' }}
                  >
                    <LogOut size={14} /> Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="dashboard-content">
          <section className="dashboard-header-section">
            <div className="greeting-area">
              <h1 className="greeting-title">My Supervisors</h1>
              <p className="greeting-subtitle">View your assigned supervisors and their feedback</p>
            </div>
          </section>

          <div className="space-y-6">
            {!user.internship ? (
              <div className="card">
                <p style={{ color: 'var(--text-muted)' }}>No supervisors assigned yet.</p>
              </div>
            ) : (
              <>
                 {user.internship.academicSupervisor && (
                   <div className="card">
                     <div className="card-header">
                       <h3 className="card-title">Academic Supervisor</h3>
                     </div>

                     <div className="space-y-3 mb-4">
                       <div className="flex items-center gap-2 text-sm">
                         <Mail className="h-4 w-4 text-[#F5A623]" />
                         <span>{user.internship.academicSupervisor.email}</span>
                       </div>
                     </div>

                     <button
                       onClick={() => toggleFeedback('academic')}
                       className="w-full rounded-xl bg-[#ee9403] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#d68302] flex items-center justify-center gap-2 shadow-[0_10px_25px_rgba(238,148,3,0.3)]"
                     >
                       <MessageSquare className="h-4 w-4" />
                       {expandedSupervisor === 'academic' ? 'Hide Feedback' : 'View Feedback'}
                       {expandedSupervisor === 'academic' ? (
                         <ChevronUp className="h-4 w-4" />
                       ) : (
                         <ChevronDown className="h-4 w-4" />
                       )}
                     </button>

                      {expandedSupervisor === 'academic' && (
                        <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
                          {academicFeedback.length === 0 ? (
                            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                              No feedback available yet. Check back later for updates from your academic supervisor.
                            </p>
                          ) : (
                            academicFeedback.map((fb, index) => (
                              <div key={index} className="rounded-lg border border-white/10 p-3" style={{ backgroundColor: 'rgba(255,255,255,0.03)' }}>
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-xs font-semibold" style={{ color: 'var(--orange-3)' }}>{fb.supervisorName}</span>
                                  {fb.givenAt && (
                                    <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{new Date(fb.givenAt).toLocaleDateString()}</span>
                                  )}
                                </div>
                                {fb.taskTitle && (
                                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>Re: {fb.taskTitle}</p>
                                )}
                                <p className="text-sm mt-1" style={{ color: 'var(--text-soft)' }}>{fb.feedback}</p>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                   </div>
                 )}

                  {user.internship.professionalSupervisor && (
                    <div className="card">
                      <div className="card-header">
                        <h3 className="card-title">Professional Supervisor</h3>
                      </div>

                      <div className="space-y-3 mb-4">
                        <div className="flex items-center gap-2 text-sm">
                          <Mail className="h-4 w-4 text-emerald-500" />
                          <span>{user.internship.professionalSupervisor.email}</span>
                        </div>
                        {user.internship.company && (
                          <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                            <span>🏢 {user.internship.company}</span>
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => toggleFeedback('professional')}
                        className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 flex items-center justify-center gap-2 shadow-[0_10px_25px_rgba(16,185,129,0.3)]"
                      >
                        <MessageSquare className="h-4 w-4" />
                        {expandedSupervisor === 'professional' ? 'Hide Feedback' : 'View Feedback'}
                        {expandedSupervisor === 'professional' ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </button>

                       {expandedSupervisor === 'professional' && (
                         <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
                           {professionalFeedback.length === 0 ? (
                             <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                               No feedback available yet. Check back later for updates from your professional supervisor.
                             </p>
                           ) : (
                             professionalFeedback.map((fb, index) => (
                               <div key={index} className="rounded-lg border border-white/10 p-3" style={{ backgroundColor: 'rgba(255,255,255,0.03)' }}>
                                 <div className="flex items-center justify-between gap-2">
                                   <span className="text-xs font-semibold text-emerald-400">{fb.supervisorName}</span>
                                   {fb.givenAt && (
                                     <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{new Date(fb.givenAt).toLocaleDateString()}</span>
                                   )}
                                 </div>
                                 {fb.taskTitle && (
                                   <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>Re: {fb.taskTitle}</p>
                                 )}
                                 <p className="text-sm mt-1" style={{ color: 'var(--text-soft)' }}>{fb.feedback}</p>
                               </div>
                             ))
                           )}
                         </div>
                       )}
                    </div>
                  )}
              </>
            )}
          </div>
        </main>
      </div>

      {/* Profile Overview Modal */}
      {showProfileOverview && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 pt-24">
          <div className="rounded-2xl border p-8 shadow-[0_20px_50px_rgba(0,0,0,0.06)] w-full max-w-md" style={{
            backgroundColor: 'var(--bg-panel)',
            borderColor: 'var(--line)',
            color: 'var(--text)'
          }}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">Profile Overview</h2>
              <button
                onClick={() => setShowProfileOverview(false)}
                className="transition"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={(e) => e.target.style.color = 'var(--text)'}
                onMouseLeave={(e) => e.target.style.color = 'var(--text-muted)'}
              >
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Name</p>
                <p className="text-base font-semibold">{user?.student?.name}</p>
              </div>
              <div>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Email</p>
                <p className="text-base font-semibold">{user?.student?.email}</p>
              </div>
              <div>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Matricule</p>
                <p className="text-base font-semibold">{user?.student?.matricule}</p>
              </div>
              <div>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Class</p>
                <p className="text-base font-semibold">{user?.student?.class}</p>
              </div>
              {user?.internship && (
                <>
                  <div>
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Company</p>
                    <p className="text-base font-semibold">{user.internship.company}</p>
                  </div>
                  <div>
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Academic Supervisor</p>
                    <p className="text-base font-semibold">
                      {user.internship.academicSupervisor?.name || 'Not assigned'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Professional Supervisor</p>
                    <p className="text-base font-semibold">
                      {user.internship.professionalSupervisor?.name || 'Not assigned'}
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default MySupervisors
