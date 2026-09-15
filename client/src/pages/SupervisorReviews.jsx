import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  FileText,
  FileSearch,
  Inbox,
  Library,
  LoaderCircle,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react'
import ThemeToggle from '../components/ThemeToggle'
import { useAuth } from '../context/AuthContext'
import { getStoredToken, clearStoredAuth } from '../utils/storage'
import {
  approveReview,
  getMyReviewQueue,
  rejectReview,
  API_ORIGIN,
} from '../services/reportWorkflowService'
import '../assets/css/dashboard.css'
import '../assets/css/dashboard-components.css'

// Shared review queue for both supervisor capacities (§4.12).
//
// One page rather than a tab in each dashboard: the API returns one queue for
// both, because the review row - not the account's role - decides which capacity
// the reviewer is acting in. A person who supervises one student academically
// and another professionally sees both here, each labelled correctly.

const supervisorLabel = (type) =>
  type === 'academic' ? 'Academic Supervisor' : 'Professional Supervisor'

const RejectDialog = ({ review, onCancel, onConfirm, busy }) => {
  const [reason, setReason] = useState('')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div
        className="w-full max-w-lg rounded-[24px] border p-6"
        style={{ backgroundColor: 'var(--bg-panel)', borderColor: 'var(--line)', color: 'var(--text)' }}
      >
        <h3 className="text-lg font-semibold tracking-[-0.03em]">Request corrections</h3>
        <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
          {review.report?.student?.name || 'The student'} will see this reason. Your confidential notes and mark are
          not shown to them.
        </p>

        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={4}
          autoFocus
          placeholder="What needs to change before this report can be approved?"
          className="mt-4 w-full rounded-xl border p-3 text-sm outline-none"
          style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--line)', color: 'var(--text)' }}
        />

        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border px-4 py-2 text-sm"
            style={{ borderColor: 'var(--line)', color: 'var(--text-soft)' }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!reason.trim() || busy}
            onClick={() => onConfirm(reason.trim())}
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            style={{ background: 'linear-gradient(to right, #ef4444, #dc2626)' }}
          >
            {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ThumbsDown className="h-4 w-4" />}
            Send for correction
          </button>
        </div>
      </div>
    </div>
  )
}

// Approving a report means confirming the supervisor's existing rubric grade, so
// the failure that matters here is RUBRIC_REQUIRED: the grade has not been
// submitted yet. The message from the API already says which scale and what to
// do; this dialog adds the optional confidential notes and a route to grading.
const ApproveDialog = ({ review, onCancel, onConfirm, busy, error }) => {
  const [notes, setNotes] = useState('')
  const rubricRequired = error?.code === 'RUBRIC_REQUIRED'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div
        className="w-full max-w-lg rounded-[24px] border p-6"
        style={{ backgroundColor: 'var(--bg-panel)', borderColor: 'var(--line)', color: 'var(--text)' }}
      >
        <h3 className="text-lg font-semibold tracking-[-0.03em]">Approve this report</h3>
        <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
          Approving confirms the supervision grade you have already submitted for{' '}
          {review.report?.student?.name || 'this student'}. Both supervisors must approve before the student can
          submit the final version.
        </p>

        {rubricRequired && (
          <div
            className="mt-4 rounded-xl border p-3 text-xs"
            style={{ borderColor: 'rgba(239,68,68,0.35)', backgroundColor: 'rgba(239,68,68,0.1)', color: '#fca5a5' }}
          >
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{error.message}</span>
            </div>
            <p className="mt-2" style={{ color: 'var(--text-soft)' }}>
              Submit the grade from your dashboard's <strong>Grading</strong> tab, then approve here.
            </p>
          </div>
        )}

        <label className="mt-5 block text-xs font-semibold" style={{ color: 'var(--text-soft)' }}>
          Confidential notes (optional)
        </label>
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={3}
          placeholder="Notes for the record. Not shown to the student."
          className="mt-1.5 w-full rounded-xl border p-3 text-sm outline-none"
          style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--line)', color: 'var(--text)' }}
        />

        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border px-4 py-2 text-sm"
            style={{ borderColor: 'var(--line)', color: 'var(--text-soft)' }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onConfirm(notes.trim() || null)}
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            style={{ background: 'linear-gradient(to right, #10b981, #059669)' }}
          >
            {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ThumbsUp className="h-4 w-4" />}
            Approve and confirm grade
          </button>
        </div>
      </div>
    </div>
  )
}

