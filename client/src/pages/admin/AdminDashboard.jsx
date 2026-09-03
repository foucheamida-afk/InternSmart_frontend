import { useState, useEffect } from 'react'
import { useNavigate, useLocation, Outlet } from 'react-router-dom'
import logoImg from '@assets/images/logo.png'
import {
  LayoutDashboard,
  Users,
  UserRound,
  Briefcase,
  FileText,
  BrainCircuit,
  CalendarDays,
  AlertTriangle,
  Bell,
  Settings,
  Menu,
  X,
  LogOut,
  ChevronDown,
  Shield,
  CalendarClock,
} from 'lucide-react'
import ThemeToggle from '../../components/ThemeToggle'
import { adminApi } from '../../services/adminService'
import '../../assets/css/dashboard.css'

const navItems = [
  { path: '/admin', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { path: '/admin/users', icon: Users, label: 'Users' },
  { path: '/admin/students', icon: UserRound, label: 'Students' },
  { path: '/admin/supervisors', icon: Shield, label: 'Supervisors' },
  { path: '/admin/internships', icon: Briefcase, label: 'Internships' },
  { path: '/admin/timeline', icon: CalendarClock, label: 'Internship Timeline' },
  { path: '/admin/ai-analysis', icon: BrainCircuit, label: 'AI Analysis' },
  { path: '/admin/defense-alerts', icon: AlertTriangle, label: 'Defense Alerts' },
  { path: '/admin/notifications', icon: Bell, label: 'Notifications' },
  { path: '/admin/settings', icon: Settings, label: 'Settings' },
]

export default function AdminDashboard() {
  const navigate = useNavigate()
  const location = useLocation()
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const [admin, setAdmin] = useState(null)
  const [stats, setStats] = useState(null)
  const [loadingStats, setLoadingStats] = useState(true)

  useEffect(() => {
    const adminData = localStorage.getItem('user')
    if (adminData) {
      try {
        setAdmin(JSON.parse(adminData))
      } catch {
        // ignore
      }
    }
  }, [])

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await adminApi.getDashboardStats()
        setStats(data)
      } catch {
        // no data
      } finally {
        setLoadingStats(false)
      }
    }
    fetchStats()
  }, [])

  const handleSignOut = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    navigate('/login')
  }

  const isActive = (path, end = false) => {
    if (end) return location.pathname === path
    return location.pathname.startsWith(path)
  }

  return (
    <div className="dashboard-wrapper">
      {/* Sidebar */}
      <aside className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
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
              <div className="logo-subtitle">ADMIN CONSOLE</div>
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const Icon = item.icon
            const active = isActive(item.path, item.end)
            return (
              <button
                key={item.path}
                type="button"
                onClick={() => navigate(item.path)}
                className={`sidebar-nav-item ${active ? 'active' : ''}`}
              >
                <Icon size={18} className="nav-icon" />
                <span className="nav-label">{item.label}</span>
              </button>
            )
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="relative">
            <div
              className="user-menu cursor-pointer"
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            >
              <div className="user-avatar">
                {admin?.name?.charAt(0)?.toUpperCase() || 'A'}
              </div>
              <div className="user-info">
                <div className="user-name">{admin?.name || 'Admin'}</div>
                <div className="user-role">{admin?.role === 'admin' ? 'Administrator' : admin?.role?.replace('_', ' ') || 'Administrator'}</div>
              </div>
              <ChevronDown size={16} />
            </div>

            {isUserMenuOpen && (
              <div className="absolute right-0 bottom-full mb-2 w-48 rounded-xl border p-2 shadow-2xl z-50 text-xs" style={{
                backgroundColor: 'var(--bg-panel)',
                borderColor: 'var(--line)',
                color: 'var(--text)'
              }}>
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-2 p-2 rounded text-left cursor-pointer"
                  style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444' }}
                >
                  <LogOut size={14} /> Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="dashboard-main">
        <header className="dashboard-header">
          <div className="header-left">
            <button className="mobile-menu-btn" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
              {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            <h1 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>
              {navItems.find(item => isActive(item.path, item.end))?.label || 'Dashboard'}
            </h1>
          </div>

          <div className="header-right">
            <ThemeToggle />
            <div className="header-divider"></div>
            <div className="user-avatar" style={{ width: 32, height: 32, fontSize: 13 }}>
              {admin?.name?.charAt(0)?.toUpperCase() || 'A'}
            </div>
          </div>
        </header>

        <main className="dashboard-content">
          <Outlet context={{ admin, stats, loadingStats, refreshStats: () => {
            setLoadingStats(true)
            adminApi.getDashboardStats().then(data => {
              setStats(data)
              setLoadingStats(false)
            }).catch(() => setLoadingStats(false))
          }}} />
        </main>
      </div>
    </div>
  )
}
