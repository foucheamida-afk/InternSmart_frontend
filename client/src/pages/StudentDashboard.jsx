import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from "../api/axios"

import {
  BarChart3,
  FileText,
  MessageSquare,
  Calendar,
  Bell,
  ChevronDown,
  Upload,
  Star,
  CheckCircle2,
  Circle,
  Clock,
  MapPin,
  Video,
  Zap,
  Brain,
  ArrowRight,
  Menu,
  X,
  LogOut,
  User,
} from 'lucide-react'
import '../assets/css/dashboard.css'
import '../assets/css/dashboard-components.css'
import Sidebar from '../components/Sidebar'
import { StatsSkeleton } from '../components/dashboard/SkeletonLoader'
import AnimatedProgressRing from '../components/dashboard/AnimatedProgressRing'
import StatisticsCard from '../components/dashboard/StatisticsCard'
import CurrentReportCard from '../components/dashboard/CurrentReportCard'
import InternshipTimeline from '../components/dashboard/InternshipTimeline'
import UpcomingMeeting from '../components/dashboard/UpcomingMeeting'
import TasksCard from '../components/dashboard/TasksCard'
import AIAnalysisOverview from '../components/dashboard/AIAnalysisOverview'
import AIAssistantCard from '../components/dashboard/AIAssistantCard'
import FinalGradeCard from '../components/dashboard/FinalGradeCard'
import ThemeToggle from '../components/ThemeToggle'



const getGreeting = () => {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

const normalizeStudentProfile = (payload = {}) => {
  const student = payload.student ?? payload ?? {}

  return {
    ...payload,
    student: {
      id: student.id ?? payload.id ?? null,
      name: student.name ?? payload.name ?? '',
      email: student.email ?? payload.email ?? '',
      role: student.role ?? payload.role ?? 'student',
      matricule: student.matricule ?? payload.matricule ?? '',
      class: student.class ?? payload.class ?? '',
    },
  }
}

export default function StudentDashboard() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [loadingUser, setLoadingUser] = useState(true)
  const [userError, setUserError] = useState("")
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)
  const [showProfileOverview, setShowProfileOverview] = useState(false)
  const [stats, setStats] = useState(null)
  const [loadingStats, setLoadingStats] = useState(true)
  const [statsError, setStatsError] = useState("")
  const [notifications, setNotifications] = useState([])
  const [loadingNotifications, setLoadingNotifications] = useState(true)

  useEffect(() => {
    const fetchDashboardData = async () => {
      const token = localStorage.getItem("token")
      if (!token) {
        navigate("/login")
        return
      }

      const [statsResult, notificationsResult] = await Promise.allSettled([
        api.get("/students/dashboard-stats"),
        api.get("/students/my-notifications"),
      ])

      if (statsResult.status === "fulfilled") {
        setStats(statsResult.value.data)
        setStatsError("")
      } else {
        console.error("Dashboard statistics error:", statsResult.reason)
        setStatsError(
          statsResult.reason.response?.data?.message ||
          "Unable to load dashboard statistics"
        )
      }

      if (notificationsResult.status === "fulfilled") {
        setNotifications(notificationsResult.value.data.notifications || [])
      } else {
        console.error("Dashboard notifications error:", notificationsResult.reason)
      }

      setLoadingStats(false)
      setLoadingNotifications(false)
    }

    if (user) {
      fetchDashboardData()
      const refreshInterval = window.setInterval(fetchDashboardData, 15000)
      return () => window.clearInterval(refreshInterval)
    }
  }, [user, navigate])

  const handleMarkNotificationRead = async (id) => {
    try {
      await api.put(`/students/notifications/${id}/read`)
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      )
    } catch (error) {
      console.error("Mark notification read error:", error)
    }
  }

  useEffect(() => {
    const fetchStudentProfile = async () => {
      try {
        const token = localStorage.getItem("token")
        if (!token) {
          navigate("/login")
          return
        }

        const response = await api.get("/students/me")
        setUser(normalizeStudentProfile(response.data))
      } catch (error) {
        console.error("FETCH STUDENT ERROR:", error)

        if (error.response?.status === 401) {
          localStorage.removeItem("token")
          localStorage.removeItem("user")
          navigate("/login")
          return
        }

        setUserError(
          error.response?.data?.message ||
          "Unable to load student information"
        )

      } finally {
        setLoadingUser(false)
      }
    }

    fetchStudentProfile()
  }, [navigate])

  const handleSignOut = () => {
    localStorage.removeItem("user")
    localStorage.removeItem("token")
    navigate("/login")
  }

  const student = user?.student ?? user ?? {}

  if (loadingUser) {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg)' }}>
      <div className="text-center">
        <div className="h-8 w-8 mx-auto animate-spin rounded-full border-4 border-[#F5A623] border-t-transparent" />

        <p className="mt-3 text-sm" style={{ color: 'var(--text-muted)' }}>
          Loading your dashboard...
        </p>
      </div>
    </div>
  )
}

