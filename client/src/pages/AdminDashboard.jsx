import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Shield,
  Users,
  UserPlus,
  FileText,
  BarChart3,
  CheckCircle2,
  AlertCircle,
  Search,
  Filter,
  Plus,
  Trash2,
  Lock,
  Mail,
  Zap,
  Menu,
  X,
  Bell,
  ChevronDown,
  LogOut,
  UserCheck,
  Building,
  CalendarClock,
} from 'lucide-react'
import '../assets/css/dashboard.css'
import '../assets/css/dashboard-components.css'
import '../assets/css/sidebar.css'
import ThemeToggle from '../components/ThemeToggle'
import { adminApi } from '../services/adminService'

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const [isCreateUserModalOpen, setIsCreateUserModalOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')

  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    role: 'Student',
    department: 'Software Engineering',
  })

  const [users, setUsers] = useState([
    { id: 'usr-1', name: 'Anita', email: 'anita.student@internsmart.edu', role: 'Student', department: 'Software Engineering', status: 'Active', created: 'Jan 2025' },
    { id: 'usr-2', name: 'Prof. Marie Dupont', email: 'marie.dupont@internsmart.edu', role: 'Supervisor', department: 'Software Engineering', status: 'Active', created: 'Sep 2024' },
    { id: 'usr-3', name: 'Dr. Rossi', email: 'rossi.mentor@internsmart.edu', role: 'Supervisor', department: 'Computer Science', status: 'Active', created: 'Oct 2024' },
    { id: 'usr-4', name: 'Alex Johnson', email: 'alex.j@internsmart.edu', role: 'Student', department: 'Cloud Computing', status: 'Active', created: 'Feb 2025' },
    { id: 'usr-5', name: 'Sarah Lin', email: 'sarah.lin@internsmart.edu', role: 'Student', department: 'Cybersecurity', status: 'Active', created: 'Feb 2025' },
  ])

  const [timeline, setTimeline] = useState(null)
  const [isTimelineModalOpen, setIsTimelineModalOpen] = useState(false)
  const [timelineForm, setTimelineForm] = useState({ label: '', startDate: '', endDate: '', milestones: [] })
  const [timelineLoading, setTimelineLoading] = useState(false)
  const [timelineError, setTimelineError] = useState('')

  const fetchTimeline = async () => {
    try {
      const data = await adminApi.getTimeline()
      const t = data.timeline || { label: '', startDate: '', endDate: '', milestones: [] }
      setTimeline(t)
    } catch (err) {
      console.error('Fetch timeline error:', err)
    }
  }

  useEffect(() => { fetchTimeline() }, [])

  const openTimelineModal = () => {
    const t = timeline || { label: '', startDate: '', endDate: '', milestones: [] }
    setTimelineForm({
      label: t.label || '',
      startDate: t.startDate ? new Date(t.startDate).toISOString().slice(0, 10) : '',
      endDate: t.endDate ? new Date(t.endDate).toISOString().slice(0, 10) : '',
      milestones: (t.milestones || []).map((m) => ({ title: m.title, date: m.date ? new Date(m.date).toISOString().slice(0, 10) : '' })),
    })
    setTimelineError('')
    setIsTimelineModalOpen(true)
  }

  const addMilestoneRow = () => {
    setTimelineForm((prev) => ({ ...prev, milestones: [...prev.milestones, { title: '', date: '' }] }))
  }

  const updateMilestone = (index, field, value) => {
    setTimelineForm((prev) => ({
      ...prev,
      milestones: prev.milestones.map((m, i) => (i === index ? { ...m, [field]: value } : m)),
    }))
  }

  const removeMilestone = (index) => {
    setTimelineForm((prev) => ({ ...prev, milestones: prev.milestones.filter((_, i) => i !== index) }))
  }

  const handleSaveTimeline = async () => {
    setTimelineLoading(true)
    setTimelineError('')
    try {
      const payload = {
        label: timelineForm.label,
        startDate: timelineForm.startDate || null,
        endDate: timelineForm.endDate || null,
        milestones: timelineForm.milestones.filter((m) => m.title && m.date),
      }
      const data = await adminApi.updateTimeline(payload)
      setTimeline(data.timeline)
      setIsTimelineModalOpen(false)
    } catch (err) {
      setTimelineError(err.response?.data?.message || 'Unable to save timeline')
    } finally {
      setTimelineLoading(false)
    }
  }

  const handleCreateUser = (e) => {
    e.preventDefault()
    if (!newUser.name.trim() || !newUser.email.trim()) return

    const created = {
      id: `usr-${Date.now()}`,
      name: newUser.name.trim(),
      email: newUser.email.trim(),
      role: newUser.role,
      department: newUser.department,
      status: 'Active',
      created: 'Just now',
    }

    setUsers((prev) => [created, ...prev])
    setNewUser({ name: '', email: '', role: 'Student', department: 'Software Engineering' })
    setIsCreateUserModalOpen(false)
  }

  const handleDeleteUser = (id) => {
    setUsers((prev) => prev.filter((u) => u.id !== id))
  }

  const filteredUsers = users.filter((u) => {
    const matchesSearch = u.name.toLowerCase().includes(searchQuery.toLowerCase()) || u.email.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesRole = roleFilter === 'all'
      || (roleFilter === 'supervisor' && (u.role === 'academic_supervisor' || u.role === 'professional_supervisor'))
      || u.role.toLowerCase() === roleFilter.toLowerCase()
    return matchesSearch && matchesRole
  })

  return (
    <div className="dashboard-wrapper">
      {/* Admin Sidebar */}
      <aside className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <button className="sidebar-close" onClick={() => setIsSidebarOpen(false)}>
            <X size={24} />
          </button>
          <div className="sidebar-logo">
            <div className="logo-icon">
              <Zap size={20} />
            </div>
            <div className="flex">
              <img
                  src={logoImg}
                  alt="InternSmart logo"
                  className="flex h-11 w-11 items-center justify-center rounded-2xl shadow-sm transition group-hover:scale-105"
              />
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <button type="button" className="sidebar-nav-item active">
            <Shield size={18} className="nav-icon" />
            <span className="nav-label">System Overview</span>
          </button>
          <button type="button" className="sidebar-nav-item" onClick={() => navigate('/supervisor')}>
            <Users size={18} className="nav-icon" />
            <span className="nav-label">Supervisor Portal</span>
          </button>
          <button type="button" className="sidebar-nav-item" onClick={() => navigate('/student')}>
            <UserCheck size={18} className="nav-icon" />
            <span className="nav-label">Student Portal</span>
          </button>
          <button type="button" className="sidebar-nav-item" onClick={openTimelineModal}>
            <CalendarClock size={18} className="nav-icon" />
            <span className="nav-label">Internship Timeline</span>
          </button>
        </nav>

        <div className="sidebar-ai-card">
          <div className="ai-card-icon">✦</div>
          <div className="ai-card-title">Admin Account Control</div>
          <p className="ai-card-description">Create, assign and manage institutional student credentials.</p>
        </div>
      </aside>

      {/* Main Content */}
      <div className="dashboard-main">
        {/* Top Header */}
        <header className="dashboard-header">
          <div className="header-left">
            <button className="mobile-menu-btn" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
              {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            <div className="program-info">
              <Building size={16} />
              <span>Institutional Administration</span>
              <span className="separator">•</span>
              <span>Global Access</span>
            </div>
          </div>

          <div className="header-right">
            <ThemeToggle />
            
            <button className="notification-btn cursor-pointer">
              <Bell size={20} />
              <span className="notification-badge">5</span>
            </button>

            <div className="header-divider"></div>

            <div className="relative">
              <div
                className="user-menu cursor-pointer"
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              >
                <div className="user-avatar">AD</div>
                <div className="user-info">
                  <div className="user-name">System Administrator</div>
                  <div className="user-role">Administrator</div>
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
                    onClick={() => navigate('/login')}
                    className="w-full flex items-center gap-2 p-2 rounded text-left cursor-pointer"
                    style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444' }}
                  >
                    <LogOut size={14} /> Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Admin Content */}
        <main className="dashboard-content">
          <div className="dashboard-header-section flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="greeting-title">Institution Management</h1>
              <p className="greeting-subtitle">Create user accounts, manage faculty assignments, and track submission metrics.</p>
            </div>

            <button
              onClick={() => setIsCreateUserModalOpen(true)}
              className="px-4 py-2.5 rounded-full bg-gradient-to-r from-[#ff7a00] to-[#ff9d3d] text-white text-xs font-semibold shadow-lg hover:opacity-90 transition cursor-pointer flex items-center gap-2"
            >
              <UserPlus size={16} />
              Create User Account
            </button>
          </div>

          {/* Stats Row */}
          <div className="grid gap-4 md:grid-cols-4 mb-8">
            <div className="stats-card">
              <div className="stats-card-header">
                <span className="stats-card-title">Total Enrolled</span>
                <Users className="stats-card-icon" size={20} />
              </div>
              <div className="stats-card-value">1,248</div>
              <div className="stats-card-change">Students in current cycle</div>
            </div>

            <div className="stats-card">
              <div className="stats-card-header">
                <span className="stats-card-title">Active Supervisors</span>
                <Shield className="stats-card-icon text-orange-400" size={20} />
              </div>
              <div className="stats-card-value">84</div>
              <div className="stats-card-change">Across 6 departments</div>
            </div>

            <div className="stats-card">
              <div className="stats-card-header">
                <span className="stats-card-title">Total Reports</span>
                <FileText className="stats-card-icon text-amber-400" size={20} />
              </div>
              <div className="stats-card-value">3,420</div>
              <div className="stats-card-change">92% AI analyzed</div>
            </div>

            <div className="stats-card">
              <div className="stats-card-header">
                <span className="stats-card-title">Approval Rate</span>
                <CheckCircle2 className="stats-card-icon text-emerald-400" size={20} />
              </div>
              <div className="stats-card-value text-emerald-400">89.4%</div>
              <div className="stats-card-change">+3.2% vs last term</div>
            </div>
          </div>

          {/* Internship Timeline Section */}
          <div className="card mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b pb-4 mb-4" style={{ borderColor: 'var(--line)' }}>
              <div>
                <h3 className="card-title">Internship Timeline</h3>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Configure the internship period and milestones visible to students & supervisors</p>
              </div>
              <button
                onClick={openTimelineModal}
                className="px-4 py-2 rounded-full bg-gradient-to-r from-[#ff7a00] to-[#ff9d3d] text-white text-xs font-semibold shadow-lg hover:opacity-90 transition cursor-pointer flex items-center gap-2"
              >
                <CalendarClock size={16} />
                Configure Timeline
              </button>
            </div>

            {timeline && (timeline.startDate || timeline.endDate || (timeline.milestones && timeline.milestones.length > 0)) ? (
              <div className="space-y-3 text-sm">
                <div className="flex flex-wrap items-center gap-3" style={{ color: 'var(--text-soft)' }}>
                  {timeline.label && <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(255,122,0,0.12)', color: 'var(--orange-3)' }}>{timeline.label}</span>}
                  {timeline.startDate && <span>Start: <strong>{new Date(timeline.startDate).toLocaleDateString()}</strong></span>}
                  {timeline.endDate && <span>End: <strong>{new Date(timeline.endDate).toLocaleDateString()}</strong></span>}
                </div>
                {timeline.milestones && timeline.milestones.length > 0 && (
                  <ul className="list-disc pl-5 space-y-1" style={{ color: 'var(--text-muted)' }}>
                    {timeline.milestones.map((m, i) => (
                      <li key={i}>{m.title} — {m.date ? new Date(m.date).toLocaleDateString() : '—'}</li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No timeline configured yet. Click “Configure Timeline” to set the internship dates and milestones.</p>
            )}
          </div>

          {/* User Management Section */}
          <div className="card">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b pb-4 mb-4" style={{ borderColor: 'var(--line)' }}>
              <div>
                <h3 className="card-title">Managed User Accounts ({filteredUsers.length})</h3>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Accounts provisioned by administrator</p>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2" size={14} style={{ color: 'var(--text-muted)' }} />
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search users..."
                    className="rounded-xl border pl-9 pr-3 py-1.5 text-xs focus:outline-none"
                    style={{
                      backgroundColor: 'var(--bg-panel)',
                      borderColor: 'var(--line)',
                      color: 'var(--text)',
                      placeholderColor: 'var(--text-muted)'
                    }}
                  />
                </div>

                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="rounded-xl border px-3 py-1.5 text-xs focus:outline-none"
                  style={{
                    backgroundColor: 'var(--bg-panel)',
                    borderColor: 'var(--line)',
                    color: 'var(--text)'
                  }}
                >
                  <option value="all">All Roles</option>
                  <option value="student">Student</option>
                  <option value="supervisor">Supervisor</option>
                </select>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs" style={{ color: 'var(--text-soft)' }}>
                <thead>
                  <tr className="border-b text-[11px] uppercase tracking-wider" style={{ borderColor: 'var(--line)', color: 'var(--text-muted)' }}>
                    <th className="pb-3 font-semibold">User</th>
                    <th className="pb-3 font-semibold">Role</th>
                    <th className="pb-3 font-semibold">Department</th>
                    <th className="pb-3 font-semibold">Status</th>
                    <th className="pb-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: 'var(--line)' }}>
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-white/3 transition" style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}>
                      <td className="py-3.5">
                        <div className="font-semibold">{u.name}</div>
                        <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{u.email}</div>
                      </td>
                      <td className="py-3.5">
                        <span
                          className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border"
                          style={{
                            backgroundColor: u.role === 'Student' ? 'rgba(255, 122, 0, 0.15)' : 'rgba(99, 102, 241, 0.15)',
                            color: u.role === 'Student' ? 'var(--orange-3)' : '#a5b4fc',
                            borderColor: u.role === 'Student' ? 'rgba(255, 122, 0, 0.3)' : 'rgba(99, 102, 241, 0.3)'
                          }}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3.5" style={{ color: 'var(--text-soft)' }}>{u.department}</td>
                      <td className="py-3.5">
                        <span className="inline-flex items-center gap-1" style={{ color: '#10b981' }}>
                          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: '#10b981' }}></span>
                          {u.status}
                        </span>
                      </td>
                      <td className="py-3.5 text-right">
                        <button
                          onClick={() => handleDeleteUser(u.id)}
                          className="p-1.5 rounded-lg transition cursor-pointer"
                          style={{ color: 'var(--text-muted)' }}
                          onMouseEnter={(e) => e.target.style.color = '#f87171'}
                          onMouseLeave={(e) => e.target.style.color = 'var(--text-muted)'}
                          title="Delete user account"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Create User Modal */}
          {isCreateUserModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
              <div className="w-full max-w-md rounded-2xl border p-6 shadow-2xl" style={{
                backgroundColor: 'var(--bg-panel)',
                borderColor: 'var(--line)',
                color: 'var(--text)'
              }}>
                <div className="flex items-center justify-between border-b pb-3 mb-4" style={{ borderColor: 'var(--line)' }}>
                  <div>
                    <h3 className="text-base font-bold">Provision New User Account</h3>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Admin creates user credentials</p>
                  </div>
                  <button
                    onClick={() => setIsCreateUserModalOpen(false)}
                    className="rounded-full p-1 transition cursor-pointer"
                    style={{ color: 'var(--text-muted)' }}
                    onMouseEnter={(e) => e.target.style.color = 'var(--text)'}
                    onMouseLeave={(e) => e.target.style.color = 'var(--text-muted)'}
                  >
                    <X size={18} />
                  </button>
                </div>

                <form onSubmit={handleCreateUser} className="space-y-4 text-xs">
                  <div>
                    <label className="block font-semibold mb-1" style={{ color: 'var(--text-soft)' }}>Full Name</label>
                    <input
                      required
                      value={newUser.name}
                      onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                      placeholder="e.g. John Doe"
                      className="w-full rounded-xl border p-2.5 text-xs focus:outline-none"
                      style={{
                        backgroundColor: 'var(--bg-panel)',
                        borderColor: 'var(--line)',
                        color: 'var(--text)',
                        placeholderColor: 'var(--text-muted)'
                      }}
                    />
                  </div>

                  <div>
                    <label className="block font-semibold mb-1" style={{ color: 'var(--text-soft)' }}>Institutional Email</label>
                    <input
                      required
                      type="email"
                      value={newUser.email}
                      onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                      placeholder="e.g. j.doe@internsmart.edu"
                      className="w-full rounded-xl border p-2.5 text-xs focus:outline-none"
                      style={{
                        backgroundColor: 'var(--bg-panel)',
                        borderColor: 'var(--line)',
                        color: 'var(--text)',
                        placeholderColor: 'var(--text-muted)'
                      }}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold mb-1" style={{ color: 'var(--text-soft)' }}>Role</label>
                      <select
                        value={newUser.role}
                        onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                        className="w-full rounded-xl border p-2.5 text-xs focus:outline-none"
                        style={{
                          backgroundColor: 'var(--bg-panel)',
                          borderColor: 'var(--line)',
                          color: 'var(--text)'
                        }}
                      >
                        <option value="Student">Student</option>
                        <option value="Supervisor">Supervisor</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold mb-1" style={{ color: 'var(--text-soft)' }}>Department</label>
                      <select
                        value={newUser.department}
                        onChange={(e) => setNewUser({ ...newUser, department: e.target.value })}
                        className="w-full rounded-xl border p-2.5 text-xs focus:outline-none"
                        style={{
                          backgroundColor: 'var(--bg-panel)',
                          borderColor: 'var(--line)',
                          color: 'var(--text)'
                        }}
                      >
                        <option value="Software Engineering">Software Engineering</option>
                        <option value="Cloud Computing">Cloud Computing</option>
                        <option value="Cybersecurity">Cybersecurity</option>
                        <option value="Data Science">Data Science</option>
                      </select>
                    </div>
                  </div>

                  <div className="pt-3 border-t flex justify-end gap-2" style={{ borderColor: 'var(--line)' }}>
                    <button
                      type="button"
                      onClick={() => setIsCreateUserModalOpen(false)}
                      className="px-4 py-2 rounded-xl transition cursor-pointer"
                      style={{
                        backgroundColor: 'rgba(255,255,255,0.05)',
                        color: 'var(--text)'
                      }}
                      onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(255,255,255,0.1)'}
                      onMouseLeave={(e) => e.target.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-xl font-semibold shadow-lg transition cursor-pointer"
                      style={{
                        backgroundColor: '#f97316',
                        color: 'white'
                      }}
                      onMouseEnter={(e) => e.target.style.backgroundColor = '#ea580c'}
                      onMouseLeave={(e) => e.target.style.backgroundColor = '#f97316'}
                    >
                      Save & Provision Account
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
          {/* Timeline Config Modal */}
          {isTimelineModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
              <div className="w-full max-w-lg rounded-2xl border p-6 shadow-2xl max-h-[90vh] overflow-y-auto" style={{
                backgroundColor: 'var(--bg-panel)',
                borderColor: 'var(--line)',
                color: 'var(--text)'
              }}>
                <div className="flex items-center justify-between border-b pb-3 mb-4" style={{ borderColor: 'var(--line)' }}>
                  <div>
                    <h3 className="text-base font-bold">Configure Internship Timeline</h3>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Visible to all students and supervisors</p>
                  </div>
                  <button
                    onClick={() => setIsTimelineModalOpen(false)}
                    className="rounded-full p-1 transition cursor-pointer"
                    style={{ color: 'var(--text-muted)' }}
                    onMouseEnter={(e) => e.target.style.color = 'var(--text)'}
                    onMouseLeave={(e) => e.target.style.color = 'var(--text-muted)'}
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="space-y-4 text-xs">
                  <div>
                    <label className="block font-semibold mb-1" style={{ color: 'var(--text-soft)' }}>Label (e.g. 2025/2026 Internship)</label>
                    <input
                      value={timelineForm.label}
                      onChange={(e) => setTimelineForm({ ...timelineForm, label: e.target.value })}
                      placeholder="Internship cycle"
                      className="w-full rounded-xl border p-2.5 text-xs focus:outline-none"
                      style={{ backgroundColor: 'var(--bg-panel)', borderColor: 'var(--line)', color: 'var(--text)' }}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold mb-1" style={{ color: 'var(--text-soft)' }}>Start Date</label>
                      <input
                        type="date"
                        value={timelineForm.startDate}
                        onChange={(e) => setTimelineForm({ ...timelineForm, startDate: e.target.value })}
                        className="w-full rounded-xl border p-2.5 text-xs focus:outline-none"
                        style={{ backgroundColor: 'var(--bg-panel)', borderColor: 'var(--line)', color: 'var(--text)' }}
                      />
                    </div>
                    <div>
                      <label className="block font-semibold mb-1" style={{ color: 'var(--text-soft)' }}>End Date</label>
                      <input
                        type="date"
                        value={timelineForm.endDate}
                        onChange={(e) => setTimelineForm({ ...timelineForm, endDate: e.target.value })}
                        className="w-full rounded-xl border p-2.5 text-xs focus:outline-none"
                        style={{ backgroundColor: 'var(--bg-panel)', borderColor: 'var(--line)', color: 'var(--text)' }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block font-semibold" style={{ color: 'var(--text-soft)' }}>Milestones</label>
                      <button
                        type="button"
                        onClick={addMilestoneRow}
                        className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg cursor-pointer"
                        style={{ color: 'var(--orange-3)', backgroundColor: 'rgba(255,122,0,0.1)' }}
                      >
                        <Plus size={12} /> Add
                      </button>
                    </div>
                    <div className="space-y-2">
                      {timelineForm.milestones.map((m, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <input
                            value={m.title}
                            onChange={(e) => updateMilestone(index, 'title', e.target.value)}
                            placeholder="Milestone title"
                            className="flex-1 rounded-lg border p-2 text-xs focus:outline-none"
                            style={{ backgroundColor: 'var(--bg-panel)', borderColor: 'var(--line)', color: 'var(--text)' }}
                          />
                          <input
                            type="date"
                            value={m.date}
                            onChange={(e) => updateMilestone(index, 'date', e.target.value)}
                            className="rounded-lg border p-2 text-xs focus:outline-none"
                            style={{ backgroundColor: 'var(--bg-panel)', borderColor: 'var(--line)', color: 'var(--text)' }}
                          />
                          <button
                            type="button"
                            onClick={() => removeMilestone(index)}
                            className="p-1.5 rounded-lg cursor-pointer"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                      {timelineForm.milestones.length === 0 && (
                        <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>No milestones added.</p>
                      )}
                    </div>
                  </div>

                  {timelineError && (
                    <p className="text-xs" style={{ color: '#ef4444' }}>{timelineError}</p>
                  )}

                  <div className="pt-3 border-t flex justify-end gap-2" style={{ borderColor: 'var(--line)' }}>
                    <button
                      type="button"
                      onClick={() => setIsTimelineModalOpen(false)}
                      className="px-4 py-2 rounded-xl transition cursor-pointer"
                      style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: 'var(--text)' }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveTimeline}
                      disabled={timelineLoading}
                      className="px-4 py-2 rounded-xl font-semibold shadow-lg transition cursor-pointer disabled:opacity-50"
                      style={{ backgroundColor: '#f97316', color: 'white' }}
                    >
                      {timelineLoading ? 'Saving...' : 'Save Timeline'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  )
}
