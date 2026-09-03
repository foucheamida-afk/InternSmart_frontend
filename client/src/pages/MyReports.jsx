import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import Sidebar from '../components/Sidebar'
import ThemeToggle from '../components/ThemeToggle'
import { useTheme } from '../context/ThemeContext'
import '../assets/css/dashboard.css'
import '../assets/css/dashboard-components.css'
import {
  AlertCircle,
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  ChevronDown,
  Circle,
  Download,
  Eye,
  FileText,
  Filter,
  History,
  LoaderCircle,
  MoreHorizontal,
  Plus,
  Search,
  Send,
  Sparkles,
  Upload,
  UserRound,
  X,
  Menu,
  Bell,
  BarChart3,
  LogOut,
  User,
} from 'lucide-react'

const REPORT_ENDPOINTS = ['http://localhost:3000/api/students/my-reports']
const STATUS_ORDER = ['submitted', 'ai_analysis', 'in_review', 'approved', 'needs_revision', 'rejected']

const STATUS_META = {
  submitted: { label: 'Submitted', color: 'bg-white/5 text-white/80 border-white/10', lightColor: 'bg-black/5 text-black/80 border-black/10' },
  ai_analysis: { label: 'AI Analysis', color: 'bg-orange-500/10 text-orange-200 border-orange-400/30', lightColor: 'bg-orange-500/10 text-orange-700 border-orange-400/30' },
  in_review: { label: 'In Review', color: 'bg-amber-500/10 text-amber-200 border-amber-400/30', lightColor: 'bg-amber-500/10 text-amber-700 border-amber-400/30' },
  approved: { label: 'Approved', color: 'bg-emerald-500/10 text-emerald-200 border-emerald-400/30', lightColor: 'bg-emerald-500/10 text-emerald-700 border-emerald-400/30' },
  needs_revision: { label: 'Needs Revision', color: 'bg-rose-500/10 text-rose-200 border-rose-400/30', lightColor: 'bg-rose-500/10 text-rose-700 border-rose-400/30' },
  rejected: { label: 'Rejected', color: 'bg-red-500/10 text-red-200 border-red-400/30', lightColor: 'bg-red-500/10 text-red-700 border-red-400/30' },
}

const workflowStages = ['uploaded', 'ai_analysis', 'in_review', 'approved']

const formatDate = (value) => {
  if (!value) return '—'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'

  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

const formatRelativeDate = (value) => {
  if (!value) return 'Updated recently'

  const diffMs = Date.now() - new Date(value).getTime()
  const diffDays = Math.max(0, Math.round(diffMs / 86400000))

  if (diffDays === 0) return 'Updated today'
  if (diffDays === 1) return 'Updated 1 day ago'
  return `Updated ${diffDays} days ago`
}

const normalizeStatus = (status) => {
  const raw = String(status || '').toLowerCase().replace(/\s+/g, '_')

  if (raw.includes('ai')) return 'ai_analysis'
  if (raw.includes('review')) return 'in_review'
  if (raw.includes('approved') || raw.includes('accept')) return 'approved'
  if (raw.includes('revision') || raw.includes('revise')) return 'needs_revision'
  if (raw.includes('reject')) return 'rejected'
  return 'submitted'
}

const normalizeReport = (raw = {}) => {
  const title = raw.title || raw.reportTitle || raw.fileName || raw.file_name || 'Untitled report'
  const fileName = raw.fileName || raw.file_name || raw.filename || 'report.pdf'
  const status = normalizeStatus(raw.status || raw.state)

  return {
    id: raw.id || raw._id || raw.reportId || `${Date.now()}-${Math.random()}`,
    title,
    fileName,
    version: Number(raw.version || raw.reportVersion || 1),
    submittedAt: raw.submittedAt || raw.createdAt || raw.uploadedAt || null,
    updatedAt: raw.updatedAt || raw.lastUpdated || raw.submittedAt || raw.createdAt || null,
    status,
    progress: typeof raw.progress === 'number' ? raw.progress : undefined,
    currentStage: raw.currentStage || raw.stage || status,
    aiScore: raw.aiScore ?? raw.ai_score ?? raw.aiAnalysis?.score ?? null,
    fileUrl: raw.fileUrl || raw.url || raw.downloadUrl || null,
    supervisor: raw.supervisor || raw.assignedSupervisor || null,
    feedback: raw.supervisorFeedback || raw.feedback || raw.latestFeedback || null,
    activity: Array.isArray(raw.activity) ? raw.activity : Array.isArray(raw.timeline) ? raw.timeline : [],
    aiAnalysis: raw.aiAnalysis || raw.ai_analysis || null,
    versions: Array.isArray(raw.versions) ? raw.versions.map(normalizeReport) : [],
  }
}

const getReportRoutes = async (token) => {
  for (const endpoint of REPORT_ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })

      if (!response.ok) {
        continue
      }

      const data = await response.json()

      const payload = Array.isArray(data)
        ? data
        : Array.isArray(data?.reports)
          ? data.reports
          : Array.isArray(data?.data)
            ? data.data
            : []

      if (payload.length > 0) {
        return payload.map(normalizeReport)
      }
    } catch {
      // ignore
    }
  }

  return []
}