if (userError || !user) {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg)' }}>
      <div className="text-center">
        <p style={{ color: '#ef4444' }}>
          {userError || "Unable to load your profile"}
        </p>

        <button
          onClick={() => navigate("/login")}
          className="mt-4 rounded-lg bg-[#F5A623] px-4 py-2 text-white"
        >
          Back to login
        </button>
      </div>
    </div>
  )
  }
  return (
    <div className="dashboard-wrapper">
      {/* Sidebar */}
      <Sidebar isOpen={isSidebarOpen} onToggle={() => setIsSidebarOpen(!isSidebarOpen)} />

      {/* Main Content */}
      <div className="dashboard-main">
        {/* Top Header */}
        <header className="dashboard-header">
          <div className="header-left">
            <button className="mobile-menu-btn" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
              {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            <div className="program-info">
              <BarChart3 size={16} />
              <span>{student.class}</span>
              <span className="separator">•</span>
              <span>{student.matricule}</span>
            </div>
          </div>

          <div className="header-right">
            <ThemeToggle />
            
            <div className="notification-center relative">
              <button
                className="notification-btn cursor-pointer"
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
              >
                <Bell size={20} />
              </button>

              {isNotificationsOpen && (
                <div className="absolute right-0 mt-2 w-72 rounded-xl border p-3 shadow-2xl z-50 text-xs" style={{
                  backgroundColor: 'var(--bg-panel)',
                  borderColor: 'var(--line)',
                  color: 'var(--text)'
                }}>
                  <div className="font-semibold text-sm border-b pb-2 mb-2" style={{ borderColor: 'var(--line)' }}>Notifications</div>
                  <div className="space-y-2">
                    {loadingNotifications ? (
                      <p className="text-center py-2" style={{ color: 'var(--text-muted)' }}>Loading...</p>
                    ) : notifications.length === 0 ? (
                      <p className="text-center py-2" style={{ color: 'var(--text-muted)' }}>No notifications yet.</p>
                    ) : (
                      notifications.slice(0, 5).map((notif) => (
                        <div
                          key={notif.id}
                          className="p-2 rounded cursor-pointer hover:bg-white/10"
                          style={{ backgroundColor: notif.isRead ? 'transparent' : 'rgba(255,255,255,0.05)' }}
                          onClick={() => handleMarkNotificationRead(notif.id)}
                        >
                          <p className="font-medium" style={{ color: 'var(--orange-3)' }}>{notif.title}</p>
                          <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{notif.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="header-divider"></div>

            <div className="relative">
              <div
                className="user-menu cursor-pointer"
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              >
                <div className="user-avatar">
                  <div className="avatar-placeholder">
                    {student.name?.charAt(0)}
                  </div>
                </div>
                <div className="user-info">
                  <div className="user-name">{student.name}</div>
                  <div className="user-role">{student.role}</div>
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

        {/* Dashboard Content */}
        <main className="dashboard-content">
          {/* Dashboard Header Section */}
          <section className="dashboard-header-section">
            <div className="greeting-area">
              <h1 className="greeting-title">{getGreeting()}, {student.name} </h1>
              <p className="greeting-subtitle">Here's what's happening with your internship today.</p>
            </div>

            <button className="upload-btn cursor-pointer" onClick={() => navigate('/my-reports', { state: { openUpload: true } })}>
              <Upload size={18} />
              Submit Report
            </button>
          </section>

          {/* Statistics Row */}
          <section className="statistics-row">
            {loadingStats ? (
              Array.from({ length: 5 }).map((_, i) => <StatsSkeleton key={i} />)
            ) : statsError ? (
              <div className="col-span-full p-4 rounded-xl text-center" style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
                <p>{statsError}</p>
              </div>
            ) : (
              <>
                <StatisticsCard
                  title="Overall Progress"
                  value={`${stats?.overallProgress ?? 0}%`}
                  change={stats?.completedTasks > 0 ? `${stats.completedTasks}/${stats.totalTasks} tasks done` : 'No tasks yet'}
                  icon={BarChart3}
                  type="progress"
                  onClick={() => navigate('/student/dashboard')}
                />
                <StatisticsCard
                  title="AI Writing Score"
                  value={stats?.latestAiScore != null ? String(stats.latestAiScore) : '—'}
                  change={stats?.latestAiScore != null ? '/10' : 'No reports analyzed'}
                  icon={Star}
                  type="score"
                  onClick={() => navigate('/ai-analysis')}
                />
                <StatisticsCard
                  title="Reports Submitted"
                  value={stats ? `${stats.submittedReports} / ${stats.totalReports || '—'}` : '—'}
                  change={stats?.totalReports > 0 ? `${Math.round((stats.submittedReports / stats.totalReports) * 100)}% completed` : 'No reports yet'}
                  icon={FileText}
                  type="default"
                  onClick={() => navigate('/my-reports')}
                />
                <StatisticsCard
                  title="Supervisor Feedback"
                  value={stats?.pendingFeedback != null ? String(stats.pendingFeedback) : '—'}
                  change="Pending reviews"
                  icon={MessageSquare}
                  type="default"
                  onClick={() => navigate('/supervisors')}
                />
                <StatisticsCard
                  title="Meetings Completed"
                  value={stats ? `${stats.completedMeetings} / ${stats.totalMeetings}` : '—'}
                  change="Total meetings"
                  icon={Calendar}
                  type="default"
                  onClick={() => navigate('/my-reports')}
                />
              </>
            )}
          </section>

          {/* Main Grid Section */}
          <section className="main-grid">
            {/* Left Column */}
            <div className="grid-col-left">
              <CurrentReportCard />
            </div>

            {/* Right Column */}
            <div className="grid-col-right">
              <InternshipTimeline />
            </div>
          </section>

          {/* Meeting and Tasks Row */}
          <section className="meeting-tasks-row">
            <div className="grid-col-left">
              <UpcomingMeeting />
            </div>
            <div className="grid-col-right">
              <TasksCard />
            </div>
          </section>

          {/* Bottom Grid Section */}
          <section className="bottom-grid">
            <AIAnalysisOverview />
            <AIAssistantCard />
            <FinalGradeCard />
          </section>
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
              >
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Name</p>
                <p className="text-base font-semibold">{student.name}</p>
              </div>
              <div>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Email</p>
                <p className="text-base font-semibold">{student.email}</p>
              </div>
              <div>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Matricule</p>
                <p className="text-base font-semibold">{student.matricule}</p>
              </div>
              <div>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Class</p>
                <p className="text-base font-semibold">{student.class}</p>
              </div>
              {user.internship && (
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

