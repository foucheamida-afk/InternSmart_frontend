import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users,
  FileCheck,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  Search,
  Filter,
  ArrowRight,
  Bell,
  LogOut,
  ChevronDown,
  Brain,
  Video,
  Star,
  Zap,
  Menu,
  X,
  FileText,
  UserCheck,
} from 'lucide-react'
import '../assets/css/dashboard.css'
import '../assets/css/dashboard-components.css'
import '../assets/css/sidebar.css'

export default function SupervisorDashboard() {
  const navigate = useNavigate()
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('pending')
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [reviewNote, setReviewNote] = useState('')
  const [actionSuccess, setActionSuccess] = useState('')

  const supervisor = {
    name: 'Prof. Marie Dupont',
    role: 'Faculty Supervisor',
    department: 'Software Engineering',
    studentsCount: 14,
    pendingReviews: 3,
  }

  const [students, setStudents] = useState([
    {
      id: 'std-1',
      name: 'Anita',
      program: 'Level 3 • Software Engineering',
      reportTitle: 'AI-Powered Internship Platform',
      version: 3,
      submittedDate: 'May 17, 2025',
      aiScore: 8.4,
      status: 'pending_review',
      progress: 75,
      notes: 'Please verify Section 4.2 evaluation metrics.',
    },
    {
      id: 'std-2',
      name: 'Alex Johnson',
      program: 'Level 3 • Cloud Computing',
      reportTitle: 'Kubernetes Microservices Architecture',
      version: 2,
      submittedDate: 'May 16, 2025',
      aiScore: 9.0,
      status: 'pending_review',
      progress: 60,
      notes: 'Updated deployment diagrams.',
    },
    {
      id: 'std-3',
      name: 'Sarah Lin',
      program: 'Level 3 • Cybersecurity',
      reportTitle: 'Zero-Trust Identity Authentication',
      version: 1,
      submittedDate: 'May 15, 2025',
      aiScore: 7.8,
      status: 'needs_revision',
      progress: 45,
      notes: 'Requested clearer threat modeling.',
    },
    {
      id: 'std-4',
      name: 'David Chen',
      program: 'Level 3 • Software Engineering',
      reportTitle: 'Real-time WebSocket Data Sync',
      version: 4,
      submittedDate: 'May 10, 2025',
      aiScore: 9.3,
      status: 'approved',
      progress: 100,
      notes: 'Approved for final defense presentation.',
    },
  ])

  const handleApprove = (id) => {
    setStudents((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status: 'approved', progress: 100 } : s))
    )
    setActionSuccess('Report has been approved successfully.')
    setTimeout(() => setActionSuccess(''), 3000)
  }

  const handleRequestRevision = (id) => {
    setStudents((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status: 'needs_revision' } : s))
    )
    setActionSuccess('Revision request sent to student.')
    setTimeout(() => setActionSuccess(''), 3000)
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
              <Zap size={20} />
            </div>
            <div className="logo-text">
              <div className="logo-brand">InternSmart</div>
             
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <button type="button" className="sidebar-nav-item active">
            <Users size={18} className="nav-icon" />
            <span className="nav-label">Supervisor Home</span>
          </button>
          <button type="button" className="sidebar-nav-item" onClick={() => navigate('/student')}>
            <UserCheck size={18} className="nav-icon" />
            <span className="nav-label">Switch to Student View</span>
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
              <span>{supervisor.department}</span>
              <span className="separator">•</span>
              <span>{supervisor.role}</span>
            </div>
          </div>

          <div className="header-right">
            <button className="notification-btn cursor-pointer">
              <Bell size={20} />
              <span className="notification-badge">3</span>
            </button>

            <div className="header-divider"></div>

            <div className="relative">
              <div
                className="user-menu cursor-pointer"
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              >
                <div className="user-avatar">MD</div>
                <div className="user-info">
                  <div className="user-name">{supervisor.name}</div>
                  <div className="user-role">{supervisor.role}</div>
                </div>
                <ChevronDown size={16} />
              </div>

              {isUserMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 rounded-xl border border-white/10 bg-[#0d1419] p-2 shadow-2xl z-50 text-white text-xs">
                  <button
                    onClick={() => navigate('/login')}
                    className="w-full flex items-center gap-2 p-2 rounded hover:bg-red-500/20 text-red-300 text-left cursor-pointer"
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
          <div className="dashboard-header-section">
            <div className="greeting-area">
              <h1 className="greeting-title">Welcome, {supervisor.name}</h1>
              <p className="greeting-subtitle">You have 3 student reports awaiting your evaluation.</p>
            </div>
          </div>

          {actionSuccess && (
            <div className="mb-6 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-200">
              <CheckCircle2 size={16} />
              <span>{actionSuccess}</span>
            </div>
          )}

          {/* Stats Row */}
          <div className="grid gap-4 md:grid-cols-4 mb-8">
            <div className="stats-card">
              <div className="stats-card-header">
                <span className="stats-card-title">Assigned Students</span>
                <Users className="stats-card-icon" size={20} />
              </div>
              <div className="stats-card-value">{supervisor.studentsCount}</div>
              <div className="stats-card-change">Active in current semester</div>
            </div>

            <div className="stats-card">
              <div className="stats-card-header">
                <span className="stats-card-title">Pending Reviews</span>
                <Clock className="stats-card-icon text-amber-400" size={20} />
              </div>
              <div className="stats-card-value text-amber-400">{supervisor.pendingReviews}</div>
              <div className="stats-card-change">2 submitted this week</div>
            </div>

            <div className="stats-card">
              <div className="stats-card-header">
                <span className="stats-card-title">Approved Reports</span>
                <CheckCircle2 className="stats-card-icon text-emerald-400" size={20} />
              </div>
              <div className="stats-card-value text-emerald-400">9</div>
              <div className="stats-card-change">75% pipeline completion</div>
            </div>

            <div className="stats-card">
              <div className="stats-card-header">
                <span className="stats-card-title">Avg. AI Score</span>
                <Star className="stats-card-icon text-orange-400" size={20} />
              </div>
              <div className="stats-card-value">8.6/10</div>
              <div className="stats-card-change">+0.4 from last cohort</div>
            </div>
          </div>

          {/* Students Evaluation Queue */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Student Submissions & Evaluation Queue</h3>
            </div>

            <div className="space-y-4">
              {students.map((std) => (
                <div
                  key={std.id}
                  className="rounded-2xl border border-white/8 bg-[#090e13] p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-xl bg-orange-500/10 border border-orange-400/20 flex items-center justify-center text-orange-300 font-bold text-sm shrink-0">
                      {std.name[0]}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-white text-sm truncate">{std.name}</h4>
                        <span className="text-[10px] text-white/50">{std.program}</span>
                      </div>
                      <p className="text-xs text-orange-300 font-medium mt-0.5">{std.reportTitle} (v{std.version})</p>
                      <p className="text-[11px] text-white/40 mt-1">Submitted {std.submittedDate} • AI Score: <strong className="text-white">{std.aiScore}/10</strong></p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {std.status === 'approved' ? (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full font-medium">
                        <CheckCircle2 size={14} /> Approved
                      </span>
                    ) : (
                      <>
                        <button
                          onClick={() => handleRequestRevision(std.id)}
                          className="px-3 py-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-200 text-xs font-medium transition cursor-pointer"
                        >
                          Request Revision
                        </button>
                        <button
                          onClick={() => handleApprove(std.id)}
                          className="px-3.5 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md transition cursor-pointer flex items-center gap-1"
                        >
                          <CheckCircle2 size={14} /> Approve
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
