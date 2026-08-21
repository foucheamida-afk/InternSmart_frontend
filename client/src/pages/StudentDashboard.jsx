import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
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
import AnimatedProgressRing from '../components/dashboard/AnimatedProgressRing'
import StatisticsCard from '../components/dashboard/StatisticsCard'
import CurrentReportCard from '../components/dashboard/CurrentReportCard'
import InternshipTimeline from '../components/dashboard/InternshipTimeline'
import UpcomingMeeting from '../components/dashboard/UpcomingMeeting'
import TasksCard from '../components/dashboard/TasksCard'
import AIAnalysisOverview from '../components/dashboard/AIAnalysisOverview'
import AIAssistantCard from '../components/dashboard/AIAssistantCard'
import { useCurrentUser } from '../hooks/useCurrentUser'

const getGreeting = () => {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function StudentDashboard() {
  const navigate = useNavigate()
  const user = useCurrentUser()
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)

  const handleSignOut = () => {
    localStorage.removeItem('internSmart_user')
    localStorage.removeItem('token')
    navigate('/login')
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
              <span>{user.program}</span>
              <span className="separator">•</span>
              <span>{user.department}</span>
            </div>
          </div>

          <div className="header-right">
            <div className="notification-center relative">
              <button
                className="notification-btn cursor-pointer"
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
              >
                <Bell size={20} />
                {user.notifications > 0 && (
                  <span className="notification-badge">{user.notifications}</span>
                )}
              </button>

              {isNotificationsOpen && (
                <div className="absolute right-0 mt-2 w-72 rounded-xl border border-white/10 bg-[#0d1419] p-3 shadow-2xl z-50 text-white text-xs">
                  <div className="font-semibold text-sm border-b border-white/10 pb-2 mb-2">Notifications</div>
                  <div className="space-y-2">
                    <div className="p-2 rounded bg-white/5 cursor-pointer hover:bg-white/10" onClick={() => navigate('/ai-analysis')}>
                      <p className="font-medium text-orange-300">AI Analysis Ready</p>
                      <p className="text-white/60 text-[11px]">Your report received a score of 8.4/10</p>
                    </div>
                    <div className="p-2 rounded bg-white/5 cursor-pointer hover:bg-white/10" onClick={() => navigate('/my-reports')}>
                      <p className="font-medium text-amber-300">Meeting Scheduled</p>
                      <p className="text-white/60 text-[11px]">Review meeting set for Tuesday, May 20</p>
                    </div>
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
                  {user.avatar ? (
                    <img src={user.avatar} alt={user.name} />
                  ) : (
                    <div className="avatar-placeholder">{user.name[0]}</div>
                  )}
                </div>
                <div className="user-info">
                  <div className="user-name">{user.name}</div>
                  <div className="user-role">{user.role}</div>
                </div>
                <ChevronDown size={16} />
              </div>

              {isUserMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 rounded-xl border border-white/10 bg-[#0d1419] p-2 shadow-2xl z-50 text-white text-xs">
                  <button
                    onClick={() => navigate('/student')}
                    className="w-full flex items-center gap-2 p-2 rounded hover:bg-white/10 text-left cursor-pointer"
                  >
                    <User size={14} /> Profile Overview
                  </button>
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-2 p-2 rounded hover:bg-red-500/20 text-red-300 text-left cursor-pointer mt-1"
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
              <h1 className="greeting-title">{getGreeting()}, {user.name} 👋</h1>
              <p className="greeting-subtitle">Here's what's happening with your internship today.</p>
            </div>

            <button className="upload-btn cursor-pointer" onClick={() => navigate('/my-reports')}>
              <Upload size={18} />
              Upload New Report
            </button>
          </section>

          {/* Statistics Row */}
          <section className="statistics-row">
            <StatisticsCard
              title="Overall Progress"
              value="68%"
              change="+12% from last week"
              icon={BarChart3}
              type="progress"
              onClick={() => navigate('/student')}
            />
            <StatisticsCard
              title="AI Writing Score"
              value="8.4"
              change="/10 Very Good"
              icon={Star}
              type="score"
              onClick={() => navigate('/ai-analysis')}
            />
            <StatisticsCard
              title="Reports Submitted"
              value="3 / 4"
              change="75% completed"
              icon={FileText}
              type="default"
              onClick={() => navigate('/my-reports')}
            />
            <StatisticsCard
              title="Supervisor Feedback"
              value="2"
              change="Pending reviews"
              icon={MessageSquare}
              type="default"
              onClick={() => navigate('/supervisor')}
            />
            <StatisticsCard
              title="Meetings Completed"
              value="4 / 6"
              change="This month"
              icon={Calendar}
              type="default"
              onClick={() => navigate('/my-reports')}
            />
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
          </section>
        </main>
      </div>
    </div>
  )
}
