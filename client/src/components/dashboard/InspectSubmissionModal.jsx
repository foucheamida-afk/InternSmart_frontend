import React, { useState } from 'react'
import { X, CheckCircle2, RotateCcw, ExternalLink, Clock, FileText, Loader2, Star, Check } from 'lucide-react'

export default function InspectSubmissionModal({ task, intern, onClose, onReviewComplete }) {
  const [feedback, setFeedback] = useState(task.feedbackAcademic || task.feedbackProfessional || task.feedback || '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [selectedMilestoneId, setSelectedMilestoneId] = useState(null)

  const milestones = Array.isArray(task.milestones) ? task.milestones : []

  const handleAction = async (status) => {
    if (status === 'needs_revision' && !feedback.trim()) {
      setError('Please provide feedback explaining what needs revision.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const payload = {
        status,
        feedback,
        milestoneId: selectedMilestoneId,
        milestoneStatus: status === 'completed' || status === 'approved' ? 'approved' : 'needs_revision',
      }
      await onReviewComplete(task.id, payload)
      onClose()
    } catch (err) {
      console.error('Review error:', err)
      setError('Failed to update task review status')
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
                Task Submission Review
              </span>
              {task.supervisorRoleLabel && (
                <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-orange-500/15 text-orange-400 border border-orange-500/30">
                  {task.supervisorRoleLabel}
                </span>
              )}
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

          {/* Task Requirements */}
          {task.description && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Task Requirements</h4>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-soft)' }}>{task.description}</p>
            </div>
          )}

          {/* Milestones if present */}
          {milestones.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Task Milestones & Progress</h4>
              <div className="space-y-2">
                {milestones.map((m) => (
                  <div
                    key={m.id}
                    onClick={() => setSelectedMilestoneId(selectedMilestoneId === m.id ? null : m.id)}
                    className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                      selectedMilestoneId === m.id ? 'border-orange-500 bg-orange-500/10' : 'border-line'
                    }`}
                    style={{ backgroundColor: selectedMilestoneId === m.id ? undefined : 'var(--bg)' }}
                  >
                    <div>
                      <p className="text-xs font-bold" style={{ color: 'var(--text)' }}>{m.title}</p>
                      {m.description && <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{m.description}</p>}
                    </div>
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                      m.status === 'approved' || m.status === 'completed' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' :
                      m.status === 'submitted' ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30' :
                      m.status === 'needs_revision' ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30' :
                      'bg-gray-500/15 text-gray-400 border border-gray-500/30'
                    }`}>
                      {m.status || 'Pending'}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] italic" style={{ color: 'var(--text-muted)' }}>
                {selectedMilestoneId ? `Selected Milestone #${selectedMilestoneId} for review.` : 'Reviewing overall task submission.'}
              </p>
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
              Review Feedback & Comments <span style={{ fontWeight: 400 }}>(Optional for approval, required for revision)</span>
            </label>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Write constructive feedback, guidance, or revision requirements for the student..."
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
            {selectedMilestoneId ? 'Approve Milestone' : 'Approve & Complete Task'}
          </button>
        </div>
      </div>
    </div>
  )
}
