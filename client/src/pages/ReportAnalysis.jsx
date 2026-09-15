import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileSearch,
  Info,
  LoaderCircle,
  RefreshCw,
  Scissors,
  ShieldAlert,
  XCircle,
} from 'lucide-react'
import ThemeToggle from '../components/ThemeToggle'
import { useAuth } from '../context/AuthContext'
import { getStoredToken, clearStoredAuth } from '../utils/storage'
import { getReportAnalysis } from '../services/plagiarismService'
import '../assets/css/dashboard.css'
import '../assets/css/dashboard-components.css'

// Report integrity view (§4.12 phases 4-6).
//
// Shows a supervisor what a similarity score is actually made of: which sources
// matched, how much of each, where they came from, and what the exclusion rules
// discarded before the comparison. A bare percentage is not actionable, and this
// module's whole premise is that similarity is not proof of misconduct - so the
// matched passages are the deliverable, not the number.
//
// Highlighting is applied to the stored match excerpt, which is the passage the
// engine identified. Character-offset highlighting inside the full document is
// not implemented: the engine stores a representative excerpt per match rather
// than offsets into the report text, and claiming otherwise would be a lie.

const bandColour = (key) => {
  switch (key) {
    case 'low':
      return { bg: 'rgba(16,185,129,0.12)', fg: '#6ee7b7', border: 'rgba(16,185,129,0.35)' }
    case 'moderate':
      return { bg: 'rgba(245,158,11,0.12)', fg: '#fbbf24', border: 'rgba(245,158,11,0.35)' }
    case 'high':
      return { bg: 'rgba(249,115,22,0.14)', fg: '#fdba74', border: 'rgba(249,115,22,0.4)' }
    case 'very_high':
      return { bg: 'rgba(239,68,68,0.14)', fg: '#fca5a5', border: 'rgba(239,68,68,0.4)' }
    default:
      return { bg: 'rgba(255,255,255,0.05)', fg: 'var(--text-muted)', border: 'var(--line)' }
  }
}

const STATUS_META = {
  completed: { label: 'Completed', colour: '#10b981', Icon: CheckCircle2 },
  failed: { label: 'Failed', colour: '#ef4444', Icon: XCircle },
  processing: { label: 'Processing', colour: '#f59e0b', Icon: Clock },
  submitted: { label: 'Submitted to provider', colour: '#f59e0b', Icon: Clock },
  queued: { label: 'Queued', colour: 'var(--text-muted)', Icon: Clock },
}

const formatWhen = (value) => {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString()
}

