import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, ArrowRight, AlertCircle, RefreshCw, Send, BrainCircuit } from 'lucide-react'
import api from '../../api/axios'
import { CardSkeleton } from './SkeletonLoader'

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
  const [action, setAction] = useState(null)

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

  const handleSendToSupervisor = async () => {
    if (!report) return
    try {
      setAction('supervisor')
      await api.post(`/students/reports/${report.id}/send-to-supervisor`)
      fetchReport()
    } catch (err) {
      console.error('Send to supervisor error:', err)
    } finally {
      setAction(null)
    }
  }

  const handleSendToAi = async () => {
    if (!report) return
    try {
      setAction('ai')
      await api.post(`/students/reports/${report.id}/send-to-ai`)
      fetchReport()
    } catch (err) {
      console.error('Send to AI error:', err)
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

  if (error) {
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
        <button className="card-action" onClick={() => navigate('/my-reports')}>
          View all
        </button>
      </div>

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
                onClick={handleSendToSupervisor}
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
              onClick={handleSendToSupervisor}
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
    </div>
  )
}
