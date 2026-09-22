import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import logoImg from '@assets/images/logo.png'
import {
  LayoutDashboard,
  FileText,
  PenLine,
  Brain,
  Users,
  Settings,
  Zap,
  ArrowRight,
  Library,
  X,
  Inbox,
  FileCheck,
  Calendar,
  GraduationCap,
  Shield,
  UserRound,
  Briefcase,
  CalendarClock,
  BrainCircuit,
  AlertTriangle,
  Bell,
} from 'lucide-react'
import RoleSwitcher from './RoleSwitcher'
import { useAuth } from '../context/AuthContext'
import '../assets/css/sidebar.css'

export default function Sidebar({ isOpen, onToggle, activeTab, onSelectTab }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()

  const userRole = user?.role || 'student'

  let subtitle = 'STUDENT PORTAL'
  let navItems = []

  if (userRole === 'academic_supervisor') {
    subtitle = 'ACADEMIC SUPERVISOR'
    navItems = [
      {
        icon: Users,
        label: 'My Interns',
        path: '/supervisor',
        tabKey: 'interns',
        active: location.pathname === '/supervisor' && (!activeTab || activeTab === 'interns'),
      },
      {
        icon: FileText,
        label: 'Tasks',
        path: '/supervisor',
        tabKey: 'tasks',
        active: location.pathname === '/supervisor' && activeTab === 'tasks',
      },
      {
        icon: PenLine,
        label: 'Writing Spaces',
        path: '/supervisor',
        tabKey: 'writing',
        active: location.pathname === '/supervisor' && activeTab === 'writing',
      },
      {
        icon: FileCheck,
        label: 'Reports',
        path: '/supervisor',
        tabKey: 'reports',
        active: location.pathname === '/supervisor' && activeTab === 'reports',
      },
      {
        icon: Calendar,
        label: 'Meetings',
        path: '/supervisor',
        tabKey: 'meetings',
        active: location.pathname === '/supervisor' && activeTab === 'meetings',
      },
      {
        icon: GraduationCap,
        label: 'Grading',
        path: '/supervisor',
        tabKey: 'grading',
        active: location.pathname === '/supervisor' && activeTab === 'grading',
      },
      {
        icon: Inbox,
        label: 'Report Reviews',
        path: '/reviews',
        active: location.pathname === '/reviews',
      },
      {
        icon: Library,
        label: 'Report Library',
        path: '/library',
        active: location.pathname === '/library',
      },
      // {
      //   icon: Settings,
      //   label: 'Settings',
      //   path: '/settings',
      //   active: location.pathname === '/settings',
      // },
    ]
  } else if (userRole === 'professional_supervisor') {
    subtitle = 'PROFESSIONAL SUPERVISOR'
    navItems = [
      {
        icon: Users,
        label: 'My Interns',
        path: '/professional-supervisor',
        tabKey: 'interns',
        active: location.pathname === '/professional-supervisor' && (!activeTab || activeTab === 'interns'),
      },
      {
        icon: FileText,
        label: 'Tasks',
        path: '/professional-supervisor',
        tabKey: 'tasks',
        active: location.pathname === '/professional-supervisor' && activeTab === 'tasks',
      },
      {
        icon: PenLine,
        label: 'Writing Spaces',
        path: '/professional-supervisor',
        tabKey: 'writing',
        active: location.pathname === '/professional-supervisor' && activeTab === 'writing',
      },
      {
        icon: Calendar,
        label: 'Meetings',
        path: '/professional-supervisor',
        tabKey: 'meetings',
        active: location.pathname === '/professional-supervisor' && activeTab === 'meetings',
      },
      {
        icon: GraduationCap,
        label: 'Grading',
        path: '/professional-supervisor',
        tabKey: 'grading',
        active: location.pathname === '/professional-supervisor' && activeTab === 'grading',
      },
      {
        icon: Inbox,
        label: 'Report Reviews',
        path: '/reviews',
        active: location.pathname === '/reviews',
      },
      {
        icon: Library,
        label: 'Report Library',
        path: '/library',
        active: location.pathname === '/library',
      },
      // {
      //   icon: Settings,
      //   label: 'Settings',
      //   path: '/settings',
      //   active: location.pathname === '/settings',
      // },
    ]
  } else if (userRole === 'admin') {
    subtitle = 'ADMIN CONSOLE'
    navItems = [
      { icon: LayoutDashboard, label: 'Dashboard', path: '/admin', active: location.pathname === '/admin' },
      { icon: Users, label: 'Users', path: '/admin/users', active: location.pathname.startsWith('/admin/users') },
      { icon: UserRound, label: 'Students', path: '/admin/students', active: location.pathname.startsWith('/admin/students') },
      { icon: Shield, label: 'Supervisors', path: '/admin/supervisors', active: location.pathname.startsWith('/admin/supervisors') },
      { icon: Briefcase, label: 'Internships', path: '/admin/internships', active: location.pathname.startsWith('/admin/internships') },
      { icon: CalendarClock, label: 'Timeline', path: '/admin/timeline', active: location.pathname.startsWith('/admin/timeline') },
      { icon: BrainCircuit, label: 'AI Analysis', path: '/admin/ai-analysis', active: location.pathname.startsWith('/admin/ai-analysis') },
      { icon: AlertTriangle, label: 'Defense Alerts', path: '/admin/defense-alerts', active: location.pathname.startsWith('/admin/defense-alerts') },
      { icon: Bell, label: 'Notifications', path: '/admin/notifications', active: location.pathname.startsWith('/admin/notifications') },
      { icon: Library, label: 'Report Library', path: '/library', active: location.pathname === '/library' },
      { icon: Settings, label: 'Settings', path: '/admin/settings', active: location.pathname.startsWith('/admin/settings') },
    ]
  } else {
    subtitle = 'STUDENT PORTAL'
    navItems = [
      { icon: LayoutDashboard, label: 'Dashboard', path: '/student/dashboard', active: location.pathname === '/student/dashboard' },
      { icon: FileText, label: 'My Reports', path: '/my-reports', active: location.pathname === '/my-reports' },
      { icon: PenLine, label: 'Writing Workspace', path: '/writing-workspace', active: location.pathname === '/writing-workspace' },
      { icon: Brain, label: 'AI Analysis', path: '/ai-analysis', active: location.pathname.startsWith('/ai-analysis') },
      { icon: Users, label: 'Supervisors', path: '/supervisors', active: location.pathname === '/supervisors' },
      { icon: Library, label: 'Report Library', path: '/library', active: location.pathname === '/library' },
      { icon: Settings, label: 'Settings', path: '/settings', active: location.pathname === '/settings' },
    ]
  }

  const handleNavClick = (item) => {
    if (item.tabKey && onSelectTab && location.pathname === item.path) {
      onSelectTab(item.tabKey)
    } else if (item.tabKey && location.pathname !== item.path) {
      navigate(item.path, { state: { tab: item.tabKey } })
    } else {
      navigate(item.path)
    }
  }

  return (
    <>
      {/* Backdrop for mobile */}
      {isOpen && <div className="sidebar-backdrop" onClick={onToggle}></div>}

      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <button className="sidebar-close" onClick={onToggle}>
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
              <div className="logo-subtitle">{subtitle}</div>
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item, index) => {
            const Icon = item.icon
            return (
              <button
                key={index}
                type="button"
                className={`sidebar-nav-item ${item.active ? 'active' : ''}`}
                onClick={() => handleNavClick(item)}
              >
                <Icon size={18} className="nav-icon" />
                <span className="nav-label">{item.label}</span>
              </button>
            )
          })}
          {(userRole === 'academic_supervisor' || userRole === 'professional_supervisor') && (
            <div className="mt-4 pt-4 border-t border-[var(--line)]">
              <RoleSwitcher />
            </div>
          )}
        </nav>

        {/* AI Assistant Card */}
        <div className="sidebar-ai-card">
          <div className="ai-card-icon">✦</div>
          <div className="ai-card-title">AI Assistant</div>
          <p className="ai-card-description">
            {userRole.includes('supervisor')
              ? 'Auto-generate review feedback & rubric criteria.'
              : userRole === 'admin'
              ? 'Monitor platform metrics & AI diagnostics.'
              : 'Ask anything about your internship or reports.'}
          </p>
          <button
            className="ai-card-btn"
            onClick={() => {
              if (userRole === 'admin') navigate('/admin/ai-analysis')
              else if (userRole.includes('supervisor')) navigate('/reviews')
              else navigate('/ai-analysis')
            }}
          >
            Start Assistant
            <ArrowRight size={14} />
          </button>
        </div>

        {/* User Profile Badge */}
        <div className="mt-auto pt-3 border-t border-[var(--line)]">
          <div className="flex items-center gap-3 p-2.5 rounded-xl bg-white/5 border border-[var(--line)]">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F5A623] font-bold text-white shadow-sm">
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-[var(--text)]">{user?.name || 'Logged User'}</p>
              <p className="truncate text-[10px] capitalize text-[var(--text-muted)]">
                {user?.role?.replace('_', ' ') || 'Member'}
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}

