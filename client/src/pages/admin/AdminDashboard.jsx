import { useState, useEffect } from 'react'
import { useNavigate, useLocation, Outlet } from 'react-router-dom'
import {
  Menu,
  X,
  LogOut,
  ChevronDown,
  Shield,
} from 'lucide-react'
import ThemeToggle from '../../components/ThemeToggle'
import Sidebar from '../../components/Sidebar'
import { adminApi } from '../../services/adminService'
import { useAuth } from '../../context/AuthContext'
import { getStoredUser } from '../../utils/storage'
import '../../assets/css/dashboard.css'

export default function AdminDashboard() {
  const navigate = useNavigate()
  const location = useLocation()
  const { logout, user: authUser } = useAuth()
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const [admin, setAdmin] = useState(() => authUser || getStoredUser())
  const [stats, setStats] = useState(null)
  const [loadingStats, setLoadingStats] = useState(true)

  useEffect(() => {
    const adminData = authUser || getStoredUser()
    if (adminData) {
      setAdmin(adminData)
    }
  }, [authUser])

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
    logout()
    navigate('/login')
  }

  return (
    <div className="dashboard-wrapper">
      <Sidebar isOpen={isSidebarOpen} onToggle={() => setIsSidebarOpen(!isSidebarOpen)} />

      {/* Main Content */}
      <div className="dashboard-main">
        <header className="dashboard-header">
          <div className="header-left">
            <button className="mobile-menu-btn" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
              {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            <div className="program-info">
              <Shield size={16} />
              <span>Admin Console</span>
            </div>
          </div>

          <div className="header-right">
            <ThemeToggle />
            <div className="header-divider"></div>
            <div className="relative">
              <div
                className="user-menu cursor-pointer"
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              >
                <div className="user-avatar" style={{ width: 32, height: 32, fontSize: 13 }}>
                  {admin?.name?.charAt(0)?.toUpperCase() || 'A'}
                </div>
                <div className="user-info">
                  <div className="user-name">{admin?.name || 'Admin'}</div>
                  <div className="user-role">{admin?.role === 'admin' ? 'Administrator' : admin?.role?.replace('_', ' ') || 'Administrator'}</div>
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
