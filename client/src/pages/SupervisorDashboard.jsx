import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users, FileCheck, Calendar, Clock, CheckCircle2, AlertCircle,
  MessageSquare, Search, Bell, LogOut, ChevronDown, Video, Star,
  Zap, Menu, X, FileText, Plus, Trash2, Edit, Save, XCircle,
  Loader2, Lock, Link as LinkIcon, MapPin, ExternalLink, GraduationCap,
} from 'lucide-react'
import logoImg from '@assets/images/logo.png'
import '../assets/css/dashboard.css'
import '../assets/css/dashboard-components.css'
import ThemeToggle from '../components/ThemeToggle'
import { supervisorApi } from '../services/supervisorService'
import api from '../api/axios'
import TimelineCard from '../components/dashboard/TimelineCard'

const getLocalDateTime = () => {
  const now = new Date()
  const timezoneOffset = now.getTimezoneOffset() * 60_000
  return new Date(now.getTime() - timezoneOffset).toISOString().slice(0, 16)
}

const toLocalDateTime = (value) => {
  const date = new Date(value)
  const timezoneOffset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16)
}

const GRADE_CRITERIA = [
  { label: 'Activities & Tasks Done', max: 6 },
  { label: 'Punctuality', max: 4 },
  { label: 'Attendance & Participation', max: 4 },
  { label: 'Report Quality', max: 3 },
  { label: 'Professional Conduct', max: 3 },
]

