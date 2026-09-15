import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  Building2,
  CalendarDays,
  ChevronDown,
  ExternalLink,
  FileText,
  GraduationCap,
  LoaderCircle,
  Lock,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react'
import ThemeToggle from '../components/ThemeToggle'
import { useAuth } from '../context/AuthContext'
import { getStoredToken, clearStoredAuth } from '../utils/storage'
import { API_ORIGIN } from '../services/apiBase'
import {
  searchLibrary,
  getLibraryFacets,
  getLibraryEntry,
  openLibraryReport,
  setLibraryVisibility,
  setLibraryDetails,
} from '../services/libraryService'
import '../assets/css/dashboard.css'
import '../assets/css/dashboard-components.css'

// The virtual library (§4.12 phase 3).
//
// What a caller can see is decided by the server, and this page deliberately
// reflects that rather than working around it. A student browsing at the default
// `institution` tier gets metadata and an abstract - enough to know a topic has
// been covered - but the full document is withheld, because handing students the
// text of earlier cohorts' reports is what the library is meant to prevent. When
// the document is withheld the server sends no file location at all, so there is
// nothing here to accidentally link to.

const VISIBILITY_META = {
  private: { label: 'Private', hint: 'Only you, your supervisors and administrators.' },
  institution: { label: 'Institution', hint: 'Anyone at the institution can find the title, abstract and year.' },
  public: { label: 'Public', hint: 'Other students may read the full document.' },
}

const roleHome = (role) => {
  switch (role) {
    case 'student':
      return '/student/dashboard'
    case 'academic_supervisor':
      return '/supervisor'
    case 'professional_supervisor':
      return '/professional-supervisor'
    case 'admin':
      return '/admin'
    default:
      return '/'
  }
}

const formatDate = (value) => {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString()
}

const Select = ({ value, onChange, children, label }) => (
  <div className="relative">
    <select
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="w-full appearance-none rounded-xl border py-2.5 pl-3 pr-9 text-sm focus:outline-none"
      style={{ backgroundColor: 'var(--bg-panel)', borderColor: 'var(--line)', color: 'var(--text)' }}
    >
      {children}
    </select>
    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
  </div>
)

const EntryCard = ({ entry, onOpen }) => (
  <button
    type="button"
    onClick={() => onOpen(entry)}
    className="w-full rounded-2xl border p-5 text-left transition hover:-translate-y-0.5"
    style={{ backgroundColor: 'var(--bg-panel)', borderColor: 'var(--line)', color: 'var(--text)' }}
  >
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 className="truncate text-base font-semibold tracking-[-0.02em]">{entry.title}</h3>
        <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
          {entry.student?.name || 'Unknown author'}
          {entry.program ? ` • ${entry.program}` : ''}
        </p>
      </div>

      {entry.academicYear && (
        <span
          className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]"
          style={{ backgroundColor: 'rgba(255,122,0,0.12)', color: 'var(--orange-3)' }}
        >
          {entry.academicYear}
        </span>
      )}
    </div>

    {entry.abstract ? (
      <p className="mt-3 line-clamp-3 text-sm" style={{ color: 'var(--text-soft)' }}>
        {entry.abstract}
      </p>
    ) : (
      <p className="mt-3 text-sm italic" style={{ color: 'var(--text-muted)' }}>
        No abstract was provided for this report.
      </p>
    )}

    <div className="mt-4 flex flex-wrap items-center gap-3 text-[11px]" style={{ color: 'var(--text-muted)' }}>
      {entry.companyName && (
        <span className="inline-flex items-center gap-1.5">
          <Building2 className="h-3.5 w-3.5" /> {entry.companyName}
        </span>
      )}
      {entry.internshipDomain && <span>{entry.internshipDomain}</span>}
      <span className="inline-flex items-center gap-1.5">
        <CalendarDays className="h-3.5 w-3.5" /> {formatDate(entry.submissionDate)}
      </span>
      {entry.ownedByMe && (
        <span className="rounded-full px-2 py-0.5" style={{ backgroundColor: 'rgba(16,185,129,0.12)', color: '#6ee7b7' }}>
          Your report
        </span>
      )}
      <span className="inline-flex items-center gap-1.5">
        {entry.canViewFullText ? <BookOpen className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
        {entry.canViewFullText ? 'Full text available' : 'Metadata only'}
      </span>
    </div>

    {(entry.keywords || []).length > 0 && (
      <div className="mt-3 flex flex-wrap gap-1.5">
        {entry.keywords.slice(0, 6).map((keyword) => (
          <span
            key={keyword}
            className="rounded-full border px-2 py-0.5 text-[10px]"
            style={{ borderColor: 'var(--line)', color: 'var(--text-muted)' }}
          >
            {keyword}
          </span>
        ))}
      </div>
    )}
  </button>
)

