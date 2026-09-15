import { useCallback, useEffect, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  FileCheck2,
  LoaderCircle,
  Lock,
  Send,
  ShieldCheck,
  XCircle,
} from 'lucide-react'
import {
  getSubmissionStatus,
  requestReportSubmission,
  submitFinalReport,
} from '../../services/reportWorkflowService'

// Student-facing half of the two-stage submission workflow (§4.12).
//
// Deliberately shows approval *states* only. The API does not return the
// supervisors' confidential marks to a student, and this component must not
// invent a place to display them if it ever did.

const REVIEW_META = {
  pending: {
    label: 'Awaiting review',
    Icon: Clock,
    colour: '#f59e0b',
    tint: 'rgba(245, 158, 11, 0.12)',
  },
  approved: {
    label: 'Approved',
    Icon: CheckCircle2,
    colour: '#10b981',
    tint: 'rgba(16, 185, 129, 0.12)',
  },
  rejected: {
    label: 'Correction requested',
    Icon: XCircle,
    colour: '#ef4444',
    tint: 'rgba(239, 68, 68, 0.12)',
  },
  cancelled: {
    label: 'Cancelled',
    Icon: XCircle,
    colour: 'var(--text-muted)',
    tint: 'rgba(255, 255, 255, 0.04)',
  },
}

const supervisorLabel = (type) =>
  type === 'academic' ? 'Academic Supervisor' : 'Professional Supervisor'

const Card = ({ children, tone }) => (
  <div
    className="rounded-2xl border p-4"
    style={{
      backgroundColor: 'var(--bg-panel)',
      borderColor: tone || 'var(--line)',
    }}
  >
    {children}
  </div>
)

const ReviewRow = ({ review }) => {
  const meta = REVIEW_META[review.status] || REVIEW_META.pending
  const { Icon } = meta

  return (
    <div
      className="rounded-xl border p-3"
      style={{ borderColor: 'var(--line)', backgroundColor: 'rgba(255,255,255,0.02)' }}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm" style={{ color: 'var(--text-soft)' }}>
          {supervisorLabel(review.supervisorType)}
        </span>
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]"
          style={{ backgroundColor: meta.tint, color: meta.colour }}
        >
          <Icon className="h-3 w-3" />
          {meta.label}
        </span>
      </div>

      {review.status === 'rejected' && review.rejectionReason && (
        <p className="mt-2 text-xs" style={{ color: 'var(--text-soft)' }}>
          <span style={{ color: '#ef4444' }}>Reason: </span>
          {review.rejectionReason}
        </p>
      )}

      {review.reviewedAt && (
        <p className="mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
          {new Date(review.reviewedAt).toLocaleString()}
        </p>
      )}
    </div>
  )
}

