import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import logoImg from '../assets/images/logo.png'
import {
  LayoutDashboard,
  FileText,
  Brain,
  Users,
  Settings,
  Zap,
  ArrowRight,
  X,
} from 'lucide-react'
import '../assets/css/sidebar.css'

export default function Sidebar({ isOpen, onToggle }) {
  const navigate = useNavigate()
  const location = useLocation()

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/student', active: location.pathname === '/student' },
    { icon: FileText, label: 'My Reports', path: '/my-reports', active: location.pathname === '/my-reports' },
    { icon: Brain, label: 'AI Analysis', path: '/ai-analysis', active: location.pathname.startsWith('/ai-analysis') },
    { icon: Users, label: 'Supervisors', path: '/supervisors', active: location.pathname === '/supervisors' },
    { icon: Settings, label: 'Settings', path: '/settings', active: location.pathname === '/settings' },
  ]

  return (
    <>
      {/* Backdrop for mobile */}
      {isOpen && <div className="sidebar-backdrop" onClick={onToggle}></div>}

      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <button className="sidebar-close" onClick={onToggle}>
            <X size={24} />
          </button>
             <div className='flex'>
                 <div>
                <img
                  src={logoImg}
                  alt="InternSmart logo"
                  className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F5A623] shadow-sm transition group-hover:scale-105"
                />
              </div>
              <div>
                <p className="text-xl font-bold tracking-tight text-white relative left-3 pt-2">InternSmart</p>
              </div>
             </div>
           
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item, index) => (
            <button
              key={index}
              type="button"
              className={`sidebar-nav-item ${item.active ? 'active' : ''}`}
              onClick={() => navigate(item.path)}
            >
              <item.icon size={18} className="nav-icon" />
              <span className="nav-label">{item.label}</span>
            </button>
          ))}
        </nav>

        {/* AI Assistant Card */}
        <div className="sidebar-ai-card">
          <div className="ai-card-icon">✦</div>
          <div className="ai-card-title">AI Assistant</div>
          <p className="ai-card-description">Ask anything about your internship or reports.</p>
          <button className="ai-card-btn" onClick={() => navigate('/ai-analysis')}>
            Start Chat
            <ArrowRight size={14} />
          </button>
        </div>
      </aside>
    </>
  )
}