const DetailPanel = ({ entryId, onClose, canAdminister, onChanged }) => {
  const [entry, setEntry] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')

  // Abstract and keywords are the metadata that makes this entry findable. They
  // cannot be derived from the file, so the author supplies them here.
  const [draft, setDraft] = useState({ abstract: '', keywords: '' })

  useEffect(() => {
    let active = true
    setLoading(true)
    getLibraryEntry(entryId)
      .then((data) => {
        if (!active) return
        setEntry(data.entry)
        setDraft({
          abstract: data.entry?.abstract || '',
          keywords: (data.entry?.keywords || []).join(', '),
        })
      })
      .catch((err) => {
        if (active) setError(err.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [entryId])

  const saveDetails = async () => {
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const data = await setLibraryDetails(entryId, {
        abstract: draft.abstract,
        keywords: draft.keywords,
      })
      setEntry((prev) => ({ ...prev, abstract: data.entry.abstract, keywords: data.entry.keywords }))
      setNotice(data.message)
      onChanged?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const changeVisibility = async (visibility) => {
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const data = await setLibraryVisibility(entryId, visibility)
      setEntry((prev) => ({ ...prev, visibility: data.entry.visibility }))
      setNotice(data.message)
      onChanged?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const openDocument = async () => {
    setError('')
    try {
      const file = await openLibraryReport(entryId)
      window.open(`${API_ORIGIN}${file.fileUrl}`, '_blank', 'noopener')
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm">
      <div
        className="h-full w-full max-w-xl overflow-y-auto border-l p-6"
        style={{ backgroundColor: 'var(--bg-panel)', borderColor: 'var(--line)', color: 'var(--text)' }}
      >
        <div className="mb-5 flex items-start justify-between gap-3">
          <h2 className="text-xl font-semibold tracking-[-0.03em]">Archived report</h2>
          <button type="button" onClick={onClose} className="rounded-full border p-2" style={{ borderColor: 'var(--line)', color: 'var(--text-muted)' }}>
            <X className="h-4 w-4" />
          </button>
        </div>

        {loading && (
          <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
            <LoaderCircle className="h-4 w-4 animate-spin" /> Loading…
          </div>
        )}

        {error && (
          <div
            className="mb-4 flex items-center gap-2 rounded-xl border p-3 text-xs"
            style={{ borderColor: 'rgba(239,68,68,0.3)', backgroundColor: 'rgba(239,68,68,0.1)', color: '#fca5a5' }}
          >
            <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {error}
          </div>
        )}

        {notice && (
          <div
            className="mb-4 rounded-xl border p-3 text-xs"
            style={{ borderColor: 'rgba(16,185,129,0.3)', backgroundColor: 'rgba(16,185,129,0.08)', color: '#86efac' }}
          >
            {notice}
          </div>
        )}

        {entry && (
          <div className="space-y-5">
            <div>
              <h3 className="text-lg font-semibold">{entry.title}</h3>
              <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                {entry.student?.name || 'Unknown author'}
                {entry.student?.matricule ? ` • ${entry.student.matricule}` : ''}
                {entry.student?.class ? ` • ${entry.student.class}` : ''}
              </p>
            </div>

            <dl className="grid grid-cols-2 gap-3">
              {[
                ['Academic year', entry.academicYear || '—'],
                ['Programme', entry.program || '—'],
                ['Company', entry.companyName || '—'],
                ['Domain', entry.internshipDomain || '—'],
                ['Academic supervisor', entry.supervisors?.academic || '—'],
                ['Professional supervisor', entry.supervisors?.professional || '—'],
                ['Submitted', formatDate(entry.submissionDate)],
                ['Visibility', VISIBILITY_META[entry.visibility]?.label || entry.visibility],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border p-3" style={{ borderColor: 'var(--line)' }}>
                  <dt className="text-[10px] uppercase tracking-[0.16em]" style={{ color: 'var(--text-muted)' }}>{label}</dt>
                  <dd className="mt-1 text-sm" style={{ color: 'var(--text-soft)' }}>{value}</dd>
                </div>
              ))}
            </dl>

            {typeof entry.finalPlagiarismScore === 'number' && (
              <div className="rounded-xl border p-3" style={{ borderColor: 'rgba(255,122,0,0.3)' }}>
                <div className="text-[10px] uppercase tracking-[0.16em]" style={{ color: 'var(--text-muted)' }}>
                  Similarity score
                </div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-lg font-semibold" style={{ color: 'var(--orange-3)' }}>
                    {entry.finalPlagiarismScore}%
                  </span>
                  {entry.similarityBand?.label && (
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em]"
                      style={{ backgroundColor: 'rgba(255,122,0,0.12)', color: 'var(--orange-3)' }}>
                      {entry.similarityBand.label}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  {entry.similarityBand?.advice ||
                    'A similarity score is not proof of misconduct - quotations, references and standard definitions all produce matches.'}
                </p>
                {entry.similarityBand?.thresholds && (
                  <p className="mt-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    Bands: low ≤ {entry.similarityBand.thresholds.low}%, moderate ≤ {entry.similarityBand.thresholds.moderate}%,
                    high ≤ {entry.similarityBand.thresholds.high}%
                  </p>
                )}
              </div>
            )}

            <div>
              <div className="mb-2 text-[11px] uppercase tracking-[0.16em]" style={{ color: 'var(--text-muted)' }}>Abstract</div>
              <p className="text-sm" style={{ color: 'var(--text-soft)' }}>
                {entry.abstract || 'No abstract was provided for this report.'}
              </p>
            </div>

            {(entry.keywords || []).length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {entry.keywords.map((keyword) => (
                  <span key={keyword} className="rounded-full border px-2 py-0.5 text-[10px]" style={{ borderColor: 'var(--line)', color: 'var(--text-muted)' }}>
                    {keyword}
                  </span>
                ))}
              </div>
            )}

            {entry.canViewFullText ? (
              <button
                type="button"
                onClick={openDocument}
                className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-white"
                style={{ background: 'linear-gradient(to right, #ff7a00, #ff8a1c, #ff9d3d)' }}
              >
                <FileText className="h-4 w-4" /> Open document
              </button>
            ) : (
              <div
                className="flex items-start gap-2 rounded-xl border p-3 text-xs"
                style={{ borderColor: 'var(--line)', backgroundColor: 'rgba(255,255,255,0.02)', color: 'var(--text-muted)' }}
              >
                <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  This report is archived for institutional records. Its metadata and abstract are available so you
                  can see the topic has been covered, but the full document can only be read by its author, its
                  supervisors, and administrators.
                </span>
              </div>
            )}

            {(entry.ownedByMe || canAdminister) && (
              <div className="rounded-xl border p-4" style={{ borderColor: 'var(--line)' }}>
                <div className="mb-2 text-[11px] uppercase tracking-[0.16em]" style={{ color: 'var(--text-muted)' }}>
                  Abstract and keywords
                </div>
                <p className="mb-3 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  These are what make your report findable in the library. Other students can read them, which is how
                  they discover a topic has already been covered.
                </p>

                <textarea
                  value={draft.abstract}
                  onChange={(event) => setDraft((prev) => ({ ...prev, abstract: event.target.value }))}
                  rows={4}
                  placeholder="A short summary of the report."
                  className="w-full rounded-xl border p-3 text-sm outline-none"
                  style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--line)', color: 'var(--text)' }}
                />

                <input
                  value={draft.keywords}
                  onChange={(event) => setDraft((prev) => ({ ...prev, keywords: event.target.value }))}
                  placeholder="Comma-separated keywords, e.g. telemetry, Kafka, backpressure"
                  className="mt-3 w-full rounded-xl border p-3 text-sm outline-none"
                  style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--line)', color: 'var(--text)' }}
                />

                <div className="mt-3 flex items-center justify-between gap-3">
                  <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    Up to 15 keywords.
                  </span>
                  <button
                    type="button"
                    onClick={saveDetails}
                    disabled={saving}
                    className="rounded-full px-4 py-2 text-xs font-medium text-white disabled:opacity-50"
                    style={{ background: 'linear-gradient(to right, #ff7a00, #ff8a1c, #ff9d3d)' }}
                  >
                    {saving ? 'Saving…' : 'Save details'}
                  </button>
                </div>
              </div>
            )}

            {entry.ownedByMe && (
              <div className="rounded-xl border p-4" style={{ borderColor: 'var(--line)' }}>
                <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.16em]" style={{ color: 'var(--text-muted)' }}>
                  <ShieldCheck className="h-3.5 w-3.5" style={{ color: 'var(--orange-3)' }} /> Visibility
                </div>
                <div className="flex flex-wrap gap-2">
                  {['private', 'institution'].map((option) => (
                    <button
                      key={option}
                      type="button"
                      disabled={saving || entry.visibility === option}
                      onClick={() => changeVisibility(option)}
                      className="rounded-full border px-3 py-1.5 text-xs font-medium transition disabled:opacity-40"
                      style={{
                        borderColor: entry.visibility === option ? 'rgba(255,122,0,0.6)' : 'var(--line)',
                        color: entry.visibility === option ? 'var(--orange-3)' : 'var(--text-soft)',
                      }}
                    >
                      {VISIBILITY_META[option].label}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  {VISIBILITY_META[entry.visibility]?.hint} Publishing publicly is an administrator decision.
                </p>
              </div>
            )}

            {canAdminister && (
              <div className="rounded-xl border p-4" style={{ borderColor: 'rgba(255,122,0,0.25)' }}>
                <div className="mb-2 text-[11px] uppercase tracking-[0.16em]" style={{ color: 'var(--text-muted)' }}>
                  Administrator: visibility
                </div>
                <div className="flex flex-wrap gap-2">
                  {['private', 'institution', 'public'].map((option) => (
                    <button
                      key={option}
                      type="button"
                      disabled={saving || entry.visibility === option}
                      onClick={() => changeVisibility(option)}
                      className="rounded-full border px-3 py-1.5 text-xs font-medium transition disabled:opacity-40"
                      style={{
                        borderColor: entry.visibility === option ? 'rgba(255,122,0,0.6)' : 'var(--line)',
                        color: entry.visibility === option ? 'var(--orange-3)' : 'var(--text-soft)',
                      }}
                    >
                      {VISIBILITY_META[option].label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

const ReportLibrary = () => {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [entries, setEntries] = useState([])
  const [facets, setFacets] = useState({ academicYears: [], programs: [], companies: [], domains: [] })
  const [filters, setFilters] = useState({ q: '', academicYear: '', program: '', company: '', domain: '' })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(null)

  const roles = Array.isArray(user?.roles) && user.roles.length ? user.roles : [user?.role]
  const canAdminister = roles.includes('admin')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await searchLibrary(filters)
      setEntries(data.entries || [])
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
  }, [filters, navigate])

  useEffect(() => {
    if (!getStoredToken()) {
      navigate('/login')
      return
    }
    getLibraryFacets().then(setFacets).catch(() => {})
  }, [navigate])

  useEffect(() => {
    // Debounced so typing in the search box does not fire a request per keystroke.
    const timer = setTimeout(load, 300)
    return () => clearTimeout(timer)
  }, [load])

  const activeFilters = useMemo(
    () => Object.values(filters).filter((value) => String(value).trim() !== '').length,
    [filters]
  )

  return (
    <div className="dashboard-wrapper">
      <div className="dashboard-main">
        <header className="dashboard-header">
          <div className="header-left">
            <button
              type="button"
              onClick={() => navigate(roleHome(user?.role))}
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
              <h1 className="greeting-title">Report Library</h1>
              <p className="greeting-subtitle">
                Archived internship reports submitted through the validation workflow. Use the academic year to see
                what a cohort covered.
              </p>
            </div>
          </section>

          <div className="mb-6 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <div className="relative md:col-span-2 xl:col-span-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
              <input
                value={filters.q}
                onChange={(event) => setFilters((prev) => ({ ...prev, q: event.target.value }))}
                placeholder="Search title, abstract, keyword…"
                className="w-full rounded-xl border py-2.5 pl-9 pr-3 text-sm focus:outline-none"
                style={{ backgroundColor: 'var(--bg-panel)', borderColor: 'var(--line)', color: 'var(--text)' }}
              />
            </div>

            <Select label="Academic year" value={filters.academicYear} onChange={(value) => setFilters((prev) => ({ ...prev, academicYear: value }))}>
              <option value="">All academic years</option>
              {(facets.academicYears || []).map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </Select>

            <Select label="Programme" value={filters.program} onChange={(value) => setFilters((prev) => ({ ...prev, program: value }))}>
              <option value="">All programmes</option>
              {(facets.programs || []).map((program) => (
                <option key={program} value={program}>{program}</option>
              ))}
            </Select>

            <Select label="Company" value={filters.company} onChange={(value) => setFilters((prev) => ({ ...prev, company: value }))}>
              <option value="">All companies</option>
              {(facets.companies || []).map((company) => (
                <option key={company} value={company}>{company}</option>
              ))}
            </Select>

            <Select label="Domain" value={filters.domain} onChange={(value) => setFilters((prev) => ({ ...prev, domain: value }))}>
              <option value="">All domains</option>
              {(facets.domains || []).map((domain) => (
                <option key={domain} value={domain}>{domain}</option>
              ))}
            </Select>
          </div>

          <div className="mb-5 flex items-center justify-between gap-3">
            <div className="text-xs uppercase tracking-[0.18em]" style={{ color: 'var(--text-muted)' }}>
              {entries.length} archived report{entries.length === 1 ? '' : 's'}
              {activeFilters > 0 ? ' matching your filters' : ''}
            </div>
            <div className="flex items-center gap-2">
              {activeFilters > 0 && (
                <button
                  type="button"
                  onClick={() => setFilters({ q: '', academicYear: '', program: '', company: '', domain: '' })}
                  className="rounded-full border px-3 py-2 text-xs font-medium"
                  style={{ borderColor: 'var(--line)', color: 'var(--text-soft)' }}
                >
                  Clear filters
                </button>
              )}
              <button
                type="button"
                onClick={load}
                className="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium"
                style={{ borderColor: 'var(--line)', color: 'var(--text-soft)' }}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
              </button>
            </div>
          </div>

          {error && (
            <div
              className="mb-5 flex items-center gap-2 rounded-2xl border p-4 text-sm"
              style={{ borderColor: 'rgba(239,68,68,0.3)', backgroundColor: 'rgba(239,68,68,0.1)', color: '#fca5a5' }}
            >
              <AlertCircle className="h-4 w-4 shrink-0" /> {error}
            </div>
          )}

          {loading && entries.length === 0 ? (
            <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
              <LoaderCircle className="h-4 w-4 animate-spin" /> Loading the library…
            </div>
          ) : entries.length === 0 ? (
            <div
              className="flex flex-col items-center rounded-[24px] border border-dashed p-10 text-center"
              style={{ borderColor: 'var(--line)', color: 'var(--text-muted)' }}
            >
              <GraduationCap className="mb-3 h-10 w-10" style={{ color: 'var(--orange-3)' }} />
              <p className="text-base font-medium" style={{ color: 'var(--text)' }}>No archived reports yet</p>
              <p className="mt-2 max-w-md text-sm">
                Reports appear here once they have been approved by both supervisors and submitted as final.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {entries.map((entry) => (
                <EntryCard key={entry.id} entry={entry} onOpen={(item) => setSelected(item.id)} />
              ))}
            </div>
          )}

          <div
            className="mt-8 flex items-start gap-2 rounded-2xl border p-4 text-xs"
            style={{ borderColor: 'var(--line)', color: 'var(--text-muted)' }}
          >
            <Users className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Archived reports are stored with the academic year they were submitted in, so a similarity match can be
              attributed to a cohort rather than to the institution as a whole.
            </span>
          </div>
        </main>
      </div>

      {selected && (
        <DetailPanel
          entryId={selected}
          canAdminister={canAdminister}
          onClose={() => setSelected(null)}
          onChanged={() => load()}
        />
      )}
    </div>
  )
}

export default ReportLibrary