const formatBytes = (bytes = 0) => {
  if (!bytes) return '0 KB'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unitIndex = 0

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }

  return `${Number(value).toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
}

const getStageIndex = (status) => {
  if (status === 'uploaded') return 0
  if (status === 'ai_analysis') return 1
  if (status === 'in_review') return 2
  if (status === 'approved') return 3
  if (status === 'needs_revision') return 1
  if (status === 'rejected') return 2
  return 0
}

const StatusBadge = ({ status }) => {
  const meta = STATUS_META[status] || STATUS_META.submitted

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.14em] ${meta.color}`}>
      {meta.label}
    </span>
  )
}

const EmptyReportsState = ({ onUploadClick }) => (
  <motion.div
    initial={{ opacity: 0, y: 18 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, ease: 'easeOut' }}
    className="mx-auto mt-10 max-w-4xl rounded-[28px] border p-8 shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_40px_80px_rgba(0,0,0,0.35)] backdrop-blur"
    style={{
      backgroundColor: 'var(--bg-panel)',
      borderColor: 'var(--line)',
      color: 'var(--text)'
    }}
  >
    <div className="relative mx-auto flex max-w-xl flex-col items-center text-center">
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
        className="relative mb-8"
      >
        <div className="absolute inset-0 rounded-[28px] bg-[#ff7a00]/10 blur-3xl" />
        <div className="relative flex h-36 w-36 items-center justify-center rounded-[28px] border text-orange-300 shadow-[0_0_35px_rgba(255,122,0,0.12)]" style={{
          backgroundColor: 'var(--bg-panel)',
          borderColor: 'rgba(255, 122, 0, 0.3)',
          color: 'var(--orange-3)'
        }}>
          <div className="absolute left-1/2 top-3 h-3 w-3 -translate-x-1/2 rounded-full bg-orange-400 shadow-[0_0_16px_rgba(255,122,0,0.7)]" />
          <FileText className="h-16 w-16" />
        </div>
      </motion.div>

      <div className="mb-3 flex h-7 w-7 items-center justify-center rounded-full border text-sm shadow-[0_0_18px_rgba(255,122,0,0.25)]" style={{
        borderColor: 'rgba(255, 122, 0, 0.4)',
        backgroundColor: 'rgba(255, 122, 0, 0.1)',
        color: 'var(--orange-3)'
      }}>
        +
      </div>

      <h2 className="text-4xl font-semibold tracking-[-0.06em]">No reports yet</h2>
      <p className="mt-4 max-w-lg text-base" style={{ color: 'var(--text-soft)' }}>
        You haven&apos;t submitted any internship reports yet. Upload your first report to begin the review process.
      </p>

      <button
        type="button"
        onClick={onUploadClick}
        className="mt-8 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#ff7a00] via-[#ff8a1c] to-[#ff9d3d] px-6 py-3 text-sm font-semibold text-white shadow-[0_18px_30px_rgba(255,122,0,0.24)] transition hover:-translate-y-0.5"
      >
        <Plus className="h-4 w-4" />
        Upload Your First Report
      </button>
    </div>
  </motion.div>
)

const ReportsHeader = ({ onUploadClick, totalReports }) => (
  <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.24em]" style={{ color: 'var(--orange-3)' }}>Internship workflow</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-[-0.06em] md:text-4xl" style={{ color: 'var(--text)' }}>My Reports</h1>
      <p className="mt-2 text-sm md:text-base" style={{ color: 'var(--text-soft)' }}>
        Track, manage and organize your internship reports in one place.
      </p>
    </div>

    <button
      type="button"
      onClick={onUploadClick}
      className="inline-flex items-center justify-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium shadow-[0_0_18px_rgba(255,122,0,0.1)] transition"
      style={{
        borderColor: 'rgba(255, 122, 0, 0.3)',
        backgroundColor: 'var(--bg-panel)',
        color: 'var(--text)'
      }}
    >
      <Plus className="h-4 w-4" style={{ color: 'var(--orange-3)' }} />
      Upload New Report
    </button>
  </div>
)