const SubmissionStatusPanel = ({ reportId }) => {
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)

  const load = useCallback(async () => {
    if (!reportId) return
    try {
      setStatus(await getSubmissionStatus(reportId))
      setError('')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [reportId])

  useEffect(() => {
    setLoading(true)
    setStatus(null)
    setNotice('')
    setError('')
    load()
  }, [load])

  const handleRequest = async () => {
    setBusy('request')
    setError('')
    setNotice('')
    try {
      const data = await requestReportSubmission(reportId)
      setNotice(data.message)
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(null)
    }
  }

  const handleFinalSubmit = async () => {
    setConfirmOpen(false)
    setBusy('final')
    setError('')
    setNotice('')
    try {
      const data = await submitFinalReport(reportId)
      setNotice(data.message)
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(null)
    }
  }

  if (!reportId) return null

  if (loading) {
    return (
      <Card>
        <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
          <LoaderCircle className="h-4 w-4 animate-spin" />
          Loading submission status…
        </div>
      </Card>
    )
  }

  if (!status) {
    return (
      <Card tone="rgba(239, 68, 68, 0.3)">
        <div className="flex items-center gap-2 text-sm" style={{ color: '#fca5a5' }}>
          <AlertCircle className="h-4 w-4" />
          {error || 'Unable to load the submission status.'}
        </div>
      </Card>
    )
  }

  const locked = status.locked
  const bothApproved = status.readyForFinalSubmission
  const canRequest = status.canRequestSubmission
  const reviews = status.reviews || []

  return (
    <div className="space-y-4">
      <Card>
        <div className="mb-3 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em]" style={{ color: 'var(--text-muted)' }}>
          <ShieldCheck className="h-3.5 w-3.5" style={{ color: 'var(--orange-3)' }} />
          Submission Validation
        </div>

        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Both supervisors must validate your report before you can submit the final version.
        </p>

        <div className="mt-4 space-y-3">
          {reviews.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              No review has been requested yet.
            </p>
          ) : (
            reviews.map((review) => <ReviewRow key={review.supervisorType} review={review} />)
          )}
        </div>

        {locked && (
          <div
            className="mt-4 flex items-start gap-2 rounded-xl border p-3 text-xs"
            style={{ borderColor: 'rgba(16, 185, 129, 0.3)', backgroundColor: 'rgba(16, 185, 129, 0.08)', color: '#86efac' }}
          >
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              This report was submitted as final
              {status.finalSubmittedAt ? ` on ${new Date(status.finalSubmittedAt).toLocaleDateString()}` : ''} and is
              archived. It can no longer be modified without administrator authorization.
            </span>
          </div>
        )}

        {!locked && bothApproved && (
          <div
            className="mt-4 flex items-start gap-2 rounded-xl border p-3 text-xs"
            style={{ borderColor: 'rgba(16, 185, 129, 0.3)', backgroundColor: 'rgba(16, 185, 129, 0.08)', color: '#86efac' }}
          >
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>Both supervisors have approved. You can submit the final version.</span>
          </div>
        )}

        {!locked && !bothApproved && !canRequest && status.blockingIssues?.length > 0 && (
          <ul className="mt-4 space-y-1 text-xs" style={{ color: 'var(--text-muted)' }}>
            {status.blockingIssues.map((issue) => (
              <li key={issue}>• {issue}</li>
            ))}
          </ul>
        )}

        {error && (
          <div
            className="mt-4 flex items-center gap-2 rounded-xl border p-3 text-xs"
            style={{ borderColor: 'rgba(239, 68, 68, 0.3)', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#fca5a5' }}
          >
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {notice && (
          <div
            className="mt-4 flex items-center gap-2 rounded-xl border p-3 text-xs"
            style={{ borderColor: 'rgba(16, 185, 129, 0.3)', backgroundColor: 'rgba(16, 185, 129, 0.08)', color: '#86efac' }}
          >
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            <span>{notice}</span>
          </div>
        )}

        {!locked && (
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleRequest}
              disabled={!canRequest || busy !== null}
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-50"
              style={{ background: 'linear-gradient(to right, #ff7a00, #ff8a1c, #ff9d3d)' }}
              title={canRequest ? 'Send to both supervisors for validation' : 'See the requirements above'}
            >
              {busy === 'request' ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {busy === 'request' ? 'Requesting…' : 'Request Submission'}
            </button>

            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              disabled={!bothApproved || busy !== null}
              className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40"
              style={{
                borderColor: 'rgba(16, 185, 129, 0.4)',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                color: '#6ee7b7',
              }}
              title={bothApproved ? 'Submit the final, locked version' : 'Available once both supervisors approve'}
            >
              {busy === 'final' ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <FileCheck2 className="h-4 w-4" />
              )}
              {busy === 'final' ? 'Submitting…' : 'Submit Final Report'}
            </button>
          </div>
        )}
      </Card>

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div
            className="w-full max-w-md rounded-[24px] border p-6"
            style={{ backgroundColor: 'var(--bg-panel)', borderColor: 'var(--line)', color: 'var(--text)' }}
          >
            <h3 className="text-lg font-semibold tracking-[-0.03em]">Submit this as your final report?</h3>

            <p className="mt-3 text-sm" style={{ color: 'var(--text-soft)' }}>
              Both supervisors have approved. Once submitted, this version is archived and <strong>cannot be
              modified</strong> without administrator authorization.
            </p>

            <div
              className="mt-4 rounded-xl border p-3 text-xs"
              style={{ borderColor: 'var(--line)', backgroundColor: 'rgba(255,255,255,0.02)', color: 'var(--text-muted)' }}
            >
              A permanent fingerprint of the submitted file is recorded so its integrity can be verified later.
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="rounded-full border px-4 py-2 text-sm"
                style={{ borderColor: 'var(--line)', color: 'var(--text-soft)' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleFinalSubmit}
                className="rounded-full px-4 py-2 text-sm font-medium text-white"
                style={{ background: 'linear-gradient(to right, #10b981, #059669)' }}
              >
                Confirm and submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SubmissionStatusPanel
