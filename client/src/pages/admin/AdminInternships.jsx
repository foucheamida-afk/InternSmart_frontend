import { useEffect, useState } from 'react'
import { Search, Briefcase, CheckCircle2, Clock, FileEdit, AlertCircle } from 'lucide-react'
import { adminApi } from '../../services/adminService'

const EmptyState = ({ icon: Icon, title, description }) => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border" style={{
      backgroundColor: 'rgba(255, 122, 0, 0.08)',
      borderColor: 'rgba(255, 122, 0, 0.25)',
      color: 'var(--orange-3)'
    }}>
      <Icon size={28} />
    </div>
    <h3 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>{title}</h3>
    <p className="mt-2 max-w-sm text-sm" style={{ color: 'var(--text-muted)' }}>{description}</p>
  </div>
)

const getStageColor = (statusKey) => {
  switch (statusKey) {
    case 'completed': return '#10b981' // Green
    case 'revision': return '#f59e0b' // Amber
    case 'in_review': return '#3b82f6' // Blue
    case 'draft': return '#8b5cf6' // Purple
    default: return '#6b7280' // Gray
  }
}

const getProgressGradient = (statusKey, percent) => {
  if (percent === 100) return 'linear-gradient(to right, #059669, #10b981)'
  if (statusKey === 'revision') return 'linear-gradient(to right, #d97706, #f59e0b)'
  if (statusKey === 'in_review') return 'linear-gradient(to right, #2563eb, #3b82f6)'
  if (statusKey === 'draft') return 'linear-gradient(to right, #7c3aed, #8b5cf6)'
  return 'linear-gradient(to right, #4b5563, #6b7280)'
}

export default function AdminInternships() {
  const [internships, setInternships] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  const fetchInternships = async () => {
    setLoading(true)
    try {
      const params = { page, limit: 20 }
      if (search) params.search = search
      const data = await adminApi.getInternships(params)
      setInternships(data.internships || [])
      setTotalPages(data.totalPages || 1)
    } catch {
      setInternships([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchInternships()
  }, [page, search])

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-semibold tracking-[-0.06em]" style={{ color: 'var(--text)' }}>Internships</h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
          Track student submission progress, supervisor assignments, and company placements.
        </p>
      </div>

      <div className="rounded-2xl border" style={{
        backgroundColor: 'var(--bg-panel)',
        borderColor: 'var(--line)'
      }}>
        <div className="p-4 border-b" style={{ borderColor: 'var(--line)' }}>
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2" size={14} style={{ color: 'var(--text-muted)' }} />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              placeholder="Search by student or supervisor..."
              className="w-full rounded-xl border pl-9 pr-3 py-2 text-sm focus:outline-none"
              style={{
                backgroundColor: 'var(--bg)',
                borderColor: 'var(--line)',
                color: 'var(--text)'
              }}
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-500 border-t-transparent" />
          </div>
        ) : internships.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={Briefcase}
              title="No internships found"
              description="Internships will appear here once students are assigned to companies and supervisors."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs" style={{ color: 'var(--text-soft)' }}>
              <thead>
                <tr className="border-b text-[11px] uppercase tracking-wider" style={{ borderColor: 'var(--line)', color: 'var(--text-muted)' }}>
                  <th className="pb-3 font-semibold px-4">Student</th>
                  <th className="pb-3 font-semibold px-4">Work & Submission Progress</th>
                  <th className="pb-3 font-semibold px-4">Academic Supervisor</th>
                  <th className="pb-3 font-semibold px-4">Company</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'var(--line)' }}>
                {internships.map((internship) => {
                  const studentName = internship.student?.user?.name || '—'
                  const studentEmail = internship.student?.user?.email || ''
                  const progress = internship.progress || { percent: 0, stage: 'Not Started', statusKey: 'not_started' }
                  const stageColor = getStageColor(progress.statusKey)

                  return (
                    <tr key={internship.id} className="hover:bg-white/[0.02] transition">
                      {/* Student info */}
                      <td className="py-3.5 px-4 font-semibold" style={{ color: 'var(--text)' }}>
                        <div>{studentName}</div>
                        {studentEmail && (
                          <div className="text-[11px] font-normal" style={{ color: 'var(--text-muted)' }}>
                            {studentEmail}
                          </div>
                        )}
                      </td>

                      {/* Work Progress Bar */}
                      <td className="py-3.5 px-4 min-w-[240px]">
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center justify-between text-[11px] font-medium">
                            <span className="inline-flex items-center gap-1.5" style={{ color: stageColor }}>
                              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: stageColor }} />
                              {progress.stage}
                            </span>
                            <span className="font-semibold" style={{ color: 'var(--text)' }}>
                              {progress.percent}%
                            </span>
                          </div>

                          {/* Progress track */}
                          <div className="h-2 w-full overflow-hidden rounded-full" style={{ backgroundColor: 'rgba(255, 255, 255, 0.08)' }}>
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${progress.percent}%`,
                                background: getProgressGradient(progress.statusKey, progress.percent)
                              }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Academic Supervisor */}
                      <td className="py-3.5 px-4">{internship.academicSupervisor?.name || '—'}</td>

                      {/* Company */}
                      <td className="py-3.5 px-4">{internship.company || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t" style={{ borderColor: 'var(--line)' }}>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 rounded-lg border text-xs disabled:opacity-40 cursor-pointer"
              style={{ borderColor: 'var(--line)', color: 'var(--text)' }}
            >
              Previous
            </button>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 rounded-lg border text-xs disabled:opacity-40 cursor-pointer"
              style={{ borderColor: 'var(--line)', color: 'var(--text)' }}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
