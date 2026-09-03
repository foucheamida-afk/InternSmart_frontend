import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  User,
  Lock,
  Bell,
  Shield,
  ChevronDown,
  ChevronUp,
  Menu,
  X,
  LogOut,
  Mail,
  Phone,
  MapPin,
  Calendar,
} from 'lucide-react'
import Sidebar from '../components/Sidebar'
import ThemeToggle from '../components/ThemeToggle'
import '../assets/css/dashboard.css'

const Settings = () => {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const [expandedSection, setExpandedSection] = useState('profile')
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
      } catch (error) {
        console.error('FETCH STUDENT ERROR:', error)
        setError('Unable to connect to the server.')
      } finally {
        setLoading(false)
      }
    }

    fetchStudentProfile()
  }, [navigate])

  const toggleSection = (section) => {
    setExpandedSection(expandedSection === section ? null : section)
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
                <ChevronDown size={16} />
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
              <h1 className="greeting-title">Settings</h1>
              <p className="greeting-subtitle">Manage your account settings and preferences</p>
            </div>
          </section>

          <div className="space-y-6">
            {/* Profile Settings */}
            <div className="card">
              <button
                onClick={() => toggleSection('profile')}
                className="w-full flex items-center justify-between p-6 cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#F5A623]/20 flex items-center justify-center">
                    <User className="h-5 w-5 text-[#F5A623]" />
                  </div>
                  <div className="text-left">
                    <h3 className="text-base font-semibold" style={{ color: 'var(--text)' }}>Profile Information</h3>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Update your personal details</p>
                  </div>
                </div>
                {expandedSection === 'profile' ? <ChevronUp className="h-5 w-5 text-slate-400" /> : <ChevronDown className="h-5 w-5 text-slate-400" />}
              </button>

              {expandedSection === 'profile' && (
                <div className="px-6 pb-6 pt-0 border-t border-white/10">
                    <div className="space-y-4 mt-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>Full Name</label>
                          <div className="text-sm" style={{ color: 'var(--text-soft)' }}>{user.student.name}</div>
                        </div>
                        <div>
                          <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>Email</label>
                          <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-soft)' }}>
                            <Mail className="h-4 w-4 text-[#F5A623]" />
                            {user.student.email}
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>Matricule</label>
                          <div className="text-sm" style={{ color: 'var(--text-soft)' }}>{user.student.matricule}</div>
                        </div>
                        <div>
                          <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>Class</label>
                          <div className="text-sm" style={{ color: 'var(--text-soft)' }}>{user.student.class}</div>
                        </div>
                      </div>
                    </div>
                </div>
              )}
            </div>

            {/* Security Settings */}
            <div className="card">
              <button
                onClick={() => toggleSection('security')}
                className="w-full flex items-center justify-between p-6 cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#F5A623]/20 flex items-center justify-center">
                    <Lock className="h-5 w-5 text-[#F5A623]" />
                  </div>
                  <div className="text-left">
                    <h3 className="text-base font-semibold" style={{ color: 'var(--text)' }}>Security</h3>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Password and authentication</p>
                  </div>
                </div>
                {expandedSection === 'security' ? <ChevronUp className="h-5 w-5 text-slate-400" /> : <ChevronDown className="h-5 w-5 text-slate-400" />}
              </button>

              {expandedSection === 'security' && (
                <div className="px-6 pb-6 pt-0 border-t border-white/10">
                  <div className="space-y-4 mt-4">
                    <button
                      onClick={() => navigate('/change-password')}
                      className="w-full rounded-xl bg-[#ee9403] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#d68302] flex items-center justify-center gap-2 shadow-[0_10px_25px_rgba(238,148,3,0.3)]"
                    >
                      <Lock className="h-4 w-4" />
                      Change Password
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Notification Settings */}
            <div className="card">
              <button
                onClick={() => toggleSection('notifications')}
                className="w-full flex items-center justify-between p-6 cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#F5A623]/20 flex items-center justify-center">
                    <Bell className="h-5 w-5 text-[#F5A623]" />
                  </div>
                  <div className="text-left">
                    <h3 className="text-base font-semibold" style={{ color: 'var(--text)' }}>Notifications</h3>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Manage your notification preferences</p>
                  </div>
                </div>
                {expandedSection === 'notifications' ? <ChevronUp className="h-5 w-5 text-slate-400" /> : <ChevronDown className="h-5 w-5 text-slate-400" />}
              </button>

              {expandedSection === 'notifications' && (
                <div className="px-6 pb-6 pt-0 border-t border-white/10">
                  <div className="space-y-4 mt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm" style={{ color: 'var(--text-soft)' }}>Email Notifications</p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Receive updates via email</p>
                      </div>
                      <div className="w-12 h-6 rounded-full bg-[#F5A623] relative cursor-pointer">
                        <div className="absolute right-1 top-1 w-4 h-4 rounded-full bg-white" />
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm" style={{ color: 'var(--text-soft)' }}>Report Reminders</p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Get reminded about deadlines</p>
                      </div>
                      <div className="w-12 h-6 rounded-full bg-[#F5A623] relative cursor-pointer">
                        <div className="absolute right-1 top-1 w-4 h-4 rounded-full bg-white" />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* About */}
            <div className="card">
              <button
                onClick={() => toggleSection('about')}
                className="w-full flex items-center justify-between p-6 cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#F5A623]/20 flex items-center justify-center">
                    <Shield className="h-5 w-5 text-[#F5A623]" />
                  </div>
                  <div className="text-left">
                    <h3 className="text-base font-semibold" style={{ color: 'var(--text)' }}>About</h3>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>App information and version</p>
                  </div>
                </div>
                {expandedSection === 'about' ? <ChevronUp className="h-5 w-5 text-slate-400" /> : <ChevronDown className="h-5 w-5 text-slate-400" />}
              </button>

              {expandedSection === 'about' && (
                <div className="px-6 pb-6 pt-0 border-t border-white/10">
                  <div className="space-y-4 mt-4">
                    <div>
                      <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>App Name</p>
                      <p className="text-sm" style={{ color: 'var(--text-soft)' }}>InternSmart</p>
                    </div>
                    <div>
                      <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Version</p>
                      <p className="text-sm" style={{ color: 'var(--text-soft)' }}>1.0.0</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
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

export default Settings
