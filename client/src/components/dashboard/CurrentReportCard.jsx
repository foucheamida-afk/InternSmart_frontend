import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, ArrowRight, AlertCircle, RefreshCw, Send, BrainCircuit, X, UserRound, CheckCircle2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import api from '../../api/axios'

const STATUS_TO_STAGES = {
  submitted: ['completed', 'pending', 'pending', 'pending'],
  ai_analysis: ['completed', 'current', 'pending', 'pending'],
  in_review: ['completed', 'completed', 'current', 'pending'],
  approved: ['completed', 'completed', 'completed', 'completed'],
  needs_revision: ['completed', 'completed', 'current', 'pending'],
  rejected: ['completed', 'completed', 'completed', 'pending'],
}

const STAGE_NAMES = ['Uploaded', 'AI Analysis', 'Supervisor Review', 'Final Approval']

export default function CurrentReportCard() {
  const navigate = useNavigate()
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [action, setAction] = useState(null)
  const [supervisorModalOpen, setSupervisorModalOpen] = useState(false)

  const fetchReport = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.get('/students/my-reports')
      const reports = res.data.reports || []
      setReport(reports.length > 0 ? reports[0] : null)
    } catch (err) {
      console.error('Fetch report error:', err)
      setError('Unable to load your report.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReport()
  }, [])

  const handleSendToSupervisor = async (type = 'academic') => {
    if (!report) return
    setError('')
    setNotice('')
    setAction('supervisor')
    try {
      const res = await api.post(`/students/reports/${report.id}/send-to-supervisor`, { type })
      setNotice(res.data.message || `Report sent to your ${type} supervisor for review.`)
      setSupervisorModalOpen(false)
      fetchReport()
    } catch (err) {
      console.error('Send to supervisor error:', err)
      setError(err.response?.data?.message || err.message || 'Unable to send report to supervisor.')
      setSupervisorModalOpen(false)
    } finally {
      setAction(null)
    }
  }

  const handleSendToAi = async () => {
    if (!report) return
    setError('')
    setNotice('Analysing your report with AI… this may take up to 30 seconds.')
    try {
      setAction('ai')
      await api.post(`/students/reports/${report.id}/send-to-ai`)
      setNotice('')
      navigate('/ai-analysis')
    } catch (err) {
      console.error('Send to AI error:', err)
      setError(err.response?.data?.message || err.message || 'Unable to analyze with AI.')
    } finally {
      setAction(null)
    }
  }

  const getTimeSince = (dateStr) => {
    if (!dateStr) return ''
    const diff = Date.now() - new Date(dateStr).getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    if (days === 0) return 'Updated today'
    if (days === 1) return 'Updated yesterday'
    return `Last updated ${days} days ago`
  }

  const getStatusLabel = (status) => {
    const labels = {
      submitted: 'Submitted',
      ai_analysis: 'AI analyzing',
      in_review: 'In review',
      approved: 'Approved',
      needs_revision: 'Needs revision',
      rejected: 'Rejected',
    }
    return labels[status] || status
  }

  if (loading) {
    return (
      <div className="card current-report-card flex flex-col min-h-[300px]">
        <div className="card-header">
          <h3 className="card-title">My Current Report</h3>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-3 border-orange-500 border-t-transparent" />
        </div>
      </div>
    )
  }

  if (error && !report) {
    return (
      <div className="card current-report-card flex flex-col min-h-[300px]">
        <div className="card-header">
          <h3 className="card-title">My Current Report</h3>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <AlertCircle size={24} style={{ color: '#ef4444' }} />
          <p className="text-sm mt-2" style={{ color: '#ef4444' }}>{error}</p>
          <button
            onClick={fetchReport}
            className="mt-2 flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg cursor-pointer"
            style={{ color: 'var(--orange-3)', backgroundColor: 'rgba(245,166,35,0.1)' }}
          >
            <RefreshCw size={12} /> Try Again
          </button>
        </div>
      </div>
    )
  }

  if (!report) {
    return (
      <div className="card current-report-card flex flex-col min-h-[300px]">
        <div className="card-header">
          <h3 className="card-title">My Current Report</h3>
          <button className="card-action" onClick={() => navigate('/my-reports')}>
            Upload
          </button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <FileText size={32} style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm mt-3" style={{ color: 'var(--text-muted)' }}>No report in progress</p>
        </div>
      </div>
    )
  }

  const stageStatuses = STATUS_TO_STAGES[report.status] || STATUS_TO_STAGES.submitted
  const stages = STAGE_NAMES.map((name, i) => ({ name, status: stageStatuses[i] }))
  const aiSummary = report.aiAnalysis?.summary || report.aiAnalysis?.feedback || null

  return (
    <div className="card current-report-card">
      <div className="card-header">
        <h3 className="card-title">My Current Report</h3>
        <button className="card-action cursor-pointer" onClick={() => navigate('/my-reports')}>
          View all
        </button>
      </div>

      {notice && (
        <div className="mb-3 flex items-center gap-2 rounded-xl border p-2.5 text-xs" style={{ borderColor: 'rgba(16, 185, 129, 0.3)', backgroundColor: 'rgba(16, 185, 129, 0.08)', color: '#86efac' }}>
          <CheckCircle2 size={14} className="shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {error && (
        <div className="mb-3 flex items-center gap-2 rounded-xl border p-2.5 text-xs" style={{ borderColor: 'rgba(239, 68, 68, 0.3)', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#fca5a5' }}>
          <AlertCircle size={14} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div
        className="report-meta-section cursor-pointer"
        onClick={() => navigate('/my-reports')}
      >
        <div className="report-icon-container">
          <FileText size={24} />
        </div>
        <div className="report-info">
          <h4 className="report-title">{report.title}</h4>
          <p className="report-meta">Version {report.version} • {getTimeSince(report.updatedAt)}</p>
        </div>
      </div>

      <div className="timeline-section">
        <div className="timeline-header">
          <span className="timeline-label">Report Progress</span>
          <span className="timeline-status">{getStatusLabel(report.status)}</span>
        </div>

        <div className="timeline-stages">
          {stages.map((stage, index) => (
            <div key={index} className="timeline-stage">
              <div className={`timeline-dot timeline-${stage.status}`}></div>
              <span className="timeline-stage-name">{stage.name}</span>
              {index < stages.length - 1 && <div className="timeline-connector"></div>}
            </div>
          ))}
        </div>
      </div>

      {report.aiScore != null && (
        <div className="ai-summary-section">
          <h5 className="ai-summary-title">AI Analysis Summary</h5>
          {aiSummary ? (
            <p className="ai-summary-text">{aiSummary}</p>
          ) : (
            <p className="ai-summary-text" style={{ color: 'var(--text-muted)' }}>AI analysis completed. View details for more info.</p>
          )}

          <div className="ai-summary-footer">
            <button className="ai-suggestions-btn cursor-pointer" onClick={() => navigate('/ai-analysis')}>
              View AI Suggestions
              <ArrowRight size={16} />
            </button>

            <div className="ai-score-badge cursor-pointer" onClick={() => navigate('/ai-analysis')}>
              <div className="score-text">{report.aiScore}/10</div>
            </div>
          </div>
        </div>
      )}

      {(report.status === 'submitted' || report.status === 'ai_analysis') && (
        <div className="mt-4 flex flex-col gap-2">
          {report.status === 'submitted' && (
            <>
              <button
                onClick={() => setSupervisorModalOpen(true)}
                disabled={action === 'supervisor'}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-white transition disabled:opacity-50 cursor-pointer"
                style={{ backgroundColor: '#F5A623' }}
              >
                <Send size={14} />
                {action === 'supervisor' ? 'Sending...' : 'Send to Supervisor'}
              </button>
              <button
                onClick={handleSendToAi}
                disabled={action === 'ai'}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition disabled:opacity-50 cursor-pointer"
                style={{ backgroundColor: 'rgba(245,166,35,0.12)', color: '#F5A623', border: '1px solid rgba(245,166,35,0.4)' }}
              >
                <BrainCircuit size={14} />
                {action === 'ai' ? 'Analyzing...' : 'Analyze with AI'}
              </button>
            </>
          )}

          {report.status === 'ai_analysis' && (
            <button
              onClick={() => setSupervisorModalOpen(true)}
              disabled={action === 'supervisor'}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-white transition disabled:opacity-50 cursor-pointer"
              style={{ backgroundColor: '#F5A623' }}
            >
              <Send size={14} />
              {action === 'supervisor' ? 'Sending...' : 'Send to Supervisor'}
            </button>
          )}
        </div>
      )}

      <AnimatePresence>
        {supervisorModalOpen && (
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
              className="w-full max-w-md rounded-[28px] border p-6 shadow-[0_40px_100px_rgba(0,0,0,0.45)]"
              style={{
                backgroundColor: 'var(--bg-panel)',
                borderColor: 'var(--line)',
                color: 'var(--text)'
              }}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.2em]" style={{ color: 'var(--orange-3)' }}>Send to Supervisor</p>
                  <h3 className="mt-2 text-xl font-semibold">Choose supervisor type</h3>
                  <p className="mt-2 text-sm" style={{ color: 'var(--text-soft)' }}>
                    Select which supervisor should review this report.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSupervisorModalOpen(false)}
                  className="rounded-full border p-2 transition cursor-pointer hover:bg-white/10 shrink-0 ml-2"
                  style={{ borderColor: 'var(--line)', color: 'var(--text-muted)' }}
                  title="Close modal"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-6 grid gap-3">
                <button
                  type="button"
                  onClick={() => handleSendToSupervisor('academic')}
                  disabled={action === 'supervisor'}
                  className="flex items-center gap-3 rounded-2xl border p-4 text-left transition hover:border-[#ff7a00] cursor-pointer"
                  style={{
                    borderColor: 'var(--line)',
                    backgroundColor: 'var(--bg-panel)'
                  }}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border" style={{
                    borderColor: 'rgba(255, 122, 0, 0.25)',
                    backgroundColor: 'rgba(255, 122, 0, 0.1)',
                    color: 'var(--orange-3)'
                  }}>
                    <UserRound className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">Academic Supervisor</div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Send to your academic supervisor for review</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleSendToSupervisor('professional')}
                  disabled={action === 'supervisor'}
                  className="flex items-center gap-3 rounded-2xl border p-4 text-left transition hover:border-[#ff7a00] cursor-pointer"
                  style={{
                    borderColor: 'var(--line)',
                    backgroundColor: 'var(--bg-panel)'
                  }}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border" style={{
                    borderColor: 'rgba(16, 185, 129, 0.25)',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    color: '#10b981'
                  }}>
                    <UserRound className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">Professional Supervisor</div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Send to your professional supervisor for review</div>
                  </div>
                </button>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={() => setSupervisorModalOpen(false)}
                  className="rounded-full border px-4 py-2 text-sm cursor-pointer"
                  style={{
                    borderColor: 'var(--line)',
                    backgroundColor: 'var(--bg-panel)',
                    color: 'var(--text-soft)'
                  }}
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