const StatCard = ({ label, value, accent = false }) => (
  <div className="rounded-2xl border p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]" style={{
    backgroundColor: 'var(--bg-panel)',
    borderColor: 'var(--line)'
  }}>
    <div className="text-[11px] uppercase tracking-[0.18em]" style={{ color: 'var(--text-muted)' }}>{label}</div>
    <div className={`mt-3 text-2xl font-semibold tracking-[-0.05em]`} style={{ color: accent ? 'var(--orange-3)' : 'var(--text)' }}>{value}</div>
  </div>
)

const ReportStatistics = ({ reports }) => {
  const total = reports.length
  const stats = {
    total,
    submitted: reports.filter((report) => report.status === 'submitted').length,
    inReview: reports.filter((report) => report.status === 'in_review').length,
    approved: reports.filter((report) => report.status === 'approved').length,
    needsRevision: reports.filter((report) => report.status === 'needs_revision').length,
  }

  return (
    <>
    <div className="mb-8 grid gap-4 md:grid-cols-5">
      <StatCard label="Total Reports" value={stats.total} accent />
      <StatCard label="Submitted" value={stats.submitted} />
      <StatCard label="In Review" value={stats.inReview} />
      <StatCard label="Approved" value={stats.approved} />
      <StatCard label="Needs Revision" value={stats.needsRevision} />
    </div>
      {/* <div className="dashboard-wrapper">
        <Sidebar/>
      </div> */}
   </>
  )
}

const ReportCard = ({ report, isSelected, onSelect }) => (
  <motion.button
    type="button"
    onClick={() => onSelect(report)}
    initial={{ opacity: 0, y: 18 }}
    animate={{ opacity: 1, y: 0 }}
    whileHover={{ y: -2, scale: 1.01 }}
    transition={{ duration: 0.2, ease: 'easeOut' }}
    className={`group w-full rounded-2xl border p-4 text-left transition-all`}
    style={{
      backgroundColor: isSelected ? 'var(--bg-panel)' : 'var(--bg-panel)',
      borderColor: isSelected ? 'rgba(255, 122, 0, 0.6)' : 'var(--line)',
      boxShadow: isSelected ? '0 0 0 1px rgba(255,122,0,0.15),0 20px 40px rgba(255,122,0,0.08)' : 'none',
      color: 'var(--text)'
    }}
  >
    <div className="flex items-start gap-3">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl border" style={{
        backgroundColor: 'rgba(255, 122, 0, 0.1)',
        borderColor: 'rgba(255, 122, 0, 0.25)',
        color: 'var(--orange-3)'
      }}>
        <FileText className="h-5 w-5" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-base font-medium">{report.title}</h3>
            <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>Version {report.version || 1} • {formatRelativeDate(report.updatedAt || report.submittedAt)}</p>
          </div>

          <StatusBadge status={report.status} />
        </div>

        <div className="mt-4 h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#ff7a00] via-[#ff8a1c] to-[#ff9d3d]"
            style={{ width: `${Math.min(Math.max(report.progress ?? getStageIndex(report.status) * 25 + 25, 18), 100)}%` }}
          />
        </div>

        <div className="mt-4 flex items-center justify-between text-[11px] uppercase tracking-[0.16em]" style={{ color: 'var(--text-muted)' }}>
          <span>AI Analysis</span>
          <span>{report.aiScore ? `${report.aiScore}/10` : 'Pending'}</span>
        </div>
      </div>
    </div>
  </motion.button>
)

const ReportFilters = ({ searchQuery, setSearchQuery, statusFilter, setStatusFilter, sortBy, setSortBy }) => (
  <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
    <div className="relative w-full max-w-md">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
      <input
        value={searchQuery}
        onChange={(event) => setSearchQuery(event.target.value)}
        placeholder="Search reports..."
        className="w-full rounded-xl border py-2.5 pl-9 pr-3 text-sm focus:outline-none"
        style={{
          backgroundColor: 'var(--bg-panel)',
          borderColor: 'var(--line)',
          color: 'var(--text)',
          placeholderColor: 'var(--text-muted)'
        }}
      />
    </div>

    <div className="flex flex-col gap-3 sm:flex-row">
      <div className="relative">
        <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="appearance-none rounded-xl border py-2.5 pl-9 pr-9 text-sm focus:outline-none"
          style={{
            backgroundColor: 'var(--bg-panel)',
            borderColor: 'var(--line)',
            color: 'var(--text)'
          }}
        >
          <option value="all">All</option>
          <option value="submitted">Submitted</option>
          <option value="ai_analysis">AI Analysis</option>
          <option value="in_review">In Review</option>
          <option value="approved">Approved</option>
          <option value="needs_revision">Needs Revision</option>
          <option value="rejected">Rejected</option>
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
      </div>

      <div className="relative">
        <select
          value={sortBy}
          onChange={(event) => setSortBy(event.target.value)}
          className="appearance-none rounded-xl border py-2.5 pl-3 pr-9 text-sm focus:outline-none"
          style={{
            backgroundColor: 'var(--bg-panel)',
            borderColor: 'var(--line)',
            color: 'var(--text)'
          }}
        >
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="updated">Recently Updated</option>
          <option value="status">Status</option>
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
      </div>
    </div>
  </div>
)

