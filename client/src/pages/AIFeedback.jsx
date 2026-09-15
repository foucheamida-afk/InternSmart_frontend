import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Brain,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
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
  History,
  Loader2,
  Maximize2,
  Minimize2,
  Split,
  MessageSquare,
} from 'lucide-react'
import Sidebar from '../components/Sidebar'
import AnimatedProgressRing from '../components/dashboard/AnimatedProgressRing'
import ThemeToggle from '../components/ThemeToggle'
import '../assets/css/dashboard.css'
import '../assets/css/dashboard-components.css'
import api from "../api/axios";
import { askWritingAssistant } from "../services/aiService";
import { getStoredToken, clearStoredAuth } from "../utils/storage";

export default function AIFeedback() {
  const navigate = useNavigate()
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('suggestions')
  const [copiedId, setCopiedId] = useState(null)
  const [chatInput, setChatInput] = useState('')
  const [quota, setQuota] = useState(null)
  const [isSending, setIsSending] = useState(false)
  const [showChatHistory, setShowChatHistory] = useState(false)
  const [chatHistory, setChatHistory] = useState([])
  const [activeChatId, setActiveChatId] = useState(null)
  const [showErrorInspector, setShowErrorInspector] = useState(false)
  const [expandedViewMode, setExpandedViewMode] = useState('split') // 'split' | 'chat' | 'errors'
  const [expandedErrorId, setExpandedErrorId] = useState(null)
  const [activeMessageErrorId, setActiveMessageErrorId] = useState(null)
  const [user, setUser] = useState(null)
  const [loadingUser, setLoadingUser] = useState(true)
  const [showProfileOverview, setShowProfileOverview] = useState(false)

  useEffect(() => {
    const fetchStudentProfile = async () => {
      try {
        const token = getStoredToken()

        if (!token) {
          navigate('/login')
          return
        }

        const response = await api.get("/students/me")

        setUser(response.data)
      } catch (error) {
        console.error('FETCH STUDENT ERROR:', error)

        if (error.response?.status === 401) {
          clearStoredAuth()
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

  const chatStorageKey = selectedReport ? `internsmart-ai-chats-${selectedReport.id}` : null

  const saveChatHistory = (nextMessages, existingHistory = chatHistory, currentId = activeChatId) => {
    if (!chatStorageKey || nextMessages.length === 0) return
    const now = new Date().toISOString()
    const chatId = currentId || `${Date.now()}`
    const existingChat = existingHistory.find((chat) => chat.id === chatId)
    const nextChat = {
      id: chatId,
      createdAt: existingChat?.createdAt || now,
      updatedAt: now,
      messages: nextMessages,
    }
    const nextHistory = existingHistory.some((chat) => chat.id === chatId)
      ? existingHistory.map((chat) => chat.id === chatId ? nextChat : chat)
      : [nextChat, ...existingHistory]
    setActiveChatId(chatId)
    setChatHistory(nextHistory)
    localStorage.setItem(chatStorageKey, JSON.stringify(nextHistory))
  }

  useEffect(() => {
    if (!chatStorageKey) return
    try {
      const stored = JSON.parse(localStorage.getItem(chatStorageKey) || '[]')
      const history = Array.isArray(stored) ? stored : []
      setChatHistory(history)
      const latest = history[0]
      setActiveChatId(latest?.id || null)
      setMessages(latest?.messages || [])
    } catch {
      setChatHistory([])
      setActiveChatId(null)
      setMessages([])
    }
  }, [chatStorageKey])

  const handleCopy = (id, text) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleSendMessage = async (e) => {
    e.preventDefault()
    if (!chatInput.trim() || !selectedReport || isSending) return

    const question = chatInput.trim()
    const chatId = activeChatId || `${Date.now()}`

    const userMsg = {
      id: Date.now(),
      sender: 'user',
      text: question,
      time: new Intl.DateTimeFormat('en', { hour: 'numeric', minute: 'numeric' }).format(new Date()),
    }

    const nextMessages = [...messages, userMsg]
    setMessages(nextMessages)
    saveChatHistory(nextMessages, chatHistory, chatId)
    setChatInput('')
    setIsSending(true)

    try {
      const data = await askWritingAssistant(selectedReport.id, question)
      setQuota(data.quota)
      const assistantMessage = {
        id: Date.now() + 1,
        sender: 'ai',
        text: data.answer,
        time: new Intl.DateTimeFormat('en', { hour: 'numeric', minute: 'numeric' }).format(new Date()),
      }
      setMessages((prev) => {
        const updated = [...prev, assistantMessage]
        saveChatHistory(updated, chatHistory, chatId)
        return updated
      })
    } catch (err) {
      const errorMessage = {
        id: Date.now() + 1,
        sender: 'ai',
        text: err.response?.data?.message || 'The assistant could not answer this request.',
        time: new Intl.DateTimeFormat('en', { hour: 'numeric', minute: 'numeric' }).format(new Date()),
      }
      setMessages((prev) => {
        const updated = [...prev, errorMessage]
        saveChatHistory(updated, chatHistory, chatId)
        return updated
      })
    } finally {
      setIsSending(false)
    }
  }

  const openPastChat = (chat) => {
    setActiveChatId(chat.id)
    setMessages(chat.messages || [])
    setShowChatHistory(false)
  }

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const token = getStoredToken()
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
        const quotaResponse = await api.get('/ai/writing-assistant/quota')
        setQuota(quotaResponse.data)
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
              <p className="text-xs mt-1 max-w-50" style={{ color: 'var(--text-muted)' }}>
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
                            <CornerDownRight size={12} /> Recommendation
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
            {(() => {
              const reportErrorItems = (selectedReport?.aiAnalysis?.suggestions || []).map((s, idx) => ({
                id: s.id || idx + 1,
                section: s.section || 'General Section',
                category: s.category || s.type || 'Writing Issue',
                originalText: s.originalText || s.location || s.title || 'Extracted text section',
                explanation: s.desc || s.explanation || 'Academic requirement, structure, or clarity issue.',
                suggestedAnswer: s.suggestion || s.suggestedAnswer || 'Revise text to match academic formatting and guidelines.',
                type: s.type || 'medium'
              }));

              return (
                <div className="rounded-2xl border p-5 flex flex-col h-145 shadow-xl" style={{
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
                      {quota && <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>{quota.requestsRemaining} of {quota.limit} requests remaining today</p>}
                    </div>

                    <div className="ml-auto flex items-center gap-1.5">
                      {/* Expand Chatbot & Section Errors Widely Icon Button */}
                      <button
                        type="button"
                        title="Expand Chatbot & Section Errors Widely"
                        aria-label="Expand Chatbot & Section Errors"
                        onClick={() => {
                          setShowErrorInspector(true);
                          setShowChatHistory(false);
                        }}
                        className="rounded-xl border p-2 transition cursor-pointer flex items-center justify-center bg-orange-500/10 border-orange-500/30 text-orange-400 hover:bg-orange-500/20 hover:border-orange-500/50 shadow-sm"
                      >
                        <Maximize2 size={16} />
                      </button>

                      {/* Error & Solution Inspector Icon Button */}
                      <button
                        type="button"
                        title="Inspect Exact Errors, Explanations & Suggested Answers"
                        aria-label="Inspect Exact Errors & Suggested Answers"
                        onClick={() => {
                          setShowErrorInspector(true);
                          setShowChatHistory(false);
                        }}
                        className={`relative rounded-xl border p-2 transition cursor-pointer flex items-center justify-center ${
                          showErrorInspector
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-md ring-2 ring-amber-500/30'
                            : 'hover:bg-amber-500/10 hover:border-amber-500/30 border-[var(--line)] text-amber-400 bg-[var(--bg-panel)]'
                        }`}
                      >
                        <AlertCircle size={17} className={reportErrorItems.length > 0 ? "animate-pulse text-amber-400" : ""} />
                        {reportErrorItems.length > 0 && (
                          <span className="absolute -top-1.5 -right-1.5 rounded-full bg-amber-500 text-black px-1.5 py-0.2 text-[9px] font-bold shadow">
                            {reportErrorItems.length}
                          </span>
                        )}
                      </button>

                      {/* Chat History Icon Button */}
                      <button
                        type="button"
                        title="Open chat history"
                        aria-label="Open chat history"
                        onClick={() => {
                          setShowChatHistory((visible) => !visible);
                          setShowErrorInspector(false);
                        }}
                        className="rounded-lg border p-2 transition hover:opacity-80 cursor-pointer"
                        style={{ borderColor: 'var(--line)', color: 'var(--text-soft)', backgroundColor: 'var(--bg-panel)' }}
                      >
                        <History size={15} />
                      </button>
                    </div>
                  </div>

                  {showChatHistory && (
                    <div className="mb-3 rounded-xl border p-3 max-h-44 overflow-y-auto" style={{ borderColor: 'var(--line)', backgroundColor: 'var(--bg-panel)' }}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold" style={{ color: 'var(--text)' }}>Past chats</span>
                        <button type="button" onClick={() => setShowChatHistory(false)} aria-label="Close chat history" className="cursor-pointer" style={{ color: 'var(--text-muted)' }}><X size={14} /></button>
                      </div>
                      {chatHistory.length === 0 ? (
                        <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>No saved chats for this report.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {chatHistory.map((chat) => {
                            const firstQuestion = chat.messages?.find((message) => message.sender === 'user')?.text || 'Chat conversation'
                            return (
                              <button
                                type="button"
                                key={chat.id}
                                onClick={() => openPastChat(chat)}
                                className="w-full text-left rounded-lg p-2 transition hover:opacity-80 cursor-pointer"
                                style={{ backgroundColor: chat.id === activeChatId ? 'rgba(255,122,0,0.1)' : 'transparent', color: 'var(--text-soft)' }}
                              >
                                <span className="block truncate text-[11px]">{firstQuestion}</span>
                                <span className="block text-[9px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{new Date(chat.updatedAt).toLocaleString()}</span>
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Chat Messages */}
                  <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
                    {messages.length === 0 ? (
                      <div className="text-center text-xs py-8 space-y-2" style={{ color: 'var(--text-muted)' }}>
                        <p>No messages yet. Ask a question about your report.</p>
                        {reportErrorItems.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setShowErrorInspector(true)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[11px] font-medium hover:bg-amber-500/20 cursor-pointer"
                          >
                            <AlertCircle size={13} /> Expand {reportErrorItems.length} Detected Errors & Solutions
                          </button>
                        )}
                      </div>
                    ) : (
                      messages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                        >
                          <div
                            className={`max-w-[85%] rounded-2xl p-3 leading-relaxed relative group ${
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

                            {/* Inline Inspect Errors Icon for AI Messages */}
                            {msg.sender === 'ai' && reportErrorItems.length > 0 && (
                              <button
                                type="button"
                                title="Expand exact errors & suggested answer"
                                onClick={() => setShowErrorInspector(true)}
                                className="mt-2 text-[10px] flex items-center gap-1 text-amber-400 hover:underline cursor-pointer border-t border-white/10 pt-1.5 w-full font-semibold"
                              >
                                <Maximize2 size={12} />
                                Expand exact errors & chat view
                              </button>
                            )}
                          </div>
                          <span className="text-[9px] mt-1 px-1" style={{ color: 'var(--text-muted)' }}>{msg.time}</span>
                        </div>
                      ))
                    )}
                    {isSending && (
                      <div className="flex items-center gap-2 text-[11px] px-1" style={{ color: 'var(--text-muted)' }} aria-live="polite">
                        <Loader2 size={14} className="animate-spin" style={{ color: 'var(--orange-3)' }} />
                        <span>AI is reviewing your report and preparing an answer...</span>
                      </div>
                    )}
                  </div>

                  {/* Quick Prompts */}
                  <div className="pt-3 border-t flex flex-wrap gap-1.5 mb-2" style={{ borderColor: 'var(--line)' }}>
                    {['Inspect exact errors & fixes', 'Explain suggestion #1', 'How to prepare for defense?'].map((quick) => (
                      <button
                        key={quick}
                        onClick={() => {
                          if (quick === 'Inspect exact errors & fixes') {
                            setShowErrorInspector(true);
                          } else {
                            setChatInput(quick);
                          }
                        }}
                        disabled={isSending}
                        className="text-[10px] px-2.5 py-1 rounded-full border transition cursor-pointer hover:border-amber-400/50"
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
                      disabled={isSending}
                    />
                    <button
                      type="submit"
                      disabled={!chatInput.trim() || isSending || !selectedReport}
                      className="rounded-xl px-3.5 py-2.5 text-white hover:opacity-90 disabled:opacity-40 transition cursor-pointer flex items-center justify-center shadow-lg"
                      style={{ backgroundColor: 'var(--orange)' }}
                    >
                      {isSending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    </button>
                  </form>
                </div>
              );
            })()}
          </div>

          {/* Expanded Chatbot & Error Inspector Modal Overlay */}
          {showErrorInspector && (() => {
            const reportErrorItems = (selectedReport?.aiAnalysis?.suggestions && selectedReport.aiAnalysis.suggestions.length > 0)
              ? selectedReport.aiAnalysis.suggestions.map((s, idx) => ({
                  id: s.id || idx + 1,
                  section: s.section || 'Specification & Analysis Section',
                  category: s.category || s.type || 'Academic Structure',
                  originalText: s.originalText || s.location || s.title || 'Informal phrasing or missing requirement in report.',
                  explanation: s.desc || s.explanation || 'Requires formal academic wording and clear technical methodology.',
                  suggestedAnswer: s.suggestion || s.suggestedAnswer || 'Update text with precise technical terminology and proper citation.',
                  type: s.type || 'medium'
                }))
              : [
                  {
                    id: 1,
                    section: 'Specification Book',
                    category: 'Functional Requirements',
                    originalText: 'The user story for supervisor task approvals lacks precondition details and role matrix.',
                    explanation: 'Academic standards require explicit specification of primary actors, system preconditions, and state transition diagrams.',
                    suggestedAnswer: 'Define explicit roles (Student, Academic Supervisor, Professional Supervisor) and detail state transitions (pending -> submitted -> needs_revision -> completed).',
                    type: 'high'
                  },
                  {
                    id: 2,
                    section: 'Architecture & Design',
                    category: 'Technical Terminology',
                    originalText: 'We stored data in the server database.',
                    explanation: 'Informal terminology ("stored data"). Academic reports require precise architectural description.',
                    suggestedAnswer: 'Rephrase to: "Data persistence is managed through PostgreSQL via a Sequelize ORM data access layer with transactional consistency."',
                    type: 'medium'
                  },
                  {
                    id: 3,
                    section: 'Conclusion & Metrics',
                    category: 'Synthesis & Results',
                    originalText: 'The project was successful and all goals were reached.',
                    explanation: 'Lacks quantitative performance metrics, user evaluation results, or future development perspectives.',
                    suggestedAnswer: 'Include quantitative KPIs (e.g., 95% system test coverage, <200ms API response time) and outline phase II scalability roadmap.',
                    type: 'low'
                  }
                ];

            return (
              <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex flex-col z-50 p-4 md:p-6 overflow-hidden">
                <div className="rounded-2xl border shadow-2xl w-full h-full flex flex-col overflow-hidden" style={{
                  backgroundColor: 'var(--bg-panel)',
                  borderColor: 'var(--line)',
                  color: 'var(--text)'
                }}>
                  {/* Modal Header */}
                  <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b shrink-0" style={{ borderColor: 'var(--line)' }}>
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-orange-500/10 border border-orange-500/30 text-orange-400">
                        <Brain size={24} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-base md:text-lg font-bold text-orange-400">Expanded AI Chatbot & Section Error Workspace</h2>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                            Live Dual View
                          </span>
                        </div>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          Report: <strong>{selectedReport?.title || 'Active Report'}</strong> • {reportErrorItems.length} Section Issue{reportErrorItems.length === 1 ? '' : 's'} Identified
                        </p>
                      </div>
                    </div>

                    {/* View Mode Toggle Controls */}
                    <div className="flex items-center gap-2 bg-[var(--bg)] p-1 rounded-xl border border-[var(--line)]">
                      <button
                        type="button"
                        onClick={() => setExpandedViewMode('split')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                          expandedViewMode === 'split'
                            ? 'bg-orange-500 text-white shadow'
                            : 'text-[var(--text-soft)] hover:text-[var(--text)]'
                        }`}
                      >
                        <Split size={14} /> Split View
                      </button>
                      <button
                        type="button"
                        onClick={() => setExpandedViewMode('chat')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                          expandedViewMode === 'chat'
                            ? 'bg-orange-500 text-white shadow'
                            : 'text-[var(--text-soft)] hover:text-[var(--text)]'
                        }`}
                      >
                        <MessageSquare size={14} /> Wide Chat
                      </button>
                      <button
                        type="button"
                        onClick={() => setExpandedViewMode('errors')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                          expandedViewMode === 'errors'
                            ? 'bg-orange-500 text-white shadow'
                            : 'text-[var(--text-soft)] hover:text-[var(--text)]'
                        }`}
                      >
                        <AlertCircle size={14} /> Section Errors ({reportErrorItems.length})
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowErrorInspector(false)}
                      className="p-2 rounded-xl hover:bg-white/10 text-gray-400 hover:text-white transition cursor-pointer border border-transparent hover:border-white/20"
                      title="Exit expanded view"
                    >
                      <Minimize2 size={20} />
                    </button>
                  </div>

                  {/* Modal Body Container */}
                  <div className="flex-1 min-h-0 p-4 md:p-6 overflow-hidden">
                    <div className={`h-full gap-6 overflow-hidden ${
                      expandedViewMode === 'split' ? 'grid grid-cols-1 lg:grid-cols-2' : 'flex flex-col max-w-4xl mx-auto'
                    }`}>

                      {/* ── LEFT PANE: WIDE AI CHATBOT INTERFACE ── */}
                      {(expandedViewMode === 'split' || expandedViewMode === 'chat') && (
                        <div className="flex flex-col h-full rounded-2xl border p-4 overflow-hidden relative" style={{
                          borderColor: 'var(--line)',
                          backgroundColor: 'var(--bg-card)'
                        }}>
                          <div className="flex items-center justify-between pb-3 border-b mb-3 shrink-0" style={{ borderColor: 'var(--line)' }}>
                            <div className="flex items-center gap-2">
                              <Sparkles size={16} className="text-orange-400" />
                              <h3 className="text-sm font-bold" style={{ color: 'var(--text)' }}>AI Writing Assistant Conversation</h3>
                            </div>
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-300 font-mono">
                              {messages.length} Messages
                            </span>
                          </div>

                          {/* Chat History Messages Stream */}
                          <div className="flex-1 overflow-y-auto space-y-3.5 pr-2 text-xs">
                            {messages.length === 0 ? (
                              <div className="text-center text-xs py-16 space-y-3" style={{ color: 'var(--text-muted)' }}>
                                <Brain size={36} className="mx-auto opacity-50 text-orange-400" />
                                <p className="font-semibold text-sm">AI Assistant Ready</p>
                                <p>Ask any question about your internship report or click an error section on the right to inspect solutions.</p>
                              </div>
                            ) : (
                              messages.map((msg) => (
                                <div
                                  key={msg.id}
                                  className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                                >
                                  <div
                                    className={`max-w-[85%] rounded-2xl p-4 leading-relaxed text-xs shadow-md ${
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
                                    <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                                  </div>
                                  <span className="text-[9px] mt-1 px-1" style={{ color: 'var(--text-muted)' }}>{msg.time}</span>
                                </div>
                              ))
                            )}
                            {isSending && (
                              <div className="flex items-center gap-2 text-[11px] px-2 py-1 text-orange-400 animate-pulse">
                                <Loader2 size={15} className="animate-spin" />
                                <span>AI is analyzing report sections and drafting answer...</span>
                              </div>
                            )}
                          </div>

                          {/* Expanded Interactive Input Form */}
                          <form onSubmit={handleSendMessage} className="flex gap-2 pt-3 border-t mt-3 shrink-0" style={{ borderColor: 'var(--line)' }}>
                            <input
                              value={chatInput}
                              onChange={(e) => setChatInput(e.target.value)}
                              placeholder="Type a message or question for AI assistant..."
                              className="flex-1 rounded-xl border px-4 py-3 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                              style={{
                                borderColor: 'var(--line)',
                                backgroundColor: 'var(--bg)',
                                color: 'var(--text)'
                              }}
                              disabled={isSending}
                            />
                            <button
                              type="submit"
                              disabled={!chatInput.trim() || isSending || !selectedReport}
                              className="rounded-xl px-5 py-3 text-white font-semibold text-xs hover:opacity-90 disabled:opacity-40 transition cursor-pointer flex items-center gap-2 shadow-lg"
                              style={{ backgroundColor: 'var(--orange)' }}
                            >
                              {isSending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                              <span>Send</span>
                            </button>
                          </form>
                        </div>
                      )}

                      {/* ── RIGHT PANE: REPORT SECTIONS ERROR INSPECTOR ── */}
                      {(expandedViewMode === 'split' || expandedViewMode === 'errors') && (
                        <div className="flex flex-col h-full rounded-2xl border p-4 overflow-hidden" style={{
                          borderColor: 'var(--line)',
                          backgroundColor: 'var(--bg-card)'
                        }}>
                          <div className="flex items-center justify-between pb-3 border-b mb-3 shrink-0" style={{ borderColor: 'var(--line)' }}>
                            <div className="flex items-center gap-2">
                              <AlertCircle size={16} className="text-amber-400" />
                              <h3 className="text-sm font-bold text-amber-300">Detected Section Errors & Suggested Fixes</h3>
                            </div>
                            <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono font-bold border border-amber-500/30">
                              {reportErrorItems.length} Issues Found
                            </span>
                          </div>

                          {/* Scrollable Error Cards */}
                          <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                            {reportErrorItems.map((item) => (
                              <div
                                key={item.id}
                                className="rounded-xl border p-4 text-xs transition space-y-3 hover:border-amber-500/40"
                                style={{ borderColor: 'var(--line)', backgroundColor: 'var(--bg-panel)' }}
                              >
                                {/* Section & Priority Header */}
                                <div className="flex items-center justify-between flex-wrap gap-2">
                                  <span className="text-[11px] px-3 py-1 rounded-full font-mono font-bold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                    Section: {item.section} • {item.category}
                                  </span>
                                  <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase ${
                                    item.type === 'high' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                  }`}>
                                    {item.type} priority
                                  </span>
                                </div>

                                {/* Exact Error Snippet */}
                                <div className="rounded-xl p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-200">
                                  <strong className="block text-[10px] text-rose-400 uppercase tracking-wider mb-1 flex items-center gap-1.5 font-bold">
                                    <AlertTriangle size={14} /> Exact Error / Problematic Passage:
                                  </strong>
                                  <p className="font-mono text-xs leading-relaxed">"{item.originalText}"</p>
                                </div>

                                {/* Detailed Explanation */}
                                <div className="rounded-xl p-3.5 bg-white/5 border border-white/10 text-[var(--text-soft)]">
                                  <strong className="block text-[10px] text-amber-400 uppercase tracking-wider mb-1 flex items-center gap-1.5 font-bold">
                                    <Lightbulb size={14} /> Detailed Explanation & Academic Standard:
                                  </strong>
                                  <p className="leading-relaxed text-xs">{item.explanation}</p>
                                </div>

                                {/* Suggested Corrected Answer */}
                                {item.suggestedAnswer && (
                                  <div className="rounded-xl p-3.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-200 space-y-2.5">
                                    <div className="flex items-center justify-between flex-wrap gap-2">
                                      <strong className="text-[10px] text-emerald-400 uppercase tracking-wider flex items-center gap-1.5 font-bold">
                                        <CheckCircle2 size={14} /> Suggested Answer & Corrected Version:
                                      </strong>
                                      <div className="flex items-center gap-2">
                                        <button
                                          type="button"
                                          onClick={() => handleCopy(`err-${item.id}`, item.suggestedAnswer)}
                                          className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-1 cursor-pointer transition border border-emerald-500/30"
                                        >
                                          <Copy size={13} /> {copiedId === `err-${item.id}` ? 'Copied!' : 'Copy Answer'}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setChatInput(`How do I improve this error in ${item.section}: "${item.originalText}"?`);
                                            if (expandedViewMode === 'errors') setExpandedViewMode('split');
                                          }}
                                          className="px-2.5 py-1 rounded-lg bg-orange-500/20 hover:bg-orange-500/40 text-orange-300 text-xs font-semibold flex items-center gap-1 cursor-pointer transition border border-orange-500/30"
                                        >
                                          <Sparkles size={13} /> Ask AI in Chat
                                        </button>
                                      </div>
                                    </div>
                                    <p className="font-mono text-xs bg-black/40 p-3 rounded-lg border border-emerald-500/20 select-all leading-relaxed">
                                      {item.suggestedAnswer}
                                    </p>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
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