const InternGradeCard = ({ intern }) => {
  const [breakdown, setBreakdown] = useState(
    GRADE_CRITERIA.map((c) => ({ label: c.label, score: 0, max: c.max }))
  )
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedTotal, setSavedTotal] = useState(null)
  const [savedAt, setSavedAt] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const data = await supervisorApi.getFinalGrade(intern.id)
        if (data.grade?.gradeStatus === 'submitted' && Array.isArray(data.grade.breakdown)) {
          setBreakdown(
            GRADE_CRITERIA.map((c) => {
              const found = data.grade.breakdown.find((b) => b.label === c.label)
              return { label: c.label, score: found ? found.score : 0, max: c.max }
            })
          )
          setSavedTotal(data.grade.finalGrade)
          setSavedAt(data.grade.gradeSubmittedAt)
        }
      } catch (err) {
        console.error('Load grade error:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [intern.id])

  const total = breakdown.reduce((sum, b) => sum + (Number(b.score) || 0), 0)
  const maxTotal = breakdown.reduce((sum, b) => sum + (Number(b.max) || 0), 0)
  const percent = maxTotal ? Math.round((total / maxTotal) * 100) : 0

  const updateScore = (index, value) => {
    const max = breakdown[index].max
    const clamped = Math.max(0, Math.min(max, Number(value) || 0))
    setBreakdown((prev) => prev.map((b, i) => (i === index ? { ...b, score: clamped } : b)))
  }

  const handleSubmit = async () => {
    setSaving(true)
    setError('')
    try {
      const data = await supervisorApi.submitFinalGrade(intern.id, { breakdown })
      setSavedTotal(data.grade.finalGrade)
      setSavedAt(data.grade.gradeSubmittedAt)
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to submit grade')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h3 className="card-title">{intern.name}</h3>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            {intern.matricule} • {intern.class}
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold" style={{ color: 'var(--orange-3)' }}>{total}/{maxTotal}</div>
          <div className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            {percent}% (20% weight)
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {breakdown.map((item, index) => (
          <div key={item.label} className="flex items-center gap-3">
            <div className="flex-1 text-sm" style={{ color: 'var(--text-soft)' }}>{item.label}</div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={item.max}
                value={item.score}
                onChange={(e) => updateScore(index, e.target.value)}
                className="w-16 rounded-lg border px-2 py-1.5 text-sm text-center focus:outline-none"
                style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--line)', color: 'var(--text)' }}
              />
              <span className="text-sm" style={{ color: 'var(--text-muted)' }}>/ {item.max}</span>
            </div>
          </div>
        ))}
      </div>

      {error && (
        <p className="mt-3 text-sm" style={{ color: '#ef4444' }}>{error}</p>
      )}

      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {savedTotal != null ? `Last submitted: ${savedAt ? new Date(savedAt).toLocaleDateString() : ''}` : 'Not yet submitted'}
        </span>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-white transition disabled:opacity-50 cursor-pointer"
          style={{ backgroundColor: '#F5A623' }}
        >
          <GraduationCap size={16} />
          {saving ? 'Submitting...' : savedTotal != null ? 'Update Grade' : 'Submit Final Grade'}
        </button>
      </div>
    </div>
  )
}

const GradingTab = ({ interns }) => {
  if (!interns.length) {
    return (
      <div className="card text-center py-12">
        <GraduationCap size={48} style={{ color: 'var(--text-muted)' }} className="mx-auto" />
        <p className="mt-4 text-sm" style={{ color: 'var(--text-muted)' }}>No interns assigned yet</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="card mb-2">
        <div className="card-header">
          <h3 className="card-title">Final Internship Grading</h3>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            Evaluate each intern across the criteria below. The total counts for 20% of the final internship grade.
          </p>
        </div>
      </div>
      {interns.map((intern) => (
        <InternGradeCard key={intern.id} intern={intern} />
      ))}
    </div>
  )
}

export default function SupervisorDashboard() {
  const navigate = useNavigate()
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('interns')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [supervisor, setSupervisor] = useState(null)
  const [interns, setInterns] = useState([])
  const [tasks, setTasks] = useState([])
  const [stats, setStats] = useState({
    totalInterns: 0, totalTasks: 0, pendingTasks: 0, completedTasks: 0, avgProgress: 0,
  })

  // Meetings state
  const [meetings, setMeetings] = useState([])
  const [isScheduleMeetingOpen, setIsScheduleMeetingOpen] = useState(false)
  const [activeCallMeeting, setActiveCallMeeting] = useState(null)
  const [newMeeting, setNewMeeting] = useState({
    studentId: '', studentIds: [], title: '', description: '', date: '', location: '', meetingLink: '', isGroupMeeting: false,
  })
  const [meetingLoading, setMeetingLoading] = useState(false)
  const [meetingError, setMeetingError] = useState('')
  const [editingMeetingId, setEditingMeetingId] = useState(null)
  const [reports, setReports] = useState([])
  const [reportFeedback, setReportFeedback] = useState({})
  const [savingReportId, setSavingReportId] = useState(null)

  // Tasks state
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false)
  const [editingTaskId, setEditingTaskId] = useState(null)
  const [editForm, setEditForm] = useState({ title: '', description: '', dueDate: '', progress: 0 })
  const [feedbackTaskId, setFeedbackTaskId] = useState(null)
  const [feedbackText, setFeedbackText] = useState('')
  const [feedbackSaving, setFeedbackSaving] = useState(false)
  const [newTask, setNewTask] = useState({ studentId: '', title: '', description: '', dueDate: '' })

  useEffect(() => { fetchDashboardData() }, [])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      const [internsRes, tasksRes] = await Promise.all([
        supervisorApi.getMyInterns(),
        supervisorApi.getTasks(),
      ])

      setInterns(internsRes.interns || [])
      setTasks(tasksRes.tasks || [])

      const allTasks = tasksRes.tasks || []
      const totalTasks = allTasks.length
      const completedTasks = allTasks.filter(t => t.completed || t.status === 'completed').length
      const pendingTasks = allTasks.filter(t => !t.completed && t.status !== 'completed').length
      const avgProgress = totalTasks > 0 ? Math.round(allTasks.reduce((sum, t) => sum + (t.progress || 0), 0) / totalTasks) : 0

      setStats({
        totalInterns: internsRes.total || 0,
        totalTasks,
        pendingTasks,
        completedTasks,
        avgProgress,
      })

      const token = localStorage.getItem('token')
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]))
        setSupervisor({
          name: payload.name || 'Supervisor',
          email: payload.email,
          role: payload.role,
        })
      }
    } catch (err) {
      console.error('Fetch dashboard error:', err)
      setError('Unable to load dashboard data')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateTask = async (e) => {
    e.preventDefault()
    if (!newTask.studentId || !newTask.title.trim()) return
    try {
      await supervisorApi.createTask(newTask)
      setNewTask({ studentId: '', title: '', description: '', dueDate: '' })
      setIsCreateTaskOpen(false)
      fetchDashboardData()
    } catch (err) { console.error('Create task error:', err) }
  }

  const handleUpdateTask = async (id) => {
    try {
      await supervisorApi.updateTask(id, editForm)
      setEditingTaskId(null)
      setEditForm({ title: '', description: '', dueDate: '', progress: 0 })
      fetchDashboardData()
    } catch (err) { console.error('Update task error:', err) }
  }

  const handleDeleteTask = async (id) => {
    if (!window.confirm('Delete this task?')) return
    try {
      await supervisorApi.deleteTask(id)
      fetchDashboardData()
    } catch (err) { console.error('Delete task error:', err) }
  }

  const handleMarkComplete = async (id) => {
    try {
      await supervisorApi.updateTask(id, { status: 'completed', progress: 100 })
      fetchDashboardData()
    } catch (err) { console.error('Complete task error:', err) }
  }

  const handleSubmitFeedback = async (taskId) => {
    if (!feedbackText.trim()) return
    setFeedbackSaving(true)
    try {
      await api.put(`/supervisor/tasks/${taskId}/feedback`, { feedback: feedbackText })
      setFeedbackTaskId(null)
      setFeedbackText('')
      fetchDashboardData()
    } catch (err) { console.error('Feedback error:', err) }
    finally { setFeedbackSaving(false) }
  }

  // Meeting handlers
  const fetchMeetings = async () => {
    try {
      const res = await api.get('/meetings/supervisor')
      setMeetings(res.data.meetings || [])
    } catch (err) { console.error('Fetch meetings error:', err) }
  }

  useEffect(() => { if (activeTab === 'meetings') fetchMeetings() }, [activeTab])

  const fetchReports = async () => {
    try {
      const data = await supervisorApi.getReports()
      setReports(data.reports || [])
    } catch (err) { console.error('Fetch reports error:', err) }
  }

  useEffect(() => { if (activeTab === 'reports') fetchReports() }, [activeTab])

  const handleReportFeedback = async (reportId) => {
    const feedback = reportFeedback[reportId]?.trim()
    if (!feedback) return
    setSavingReportId(reportId)
    try {
      await supervisorApi.submitFeedback(reportId, { feedback, status: 'in_review' })
      setReportFeedback((current) => ({ ...current, [reportId]: '' }))
      fetchReports()
    } catch (err) { console.error('Report feedback error:', err) }
    finally { setSavingReportId(null) }
  }

  const handleScheduleMeeting = async (e) => {
    e.preventDefault()
    if (!newMeeting.title || !newMeeting.date) return
    if (!newMeeting.studentId && !newMeeting.studentIds?.length) return
    setMeetingLoading(true)
    setMeetingError('')
    try {
      if (editingMeetingId) {
        const { meeting } = await supervisorApi.updateMeeting(editingMeetingId, newMeeting)
        setMeetings((currentMeetings) => currentMeetings.map((currentMeeting) =>
          currentMeeting.id === editingMeetingId
            ? { ...currentMeeting, ...meeting }
            : currentMeeting
        ))
      } else {
        const { meeting } = await supervisorApi.createMeeting(newMeeting)
        setMeetings((currentMeetings) => [...currentMeetings, meeting].sort(
          (first, second) => new Date(first.date) - new Date(second.date)
        ))
      }
      setNewMeeting({ studentId: '', studentIds: [], title: '', description: '', date: '', location: '', meetingLink: '', isGroupMeeting: false })
      setEditingMeetingId(null)
      setIsScheduleMeetingOpen(false)
    } catch (err) {
      console.error('Schedule meeting error:', err)
      setMeetingError(err.response?.data?.message || 'Unable to schedule the meeting. Please try again.')
    }
    finally { setMeetingLoading(false) }
  }

  const openScheduleMeeting = () => {
    setNewMeeting({ studentId: '', studentIds: [], title: '', description: '', date: '', location: '', meetingLink: '', isGroupMeeting: false })
    setEditingMeetingId(null)
    setMeetingError('')
    setIsScheduleMeetingOpen(true)
  }

  const openEditMeeting = (meeting) => {
    setNewMeeting({
      studentId: String(meeting.studentId || ''),
      studentIds: meeting.studentIds || [],
      title: meeting.title || '',
      description: meeting.description || '',
      date: toLocalDateTime(meeting.date),
      location: meeting.location || '',
      meetingLink: meeting.meetingLink || '',
      isGroupMeeting: meeting.isGroupMeeting || false,
    })
    setEditingMeetingId(meeting.id)
    setMeetingError('')
    setIsScheduleMeetingOpen(true)
  }

  const handleInitiateMeeting = async (id) => {
    const meetingWindow = window.open('about:blank', '_blank')
    try {
      const res = await supervisorApi.initiateMeeting(id)
      const meetingLink = res.link || res.meeting?.meetingLink
      if (meetingWindow && meetingLink) {
        meetingWindow.location.href = meetingLink
      } else if (meetingLink) {
        window.open(meetingLink, '_blank', 'noopener,noreferrer')
      }
      fetchMeetings()
    } catch (err) {
      meetingWindow?.close()
      console.error('Initiate meeting error:', err)
    }
  }

  const handleDeleteMeeting = async (id) => {
    if (!window.confirm('Cancel this meeting?')) return
    try {
      await api.delete(`/meetings/${id}`)
      fetchMeetings()
    } catch (err) { console.error('Delete meeting error:', err) }
  }

  const handleSignOut = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    navigate('/login')
  }

  const filteredTasks = tasks.filter(task => {
    const intern = interns.find(i => i.id === task.studentId)
    const matchesSearch = !searchQuery ||
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      intern?.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === 'all' || task.status === statusFilter
    return matchesSearch && matchesStatus
  })

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg)' }}>
        <div className="text-center">
          <div className="h-8 w-8 mx-auto animate-spin rounded-full border-4 border-[#F5A623] border-t-transparent" />
          <p className="mt-3 text-sm" style={{ color: 'var(--text-muted)' }}>Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg)' }}>
        <div className="text-center">
          <p style={{ color: '#ef4444' }}>{error}</p>
          <button onClick={() => navigate('/login')} className="mt-4 rounded-lg bg-[#F5A623] px-4 py-2 text-white">
            Back to login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard-wrapper">
      {/* Supervisor Sidebar */}
      <aside className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <button className="sidebar-close" onClick={() => setIsSidebarOpen(false)}>
            <X size={24} />
          </button>
          <div className="sidebar-logo">
            <div className="logo-icon">
              <img
                src={logoImg}
                alt="InternSmart logo"
                className="h-11 w-11 rounded-2xl"
              />
            </div>
            <div className="logo-text">
              <div className="logo-brand">InternSmart</div>
              <div className="logo-subtitle">ACADEMIC SUPERVISOR</div>
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <button 
            type="button" 
            className={`sidebar-nav-item ${activeTab === 'interns' ? 'active' : ''}`}
            onClick={() => setActiveTab('interns')}
          >
            <Users size={18} className="nav-icon" />
            <span className="nav-label">My Interns</span>
          </button>
          <button
            type="button"
            className={`sidebar-nav-item ${activeTab === 'tasks' ? 'active' : ''}`}
            onClick={() => setActiveTab('tasks')}
          >
            <FileText size={18} className="nav-icon" />
            <span className="nav-label">Tasks</span>
          </button>
          <button type="button" className={`sidebar-nav-item ${activeTab === 'writing' ? 'active' : ''}`} onClick={() => setActiveTab('writing')}>
            <FileText size={18} className="nav-icon" />
            <span className="nav-label">Writing Spaces</span>
          </button>
          <button
            type="button"
            className={`sidebar-nav-item ${activeTab === 'reports' ? 'active' : ''}`}
            onClick={() => setActiveTab('reports')}
          >
            <FileCheck size={18} className="nav-icon" />
            <span className="nav-label">Reports</span>
          </button>
          <button
            type="button"
            className={`sidebar-nav-item ${activeTab === 'meetings' ? 'active' : ''}`}
            onClick={() => setActiveTab('meetings')}
          >
            <Calendar size={18} className="nav-icon" />
            <span className="nav-label">Meetings</span>
          </button>
          <button
            type="button"
            className={`sidebar-nav-item ${activeTab === 'grading' ? 'active' : ''}`}
            onClick={() => setActiveTab('grading')}
          >
            <GraduationCap size={18} className="nav-icon" />
            <span className="nav-label">Grading</span>
          </button>
        </nav>

        <div className="sidebar-ai-card">
          <div className="ai-card-icon">✦</div>
          <div className="ai-card-title">Supervisor AI Assistant</div>
          <p className="ai-card-description">Auto-generate review feedback & rubric criteria.</p>
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
              <Users size={16} />
              <span>{supervisor?.role?.replace('_', ' ') || 'Academic Supervisor'}</span>
            </div>
          </div>

          <div className="header-right">
            <ThemeToggle />
            
            <button className="notification-btn cursor-pointer">
              <Bell size={20} />
              <span className="notification-badge">0</span>
            </button>

            <div className="header-divider"></div>

            <div className="relative">
              <div
                className="user-menu cursor-pointer"
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              >
                <div className="user-avatar">
                  {supervisor?.name?.charAt(0)?.toUpperCase() || 'S'}
                </div>
                <div className="user-info">
                  <div className="user-name">{supervisor?.name || 'Supervisor'}</div>
                  <div className="user-role">{supervisor?.role?.replace('_', ' ') || 'Academic Supervisor'}</div>
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
                    onClick={() => navigate('/change-password')}
                    className="w-full flex items-center gap-2 p-2 rounded text-left cursor-pointer"
                    style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: 'var(--text)' }}
                  >
                    <Lock size={14} /> Change Password
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

        {/* Supervisor Content */}
        <main className="dashboard-content">
          {/* Stats Row */}
          <div className="grid gap-4 md:grid-cols-5 mb-8">
            <div className="stats-card">
              <div className="stats-card-header">
                <span className="stats-card-title">Total Interns</span>
                <Users className="stats-card-icon" size={20} />
              </div>
              <div className="stats-card-value">{stats.totalInterns}</div>
            </div>

            <div className="stats-card">
              <div className="stats-card-header">
                <span className="stats-card-title">Total Tasks</span>
                <FileText className="stats-card-icon" size={20} />
              </div>
              <div className="stats-card-value">{stats.totalTasks}</div>
            </div>

            <div className="stats-card">
              <div className="stats-card-header">
                <span className="stats-card-title">Pending Tasks</span>
                <Clock className="stats-card-icon text-amber-400" size={20} />
              </div>
              <div className="stats-card-value text-amber-400">{stats.pendingTasks}</div>
            </div>

            <div className="stats-card">
              <div className="stats-card-header">
                <span className="stats-card-title">Completed</span>
                <CheckCircle2 className="stats-card-icon text-emerald-400" size={20} />
              </div>
              <div className="stats-card-value text-emerald-400">{stats.completedTasks}</div>
            </div>

            <div className="stats-card">
              <div className="stats-card-header">
                <span className="stats-card-title">Avg Progress</span>
                <Star className="stats-card-icon text-orange-400" size={20} />
              </div>
              <div className="stats-card-value">{stats.avgProgress}%</div>
            </div>
          </div>

          <div className="mb-8">
            <TimelineCard />
          </div>

          {/* Interns Tab */}
          {activeTab === 'interns' && (
            <div className="card mb-8">
              <div className="card-header">
                <h3 className="card-title">My Interns</h3>
              </div>

              {interns.length === 0 ? (
                <div className="text-center py-12">
                  <Users size={48} style={{ color: 'var(--text-muted)' }} />
                  <p className="mt-4 text-sm" style={{ color: 'var(--text-muted)' }}>No interns assigned yet</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Interns will appear here when they are assigned to you</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b text-[11px] uppercase tracking-wider" style={{ borderColor: 'var(--line)', color: 'var(--text-muted)' }}>
                        <th className="pb-3 font-semibold px-4 text-left">Name</th>
                        <th className="pb-3 font-semibold px-4 text-left">Email</th>
                        <th className="pb-3 font-semibold px-4 text-left">Matricule</th>
                        <th className="pb-3 font-semibold px-4 text-left">Class</th>
                        <th className="pb-3 font-semibold px-4 text-left">Tasks</th>
                      <th className="pb-3 font-semibold px-4 text-left">Writing Space</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y" style={{ borderColor: 'var(--line)' }}>
                      {interns.map((intern) => {
                        const internTasks = tasks.filter(t => t.studentId === intern.id)
                        const completedCount = internTasks.filter(t => t.completed || t.status === 'completed').length
                        return (
                          <tr key={intern.id} className="hover:bg-white/[0.02] transition">
                            <td className="py-3.5 px-4 font-semibold" style={{ color: 'var(--text)' }}>{intern.name}</td>
                            <td className="py-3.5 px-4">{intern.email}</td>
                            <td className="py-3.5 px-4">{intern.matricule}</td>
                            <td className="py-3.5 px-4">{intern.class}</td>
                            <td className="py-3.5 px-4">
                              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                {completedCount}/{internTasks.length} completed
                              </span>
                            </td>
                            <td className="py-3.5 px-4">
                              {intern.reportId ? <button type="button" onClick={() => navigate(`/writing-workspace?reportId=${intern.reportId}`)} className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold" style={{ borderColor: 'rgba(245,166,35,.35)', color: 'var(--orange-3)' }}><FileText size={13} /> Open</button> : <span className="text-xs" style={{ color: 'var(--text-muted)' }}>No report</span>}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'writing' && (
            <div className="card mb-8">
              <div className="card-header"><h3 className="card-title">Intern Writing Spaces</h3><p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Open each report in secure read-only review mode.</p></div>
              <div className="space-y-3">{interns.map((intern) => <div key={intern.id} className="flex items-center justify-between gap-4 border-b py-3" style={{ borderColor: 'var(--line)' }}><div><div className="font-semibold" style={{ color: 'var(--text)' }}>{intern.name}</div><div className="text-xs" style={{ color: 'var(--text-muted)' }}>{intern.email}</div></div>{intern.reportId ? <button type="button" onClick={() => navigate(`/writing-workspace?reportId=${intern.reportId}`)} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-white" style={{ background: 'linear-gradient(135deg, var(--orange), var(--orange-3))' }}><FileText size={14} /> View writing space</button> : <span className="text-xs" style={{ color: 'var(--text-muted)' }}>No report submitted</span>}</div>)}</div>
            </div>
          )}

          {/* Tasks Tab */}
          {activeTab === 'tasks' && (
            <div className="card">
              <div className="card-header flex items-center justify-between">
                <h3 className="card-title">Task Management</h3>
                <button
                  onClick={() => setIsCreateTaskOpen(true)}
                  className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium shadow-lg transition cursor-pointer"
                  style={{
                    background: 'linear-gradient(135deg, var(--orange), var(--orange-3))',
                    color: 'white',
                  }}
                >
                  <Plus size={16} />
                  Create Task
                </button>
              </div>

              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-3 p-4 border-b" style={{ borderColor: 'var(--line)' }}>
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search tasks or interns..."
                    className="w-full rounded-xl border pl-9 pr-3 py-2 text-sm focus:outline-none"
                    style={{
                      backgroundColor: 'var(--bg)',
                      borderColor: 'var(--line)',
                      color: 'var(--text)'
                    }}
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="rounded-xl border px-3 py-2 text-sm focus:outline-none"
                  style={{
                    backgroundColor: 'var(--bg)',
                    borderColor: 'var(--line)',
                    color: 'var(--text)'
                  }}
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                </select>
              </div>

              {/* Tasks List */}
              {filteredTasks.length === 0 ? (
                <div className="text-center py-12">
                  <FileText size={48} style={{ color: 'var(--text-muted)' }} />
                  <p className="mt-4 text-sm" style={{ color: 'var(--text-muted)' }}>No tasks found</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Create a task to get started</p>
                </div>
              ) : (
                <div className="divide-y" style={{ borderColor: 'var(--line)' }}>
                  {filteredTasks.map((task) => {
                    const intern = interns.find(i => i.id === task.studentId)
                    const isEditing = editingTaskId === task.id

                    return (
                      <div key={task.id} className="p-4 hover:bg-white/[0.02] transition">
                        {isEditing ? (
                          <div className="space-y-3">
                            <input
                              value={editForm.title}
                              onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                              className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none"
                              style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--line)', color: 'var(--text)' }}
                            />
                            <textarea
                              value={editForm.description}
                              onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                              className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none"
                              rows={3}
                              style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--line)', color: 'var(--text)' }}
                            />
                            <input
                              type="date"
                              value={editForm.dueDate}
                              onChange={(e) => setEditForm({ ...editForm, dueDate: e.target.value })}
                              className="rounded-xl border px-3 py-2 text-sm focus:outline-none"
                              style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--line)', color: 'var(--text)' }}
                            />
                            <div className="flex items-center gap-2">
                              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Progress:</span>
                              <input
                                type="range"
                                min="0"
                                max="100"
                                value={editForm.progress}
                                onChange={(e) => setEditForm({ ...editForm, progress: parseInt(e.target.value) })}
                                className="flex-1"
                              />
                              <span className="text-xs font-semibold" style={{ color: 'var(--orange-3)' }}>{editForm.progress}%</span>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleUpdateTask(task.id)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-white"
                                style={{ backgroundColor: '#10b981' }}
                              >
                                <Save size={14} /> Save
                              </button>
                              <button
                                onClick={() => { setEditingTaskId(null); setEditForm({ title: '', description: '', dueDate: '', progress: 0 }) }}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border"
                                style={{ borderColor: 'var(--line)', color: 'var(--text)' }}
                              >
                                <XCircle size={14} /> Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-semibold text-sm truncate" style={{ color: 'var(--text)' }}>{task.title}</h4>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase ${
                                  task.status === 'completed' ? 'bg-emerald-500/15 text-emerald-300' :
                                  task.status === 'in_progress' ? 'bg-amber-500/15 text-amber-300' :
                                  'bg-white/10 text-white/60'
                                }`}>
                                  {task.status?.replace('_', ' ')}
                                </span>
                              </div>
                              {task.description && (
                                <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>{task.description}</p>
                              )}
                              <div className="flex items-center gap-4 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                                <span>Assigned to: <strong style={{ color: 'var(--text-soft)' }}>{intern?.name || 'Unknown'}</strong></span>
                                {task.dueDate && <span>Due: {new Date(task.dueDate).toLocaleDateString()}</span>}
                                <span>Progress: {task.progress || 0}%</span>
                              </div>
                              <div className="mt-2 h-2 w-full rounded-full overflow-hidden" style={{ backgroundColor: 'var(--line)' }}>
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{
                                    width: `${task.progress || 0}%`,
                                    background: task.progress === 100 ? 'linear-gradient(90deg, #10b981, #34d399)' : 'linear-gradient(90deg, var(--orange), var(--orange-3))'
                                  }}
                                ></div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                onClick={() => {
                                  setFeedbackTaskId(task.id)
                                  setFeedbackText(task.feedbackAcademic || task.feedback || '')
                                }}
                                className="p-2 rounded-lg border transition cursor-pointer hover:bg-white/5"
                                style={{ borderColor: 'rgba(139,92,246,0.3)', color: '#a78bfa' }}
                                title="Leave feedback"
                              >
                                <MessageSquare size={14} />
                              </button>
                              <button
                                onClick={() => {
                                  setEditingTaskId(task.id)
                                  setEditForm({
                                    title: task.title,
                                    description: task.description || '',
                                    dueDate: task.dueDate ? task.dueDate.split('T')[0] : '',
                                    progress: task.progress || 0,
                                  })
                                }}
                                className="p-2 rounded-lg border transition cursor-pointer hover:bg-white/5"
                                style={{ borderColor: 'var(--line)', color: 'var(--text-soft)' }}
                              >
                                <Edit size={14} />
                              </button>
                              {task.status !== 'completed' && (
                                <button
                                  onClick={() => handleMarkComplete(task.id)}
                                  className="p-2 rounded-lg border transition cursor-pointer hover:bg-white/5"
                                  style={{ borderColor: 'rgba(16, 185, 129, 0.3)', color: '#10b981' }}
                                >
                                  <CheckCircle2 size={14} />
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteTask(task.id)}
                                className="p-2 rounded-lg border transition cursor-pointer hover:bg-white/5"
                                style={{ borderColor: 'rgba(239, 68, 68, 0.3)', color: '#ef4444' }}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── Create Task Modal ── */}
          {isCreateTaskOpen && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="rounded-2xl border p-6 shadow-2xl w-full max-w-md" style={{
                backgroundColor: 'var(--bg-panel)', borderColor: 'var(--line)', color: 'var(--text)'
              }}>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold">Create New Task</h2>
                  <button
                    onClick={() => setIsCreateTaskOpen(false)}
                    className="p-1.5 rounded-lg transition cursor-pointer hover:bg-white/5"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    <X size={20} />
                  </button>
                </div>
                <form onSubmit={handleCreateTask} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-soft)' }}>Assign to Student</label>
                    <select
                      value={newTask.studentId}
                      onChange={(e) => setNewTask({ ...newTask, studentId: e.target.value })}
                      className="w-full rounded-xl border px-3 py-2.5 text-sm focus:outline-none"
                      style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--line)', color: 'var(--text)' }}
                      required
                    >
                      <option value="">Select a student</option>
                      {interns.map((intern) => (
                        <option key={intern.id} value={intern.id}>{intern.name} ({intern.matricule})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-soft)' }}>Task Title</label>
                    <input
                      value={newTask.title}
                      onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                      placeholder="Enter task title"
                      className="w-full rounded-xl border px-3 py-2.5 text-sm focus:outline-none"
                      style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--line)', color: 'var(--text)' }}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-soft)' }}>Description</label>
                    <textarea
                      value={newTask.description}
                      onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                      placeholder="Enter task description"
                      rows={3}
                      className="w-full rounded-xl border px-3 py-2.5 text-sm focus:outline-none resize-none"
                      style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--line)', color: 'var(--text)' }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-soft)' }}>Due Date</label>
                    <input
                      type="date"
                      value={newTask.dueDate}
                      onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                      className="w-full rounded-xl border px-3 py-2.5 text-sm focus:outline-none"
                      style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--line)', color: 'var(--text)' }}
                    />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button
                      type="submit"
                      className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white shadow-lg transition cursor-pointer"
                      style={{ background: 'linear-gradient(135deg, var(--orange), var(--orange-3))' }}
                    >
                      Create Task
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsCreateTaskOpen(false)}
                      className="px-4 py-2.5 rounded-xl border text-sm font-medium transition cursor-pointer"
                      style={{ borderColor: 'var(--line)', color: 'var(--text)' }}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ── Meetings Tab ── */}
          {activeTab === 'reports' && (
            <div className="card">
              <div className="card-header"><h3 className="card-title">Submitted Reports</h3></div>
              {reports.length === 0 ? (
                <div className="py-12 text-center text-sm" style={{ color: 'var(--text-muted)' }}>No reports have been submitted yet.</div>
              ) : (
                <div className="divide-y" style={{ borderColor: 'var(--line)' }}>
                  {reports.map((report) => (
                    <div key={report.id} className="p-4 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h4 className="font-semibold text-sm" style={{ color: 'var(--text)' }}>{report.title}</h4>
                          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{report.student?.user?.name || 'Student'} · {report.fileName}</p>
                        </div>
                        <a href={`http://localhost:3000${report.fileUrl}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-medium" style={{ borderColor: 'var(--line)', color: 'var(--text)' }}>
                          <ExternalLink size={13} /> View document
                        </a>
                      </div>
                      <textarea
                        value={reportFeedback[report.id] || ''}
                        onChange={(event) => setReportFeedback((current) => ({ ...current, [report.id]: event.target.value }))}
                        placeholder="Write feedback for the student..."
                        rows={2}
                        className="w-full resize-none rounded-lg border px-3 py-2 text-sm focus:outline-none"
                        style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--line)', color: 'var(--text)' }}
                      />
                      <button onClick={() => handleReportFeedback(report.id)} disabled={savingReportId === report.id || !reportFeedback[report.id]?.trim()} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-white disabled:opacity-50" style={{ background: 'linear-gradient(135deg, var(--orange), var(--orange-3))' }}>
                        {savingReportId === report.id ? <Loader2 size={13} className="animate-spin" /> : <MessageSquare size={13} />}
                        Send feedback
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'meetings' && (
            <div className="card">
              <div className="card-header flex items-center justify-between">
                <h3 className="card-title">Meetings</h3>
                <button
                  onClick={openScheduleMeeting}
                  className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-white shadow-lg transition cursor-pointer"
                  style={{ background: 'linear-gradient(135deg, var(--orange), var(--orange-3))' }}
                >
                  <Plus size={16} /> Schedule Meeting
                </button>
              </div>

              {meetings.length === 0 ? (
                <div className="text-center py-12">
                  <Calendar size={48} style={{ color: 'var(--text-muted)' }} />
                  <p className="mt-4 text-sm" style={{ color: 'var(--text-muted)' }}>No meetings scheduled yet</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Schedule a meeting with your interns</p>
                </div>
              ) : (
                <div className="divide-y" style={{ borderColor: 'var(--line)' }}>
                  {meetings.map((meeting) => {
                    const student = meeting.meetingStudent
                    const studentName = student?.user?.name || 'Student'
                    const meetingDate = new Date(meeting.date)
                    const isPast = meetingDate < new Date()
                    return (
                      <div key={meeting.id} className="p-4 hover:bg-white/[0.02] transition">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                          <div className="flex gap-4 items-start">
                            {/* Date block */}
                            <div className="flex flex-col items-center justify-center px-3 py-2 rounded-xl min-w-[56px] shrink-0"
                              style={{ backgroundColor: 'rgba(245,166,35,0.08)', border: '1px solid rgba(245,166,35,0.15)' }}>
                              <span className="text-[10px] font-bold text-orange-400">
                                {meetingDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}
                              </span>
                              <span className="text-xl font-bold" style={{ color: 'var(--text)' }}>
                                {meetingDate.getDate()}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-semibold text-sm" style={{ color: 'var(--text)' }}>{meeting.title}</h4>
                                {meeting.isGroupMeeting && (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase bg-blue-500/15 text-blue-300">Group</span>
                                )}
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase ${
                                  meeting.status === 'completed' ? 'bg-emerald-500/15 text-emerald-300' :
                                  meeting.status === 'cancelled' ? 'bg-red-500/15 text-red-300' :
                                  'bg-amber-500/15 text-amber-300'
                                }`}>{meeting.status}</span>
                              </div>
                              <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
                                👤 {meeting.isGroupMeeting ? `${meeting.studentIds?.length || 0} interns` : studentName} &nbsp;•&nbsp; 🕐 {meetingDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                              </p>
                              {meeting.description && (
                                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{meeting.description}</p>
                              )}
                              <div className="flex gap-2 mt-1">
                                {meeting.location && (
                                  <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--bg)', color: 'var(--text-muted)' }}>
                                    📍 {meeting.location}
                                  </span>
                                )}
                                {meeting.meetingLink && (
                                  <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--bg)', color: 'var(--text-muted)' }}>
                                    🎥 Online
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {!isPast && meeting.status !== 'cancelled' && (
                              <button
                                onClick={() => handleInitiateMeeting(meeting.id)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition cursor-pointer"
                                style={{ background: 'linear-gradient(135deg, #059669, #10b981)' }}
                              >
                                <Video size={13} /> Start
                              </button>
                            )}
                            {meeting.meetingLink && (
                              <a
                                href={meeting.meetingLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition cursor-pointer"
                                style={{ borderColor: 'var(--line)', color: 'var(--text)', textDecoration: 'none' }}
                              >
                                <ExternalLink size={13} /> Link
                              </a>
                            )}
                            <button
                              onClick={() => openEditMeeting(meeting)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition cursor-pointer"
                              style={{ borderColor: 'var(--line)', color: 'var(--text)' }}
                            >
                              <Edit size={13} /> Edit
                            </button>
                            <button
                              onClick={() => handleDeleteMeeting(meeting.id)}
                              className="p-1.5 rounded-lg border transition cursor-pointer"
                              style={{ borderColor: 'rgba(239,68,68,0.3)', color: '#ef4444' }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── Schedule Meeting Modal ── */}
          {isScheduleMeetingOpen && (
            <div className="fixed inset-x-0 bottom-0 top-20 bg-black/50 flex items-start justify-center z-50 overflow-y-auto p-3">
              <div className="rounded-2xl border p-4 shadow-2xl w-full max-w-lg" style={{
                backgroundColor: 'var(--bg-panel)', borderColor: 'var(--line)', color: 'var(--text)'
              }}>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-bold">{editingMeetingId ? 'Edit Meeting' : 'Schedule Meeting'}</h2>
                  <button onClick={() => { setIsScheduleMeetingOpen(false); setEditingMeetingId(null) }}
                    className="p-1.5 rounded-lg transition cursor-pointer hover:bg-white/5"
                    style={{ color: 'var(--text-muted)' }}>
                    <X size={20} />
                  </button>
                </div>
                <form onSubmit={handleScheduleMeeting} className="space-y-2.5">
                  <div>
                    <label className="flex items-center gap-2 cursor-pointer mb-2">
                      <input
                        type="checkbox"
                        checked={newMeeting.isGroupMeeting}
                        onChange={(e) => setNewMeeting({ ...newMeeting, isGroupMeeting: e.target.checked, studentId: '', studentIds: [] })}
                        className="rounded"
                      />
                      <span className="text-sm" style={{ color: 'var(--text-soft)' }}>Group meeting (multiple interns)</span>
                    </label>
                  </div>

                  {!newMeeting.isGroupMeeting ? (
                    <div>
                      <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-soft)' }}>Intern</label>
                      <select
                        value={newMeeting.studentId}
                        onChange={(e) => setNewMeeting({ ...newMeeting, studentId: e.target.value })}
                        className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
                        style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--line)', color: 'var(--text)' }}
                        required
                      >
                        <option value="">Select intern</option>
                        {interns.map((i) => (
                          <option key={i.id} value={i.id}>{i.name} ({i.matricule})</option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-soft)' }}>Select Interns</label>
                      <div className="space-y-2 max-h-32 overflow-y-auto rounded-lg border p-2" style={{ borderColor: 'var(--line)', backgroundColor: 'var(--bg)' }}>
                        {interns.map((intern) => (
                          <label key={intern.id} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={newMeeting.studentIds?.includes(intern.id)}
                              onChange={(e) => {
                                const ids = e.target.checked
                                  ? [...(newMeeting.studentIds || []), intern.id]
                                  : (newMeeting.studentIds || []).filter(id => id !== intern.id);
                                setNewMeeting({ ...newMeeting, studentIds: ids });
                              }}
                              className="rounded"
                            />
                            <span className="text-sm" style={{ color: 'var(--text)' }}>{intern.name} ({intern.matricule})</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-soft)' }}>Title</label>
                    <input
                      value={newMeeting.title}
                      onChange={(e) => setNewMeeting({ ...newMeeting, title: e.target.value })}
                      placeholder="e.g. Progress Review"
                      className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
                      style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--line)', color: 'var(--text)' }}
                      required
                    />
                  </div>
                    <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-soft)' }}>Date &amp; Time</label>
                    <input
                      type="datetime-local"
                      value={newMeeting.date}
                      min={editingMeetingId ? undefined : getLocalDateTime()}
                      onChange={(e) => setNewMeeting({ ...newMeeting, date: e.target.value })}
                      className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
                      style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--line)', color: 'var(--text)' }}
                      required
                    />
                  </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-soft)' }}>Description (optional)</label>
                    <textarea
                      value={newMeeting.description}
                      onChange={(e) => setNewMeeting({ ...newMeeting, description: e.target.value })}
                      placeholder="What will you discuss?"
                      rows={1}
                      className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none resize-none"
                      style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--line)', color: 'var(--text)' }}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-soft)' }}>Location (optional)</label>
                      <input
                        value={newMeeting.location}
                        onChange={(e) => setNewMeeting({ ...newMeeting, location: e.target.value })}
                        placeholder="Room / address"
                        className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
                        style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--line)', color: 'var(--text)' }}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-soft)' }}>Meeting Link (optional)</label>
                      <input
                        value={newMeeting.meetingLink}
                        onChange={(e) => setNewMeeting({ ...newMeeting, meetingLink: e.target.value })}
                        placeholder="Leave empty for auto-generated Jitsi link"
                        className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
                        style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--line)', color: 'var(--text)' }}
                      />
                    </div>
                  </div>
                  {meetingError && (
                    <p className="text-xs" style={{ color: '#ef4444' }}>{meetingError}</p>
                  )}
                  <div className="flex gap-3 pt-1">
                    <button
                      type="submit"
                      disabled={meetingLoading}
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold text-white shadow-lg transition cursor-pointer disabled:opacity-50"
                      style={{ background: 'linear-gradient(135deg, var(--orange), var(--orange-3))' }}
                    >
                      {meetingLoading ? <Loader2 size={14} className="animate-spin" /> : <Calendar size={14} />}
                      {editingMeetingId ? 'Save Changes' : 'Schedule'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setIsScheduleMeetingOpen(false); setEditingMeetingId(null) }}
                      className="px-4 py-2 rounded-lg border text-sm font-medium transition cursor-pointer"
                      style={{ borderColor: 'var(--line)', color: 'var(--text)' }}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ── Feedback Modal (for tasks) ── */}
          {feedbackTaskId && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="rounded-2xl border p-6 shadow-2xl w-full max-w-md" style={{
                backgroundColor: 'var(--bg-panel)', borderColor: 'var(--line)', color: 'var(--text)'
              }}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold">Leave Feedback <span className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}>(Academic Supervisor)</span></h2>
                  <button onClick={() => setFeedbackTaskId(null)}
                    className="p-1.5 rounded-lg hover:bg-white/5 cursor-pointer"
                    style={{ color: 'var(--text-muted)' }}>
                    <X size={18} />
                  </button>
                </div>
                <textarea
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  placeholder="Write your feedback for this task..."
                  rows={5}
                  className="w-full rounded-xl border px-3 py-2.5 text-sm focus:outline-none resize-none mb-4"
                  style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--line)', color: 'var(--text)' }}
                />
                <div className="flex gap-3">
                  <button
                    onClick={() => handleSubmitFeedback(feedbackTaskId)}
                    disabled={feedbackSaving || !feedbackText.trim()}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white cursor-pointer disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)' }}
                  >
                    {feedbackSaving ? <Loader2 size={14} className="animate-spin" /> : <MessageSquare size={14} />}
                    Submit Feedback
                  </button>
                  <button onClick={() => setFeedbackTaskId(null)}
                    className="px-4 py-2.5 rounded-xl border text-sm font-medium cursor-pointer"
                    style={{ borderColor: 'var(--line)', color: 'var(--text)' }}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── In-browser Jitsi Meet Call ── */}
          {activeCallMeeting && (
            <div className="fixed inset-0 z-50 flex flex-col bg-black">
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 bg-[#0d1419]">
                <div>
                  <h3 className="text-lg font-bold text-white">{activeCallMeeting.title}</h3>
                  <p className="text-xs text-white/50">Virtual meeting with Jitsi Meet</p>
                </div>
                <button onClick={() => setActiveCallMeeting(null)}
                  className="rounded-full p-1.5 hover:bg-white/10 text-white/70 hover:text-white transition cursor-pointer">
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 relative bg-black">
                <iframe
                  src={activeCallMeeting.meetingLink}
                  title="Jitsi Meet"
                  allow="camera; microphone; fullscreen; display-capture; autoplay"
                  className="w-full h-full border-0"
                  allowFullScreen
                />
              </div>
            </div>
          )}

          {/* Grading Tab */}
          {activeTab === 'grading' && (
            <GradingTab interns={interns} />
          )}
        </main>
      </div>
    </div>
  )
}
