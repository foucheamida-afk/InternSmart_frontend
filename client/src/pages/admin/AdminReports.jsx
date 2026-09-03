import { useEffect, useState } from 'react'
import { Search, FileText } from 'lucide-react'
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

const statusStyles = {
  submitted: { bg: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-soft)', border: 'var(--line)' },
  ai_analysis: { bg: 'rgba(255, 122, 0, 0.1)', color: 'var(--orange-3)', border: 'rgba(255, 122, 0, 0.3)' },
  in_review: { bg: 'rgba(245, 158, 11, 0.1)', color: '#fbbf24', border: 'rgba(245, 158, 11, 0.3)' },
  approved: { bg: 'rgba(16, 185, 129, 0.1)', color: '#6ee7b7', border: 'rgba(16, 185, 129, 0.3)' },
  needs_revision: { bg: 'rgba(239, 68, 68, 0.1)', color: '#fca5a5', border: 'rgba(239, 68, 68, 0.3)' },
  rejected: { bg: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: 'rgba(239, 68, 68, 0.3)' },
}

export default function AdminReports() {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  const fetchReports = async () => {
    setLoading(true)
    try {
      const params = { page, limit: 20 }
      if (search) params.search = search
      if (statusFilter) params.status = statusFilter
      const data = await adminApi.getReports(params)
      setReports(data.reports || [])
      setTotalPages(data.totalPages || 1)
    } catch {
      setReports([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReports()
  }, [page, search, statusFilter])

  const getStatusBadge = (status) => {
    const s = statusStyles[status] || statusStyles.submitted
    return (
      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border" style={{
        backgroundColor: s.bg,
        color: s.color,
        borderColor: s.border
      }}>
        {status?.replace('_', ' ')}
      </span>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-semibold tracking-[-0.06em]" style={{ color: 'var(--text)' }}>Reports</h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
          Monitor and manage all submitted internship reports.
        </p>
      </div>

      <div className="rounded-2xl border" style={{
        backgroundColor: 'var(--bg-panel)',
        borderColor: 'var(--line)'
      }}>
        <div className="flex flex-col sm:flex-row gap-3 p-4 border-b" style={{ borderColor: 'var(--line)' }}>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2" size={14} style={{ color: 'var(--text-muted)' }} />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              placeholder="Search by title or filename..."
              className="w-full rounded-xl border pl-9 pr-3 py-2 text-sm focus:outline-none"
              style={{
                backgroundColor: 'var(--bg)',
                borderColor: 'var(--line)',
                color: 'var(--text)'
              }}
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
            className="rounded-xl border px-3 py-2 text-sm focus:outline-none"
            style={{
              backgroundColor: 'var(--bg)',
              borderColor: 'var(--line)',
              color: 'var(--text)'
            }}
          >
            <option value="">All Statuses</option>
            <option value="submitted">Submitted</option>
            <option value="ai_analysis">AI Analysis</option>
            <option value="in_review">In Review</option>
            <option value="approved">Approved</option>
            <option value="needs_revision">Needs Revision</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-500 border-t-transparent" />
          </div>
        ) : reports.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={FileText}
              title="No reports found"
              description="Reports will appear here once students submit them."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs" style={{ color: 'var(--text-soft)' }}>
              <thead>
                <tr className="border-b text-[11px] uppercase tracking-wider" style={{ borderColor: 'var(--line)', color: 'var(--text-muted)' }}>
                  <th className="pb-3 font-semibold px-4">Title</th>
                  <th className="pb-3 font-semibold px-4">Student</th>
                  <th className="pb-3 font-semibold px-4">Version</th>
                  <th className="pb-3 font-semibold px-4">Status</th>
                  <th className="pb-3 font-semibold px-4">AI Score</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'var(--line)' }}>
                {reports.map((r) => (
                  <tr key={r.id} className="hover:bg-white/[0.02] transition">
                    <td className="py-3.5 px-4 font-semibold" style={{ color: 'var(--text)' }}>{r.title}</td>
                    <td className="py-3.5 px-4">{r.student?.user?.name || '—'}</td>
                    <td className="py-3.5 px-4">v{r.version || 1}</td>
                    <td className="py-3.5 px-4">{getStatusBadge(r.status)}</td>
                    <td className="py-3.5 px-4">{r.aiScore ? `${r.aiScore}/10` : 'Pending'}</td>
                  </tr>
                ))}
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
