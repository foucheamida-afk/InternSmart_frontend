import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Brain,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Send,
  ArrowRight,
  TrendingUp,
  ShieldCheck,
  BookOpen,
  ChevronDown,
  Bell,
  Menu,
  X,
  User,
  LogOut,
  BarChart3,
  Lightbulb,
  CornerDownRight,
  ThumbsUp,
  Copy,
} from 'lucide-react'
import Sidebar from '../components/Sidebar'
import AnimatedProgressRing from '../components/dashboard/AnimatedProgressRing'
import ThemeToggle from '../components/ThemeToggle'
import '../assets/css/dashboard.css'
import '../assets/css/dashboard-components.css'
import api from "../api/axios";

export default function AIFeedback() {
  const navigate = useNavigate()
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('suggestions')
  const [copiedId, setCopiedId] = useState(null)
  const [chatInput, setChatInput] = useState('')
  const [user, setUser] = useState(null)
  const [loadingUser, setLoadingUser] = useState(true)
  const [showProfileOverview, setShowProfileOverview] = useState(false)

  useEffect(() => {
    const fetchStudentProfile = async () => {
      try {
        const token = localStorage.getItem('token')

        if (!token) {
          navigate('/login')
          return
        }

        const response = await api.get("/students/me")

        setUser(response.data)
      } catch (error) {
        console.error('FETCH STUDENT ERROR:', error)

        if (error.response?.status === 401) {
          localStorage.removeItem('token')
          localStorage.removeItem('user')
          navigate('/login')
          return
        }
      } finally {
        setLoadingUser(false)
      }
    }

    fetchStudentProfile()
  }, [navigate])

  const [messages, setMessages] = useState([])
  const [reports, setReports] = useState([])
  const [selectedReport, setSelectedReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const handleCopy = (id, text) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleSendMessage = (e) => {
    e.preventDefault()
    if (!chatInput.trim()) return

    const userMsg = {
      id: Date.now(),
      sender: 'user',
      text: chatInput,
      time: new Intl.DateTimeFormat('en', { hour: 'numeric', minute: 'numeric' }).format(new Date()),
    }

    setMessages((prev) => [...prev, userMsg])
    setChatInput('')
  }

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const token = localStorage.getItem('token')
        if (!token) {
          navigate('/login')
          return
        }

        setLoading(true)
        const response = await api.get('/students/my-reports')
        const reports = response.data.reports || []
        setReports(reports)

        const withAnalysis = reports.find((r) => r.aiAnalysis || r.aiScore != null)
        if (withAnalysis) {
          setSelectedReport(withAnalysis)
        }
      } catch (err) {
        console.error('Fetch reports error:', err)
        setError('Unable to load your reports.')
      } finally {
        setLoading(false)
      }
    }

    fetchReports()
  }, [])

  return (
    <div className="dashboard-wrapper">
      {/* Sidebar */}
      <Sidebar isOpen={isSidebarOpen} onToggle={() => setIsSidebarOpen(!isSidebarOpen)} />

      {/* Main Content Area */}
      <div className="dashboard-main">
        {/* Top Header */}
        <header className="dashboard-header">
          <div className="header-left">
            <button className="mobile-menu-btn" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
              {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            <div className="program-info">
              <span>{user?.student?.class}</span>
              <span className="separator">•</span>
              <span>{user?.student?.matricule}</span>
            </div>
          </div>

          <div className="header-right">
            <ThemeToggle />

            <div className="relative">
              <div
                className="user-menu cursor-pointer"
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              >
                <div className="user-avatar">
                  <div className="avatar-placeholder">{user?.student?.name?.charAt(0)}</div>
                </div>
                <div className="user-info">
                  <div className="user-name">{user?.student?.name}</div>
                  <div className="user-role">{user?.student?.role}</div>
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
                    onClick={() => navigate('/login')}
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

        {/* AI Feedback Content */}
        <main className="dashboard-content">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-500 border-t-transparent" />
            </div>
          ) : error ? (
            <div className="rounded-2xl border p-8 text-center" style={{ borderColor: 'var(--line)', backgroundColor: 'var(--bg-panel)' }}>
              <AlertTriangle size={24} style={{ color: '#ef4444' }} />
              <p className="text-sm mt-2" style={{ color: '#ef4444' }}>{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-3 rounded-lg bg-[#F5A623] px-4 py-2 text-white text-sm"
              >
                Try Again
              </button>
            </div>
          ) : !selectedReport ? (
            <div className="rounded-2xl border p-8 text-center" style={{ borderColor: 'var(--line)', backgroundColor: 'var(--bg-panel)' }}>
              <Brain size={32} style={{ color: 'var(--text-muted)' }} />
              <h3 className="text-lg font-bold mt-3" style={{ color: 'var(--text)' }}>No AI analysis available</h3>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Submit a report to receive AI feedback and insights.</p>
            </div>
          ) : (
            <>
              {/* Header Banner */}
          <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs uppercase tracking-widest font-semibold mb-1" style={{ color: 'var(--orange-3)' }}>
                <Brain size={16} />
                <span>AI Automated Report Analysis</span>
              </div>
              <h1 className="text-3xl font-bold tracking-tight" style={{ color: 'var(--text)' }}>AI Feedback & Insights</h1>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                Report: <span className="font-medium" style={{ color: 'var(--text-soft)' }}>{selectedReport ? selectedReport.title : 'No report selected'}</span>
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/my-reports')}
                className="px-4 py-2.5 rounded-full border text-xs font-medium transition cursor-pointer flex items-center gap-2"
                style={{
                  borderColor: 'var(--line)',
                  backgroundColor: 'var(--bg-panel)',
                  color: 'var(--text-soft)'
                }}
              >
                <FileText size={14} /> View All Reports
              </button>
              <button
                onClick={() => navigate('/my-reports')}
                className="px-4 py-2.5 rounded-full text-white text-xs font-semibold shadow-lg hover:opacity-90 transition cursor-pointer flex items-center gap-2"
                style={{ background: 'linear-gradient(135deg, var(--orange), var(--orange-3))' }}
              >
                Upload Revision <ArrowRight size={14} />
              </button>
            </div>
          </div>

          {/* Top Score Banner */}
          <div className="grid gap-6 md:grid-cols-3 mb-8">
            <div className="card md:col-span-1 flex flex-col items-center justify-center p-6 text-center">
              <AnimatedProgressRing percentage={selectedReport && selectedReport.aiScore != null ? Math.round((selectedReport.aiScore / 10) * 100) : 0} size={120} strokeWidth={10} />
              <h3 className="text-lg font-bold mt-4" style={{ color: 'var(--text)' }}>Writing Quality Score</h3>
              <p className="text-xs mt-1 max-w-[200px]" style={{ color: 'var(--text-muted)' }}>
                {selectedReport && selectedReport.aiScore != null ? (
                  <>Grade: <strong className="font-semibold" style={{ color: '#10b981' }}>{selectedReport.aiScore}/10</strong></>
                ) : (
                  'No AI analysis available yet.'
                )}
              </p>
            </div>

            <div className="card md:col-span-2 p-6 flex flex-col justify-between">
              <div>
                <h3 className="text-base font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--text)' }}>
                  <TrendingUp size={18} style={{ color: 'var(--orange-3)' }} />
                  Key Category Performance
                </h3>
                {selectedReport && selectedReport.aiAnalysis && selectedReport.aiAnalysis.metrics ? (
                  <div className="space-y-3">
                    {Object.entries(selectedReport.aiAnalysis.metrics).map(([name, score]) => (
                      <div key={name} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="font-medium" style={{ color: 'var(--text-soft)' }}>{name.charAt(0).toUpperCase() + name.slice(1)}</span>
                          <span className="font-bold" style={{ color: 'var(--orange-3)' }}>{score}%</span>
                        </div>
                        <div className="h-2 w-full rounded-full overflow-hidden" style={{ backgroundColor: 'var(--line)' }}>
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${score}%`,
                              background: 'linear-gradient(90deg, var(--orange), var(--orange-3))'
                            }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No category performance data available yet.</p>
                )}
              </div>
            </div>
          </div>

          {/* Main Grid: Suggestions & Interactive AI Assistant */}
          <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
            {/* Left: AI Suggestions List */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: 'var(--text)' }}>
                  <Lightbulb size={18} style={{ color: '#f59e0b' }} />
                  Actionable Recommendations
                </h2>
              </div>

              {selectedReport && selectedReport.aiAnalysis && selectedReport.aiAnalysis.suggestions ? (
                selectedReport.aiAnalysis.suggestions.map((s) => (
                  <div
                    key={s.id || s.title}
                    className="rounded-2xl border p-5 transition hover:border-orange-400/30 shadow-sm"
                    style={{
                      borderColor: 'var(--line)',
                      backgroundColor: 'var(--surface)'
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        {s.section && (
                          <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--orange-3)' }}>
                            {s.section}
                          </span>
                        )}
                        <h4 className="text-sm font-bold mt-1" style={{ color: 'var(--text)' }}>{s.title || s.heading || 'Recommendation'}</h4>
                      </div>

                      {s.type && (
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider ${
                            s.type === 'high'
                              ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                              : s.type === 'medium'
                              ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                              : s.type === 'positive'
                              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                              : 'bg-white/10 text-white/60'
                          }`}
                        >
                          {s.type}
                        </span>
                      )}
                    </div>

                    {s.desc && <p className="text-xs mt-2 leading-relaxed" style={{ color: 'var(--text-soft)' }}>{s.desc}</p>}

                    {s.suggestion && (
                      <div className="mt-3 rounded-xl border p-3 text-xs" style={{
                        borderColor: 'rgba(255, 122, 0, 0.2)',
                        backgroundColor: 'rgba(255, 122, 0, 0.05)',
                        color: 'var(--text-soft)'
                      }}>
                        <div className="flex items-center justify-between text-[10px] font-semibold mb-1" style={{ color: 'var(--orange-3)' }}>
                          <span className="flex items-center gap-1">
                            <CornerDownRight size={12} /> AI Proposed Fix
                          </span>
                          <button
                            onClick={() => handleCopy(s.id || s.title, s.suggestion)}
                            className="hover:opacity-80 flex items-center gap-1 transition cursor-pointer"
                            style={{ color: 'var(--text-soft)' }}
                          >
                            <Copy size={12} />
                            {copiedId === (s.id || s.title) ? 'Copied!' : 'Copy'}
                          </button>
                        </div>
                        <p className="font-mono text-[11px]" style={{ color: 'var(--text)' }}>{s.suggestion}</p>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border p-6 text-center" style={{ borderColor: 'var(--line)', backgroundColor: 'var(--bg-panel)' }}>
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No AI suggestions available yet.</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Submit a report to receive AI feedback.</p>
                </div>
              )}
            </div>

            {/* Right: AI Assistant Chat */}
            <div className="rounded-2xl border p-5 flex flex-col h-[580px] shadow-xl" style={{
              borderColor: 'var(--line)',
              backgroundColor: 'var(--surface)'
            }}>
              <div className="flex items-center gap-3 border-b pb-3 mb-3" style={{ borderColor: 'var(--line)' }}>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border" style={{
                  backgroundColor: 'rgba(255, 122, 0, 0.1)',
                  borderColor: 'rgba(255, 122, 0, 0.25)',
                  color: 'var(--orange-3)'
                }}>
                  <Brain size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold" style={{ color: 'var(--text)' }}>AI Writing Assistant</h3>
                  <p className="text-[10px] flex items-center gap-1" style={{ color: '#10b981' }}>
                    <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ backgroundColor: '#10b981' }}></span> Online
                  </p>
                </div>
              </div>

              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
                {messages.length === 0 ? (
                  <p className="text-center text-xs py-8" style={{ color: 'var(--text-muted)' }}>
                    No messages yet. Ask a question about your report.
                  </p>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl p-3 leading-relaxed ${
                          msg.sender === 'user'
                            ? 'text-white rounded-br-none'
                            : 'border rounded-bl-none'
                        }`}
                        style={{
                          background: msg.sender === 'user'
                            ? 'linear-gradient(135deg, var(--orange), var(--orange-3))'
                            : 'var(--bg-panel)',
                          borderColor: msg.sender === 'user' ? 'transparent' : 'var(--line)',
                          color: msg.sender === 'user' ? 'white' : 'var(--text-soft)'
                        }}
                      >
                        {msg.text}
                      </div>
                      <span className="text-[9px] mt-1 px-1" style={{ color: 'var(--text-muted)' }}>{msg.time}</span>
                    </div>
                  ))
                )}
              </div>

              {/* Quick Prompts */}
              <div className="pt-3 border-t flex flex-wrap gap-1.5 mb-2" style={{ borderColor: 'var(--line)' }}>
                {['Explain suggestion #1', 'How to prepare for defense?', 'Summarize key strengths'].map((quick) => (
                  <button
                    key={quick}
                    onClick={() => setChatInput(quick)}
                    className="text-[10px] px-2.5 py-1 rounded-full border transition cursor-pointer"
                    style={{
                      borderColor: 'var(--line)',
                      backgroundColor: 'var(--bg-panel)',
                      color: 'var(--text-soft)'
                    }}
                  >
                    {quick}
                  </button>
                ))}
              </div>

              {/* Input Form */}
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ask AI anything about your report..."
                  className="flex-1 rounded-xl border px-3.5 py-2.5 text-xs focus:outline-none"
                  style={{
                    borderColor: 'var(--line)',
                    backgroundColor: 'var(--bg)',
                    color: 'var(--text)'
                  }}
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim()}
                  className="rounded-xl px-3.5 py-2.5 text-white hover:opacity-90 disabled:opacity-40 transition cursor-pointer flex items-center justify-center shadow-lg"
                  style={{ backgroundColor: 'var(--orange)' }}
                >
                  <Send size={14} />
                </button>
              </form>
            </div>
          </div>
        </>
      )}
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
                onMouseEnter={(e) => e.target.style.color = 'var(--text)'}
                onMouseLeave={(e) => e.target.style.color = 'var(--text-muted)'}
              >
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Name</p>
                <p className="text-base font-semibold">{user?.student?.name}</p>
              </div>
              <div>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Email</p>
                <p className="text-base font-semibold">{user?.student?.email}</p>
              </div>
              <div>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Matricule</p>
                <p className="text-base font-semibold">{user?.student?.matricule}</p>
              </div>
              <div>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Class</p>
                <p className="text-base font-semibold">{user?.student?.class}</p>
              </div>
              {user?.internship && (
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
