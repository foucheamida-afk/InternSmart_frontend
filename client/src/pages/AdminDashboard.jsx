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
} from 'lucide-react'
import '../assets/css/dashboard.css'
import '../assets/css/dashboard-components.css'
import '../assets/css/sidebar.css'

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
    const matchesRole = roleFilter === 'all' || u.role.toLowerCase() === roleFilter.toLowerCase()
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
            <div className="logo-text">
              <div className="logo-brand">InternSmart</div>
              <div className="logo-subtitle">ADMIN PORTAL</div>
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

          {/* User Management Section */}
          <div className="card">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-white/10 pb-4 mb-4">
              <div>
                <h3 className="card-title">Managed User Accounts ({filteredUsers.length})</h3>
                <p className="text-xs text-white/50">Accounts provisioned by administrator</p>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={14} />
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search users..."
                    className="rounded-xl border border-white/10 bg-[#070b0e] pl-9 pr-3 py-1.5 text-xs text-white placeholder:text-white/30 focus:border-orange-400 focus:outline-none"
                  />
                </div>

                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="rounded-xl border border-white/10 bg-[#070b0e] px-3 py-1.5 text-xs text-white focus:border-orange-400 focus:outline-none"
                >
                  <option value="all">All Roles</option>
                  <option value="student">Student</option>
                  <option value="supervisor">Supervisor</option>
                </select>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-white/80">
                <thead>
                  <tr className="border-b border-white/8 text-[11px] uppercase tracking-wider text-white/40">
                    <th className="pb-3 font-semibold">User</th>
                    <th className="pb-3 font-semibold">Role</th>
                    <th className="pb-3 font-semibold">Department</th>
                    <th className="pb-3 font-semibold">Status</th>
                    <th className="pb-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-white/3 transition">
                      <td className="py-3.5">
                        <div className="font-semibold text-white">{u.name}</div>
                        <div className="text-[11px] text-white/40">{u.email}</div>
                      </td>
                      <td className="py-3.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                            u.role === 'Student'
                              ? 'bg-orange-500/15 text-orange-300 border border-orange-500/30'
                              : 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30'
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3.5 text-white/70">{u.department}</td>
                      <td className="py-3.5">
                        <span className="inline-flex items-center gap-1 text-emerald-400">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
                          {u.status}
                        </span>
                      </td>
                      <td className="py-3.5 text-right">
                        <button
                          onClick={() => handleDeleteUser(u.id)}
                          className="p-1.5 rounded-lg text-white/40 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
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
              <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0d1419] p-6 shadow-2xl text-white">
                <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
                  <div>
                    <h3 className="text-base font-bold text-white">Provision New User Account</h3>
                    <p className="text-xs text-white/50">Admin creates user credentials</p>
                  </div>
                  <button
                    onClick={() => setIsCreateUserModalOpen(false)}
                    className="rounded-full p-1 hover:bg-white/10 text-white/70 hover:text-white transition cursor-pointer"
                  >
                    <X size={18} />
                  </button>
                </div>

                <form onSubmit={handleCreateUser} className="space-y-4 text-xs">
                  <div>
                    <label className="block text-white/70 font-semibold mb-1">Full Name</label>
                    <input
                      required
                      value={newUser.name}
                      onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                      placeholder="e.g. John Doe"
                      className="w-full rounded-xl border border-white/10 bg-[#070b0e] p-2.5 text-xs text-white placeholder:text-white/30 focus:border-orange-400 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-white/70 font-semibold mb-1">Institutional Email</label>
                    <input
                      required
                      type="email"
                      value={newUser.email}
                      onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                      placeholder="e.g. j.doe@internsmart.edu"
                      className="w-full rounded-xl border border-white/10 bg-[#070b0e] p-2.5 text-xs text-white placeholder:text-white/30 focus:border-orange-400 focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-white/70 font-semibold mb-1">Role</label>
                      <select
                        value={newUser.role}
                        onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                        className="w-full rounded-xl border border-white/10 bg-[#070b0e] p-2.5 text-xs text-white focus:border-orange-400 focus:outline-none"
                      >
                        <option value="Student">Student</option>
                        <option value="Supervisor">Supervisor</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-white/70 font-semibold mb-1">Department</label>
                      <select
                        value={newUser.department}
                        onChange={(e) => setNewUser({ ...newUser, department: e.target.value })}
                        className="w-full rounded-xl border border-white/10 bg-[#070b0e] p-2.5 text-xs text-white focus:border-orange-400 focus:outline-none"
                      >
                        <option value="Software Engineering">Software Engineering</option>
                        <option value="Cloud Computing">Cloud Computing</option>
                        <option value="Cybersecurity">Cybersecurity</option>
                        <option value="Data Science">Data Science</option>
                      </select>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-white/10 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsCreateUserModalOpen(false)}
                      className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white transition cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold shadow-lg transition cursor-pointer"
                    >
                      Save & Provision Account
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
