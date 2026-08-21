import React, { useState } from 'react'
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
import '../assets/css/dashboard.css'
import '../assets/css/dashboard-components.css'

export default function AIFeedback() {
  const navigate = useNavigate()
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('suggestions')
  const [copiedId, setCopiedId] = useState(null)
  const [chatInput, setChatInput] = useState('')
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'ai',
      text: "Hello Anita! I have analyzed your report 'AI-Powered Internship Platform' (v3). Your overall writing score is 8.4/10. What would you like assistance with?",
      time: '10:02 AM',
    },
  ])

  const [user] = useState({
    name: 'Anita',
    role: 'Student',
    program: 'Level 3',
    department: 'Software Engineering',
    avatar: null,
    notifications: 2,
  })

  const metrics = [
    { name: 'Structure', score: 85, desc: 'Logical section progression and clear abstract/conclusion mapping' },
    { name: 'Clarity', score: 90, desc: 'High readability index with concise phrasing' },
    { name: 'Grammar & Tone', score: 88, desc: 'Formal academic tone; minor passive voice in Chapter 2' },
    { name: 'Originality', score: 95, desc: '95% unique phrasing, authentic experimental descriptions' },
    { name: 'References', score: 86, desc: 'Well formatted citations; 2 references missing year published' },
  ]

  const suggestions = [
    {
      id: 1,
      type: 'high',
      section: 'Section 4.2 • System Evaluation',
      title: 'Strengthen Benchmark Metrics',
      desc: 'Include concrete execution latency comparisons (ms) rather than stating the system felt faster.',
      suggestion: 'Replace "the query responded much faster" with "the response latency decreased from 420ms to 85ms (79.7% reduction)".',
    },
    {
      id: 2,
      type: 'medium',
      section: 'Section 2.1 • Literature Review',
      title: 'Active Voice Optimization',
      desc: 'Three consecutive paragraphs in Section 2 use heavy passive constructions.',
      suggestion: 'Rephrase "It was discovered by Smith et al. that..." to "Smith et al. discovered that...".',
    },
    {
      id: 3,
      type: 'positive',
      section: 'Section 3 • System Architecture',
      title: 'Excellent Architecture Diagram & Description',
      desc: 'The component data-flow diagram and description are lucid, well structured, and technically accurate.',
      suggestion: 'Keep this structure consistent for the deployment pipeline subsection.',
    },
    {
      id: 4,
      type: 'low',
      section: 'References & Bibliography',
      title: 'Missing Publication Years',
      desc: 'Reference #7 (Vue.js official documentation) and Reference #11 need publication/access dates.',
      suggestion: 'Add "(Accessed: April 2025)" to online citations.',
    },
  ]

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
    const prompt = chatInput
    setChatInput('')

    setTimeout(() => {
      let reply = "I've reviewed that part. Make sure to clearly state your testing methodology and substantiate your findings with concrete numbers."
      if (prompt.toLowerCase().includes('conclusion') || prompt.toLowerCase().includes('defense')) {
        reply = "For your defense, summarize the 3 main engineering challenges you overcame: real-time latency, state synchronization, and user authorization."
      } else if (prompt.toLowerCase().includes('score') || prompt.toLowerCase().includes('improve')) {
        reply = "To raise your score to 9.2+, focus on adding quantitative benchmarks in Section 4.2 and fixing the two online citation dates."
      }

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'ai',
          text: reply,
          time: new Intl.DateTimeFormat('en', { hour: 'numeric', minute: 'numeric' }).format(new Date()),
        },
      ])
    }, 600)
  }

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
              <BarChart3 size={16} />
              <span>{user.program}</span>
              <span className="separator">•</span>
              <span>{user.department}</span>
            </div>
          </div>

          <div className="header-right">
            <div className="notification-center">
              <button className="notification-btn cursor-pointer" onClick={() => navigate('/my-reports')}>
                <Bell size={20} />
                {user.notifications > 0 && <span className="notification-badge">{user.notifications}</span>}
              </button>
            </div>

            <div className="header-divider"></div>

            <div className="relative">
              <div
                className="user-menu cursor-pointer"
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              >
                <div className="user-avatar">
                  <div className="avatar-placeholder">{user.name[0]}</div>
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
                    <User size={14} /> Student Dashboard
                  </button>
                  <button
                    onClick={() => navigate('/login')}
                    className="w-full flex items-center gap-2 p-2 rounded hover:bg-red-500/20 text-red-300 text-left cursor-pointer mt-1"
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
          {/* Header Banner */}
          <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-orange-400 font-semibold mb-1">
                <Brain size={16} />
                <span>AI Automated Report Analysis</span>
              </div>
              <h1 className="text-3xl font-bold text-white tracking-tight">AI Feedback & Insights</h1>
              <p className="text-white/60 text-sm mt-1">
                Report: <span className="text-white font-medium">AI-Powered Internship Platform (Version 3)</span>
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/my-reports')}
                className="px-4 py-2.5 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 text-white text-xs font-medium transition cursor-pointer flex items-center gap-2"
              >
                <FileText size={14} /> View All Reports
              </button>
              <button
                onClick={() => navigate('/my-reports')}
                className="px-4 py-2.5 rounded-full bg-gradient-to-r from-[#ff7a00] to-[#ff9d3d] text-white text-xs font-semibold shadow-lg hover:opacity-90 transition cursor-pointer flex items-center gap-2"
              >
                Upload Revision <ArrowRight size={14} />
              </button>
            </div>
          </div>

          {/* Top Score Banner */}
          <div className="grid gap-6 md:grid-cols-3 mb-8">
            <div className="card md:col-span-1 flex flex-col items-center justify-center p-6 text-center">
              <AnimatedProgressRing percentage={84} size={120} strokeWidth={10} />
              <h3 className="text-lg font-bold text-white mt-4">Writing Quality Score</h3>
              <p className="text-xs text-white/50 mt-1 max-w-[200px]">
                Grade: <strong className="text-emerald-400 font-semibold">Very Good (A-)</strong>. Ready for supervisor sign-off after minor tweaks.
              </p>
            </div>

            <div className="card md:col-span-2 p-6 flex flex-col justify-between">
              <div>
                <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                  <TrendingUp size={18} className="text-orange-400" />
                  Key Category Performance
                </h3>
                <div className="space-y-3">
                  {metrics.map((m) => (
                    <div key={m.name} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-white font-medium">{m.name}</span>
                        <span className="text-orange-300 font-bold">{m.score}%</span>
                      </div>
                      <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-[#ff7a00] to-[#ff9d3d] rounded-full"
                          style={{ width: `${m.score}%` }}
                        ></div>
                      </div>
                      <p className="text-[10px] text-white/40">{m.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Main Grid: Suggestions & Interactive AI Assistant */}
          <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
            {/* Left: AI Suggestions List */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Lightbulb size={18} className="text-amber-400" />
                  Actionable Recommendations ({suggestions.length})
                </h2>
              </div>

              {suggestions.map((s) => (
                <div
                  key={s.id}
                  className="rounded-2xl border border-white/8 bg-[#0c1218] p-5 transition hover:border-orange-400/30 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-orange-400">
                        {s.section}
                      </span>
                      <h4 className="text-sm font-bold text-white mt-1">{s.title}</h4>
                    </div>

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
                  </div>

                  <p className="text-xs text-white/70 mt-2 leading-relaxed">{s.desc}</p>

                  <div className="mt-3 rounded-xl border border-orange-400/20 bg-orange-500/5 p-3 text-xs text-orange-200">
                    <div className="flex items-center justify-between text-[10px] text-orange-300 font-semibold mb-1">
                      <span className="flex items-center gap-1">
                        <CornerDownRight size={12} /> AI Proposed Fix
                      </span>
                      <button
                        onClick={() => handleCopy(s.id, s.suggestion)}
                        className="hover:text-white flex items-center gap-1 transition cursor-pointer"
                      >
                        <Copy size={12} />
                        {copiedId === s.id ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                    <p className="font-mono text-[11px] text-white/90">{s.suggestion}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Right: AI Assistant Chat */}
            <div className="rounded-2xl border border-white/10 bg-[#090e13] p-5 flex flex-col h-[580px] shadow-xl">
              <div className="flex items-center gap-3 border-b border-white/10 pb-3 mb-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500/20 text-orange-300 border border-orange-400/30">
                  <Brain size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">AI Writing Assistant</h3>
                  <p className="text-[10px] text-emerald-400 flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Online & contextualized to Report v3
                  </p>
                </div>
              </div>

              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl p-3 leading-relaxed ${
                        msg.sender === 'user'
                          ? 'bg-gradient-to-r from-[#ff7a00] to-[#ff9d3d] text-white rounded-br-none'
                          : 'bg-white/8 text-white/90 border border-white/8 rounded-bl-none'
                      }`}
                    >
                      {msg.text}
                    </div>
                    <span className="text-[9px] text-white/30 mt-1 px-1">{msg.time}</span>
                  </div>
                ))}
              </div>

              {/* Quick Prompts */}
              <div className="pt-3 border-t border-white/8 flex flex-wrap gap-1.5 mb-2">
                {['Explain suggestion #1', 'How to prepare for defense?', 'Summarize key strengths'].map((quick) => (
                  <button
                    key={quick}
                    onClick={() => setChatInput(quick)}
                    className="text-[10px] px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 text-white/70 border border-white/10 transition cursor-pointer"
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
                  className="flex-1 rounded-xl border border-white/10 bg-[#06090c] px-3.5 py-2.5 text-xs text-white placeholder:text-white/30 focus:border-orange-400 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim()}
                  className="rounded-xl bg-orange-500 px-3.5 py-2.5 text-white hover:bg-orange-600 disabled:opacity-40 transition cursor-pointer flex items-center justify-center shadow-lg shadow-orange-500/20"
                >
                  <Send size={14} />
                </button>
              </form>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
