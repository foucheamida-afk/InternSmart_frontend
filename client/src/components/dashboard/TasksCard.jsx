import React, { useState, useEffect, useRef } from 'react'
import {
  CheckCircle2, Circle, AlertCircle, RefreshCw, ChevronRight,
  X, Save, Send, MessageSquare, Clock, Calendar, ArrowUpRight,
  Loader2, Star, Upload
} from 'lucide-react'
import api from '../../api/axios'

const STATUS_COLORS = {
  pending:        { bg: 'rgba(156,163,175,0.15)', text: '#9ca3af', label: 'Pending' },
  in_progress:    { bg: 'rgba(245,166,35,0.15)',  text: '#F5A623', label: 'In Progress' },
  submitted:      { bg: 'rgba(59,130,246,0.15)',  text: '#3b82f6', label: 'Awaiting Review' },
  needs_revision: { bg: 'rgba(239,68,68,0.15)',   text: '#ef4444', label: 'Needs Revision' },
  completed:      { bg: 'rgba(16,185,129,0.15)',  text: '#10b981', label: 'Completed' },
}

function TaskDetailModal({ task, onClose, onRefresh }) {
  const [submissionNote, setSubmissionNote] = useState(task.submissionNote || '')
  const [workUrl, setWorkUrl] = useState(task.workUrl || '')
  const [selectedMilestoneId, setSelectedMilestoneId] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [localTask, setLocalTask] = useState(task)
  const [activePane, setActivePane] = useState('details') // 'details' | 'feedback'
  const fileInputRef = useRef(null)

  const formatDate = (dateStr) => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const formData = new FormData()
    formData.append('file', file)
    setUploading(true)
    try {
      const res = await api.post('/students/tasks/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      if (res.data?.fileUrl) {
        setWorkUrl(res.data.fileUrl)
      }
    } catch (err) {
      console.error('File upload error:', err)
      alert(err.response?.data?.message || 'Failed to upload deliverable file.')
    } finally {
      setUploading(false)
      if (e.target) e.target.value = ''
    }
  }

  const handleSubmit = async () => {
    if (!window.confirm('Submit your completed work for supervisor review?')) return
    setSubmitting(true)
    try {
      const payload = { submissionNote, workUrl }
      if (selectedMilestoneId) payload.milestoneId = selectedMilestoneId
      const res = await api.post(`/students/tasks/${task.id}/submit`, payload)
      setLocalTask(res.data.task)
      onRefresh()
    } catch (err) {
      console.error('Submit task error:', err)
    } finally {
      setSubmitting(false)
    }
  }

  const status = localTask.status || 'pending'
  const statusStyle = STATUS_COLORS[status] || STATUS_COLORS.pending
  const isCompleted = status === 'completed'
  const isSubmitted = status === 'submitted'
  const needsRevision = status === 'needs_revision'
  const hasFeedback = !!localTask.feedback || !!localTask.feedbackAcademic || !!localTask.feedbackProfessional
  const milestones = Array.isArray(localTask.milestones) ? localTask.milestones : []

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div
        className="relative w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        style={{ backgroundColor: 'var(--bg-panel)', borderColor: 'var(--line)', color: 'var(--text)' }}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b" style={{ borderColor: 'var(--line)' }}>
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span
                className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full"
                style={{ backgroundColor: statusStyle.bg, color: statusStyle.text }}
              >
                {statusStyle.label}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20">
                {localTask.assignedByLabel || 'Supervisor Task'}
              </span>
              {hasFeedback && (
                <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full flex items-center gap-1"
                  style={{ backgroundColor: 'rgba(139,92,246,0.15)', color: '#a78bfa' }}>
                  <Star size={11} /> Feedback
                </span>
              )}
            </div>
            <h2 className="text-lg font-bold leading-tight" style={{ color: 'var(--text)' }}>
              {localTask.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 transition flex-shrink-0 cursor-pointer"
            style={{ color: 'var(--text-muted)' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Nav */}
        <div className="flex border-b" style={{ borderColor: 'var(--line)' }}>
          {['details', 'milestones', 'feedback'].map((pane) => {
            if (pane === 'milestones' && milestones.length === 0) return null
            return (
              <button
                key={pane}
                onClick={() => setActivePane(pane)}
                className="flex-1 py-3 text-sm font-semibold capitalize transition cursor-pointer"
                style={{
                  color: activePane === pane ? '#F5A623' : 'var(--text-muted)',
                  borderBottom: activePane === pane ? '2px solid #F5A623' : '2px solid transparent',
                }}
              >
                {pane === 'feedback' ? `Feedback${hasFeedback ? ' ●' : ''}` : pane === 'milestones' ? `Milestones (${milestones.length})` : 'Details'}
              </button>
            )
          })}
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {activePane === 'details' && (
            <>
              {/* Status Banners */}
              {isSubmitted && (
                <div className="rounded-xl p-3 border bg-blue-500/10 border-blue-500/30 text-blue-300 text-xs flex items-center gap-2">
                  <Clock size={16} className="shrink-0" />
                  <div>
                    <strong className="block text-[11px] uppercase tracking-wider">Submitted for Supervisor Review</strong>
                    <span>Submitted on {formatDate(localTask.submittedAt)}. Awaiting supervisor approval.</span>
                  </div>
                </div>
              )}

              {needsRevision && (
                <div className="rounded-xl p-3 border bg-rose-500/10 border-rose-500/30 text-rose-300 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[11px]">
                    <AlertCircle size={15} /> Revision Requested
                  </div>
                  {localTask.feedback && (
                    <p className="bg-black/30 p-2 rounded border border-rose-500/20 text-xs italic">
                      "{localTask.feedback}"
                    </p>
                  )}
                  <p className="text-[11px]">Please revise your submission below and click <strong>Resubmit Task</strong>.</p>
                </div>
              )}

              {/* Description */}
              {localTask.description && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-muted)' }}>Task Description</p>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--text-soft)' }}>{localTask.description}</p>
                </div>
              )}

              {/* Meta */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl p-3 border" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--line)' }}>
                  <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Due Date</p>
                  <div className="flex items-center gap-2">
                    <Calendar size={14} style={{ color: '#F5A623' }} />
                    <span className="text-sm font-semibold">{formatDate(localTask.dueDate)}</span>
                  </div>
                </div>
                <div className="rounded-xl p-3 border" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--line)' }}>
                  <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Assigned By</p>
                  <div className="flex items-center gap-2">
                    <Star size={14} style={{ color: '#F5A623' }} />
                    <span className="text-xs font-semibold truncate">{localTask.assignedByLabel || 'Supervisor'}</span>
                  </div>
                </div>
              </div>

              {/* Automatic Read-only Progress Bar */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Task Completion Progress</p>
                  <span className="text-sm font-bold" style={{ color: '#F5A623' }}>{localTask.progress || 0}%</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--line)' }}>
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${localTask.progress || 0}%`, background: 'linear-gradient(90deg, #F5A623, #10b981)' }}
                  />
                </div>
                <p className="text-[11px] mt-1 italic text-center" style={{ color: 'var(--text-muted)' }}>
                  Progress is updated automatically upon supervisor approval.
                </p>
              </div>

              {/* Submission Inputs */}
              {!isCompleted && (
                <div className="space-y-3 pt-2 border-t" style={{ borderColor: 'var(--line)' }}>
                  {milestones.length > 0 && (
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
                        Select Milestone to Submit (Optional)
                      </label>
                      <select
                        value={selectedMilestoneId || ''}
                        onChange={(e) => setSelectedMilestoneId(e.target.value || null)}
                        className="w-full rounded-xl border px-3 py-2 text-xs focus:outline-none"
                        style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--line)', color: 'var(--text)' }}
                      >
                        <option value="">Full Task Submission</option>
                        {milestones.map((m) => (
                          <option key={m.id} value={m.id}>
                            Milestone: {m.title} ({m.status || 'pending'})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
                      Submission Notes / Work Summary
                    </label>
                    <textarea
                      value={submissionNote}
                      onChange={(e) => setSubmissionNote(e.target.value)}
                      placeholder="Describe what work was completed, methodology, or results..."
                      rows={3}
                      className="w-full rounded-xl border px-3 py-2.5 text-sm focus:outline-none resize-none"
                      style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--line)', color: 'var(--text)' }}
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                        Deliverable Link / Document URL
                      </label>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="text-xs font-semibold text-orange-400 hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      >
                        {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                        {uploading ? 'Uploading...' : 'Upload File to Supervisor'}
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="url"
                        value={workUrl}
                        onChange={(e) => setWorkUrl(e.target.value)}
                        placeholder="https://... or upload a file directly"
                        className="flex-1 rounded-xl border px-3 py-2 text-xs focus:outline-none"
                        style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--line)', color: 'var(--text)' }}
                      />
                      {workUrl && (
                        <a
                          href={workUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/30 hover:bg-blue-500/20"
                          title="Open Deliverable Link"
                        >
                          <ArrowUpRight size={14} />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Milestones Tab */}
          {activePane === 'milestones' && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Defined Milestones</h4>
              {milestones.map((m, i) => (
                <div key={m.id || i} className="rounded-xl p-3.5 border space-y-1.5" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--line)' }}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold" style={{ color: 'var(--text)' }}>{i + 1}. {m.title}</span>
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                      m.status === 'approved' || m.status === 'completed' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' :
                      m.status === 'submitted' ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30' :
                      m.status === 'needs_revision' ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30' :
                      'bg-gray-500/15 text-gray-400 border border-gray-500/30'
                    }`}>
                      {m.status || 'Pending'}
                    </span>
                  </div>
                  {m.description && <p className="text-xs" style={{ color: 'var(--text-soft)' }}>{m.description}</p>}
                  {m.dueDate && <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Due: {formatDate(m.dueDate)}</p>}
                </div>
              ))}
            </div>
          )}

          {/* Feedback Tab */}
          {activePane === 'feedback' && (
            <div>
              {hasFeedback ? (
                <div className="space-y-4">
                  {localTask.feedbackAcademic && (
                    <div className="rounded-xl p-4 border bg-purple-500/5 border-purple-500/20 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-purple-400">Academic Supervisor Feedback</span>
                        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{formatDate(localTask.feedbackAcademicAt)}</span>
                      </div>
                      <p className="text-sm leading-relaxed" style={{ color: 'var(--text-soft)' }}>{localTask.feedbackAcademic}</p>
                    </div>
                  )}

                  {localTask.feedbackProfessional && (
                    <div className="rounded-xl p-4 border bg-blue-500/5 border-blue-500/20 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-blue-400">Professional Supervisor Feedback</span>
                        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{formatDate(localTask.feedbackProfessionalAt)}</span>
                      </div>
                      <p className="text-sm leading-relaxed" style={{ color: 'var(--text-soft)' }}>{localTask.feedbackProfessional}</p>
                    </div>
                  )}

                  {localTask.feedback && !localTask.feedbackAcademic && !localTask.feedbackProfessional && (
                    <div className="rounded-xl p-4 border bg-orange-500/5 border-orange-500/20 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-orange-400">Supervisor Feedback</span>
                        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{formatDate(localTask.feedbackAt)}</span>
                      </div>
                      <p className="text-sm leading-relaxed" style={{ color: 'var(--text-soft)' }}>{localTask.feedback}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <MessageSquare size={40} style={{ color: 'var(--text-muted)' }} />
                  <p className="text-sm mt-3" style={{ color: 'var(--text-muted)' }}>No feedback yet</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Your supervisor will review your work and leave feedback.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer actions */}
        {!isCompleted && activePane === 'details' && (
          <div className="flex items-center gap-2.5 px-6 pb-6 pt-3 border-t" style={{ borderColor: 'var(--line)' }}>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || submitting}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border text-xs font-semibold hover:bg-white/5 transition cursor-pointer disabled:opacity-50 shrink-0"
              style={{ borderColor: 'var(--line)', color: 'var(--text)' }}
              title="Upload work file directly"
            >
              {uploading ? <Loader2 size={14} className="animate-spin text-orange-400" /> : <Upload size={14} className="text-orange-400" />}
              <span>{uploading ? 'Uploading...' : 'Upload Work'}</span>
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || uploading}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition cursor-pointer disabled:opacity-50 shadow-lg"
              style={{ background: 'linear-gradient(135deg, #F5A623, #fb923c)' }}
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              {isSubmitted ? 'Update Work Submission' : needsRevision ? 'Resubmit Work' : 'Submit Work for Review'}
            </button>
          </div>
        )}

        {isCompleted && (
          <div className="px-6 pb-6 pt-2">
            <div className="flex items-center gap-3 py-3 px-4 rounded-xl"
              style={{ backgroundColor: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
              <CheckCircle2 size={18} className="text-emerald-400 flex-shrink-0" />
              <p className="text-sm font-semibold text-emerald-400">Task approved and marked completed by supervisor</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function TasksCard() {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedTask, setSelectedTask] = useState(null)

  const fetchTasks = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.get('/students/my-tasks')
      setTasks(res.data.tasks || [])
    } catch (err) {
      console.error('Fetch tasks error:', err)
      setError('Unable to load your tasks.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTasks()
    const refreshInterval = window.setInterval(fetchTasks, 10000)
    return () => window.clearInterval(refreshInterval)
  }, [])

  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const isDueSoon = (dateStr) => {
    if (!dateStr) return false
    const diff = new Date(dateStr) - new Date()
    return diff > 0 && diff < 3 * 24 * 60 * 60 * 1000
  }

  const isOverdue = (dateStr, status) => {
    if (!dateStr || status === 'completed') return false
    return new Date(dateStr) < new Date()
  }

  return (
    <>
      <div className="card tasks-card">
        <div className="card-header">
          <h3 className="card-title">My Tasks</h3>
          <span className="text-xs font-semibold px-2 py-1 rounded-full"
            style={{ backgroundColor: 'rgba(245,166,35,0.12)', color: '#F5A623' }}>
            {tasks.filter(t => !t.completed).length} pending
          </span>
        </div>

        <div className="tasks-list">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-orange-400 border-t-transparent" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <AlertCircle size={24} style={{ color: '#ef4444' }} />
              <p className="text-sm mt-2" style={{ color: '#ef4444' }}>{error}</p>
              <button
                onClick={fetchTasks}
                className="mt-2 flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg cursor-pointer"
                style={{ color: '#F5A623', backgroundColor: 'rgba(245,166,35,0.1)' }}
              >
                <RefreshCw size={12} /> Try Again
              </button>
            </div>
          ) : tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <CheckCircle2 size={36} style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
              <p className="text-sm mt-3" style={{ color: 'var(--text-muted)' }}>No tasks assigned yet</p>
            </div>
          ) : (
            tasks.slice(0, 5).map((task) => {
              const statusStyle = STATUS_COLORS[task.status] || STATUS_COLORS.pending
              const dueSoon = isDueSoon(task.dueDate)
              const overdue = isOverdue(task.dueDate, task.status)
              const hasFeedback = !!task.feedback

              return (
                <div
                  key={task.id}
                  onClick={() => setSelectedTask(task)}
                  className="task-item cursor-pointer group hover:bg-orange-500/[0.04] transition-all rounded-lg px-2"
                  style={{ borderBottom: '1px solid var(--line)', paddingTop: '12px', paddingBottom: '12px' }}
                >
                  <div className="task-checkbox mr-1">
                    {task.completed
                      ? <CheckCircle2 size={18} className="text-emerald-400" />
                      : <Circle size={18} style={{ color: 'var(--text-muted)' }} />}
                  </div>

                  <div className="task-content flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`task-name text-sm font-medium truncate ${task.completed ? 'line-through opacity-50' : ''}`}
                        style={{ color: 'var(--text)' }}
                      >
                        {task.title}
                      </span>
                      {hasFeedback && (
                        <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: 'rgba(139,92,246,0.15)', color: '#a78bfa' }}>
                          FB
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-full"
                        style={{ backgroundColor: statusStyle.bg, color: statusStyle.text }}
                      >
                        {statusStyle.label}
                      </span>
                      {dueSoon && !task.completed && (
                        <span className="text-[10px] text-amber-400 font-semibold">Due soon!</span>
                      )}
                      {overdue && (
                        <span className="text-[10px] text-red-400 font-semibold">Overdue</span>
                      )}
                    </div>
                    {/* Mini progress bar */}
                    {!task.completed && task.progress > 0 && (
                      <div className="mt-1.5 h-1 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--line)' }}>
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${task.progress}%`, background: 'linear-gradient(90deg, #F5A623, #fb923c)' }}
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {task.dueDate && (
                      <span
                        className="task-date text-[10px]"
                        style={{ color: overdue ? '#ef4444' : dueSoon ? '#f59e0b' : 'var(--text-muted)' }}
                      >
                        {formatDate(task.dueDate)}
                      </span>
                    )}
                    <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} className="group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              )
            })
          )}
        </div>

        {tasks.length > 5 && (
          <div className="pt-3 border-t mt-3" style={{ borderColor: 'var(--line)' }}>
            <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
              +{tasks.length - 5} more tasks
            </p>
          </div>
        )}
      </div>

      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onRefresh={() => {
            fetchTasks()
            setSelectedTask(null)
          }}
        />
      )}
    </>
  )
}