const ReportDetails = ({ report, onSendToSupervisor, onSendToAi, actionLoading }) => {
  if (!report) {
    return (
      <div className="flex h-full min-h-[420px] items-center justify-center rounded-[24px] border border-dashed p-8 text-center" style={{
        backgroundColor: 'var(--bg-panel)',
        borderColor: 'var(--line)',
        color: 'var(--text-muted)'
      }}>
        <div>
          <p className="text-lg font-medium" style={{ color: 'var(--text)' }}>Select a report</p>
          <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>Select a report from the list to view its details.</p>
        </div>
      </div>
    )
  }

  const details = [
    { label: 'Title', value: report.title },
    { label: 'File name', value: report.fileName },
    { label: 'Version', value: `Version ${report.version || 1}` },
    { label: 'Submitted date', value: formatDate(report.submittedAt) },
    { label: 'Last updated', value: formatDate(report.updatedAt || report.submittedAt) },
    { label: 'Status', value: STATUS_META[report.status]?.label || 'Submitted' },
    { label: 'Current stage', value: report.currentStage || report.status },
  ]

  const workflowIndex = getStageIndex(report.status)
  const stageLabels = {
    uploaded: 'Uploaded',
    ai_analysis: 'AI Analysis',
    in_review: 'Supervisor Review',
    approved: 'Final Approval',
  }

  return (
    <motion.div
      key={report.id}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="rounded-[28px] border p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
      style={{
        backgroundColor: 'var(--bg-panel)',
        borderColor: 'var(--line)',
        color: 'var(--text)'
      }}
    >
      <div className="flex items-start justify-between gap-4 border-b pb-4" style={{ borderColor: 'var(--line)' }}>
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em]" style={{ color: 'var(--orange-3)' }}>Report Details</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em]">{report.title}</h2>
        </div>
        <StatusBadge status={report.status} />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {details.map((detail) => (
          <div key={detail.label} className="rounded-2xl border p-3" style={{
            backgroundColor: 'var(--bg-panel)',
            borderColor: 'var(--line)'
          }}>
            <div className="text-[10px] uppercase tracking-[0.18em]" style={{ color: 'var(--text-muted)' }}>{detail.label}</div>
            <div className="mt-2 text-sm font-medium" style={{ color: 'var(--text-soft)' }}>{detail.value}</div>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-2xl border p-4" style={{
        backgroundColor: 'var(--bg-panel)',
        borderColor: 'var(--line)'
      }}>
        <div className="mb-4 text-[11px] uppercase tracking-[0.18em]" style={{ color: 'var(--text-muted)' }}>Workflow</div>
        <div className="space-y-4">
          {workflowStages.map((stage, index) => {
            const isDone = index <= workflowIndex
            const isCurrent = index === workflowIndex

            return (
              <div key={stage} className="flex items-center gap-3">
                <div className={`flex h-5 w-5 items-center justify-center rounded-full border`} style={{
                  borderColor: isDone ? 'rgba(255, 122, 0, 1)' : 'var(--line)',
                  backgroundColor: isDone ? '#f97316' : 'transparent',
                  color: isDone ? 'white' : 'var(--text-muted)'
                }}>
                  {isDone ? <CheckCircle2 className="h-4 w-4" /> : isCurrent ? <Circle className="h-3 w-3 fill-current" /> : <Circle className="h-3 w-3 fill-current" />}
                </div>
                <div className="text-sm" style={{
                  color: isCurrent ? 'var(--orange-3)' : isDone ? 'var(--text-soft)' : 'var(--text-muted)'
                }}>
                  {index === 0 && (isDone ? '✓ Uploaded' : 'Uploaded')}
                  {index === 1 && (isDone ? '✓ AI Analysis' : 'AI Analysis')}
                  {index === 2 && (isDone ? '✓ Supervisor Review' : 'Supervisor Review')}
                  {index === 3 && (isDone ? '✓ Final Approval' : 'Final Approval')}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        {report.status === 'submitted' && (
          <>
            <button
              type="button"
              onClick={() => onSendToSupervisor?.(report.id)}
              disabled={actionLoading}
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-white shadow-[0_18px_30px_rgba(255,122,0,0.2)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                background: 'linear-gradient(to right, #ff7a00, #ff8a1c, #ff9d3d)'
              }}
            >
              <Send className="h-4 w-4" />
              {actionLoading ? 'Sending...' : 'Send to Supervisor'}
            </button>

            <button
              type="button"
              onClick={() => onSendToAi?.(report.id)}
              disabled={actionLoading}
              className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                borderColor: 'rgba(255, 122, 0, 0.3)',
                backgroundColor: 'rgba(255, 122, 0, 0.1)',
                color: 'var(--orange-3)'
              }}
            >
              <BrainCircuit className="h-4 w-4" />
              Analyze with AI
            </button>
          </>
        )}

        {report.status === 'ai_analysis' && (
          <button
            type="button"
            onClick={() => onSendToSupervisor?.(report.id)}
            disabled={actionLoading}
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-white shadow-[0_18px_30px_rgba(255,122,0,0.2)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              background: 'linear-gradient(to right, #ff7a00, #ff8a1c, #ff9d3d)'
            }}
          >
            <Send className="h-4 w-4" />
            {actionLoading ? 'Sending...' : 'Send to Supervisor'}
          </button>
        )}

        {report.aiAnalysis ? (
          <Link
            to="/ai-analysis"
            className="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition"
            style={{
              borderColor: 'rgba(255, 122, 0, 0.3)',
              backgroundColor: 'rgba(255, 122, 0, 0.1)',
              color: 'var(--orange-3)'
            }}
          >
            View AI Analysis <ArrowRight className="h-4 w-4" />
          </Link>
        ) : (
          <span className="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm" style={{
            borderColor: 'var(--line)',
            backgroundColor: 'rgba(255,255,255,0.03)',
            color: 'var(--text-muted)'
          }}>
            AI analysis pending
          </span>
        )}

        <button type="button" className="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm" style={{
          borderColor: 'var(--line)',
          backgroundColor: 'var(--bg-panel)',
          color: 'var(--text-soft)'
        }}>
          <Download className="h-4 w-4" />
          Download
        </button>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border p-4" style={{
          backgroundColor: 'var(--bg-panel)',
          borderColor: 'var(--line)'
        }}>
          <div className="mb-3 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em]" style={{ color: 'var(--text-muted)' }}>
            <UserRound className="h-3.5 w-3.5" style={{ color: 'var(--orange-3)' }} />
            Supervisor Review
          </div>
          {report.supervisor ? (
            <div>
              <div className="text-sm font-medium">{report.supervisor.name || report.supervisor.fullName || 'Assigned supervisor'}</div>
              <div className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>{report.supervisor.role || report.supervisor.department || 'Supervisor'}</div>
            </div>
          ) : (
            <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Supervisor not assigned yet.</div>
          )}
        </div>

        <div className="rounded-2xl border p-4" style={{
          backgroundColor: 'var(--bg-panel)',
          borderColor: 'var(--line)'
        }}>
          <div className="mb-3 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em]" style={{ color: 'var(--text-muted)' }}>
            <Sparkles className="h-3.5 w-3.5" style={{ color: 'var(--orange-3)' }} />
            Latest Feedback
          </div>
          {report.feedback ? (
            <div>
              <div className="text-sm font-medium">{report.feedback.author || 'Supervisor'}</div>
              <div className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>{formatDate(report.feedback.date || report.updatedAt)}</div>
              <div className="mt-2 text-sm" style={{ color: 'var(--text-soft)' }}>{report.feedback.comment || report.feedback.message || report.feedback.text || 'Feedback provided.'}</div>
            </div>
          ) : (
            <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
              No feedback yet. Your supervisor&apos;s feedback will appear here once your report has been reviewed.
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 rounded-2xl border p-4" style={{
        backgroundColor: 'var(--bg-panel)',
        borderColor: 'var(--line)'
      }}>
        <div className="mb-4 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em]" style={{ color: 'var(--text-muted)' }}>
          <History className="h-3.5 w-3.5" style={{ color: 'var(--orange-3)' }} />
          Activity
        </div>

        {report.activity && report.activity.length > 0 ? (
          <div className="space-y-3">
            {report.activity.map((item, index) => (
              <div key={`${item.label || 'activity'}-${index}`} className="flex items-start gap-3 rounded-xl border p-3" style={{
                borderColor: 'var(--line)',
                backgroundColor: 'rgba(255,255,255,0.02)'
              }}>
                <div className="mt-1 h-2.5 w-2.5 rounded-full bg-orange-400 shadow-[0_0_8px_rgba(255,122,0,0.6)]" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-sm" style={{ color: 'var(--text-soft)' }}>{item.label || item.title || 'Activity update'}</p>
                    <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{item.time || item.timestamp || '—'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm" style={{ color: 'var(--text-muted)' }}>No activity yet.</div>
        )}
      </div>
    </motion.div>
  )
}

const UploadReportModal = ({ isOpen, onClose, onUploadSuccess }) => {
  const inputRef = useRef(null)
  const [selectedFile, setSelectedFile] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (!isOpen) {
      setSelectedFile(null)
      setDragging(false)
      setUploading(false)
      setUploadProgress(0)
      setError('')
      setSuccess(false)
    }
  }, [isOpen])

  const handleFile = (file) => {
    if (!file) return

    const extension = file.name.toLowerCase().split('.').pop()
    if (extension !== 'pdf') {
      setError('Only PDF files are supported.')
      return
    }

    const sizeOk = !file.size || file.size <= 20 * 1024 * 1024
    if (!sizeOk) {
      setError('This file exceeds the supported size limit.')
      return
    }

    setSelectedFile(file)
    setError('')
  }

  const handleSubmit = async () => {
    if (!selectedFile) {
      setError('Please select a report file to upload.')
      return
    }

    setUploading(true)
    setError('')
    setSuccess(false)
    setUploadProgress(35)

    try {
      const token = localStorage.getItem('token')
      const formData = new FormData()
      formData.append('report', selectedFile)
      formData.append('title', selectedFile.name.replace(/\.[^/.]+$/, ''))

      const response = await fetch('http://localhost:3000/api/students/reports', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Unable to submit report')

      setUploadProgress(100)
      setSuccess(true)
      setUploading(false)
      setTimeout(() => {
        onUploadSuccess?.(normalizeReport(data.report))
        onClose()
      }, 500)
    } catch (uploadError) {
      setUploading(false)
      setError(uploadError.message || 'Unable to submit your report. Please try again.')
    }
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      >
        <motion.div
          initial={{ y: 18, opacity: 0, scale: 0.98 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 12, opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="w-full max-w-xl rounded-[28px] border p-5 shadow-[0_40px_100px_rgba(0,0,0,0.45)]"
          style={{
            backgroundColor: 'var(--bg-panel)',
            borderColor: 'var(--line)',
            color: 'var(--text)'
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em]" style={{ color: 'var(--orange-3)' }}>Upload</p>
              <h3 className="mt-2 text-2xl font-semibold tracking-[-0.05em]">Upload Internship Report</h3>
            </div>
            <button type="button" onClick={onClose} className="rounded-full border p-2 transition" style={{
              borderColor: 'var(--line)',
              color: 'var(--text-muted)'
            }} onMouseEnter={(e) => e.target.style.color = 'var(--text)'} onMouseLeave={(e) => e.target.style.color = 'var(--text-muted)'}>
              <X className="h-4 w-4" />
            </button>
          </div>

          <div
            onDragOver={(event) => {
              event.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault()
              setDragging(false)
              if (event.dataTransfer.files?.[0]) handleFile(event.dataTransfer.files[0])
            }}
            className={`mt-6 rounded-2xl border border-dashed p-6 text-center transition`}
            style={{
              borderColor: dragging ? 'rgba(255, 122, 0, 0.7)' : 'var(--line)',
              backgroundColor: dragging ? 'rgba(255, 122, 0, 0.08)' : 'var(--bg-panel)',
              boxShadow: dragging ? '0 0 24px rgba(255,122,0,0.12)' : 'none'
            }}
          >
            {!selectedFile ? (
              <>
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border" style={{
                  borderColor: 'rgba(255, 122, 0, 0.3)',
                  backgroundColor: 'rgba(255, 122, 0, 0.1)',
                  color: 'var(--orange-3)'
                }}>
                  <Upload className={`h-5 w-5 transition ${dragging ? 'scale-110' : ''}`} />
                </div>

                <p className="text-base font-medium">Drag &amp; Drop your file here</p>
                <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>or</p>
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="mt-3 inline-flex items-center justify-center rounded-full border px-4 py-2 text-sm font-medium"
                  style={{
                    borderColor: 'var(--line)',
                    backgroundColor: 'var(--bg-panel)',
                    color: 'var(--text)'
                  }}
                >
                  Browse Files
                </button>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={(event) => handleFile(event.target.files?.[0])}
                />
                <p className="mt-4 text-xs" style={{ color: 'var(--text-muted)' }}>Supported formats: PDF only</p>
              </>
            ) : (
              <div className="flex items-center justify-between gap-4 rounded-2xl border p-4 text-left" style={{
                borderColor: 'rgba(255, 122, 0, 0.3)',
                backgroundColor: 'var(--bg-panel)'
              }}>
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl border" style={{
                    borderColor: 'rgba(255, 122, 0, 0.25)',
                    backgroundColor: 'rgba(255, 122, 0, 0.1)',
                    color: 'var(--orange-3)'
                  }}>
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{selectedFile.name}</div>
                    <div className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>{formatBytes(selectedFile.size)}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedFile(null)}
                  className="rounded-full border px-3 py-1.5 text-xs transition"
                  style={{
                    borderColor: 'var(--line)',
                    color: 'var(--text-muted)'
                  }}
                  onMouseEnter={(e) => e.target.style.color = 'var(--text)'}
                  onMouseLeave={(e) => e.target.style.color = 'var(--text-muted)'}
                >
                  Remove
                </button>
              </div>
            )}
          </div>

          {error && (
            <div className="mt-4 flex items-center gap-2 rounded-xl border px-3 py-2 text-sm" style={{
              borderColor: 'rgba(239, 68, 68, 0.3)',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              color: '#fca5a5'
            }}>
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          {uploading && (
            <div className="mt-5 rounded-2xl border p-4" style={{
              backgroundColor: 'var(--bg-panel)',
              borderColor: 'var(--line)'
            }}>
              <div className="mb-2 flex items-center justify-between text-sm" style={{ color: 'var(--text-soft)' }}>
                <span>Uploading report...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${uploadProgress}%` }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  className="h-full rounded-full bg-gradient-to-r from-[#ff7a00] via-[#ff8a1c] to-[#ff9d3d]"
                />
              </div>
              <p className="mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>Please don&apos;t close this window.</p>
            </div>
          )}

          {success && (
            <div className="mt-4 rounded-2xl border p-3 text-center text-sm" style={{
              borderColor: 'rgba(16, 185, 129, 0.3)',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              color: '#86efac'
            }}>
              <div className="mb-1 inline-flex h-7 w-7 items-center justify-center rounded-full" style={{
                backgroundColor: 'rgba(16, 185, 129, 0.2)',
                color: '#6ee7b7'
              }}>
                <CheckCircle2 className="h-4 w-4" />
              </div>
              <div>Report uploaded successfully.</div>
            </div>
          )}

          <div className="mt-6 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="rounded-full border px-4 py-2 text-sm" style={{
              borderColor: 'var(--line)',
              backgroundColor: 'var(--bg-panel)',
              color: 'var(--text-soft)'
            }}>
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={uploading || !selectedFile}
              className="rounded-full bg-gradient-to-r from-[#ff7a00] via-[#ff8a1c] to-[#ff9d3d] px-4 py-2 text-sm font-medium text-white shadow-[0_18px_30px_rgba(255,122,0,0.2)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {uploading ? 'Uploading...' : 'Submit Report'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

export default function MyReports() {
  const navigate = useNavigate()
  const location = useLocation()
  const [user, setUser] = useState(null)
  const [loadingUser, setLoadingUser] = useState(true)
  const [reports, setReports] = useState([])
  const [selectedReportId, setSelectedReportId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [showProfileOverview, setShowProfileOverview] = useState(false)

  useEffect(() => {
    const fetchStudentProfile = async () => {
      try {
        const token = localStorage.getItem('token')

        if (!token) {
          navigate('/login')
          return
        }

        const response = await fetch('http://localhost:3000/api/students/me', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        })

        const data = await response.json()

        if (!response.ok) {
          console.error('STUDENT PROFILE ERROR:', data)

          if (response.status === 401) {
            localStorage.removeItem('token')
            localStorage.removeItem('user')
            navigate('/login')
            return
          }

          return
        }

        setUser(data)
      } catch (error) {
        console.error('FETCH STUDENT ERROR:', error)
      } finally {
        setLoadingUser(false)
      }
    }

    fetchStudentProfile()
  }, [navigate])
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortBy, setSortBy] = useState('newest')
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)

  const handleSignOut = () => {
    localStorage.removeItem('internSmart_user')
    localStorage.removeItem('token')
    navigate('/login')
  }

  const fetchReports = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')
      const data = await getReportRoutes(token)
      setReports(data)
      setSelectedReportId((current) => current || (data[0]?.id || null))
    } catch {
      // keep existing reports on error
    } finally {
      setLoading(false)
    }
  }

  const handleUploadSuccess = (newReport) => {
    if (newReport) {
      setReports((prev) => [newReport, ...prev])
      setSelectedReportId(newReport.id)
    } else {
      fetchReports()
    }
  }

  const handleSendToSupervisor = async (id) => {
    setActionLoading(true)
    setError('')
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`http://localhost:3000/api/students/reports/${id}/send-to-supervisor`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Unable to send report to supervisor')

      setReports((prev) => prev.map((r) => (r.id === id ? normalizeReport(data.report) : r)))
    } catch (err) {
      setError(err.message || 'Unable to send report to supervisor. Please try again.')
    } finally {
      setActionLoading(false)
    }
  }

  const handleSendToAi = async (id) => {
    setActionLoading(true)
    setError('')
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`http://localhost:3000/api/students/reports/${id}/send-to-ai`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Unable to send report to AI')

      setReports((prev) => prev.map((r) => (r.id === id ? normalizeReport(data.report) : r)))
    } catch (err) {
      setError(err.message || 'Unable to send report to AI. Please try again.')
    } finally {
      setActionLoading(false)
    }
  }

  useEffect(() => {
    fetchReports()
  }, [])

  useEffect(() => {
    if (location.state?.openUpload) {
      setIsUploadModalOpen(true)
      navigate(location.pathname, { replace: true, state: null })
    }
  }, [location.pathname, location.state, navigate])

  const filteredReports = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()

    const bySearch = reports.filter((report) => {
      if (!query) return true
      return [report.title, report.fileName, String(report.version)].some((value) =>
        String(value).toLowerCase().includes(query),
      )
    })

    const byStatus = bySearch.filter((report) => {
      if (statusFilter === 'all') return true
      return report.status === statusFilter
    })

    const sorted = [...byStatus]

    sorted.sort((a, b) => {
      const aTime = new Date(a.updatedAt || a.submittedAt || 0).getTime()
      const bTime = new Date(b.updatedAt || b.submittedAt || 0).getTime()

      switch (sortBy) {
        case 'oldest':
          return aTime - bTime
        case 'updated':
          return bTime - aTime
        case 'status':
          return STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)
        case 'newest':
        default:
          return bTime - aTime
      }
    })

    return sorted
  }, [reports, searchQuery, statusFilter, sortBy])

  useEffect(() => {
    if (!filteredReports.length) {
      setSelectedReportId(null)
      return
    }

    if (!selectedReportId || !filteredReports.some((report) => report.id === selectedReportId)) {
      setSelectedReportId(filteredReports[0].id)
    }
  }, [filteredReports, selectedReportId])

  const selectedReport = filteredReports.find((report) => report.id === selectedReportId) || reports.find((report) => report.id === selectedReportId) || null

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
                    className="w-full flex items-center gap-2 p-2 rounded text-left cursor-pointer"
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

        {/* Dashboard Main Content */}
        <main className="dashboard-content">
          <ReportsHeader onUploadClick={() => setIsUploadModalOpen(true)} totalReports={reports.length} />

          {error && (
            <div className="mb-6 flex items-center justify-between gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">
              <span>{error}</span>
              <button type="button" onClick={fetchReports} className="rounded-full border border-red-400/30 px-3 py-1.5 text-xs font-medium text-red-100">
                Try Again
              </button>
            </div>
          )}

          {!reports.length && !error ? (
            <EmptyReportsState onUploadClick={() => setIsUploadModalOpen(true)} />
          ) : (
            <>
              <ReportStatistics reports={reports} />

              <ReportFilters
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                statusFilter={statusFilter}
                setStatusFilter={setStatusFilter}
                sortBy={sortBy}
                setSortBy={setSortBy}
              />

              {filteredReports.length === 0 ? (
                <div className="rounded-[24px] border border-white/10 bg-[#0a0f13] p-10 text-center text-white/55">
                  <p className="text-2xl font-semibold tracking-[-0.04em] text-white">No reports found</p>
                  <p className="mt-2 text-sm">Try a different search or filter.</p>
                </div>
              ) : (
                <div className="grid gap-6 lg:grid-cols-[0.92fr_1.4fr]">
                  <div className="space-y-3">
                    {filteredReports.map((report) => (
                      <ReportCard
                        key={report.id}
                        report={report}
                        isSelected={selectedReport?.id === report.id}
                        onSelect={setSelectedReportId}
                      />
                    ))}
                  </div>

                  <ReportDetails
                    report={selectedReport}
                    onSendToSupervisor={handleSendToSupervisor}
                    onSendToAi={handleSendToAi}
                    actionLoading={actionLoading}
                  />
                </div>
              )}
            </>
          )}
        </main>
      </div>

      <UploadReportModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onUploadSuccess={handleUploadSuccess}
      />

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