const SupervisorReviews = () => {
  const navigate = useNavigate()
  const { logout, user } = useAuth()

  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [rejecting, setRejecting] = useState(null)
  const [approving, setApproving] = useState(null)
  const [approveError, setApproveError] = useState(null)

  // No shared Sidebar here on purpose: that component's navigation is
  // student-scoped (My Reports, Writing Workspace, ...) and would offer a
  // supervisor links that ProtectedRoute immediately bounces them off.
  const dashboardHome = () =>
    user?.role === 'professional_supervisor' ? '/professional-supervisor' : '/supervisor'

  const load = useCallback(async () => {
    try {
      const data = await getMyReviewQueue()
      setReviews(data.reviews || [])
      setError('')
    } catch (err) {
      if (err.status === 401) {
        clearStoredAuth()
        navigate('/login')
        return
      }
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [navigate])

  useEffect(() => {
    if (!getStoredToken()) {
      navigate('/login')
      return
    }
    load()
  }, [load, navigate])

  const handleApprove = async (privateComments) => {
    const review = approving
    if (!review) return

    setBusyId(review.id)
    setError('')
    setNotice('')
    setApproveError(null)

    try {
      const data = await approveReview(review.id, privateComments)
      setApproving(null)
      setNotice(data.message)
      await load()
    } catch (err) {
      // Kept on the dialog rather than the page banner: the gate is specific to
      // this action and the reviewer needs to see what to do about it here.
      setApproveError(err)
    } finally {
      setBusyId(null)
    }
  }

  const handleReject = async (reason) => {
    const review = rejecting
    setRejecting(null)
    setBusyId(review.id)
    setError('')
    setNotice('')
    try {
      const data = await rejectReview(review.id, reason)
      setNotice(data.message)
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  const handleSignOut = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="dashboard-wrapper">
      <div className="dashboard-main">
        <header className="dashboard-header">
          <div className="header-left">
            <button
              type="button"
              onClick={() => navigate(dashboardHome())}
              className="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium transition"
              style={{ borderColor: 'var(--line)', color: 'var(--text-soft)' }}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to dashboard
            </button>
            <div className="program-info">
              <span>{supervisorLabel(user?.role)}</span>
            </div>
            <button
              type="button"
              onClick={() => navigate('/library')}
              className="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium transition"
              style={{ borderColor: 'var(--line)', color: 'var(--text-soft)' }}
            >
              <Library className="h-3.5 w-3.5" /> Report Library
            </button>
          </div>

          <div className="header-right">
            <ThemeToggle />
            <div className="user-menu cursor-pointer" onClick={handleSignOut} title="Sign out">
              <div className="user-avatar">
                <div className="avatar-placeholder">{user?.name?.charAt(0)}</div>
              </div>
              <div className="user-info">
                <div className="user-name">{user?.name}</div>
                <div className="user-role">Sign out</div>
              </div>
              <ChevronDown size={16} />
            </div>
          </div>
        </header>

        <main className="dashboard-content">
          <section className="dashboard-header-section">
            <div className="greeting-area">
              <h1 className="greeting-title">Report Reviews</h1>
              <p className="greeting-subtitle">
                Reports awaiting your validation. Both supervisors must approve before the student can submit the
                final version.
              </p>
            </div>
          </section>

          <div className="mb-6 flex items-center justify-between gap-3">
            <div className="text-xs uppercase tracking-[0.18em]" style={{ color: 'var(--text-muted)' }}>
              {reviews.length} awaiting review
            </div>
            <button
              type="button"
              onClick={load}
              className="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium transition"
              style={{ borderColor: 'var(--line)', color: 'var(--text-soft)' }}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {error && (
            <div
              className="mb-5 flex items-center gap-2 rounded-2xl border p-4 text-sm"
              style={{ borderColor: 'rgba(239, 68, 68, 0.3)', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#fca5a5' }}
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {notice && (
            <div
              className="mb-5 flex items-center gap-2 rounded-2xl border p-4 text-sm"
              style={{ borderColor: 'rgba(16, 185, 129, 0.3)', backgroundColor: 'rgba(16, 185, 129, 0.08)', color: '#86efac' }}
            >
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              {notice}
            </div>
          )}

          {loading && reviews.length === 0 ? (
            <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Loading your review queue…
            </div>
          ) : reviews.length === 0 ? (
            <div
              className="flex flex-col items-center rounded-[24px] border border-dashed p-10 text-center"
              style={{ borderColor: 'var(--line)', color: 'var(--text-muted)' }}
            >
              <Inbox className="mb-3 h-10 w-10" style={{ color: 'var(--orange-3)' }} />
              <p className="text-base font-medium" style={{ color: 'var(--text)' }}>
                Nothing awaiting your review
              </p>
              <p className="mt-2 max-w-md text-sm">
                When a student requests submission, the report appears here for you to validate.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {reviews.map((review) => (
                <div
                  key={review.id}
                  className="rounded-[20px] border p-5"
                  style={{ backgroundColor: 'var(--bg-panel)', borderColor: 'var(--line)', color: 'var(--text)' }}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" style={{ color: 'var(--orange-3)' }} />
                        <h3 className="truncate text-base font-semibold">{review.report?.title}</h3>
                      </div>
                      <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                        {review.report?.student?.name || 'Student'}
                        {review.report?.student?.matricule ? ` • ${review.report.student.matricule}` : ''}
                        {review.report?.student?.class ? ` • ${review.report.student.class}` : ''}
                      </p>
                    </div>

                    <span
                      className="rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]"
                      style={{
                        backgroundColor: 'rgba(245, 158, 11, 0.12)',
                        color: '#fbbf24',
                      }}
                    >
                      {supervisorLabel(review.supervisorType)}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-4 text-xs" style={{ color: 'var(--text-muted)' }}>
                    <span>Version {review.version?.versionNumber ?? '—'}</span>
                    {review.version?.fileName && <span>{review.version.fileName}</span>}
                    {review.requestedAt && <span>Requested {new Date(review.requestedAt).toLocaleDateString()}</span>}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setApproveError(null)
                        setApproving(review)
                      }}
                      disabled={busyId !== null}
                      className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-50"
                      style={{ background: 'linear-gradient(to right, #10b981, #059669)' }}
                    >
                      {busyId === review.id ? (
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                      ) : (
                        <ThumbsUp className="h-4 w-4" />
                      )}
                      Approve
                    </button>

                    <button
                      type="button"
                      onClick={() => setRejecting(review)}
                      disabled={busyId !== null}
                      className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50"
                      style={{ borderColor: 'rgba(239, 68, 68, 0.35)', color: '#fca5a5' }}
                    >
                      <ThumbsDown className="h-4 w-4" />
                      Request corrections
                    </button>

                    {review.version?.fileUrl && (
                      <a
                        href={`${API_ORIGIN}${review.version.fileUrl}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition"
                        style={{ borderColor: 'var(--line)', color: 'var(--text-soft)' }}
                      >
                        <ExternalLink className="h-4 w-4" />
                        Open PDF
                      </a>
                    )}

                    {/* Integrity analysis: matched sources and exclusions, so a
                        verdict is informed rather than impressionistic. */}
                    {review.report?.id && (
                      <button
                        type="button"
                        onClick={() => navigate(`/plagiarism/${review.report.id}`)}
                        className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition"
                        style={{ borderColor: 'rgba(255,122,0,0.35)', color: 'var(--orange-3)' }}
                      >
                        <FileSearch className="h-4 w-4" />
                        Integrity analysis
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {rejecting && (
        <RejectDialog review={rejecting} busy={busyId !== null} onCancel={() => setRejecting(null)} onConfirm={handleReject} />
      )}

      {approving && (
        <ApproveDialog
          review={approving}
          busy={busyId !== null}
          error={approveError}
          onCancel={() => {
            setApproving(null)
            setApproveError(null)
          }}
          onConfirm={handleApprove}
        />
      )}
    </div>
  )
}

export default SupervisorReviews
