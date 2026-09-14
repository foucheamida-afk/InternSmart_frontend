import React, { useState } from 'react'
import { X, CheckCircle2, RotateCcw, ExternalLink, Clock, FileText, Loader2 } from 'lucide-react'

export default function InspectSubmissionModal({ task, intern, onClose, onReviewComplete }) {
  const [feedback, setFeedback] = useState(task.feedbackAcademic || task.feedbackProfessional || task.feedback || '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleAction = async (status) => {
    if (status === 'needs_revision' && !feedback.trim()) {
      setError('Please provide feedback explaining what needs revision.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await onReviewComplete(task.id, status, feedback)
      onClose()
    } catch (err) {
      console.error('Review error:', err)
      setError('Failed to update task status')
    } finally {
      setSubmitting(false)
    }
  }

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div
        className="relative w-full max-w-xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        style={{ backgroundColor: 'var(--bg-panel)', borderColor: 'var(--line)', color: 'var(--text)' }}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b" style={{ borderColor: 'var(--line)' }}>
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/30">
                Submitted Task Review
              </span>
            </div>
            <h2 className="text-lg font-bold leading-tight" style={{ color: 'var(--text)' }}>
              {task.title}
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

        {/* Content */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Intern Info */}
          <div className="flex items-center justify-between p-3.5 rounded-xl border" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--line)' }}>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full flex items-center justify-center font-bold text-white bg-gradient-to-tr from-amber-500 to-orange-500">
                {intern?.name?.charAt(0)?.toUpperCase() || 'S'}
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{intern?.name || 'Student Intern'}</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{intern?.email || intern?.matricule || ''}</p>
              </div>
            </div>
            <div className="text-right text-xs" style={{ color: 'var(--text-muted)' }}>
              <div className="flex items-center gap-1"><Clock size={13} /> Submitted:</div>
              <span className="font-semibold text-emerald-400">{formatDate(task.submittedAt)}</span>
            </div>
          </div>

          {/* Description */}
          {task.description && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Task Requirements</h4>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-soft)' }}>{task.description}</p>
            </div>
          )}

          {/* Student Submitted Notes */}
          <div className="rounded-xl p-4 border bg-blue-500/5 border-blue-500/20 space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
              <FileText size={14} /> Student Submission Notes
            </h4>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text)' }}>
              {task.submissionNote || <em style={{ color: 'var(--text-muted)' }}>No submission notes provided by student.</em>}
            </p>
          </div>

          {/* Student Submitted Link */}
          {task.workUrl && (
            <div className="rounded-xl p-4 border bg-emerald-500/5 border-emerald-500/20 flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400">Attached Deliverable / Work URL</h4>
                <p className="text-xs truncate max-w-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>{task.workUrl}</p>
              </div>
              <a
                href={task.workUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 transition shrink-0"
              >
                Open Work <ExternalLink size={13} />
              </a>
            </div>
          )}

          {/* Supervisor Feedback Form */}
          <div className="space-y-2 pt-2 border-t" style={{ borderColor: 'var(--line)' }}>
            <label className="block text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              Review Feedback & Instructions <span style={{ fontWeight: 400 }}>(Optional for approval, required for revision)</span>
            </label>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Write feedback, guidance, or instructions for revision..."
              rows={3}
              className="w-full rounded-xl border px-3 py-2.5 text-sm focus:outline-none resize-none"
              style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--line)', color: 'var(--text)' }}
            />
          </div>

          {error && <p className="text-xs text-rose-400 font-semibold">{error}</p>}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between gap-3 p-6 border-t" style={{ borderColor: 'var(--line)' }}>
          <button
            onClick={() => handleAction('needs_revision')}
            disabled={submitting}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-rose-500/40 text-rose-400 hover:bg-rose-500/10 text-sm font-semibold transition cursor-pointer disabled:opacity-50"
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
            Request Revision
          </button>
          <button
            onClick={() => handleAction('completed')}
            disabled={submitting}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 transition cursor-pointer disabled:opacity-50 shadow-lg"
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            Approve & Complete
          </button>
        </div>
      </div>
    </div>
  )
}