const MatchCard = ({ match }) => {
  const isInternal = match.sourceType === 'internal'

  return (
    <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--line)', backgroundColor: 'var(--bg-panel)' }}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 shrink-0" style={{ color: 'var(--orange-3)' }} />
            <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
              {match.sourceTitle || match.sourceUrl || 'Unnamed source'}
            </span>
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px]" style={{ color: 'var(--text-muted)' }}>
            <span className="rounded-full px-2 py-0.5" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
              {isInternal ? 'Previous student report' : 'Web source'}
            </span>
            {match.sourceAcademicYear && (
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5" /> {match.sourceAcademicYear}
              </span>
            )}
            {match.matchedWords ? <span>{match.matchedWords} matched words</span> : null}
          </div>
        </div>

        <div className="text-right">
          <div className="text-lg font-semibold" style={{ color: 'var(--orange-3)' }}>
            {match.similarityPercentage != null ? `${match.similarityPercentage}%` : '—'}
          </div>
          {match.sourceUrl && (
            <a
              href={match.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-[11px]"
              style={{ color: 'var(--text-muted)' }}
            >
              Open source <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>

      {match.matchedText && (
        <div className="mt-3">
          <div className="mb-1.5 text-[10px] uppercase tracking-[0.16em]" style={{ color: 'var(--text-muted)' }}>
            Matched passage
          </div>
          {/* The excerpt the engine identified, marked as the matched material.
              Read it against the source before drawing any conclusion. */}
          <p
            className="rounded-xl p-3 text-sm leading-relaxed"
            style={{
              backgroundColor: 'rgba(249,115,22,0.1)',
              borderLeft: '3px solid rgba(249,115,22,0.6)',
              color: 'var(--text-soft)',
            }}
          >
            {match.matchedText}
          </p>
        </div>
      )}
    </div>
  )
}

const ReportAnalysis = () => {
  const { reportId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const roles = Array.isArray(user?.roles) && user.roles.length ? user.roles : [user?.role]
  const dashboardHome = roles.includes('admin')
    ? '/admin'
    : roles.includes('professional_supervisor') && !roles.includes('academic_supervisor')
      ? '/professional-supervisor'
      : roles.includes('academic_supervisor')
        ? '/supervisor'
        : '/student/dashboard'

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setData(await getReportAnalysis(reportId))
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
  }, [reportId, navigate])

  useEffect(() => {
    if (!getStoredToken()) {
      navigate('/login')
      return
    }
    load()
  }, [load, navigate])

  const latest = data?.latest
  const band = latest?.similarityBand
  const colours = bandColour(band?.key)
  const history = data?.history || []

  return (
    <div className="dashboard-wrapper">
      <div className="dashboard-main">
        <header className="dashboard-header">
          <div className="header-left">
            <button
              type="button"
              onClick={() => navigate(dashboardHome)}
              className="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium transition"
              style={{ borderColor: 'var(--line)', color: 'var(--text-soft)' }}
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to dashboard
            </button>
          </div>
          <div className="header-right">
            <ThemeToggle />
          </div>
        </header>

        <main className="dashboard-content">
          <section className="dashboard-header-section">
            <div className="greeting-area">
              <h1 className="greeting-title">Report Integrity</h1>
              <p className="greeting-subtitle">
                Similarity analysis for this report: what matched, where it came from, and what was excluded before
                comparison.
              </p>
            </div>
          </section>

          <div className="mb-6 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={load}
              className="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium"
              style={{ borderColor: 'var(--line)', color: 'var(--text-soft)' }}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>

          {error && (
            <div
              className="mb-5 flex items-center gap-2 rounded-2xl border p-4 text-sm"
              style={{ borderColor: 'rgba(239,68,68,0.3)', backgroundColor: 'rgba(239,68,68,0.1)', color: '#fca5a5' }}
            >
              <AlertCircle className="h-4 w-4 shrink-0" /> {error}
            </div>
          )}

          {loading && !data ? (
            <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
              <LoaderCircle className="h-4 w-4 animate-spin" /> Loading the analysis…
            </div>
          ) : !latest ? (
            <div
              className="flex flex-col items-center rounded-[24px] border border-dashed p-10 text-center"
              style={{ borderColor: 'var(--line)', color: 'var(--text-muted)' }}
            >
              <FileSearch className="mb-3 h-10 w-10" style={{ color: 'var(--orange-3)' }} />
              <p className="text-base font-medium" style={{ color: 'var(--text)' }}>No completed analysis yet</p>
              <p className="mt-2 max-w-md text-sm">
                {history.length
                  ? 'Previous attempts are listed below. None has completed successfully.'
                  : 'No similarity analysis has been run for this report.'}
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Score + band */}
              <div className="rounded-[24px] border p-5" style={{ backgroundColor: 'var(--bg-panel)', borderColor: colours.border }}>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.18em]" style={{ color: 'var(--text-muted)' }}>
                      Similarity score
                    </div>
                    <div className="mt-1 flex items-baseline gap-3">
                      <span className="text-4xl font-semibold tracking-[-0.04em]" style={{ color: colours.fg }}>
                        {latest.overallScore != null ? `${latest.overallScore}%` : '—'}
                      </span>
                      {band?.label && (
                        <span
                          className="rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.1em]"
                          style={{ backgroundColor: colours.bg, color: colours.fg }}
                        >
                          {band.label}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-right text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    <div>Provider: {latest.provider}</div>
                    <div>Completed: {formatWhen(latest.completedAt)}</div>
                    {latest.totalWords ? <div>{latest.totalWords} words compared</div> : null}
                    {latest.matchedWords ? <div>{latest.matchedWords} matched words</div> : null}
                  </div>
                </div>

                {band?.advice && (
                  <p className="mt-3 text-sm" style={{ color: 'var(--text-soft)' }}>{band.advice}</p>
                )}

                <div
                  className="mt-4 flex items-start gap-2 rounded-xl border p-3 text-xs"
                  style={{ borderColor: 'var(--line)', backgroundColor: 'rgba(255,255,255,0.02)', color: 'var(--text-muted)' }}
                >
                  <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: 'var(--orange-3)' }} />
                  <span>
                    A similarity score is <strong>not</strong> a finding of misconduct. Bibliographies, standard
                    definitions, templates and properly quoted material all produce matches - read the passages below
                    before drawing any conclusion.
                    {band?.thresholds
                      ? ` Bands: low ≤ ${band.thresholds.low}%, moderate ≤ ${band.thresholds.moderate}%, high ≤ ${band.thresholds.high}%.`
                      : ''}
                  </span>
                </div>
              </div>

              {/* What the exclusion rules removed */}
              <div className="rounded-[24px] border p-5" style={{ backgroundColor: 'var(--bg-panel)', borderColor: 'var(--line)' }}>
                <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.16em]" style={{ color: 'var(--text-muted)' }}>
                  <Scissors className="h-3.5 w-3.5" style={{ color: 'var(--orange-3)' }} /> Exclusions applied
                </div>
                {(latest.excludedSections || []).length > 0 ? (
                  <>
                    <p className="text-sm" style={{ color: 'var(--text-soft)' }}>
                      The following sections were discarded before comparison, because material that is identical by
                      design would otherwise inflate the score:
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {latest.excludedSections.map((section) => (
                        <span
                          key={section}
                          className="rounded-full border px-2.5 py-1 text-[11px]"
                          style={{ borderColor: 'var(--line)', color: 'var(--text-muted)' }}
                        >
                          {section}
                        </span>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    No excluded sections were found in this report.
                  </p>
                )}
              </div>

              {/* Matches */}
              <div>
                <h2 className="mb-3 text-lg font-semibold tracking-[-0.02em]" style={{ color: 'var(--text)' }}>
                  Matched sources ({(latest.matches || []).length})
                </h2>

                {(latest.matches || []).length === 0 ? (
                  <div
                    className="rounded-2xl border border-dashed p-6 text-center text-sm"
                    style={{ borderColor: 'var(--line)', color: 'var(--text-muted)' }}
                  >
                    Nothing above the reporting floor was found. That is not a clean bill of health - the corpus only
                    contains reports that reached final submission.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {latest.matches.map((match) => <MatchCard key={match.id} match={match} />)}
                  </div>
                )}
              </div>

              {/* Analysis history */}
              <div className="rounded-[24px] border p-5" style={{ backgroundColor: 'var(--bg-panel)', borderColor: 'var(--line)' }}>
                <div className="mb-3 flex items-center gap-2 text-[11px] uppercase tracking-[0.16em]" style={{ color: 'var(--text-muted)' }}>
                  <Info className="h-3.5 w-3.5" style={{ color: 'var(--orange-3)' }} /> Analysis history
                </div>

                <p className="mb-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                  Every analysis of this report, including failed and superseded attempts, so the score is auditable.
                </p>

                <div className="space-y-2">
                  {history.map((item) => {
                    const meta = STATUS_META[item.status] || STATUS_META.queued
                    const { Icon } = meta
                    const itemBand = bandColour(item.similarityBand?.key)

                    return (
                      <div
                        key={item.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"
                        style={{ borderColor: 'var(--line)', backgroundColor: 'rgba(255,255,255,0.02)' }}
                      >
                        <div className="flex items-center gap-2 text-xs">
                          <Icon className="h-3.5 w-3.5" style={{ color: meta.colour }} />
                          <span style={{ color: meta.colour }}>{meta.label}</span>
                          <span style={{ color: 'var(--text-muted)' }}>{item.provider}</span>
                          {item.similarityBand?.label && (
                            <span className="rounded-full px-2 py-0.5 text-[10px]" style={{ backgroundColor: itemBand.bg, color: itemBand.fg }}>
                              {item.similarityBand.label}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-4 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                          <span>{item.overallScore != null ? `${item.overallScore}%` : '—'}</span>
                          <span>{formatWhen(item.completedAt || item.requestedAt)}</span>
                        </div>

                        {item.errorMessage && (
                          <div className="w-full text-[11px]" style={{ color: '#fca5a5' }}>
                            {item.errorMessage}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

export default ReportAnalysis
