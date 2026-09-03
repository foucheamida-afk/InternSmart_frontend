import React, { useState, useEffect } from 'react'
import {
  CheckCircle2, Circle, AlertCircle, RefreshCw, ChevronRight,
  X, Save, Send, MessageSquare, Clock, Calendar, ArrowUpRight,
  Loader2, Star
} from 'lucide-react'
import api from '../../api/axios'

const STATUS_COLORS = {
  pending:     { bg: 'rgba(156,163,175,0.15)', text: '#9ca3af', label: 'Pending' },
  in_progress: { bg: 'rgba(245,166,35,0.15)',  text: '#F5A623', label: 'In Progress' },
  completed:   { bg: 'rgba(16,185,129,0.15)',  text: '#10b981', label: 'Completed' },
}

function TaskDetailModal({ task, onClose, onRefresh }) {
  const [progress, setProgress] = useState(task.progress || 0)
  const [submissionNote, setSubmissionNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [localTask, setLocalTask] = useState(task)
  const [activePane, setActivePane] = useState('details') // 'details' | 'feedback'

  const formatDate = (dateStr) => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  }

  const handleSaveProgress = async () => {
    setSaving(true)
    try {
      const res = await api.put(`/students/tasks/${task.id}/progress`, { progress })
      setLocalTask(res.data.task)
      onRefresh()
    } catch (err) {
      console.error('Save progress error:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleSubmit = async () => {
    if (!window.confirm('Submit this task as complete?')) return
    setSubmitting(true)
    try {
      const res = await api.post(`/students/tasks/${task.id}/submit`, { submissionNote })
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
  const hasFeedback = !!localTask.feedback

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div
        className="relative w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden"
        style={{ backgroundColor: 'var(--bg-panel)', borderColor: 'var(--line)', color: 'var(--text)' }}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b" style={{ borderColor: 'var(--line)' }}>
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2 mb-2">
              <span
                className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full"
                style={{ backgroundColor: statusStyle.bg, color: statusStyle.text }}
              >
                {statusStyle.label}
              </span>
              {hasFeedback && (
                <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full"
                  style={{ backgroundColor: 'rgba(139,92,246,0.15)', color: '#a78bfa' }}>
                  Feedback ✦
                </span>
              )}
            </div>
            <h2 className="text-lg font-bold leading-tight" style={{ color: 'var(--text)' }}>
              {localTask.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 transition flex-shrink-0"
            style={{ color: 'var(--text-muted)' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Nav */}
        <div className="flex border-b" style={{ borderColor: 'var(--line)' }}>
          {['details', 'feedback'].map((pane) => (
            <button
              key={pane}
              onClick={() => setActivePane(pane)}
              className="flex-1 py-3 text-sm font-semibold capitalize transition"
              style={{
                color: activePane === pane ? '#F5A623' : 'var(--text-muted)',
                borderBottom: activePane === pane ? '2px solid #F5A623' : '2px solid transparent',
              }}
            >
              {pane === 'feedback' ? `Feedback${hasFeedback ? ' ●' : ''}` : 'Details'}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto">
          {activePane === 'details' ? (
            <>
              {/* Description */}
              {localTask.description && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Description</p>
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
                  <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Submitted</p>
                  <div className="flex items-center gap-2">
                    <Clock size={14} style={{ color: localTask.submittedAt ? '#10b981' : 'var(--text-muted)' }} />
                    <span className="text-sm font-semibold">{localTask.submittedAt ? formatDate(localTask.submittedAt) : 'Not yet'}</span>
                  </div>
                </div>
              </div>

              {/* Submission note */}
              {localTask.submissionNote && (
                <div className="rounded-xl p-3 border" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--line)' }}>
                  <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Your Submission Note</p>
                  <p className="text-sm" style={{ color: 'var(--text-soft)' }}>{localTask.submissionNote}</p>
                </div>
              )}

              {/* Progress slider */}
              {!isCompleted && (
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Progress</p>
                    <span className="text-sm font-bold" style={{ color: '#F5A623' }}>{progress}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={progress}
                    onChange={(e) => setProgress(parseInt(e.target.value))}
                    className="w-full accent-orange-400"
                  />
                  <div className="mt-1.5 h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--line)' }}>
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #F5A623, #fb923c)' }}
                    />
                  </div>
                </div>
              )}

              {/* Completed progress bar */}
              {isCompleted && (
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Progress</p>
                    <span className="text-sm font-bold text-emerald-400">100%</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--line)' }}>
                    <div className="h-full rounded-full bg-emerald-500 w-full" />
                  </div>
                </div>
              )}

              {/* Submission note input */}
              {!isCompleted && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                    Submission Note <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span>
                  </p>
                  <textarea
                    value={submissionNote}
                    onChange={(e) => setSubmissionNote(e.target.value)}
                    placeholder="Add a note for your supervisor..."
                    rows={3}
                    className="w-full rounded-xl border px-3 py-2.5 text-sm focus:outline-none resize-none"
                    style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--line)', color: 'var(--text)' }}
                  />
                </div>
              )}
            </>
          ) : (
            /* Feedback pane */
            <div>
              {hasFeedback ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold"
                      style={{ background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)' }}>
                      <Star size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">Supervisor Feedback</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {localTask.feedbackAt ? formatDate(localTask.feedbackAt) : ''}
                      </p>
                    </div>
                  </div>
                  <div
                    className="rounded-xl p-4 border text-sm leading-relaxed"
                    style={{ backgroundColor: 'rgba(139,92,246,0.06)', borderColor: 'rgba(139,92,246,0.2)', color: 'var(--text-soft)' }}
                  >
                    {localTask.feedback}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <MessageSquare size={40} style={{ color: 'var(--text-muted)' }} />
                  <p className="text-sm mt-3" style={{ color: 'var(--text-muted)' }}>No feedback yet</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Your supervisor will leave feedback once your task is reviewed</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer actions */}
        {!isCompleted && activePane === 'details' && (
          <div className="flex gap-3 px-6 pb-6">
            <button
              onClick={handleSaveProgress}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-semibold transition cursor-pointer disabled:opacity-50"
              style={{ borderColor: 'var(--line)', color: 'var(--text)' }}
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Save Progress
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition cursor-pointer disabled:opacity-50 shadow-lg"
              style={{ background: 'linear-gradient(135deg, #F5A623, #fb923c)' }}
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Submit Task
            </button>
          </div>
        )}

        {isCompleted && (
          <div className="px-6 pb-6">
            <div className="flex items-center gap-3 py-3 px-4 rounded-xl"
              style={{ backgroundColor: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
              <CheckCircle2 size={18} className="text-emerald-400 flex-shrink-0" />
              <p className="text-sm font-semibold text-emerald-400">Task completed and submitted</p>
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
