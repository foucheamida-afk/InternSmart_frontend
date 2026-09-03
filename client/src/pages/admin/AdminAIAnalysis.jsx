import { useEffect, useState } from 'react'
import { BrainCircuit, Search } from 'lucide-react'
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

export default function AdminAIAnalysis() {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const fetchReports = async () => {
    setLoading(true)
    try {
      const params = { limit: 50 }
      if (search) params.search = search
      const data = await adminApi.getReports(params)
      setReports(data.reports || [])
    } catch {
      setReports([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReports()
  }, [search])

  const analyzed = reports.filter(r => r.aiScore !== null && r.aiScore !== undefined)
  const avgScore = analyzed.length > 0 ? (analyzed.reduce((sum, r) => sum + (r.aiScore || 0), 0) / analyzed.length).toFixed(1) : null

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-semibold tracking-[-0.06em]" style={{ color: 'var(--text)' }}>AI Analysis</h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
          Review AI-generated scores and analysis across all reports.
        </p>
      </div>

      {avgScore !== null && (
        <div className="mb-6 rounded-2xl border p-6" style={{
          backgroundColor: 'var(--bg-panel)',
          borderColor: 'var(--line)'
        }}>
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl border" style={{
              backgroundColor: 'rgba(255, 122, 0, 0.12)',
              borderColor: 'rgba(255, 122, 0, 0.25)',
              color: 'var(--orange-3)'
            }}>
              <BrainCircuit size={28} />
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.18em]" style={{ color: 'var(--text-muted)' }}>Average AI Score</div>
              <div className="text-3xl font-semibold" style={{ color: 'var(--text)' }}>{avgScore}/10</div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Across {analyzed.length} analyzed reports</div>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-2xl border" style={{
        backgroundColor: 'var(--bg-panel)',
        borderColor: 'var(--line)'
      }}>
        <div className="p-4 border-b" style={{ borderColor: 'var(--line)' }}>
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2" size={14} style={{ color: 'var(--text-muted)' }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search reports..."
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
        ) : reports.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={BrainCircuit}
              title="No reports analyzed yet"
              description="AI analysis results will appear here once reports are submitted."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs" style={{ color: 'var(--text-soft)' }}>
              <thead>
                <tr className="border-b text-[11px] uppercase tracking-wider" style={{ borderColor: 'var(--line)', color: 'var(--text-muted)' }}>
                  <th className="pb-3 font-semibold px-4">Report</th>
                  <th className="pb-3 font-semibold px-4">Student</th>
                  <th className="pb-3 font-semibold px-4">Status</th>
                  <th className="pb-3 font-semibold px-4">AI Score</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'var(--line)' }}>
                {reports.map((r) => (
                  <tr key={r.id} className="hover:bg-white/[0.02] transition">
                    <td className="py-3.5 px-4 font-semibold" style={{ color: 'var(--text)' }}>{r.title}</td>
                    <td className="py-3.5 px-4">{r.student?.user?.name || '—'}</td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border" style={{
                        backgroundColor: r.status === 'approved' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                        color: r.status === 'approved' ? '#6ee7b7' : 'var(--text-soft)',
                        borderColor: r.status === 'approved' ? 'rgba(16, 185, 129, 0.3)' : 'var(--line)'
                      }}>
                        {r.status?.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-semibold" style={{ color: r.aiScore >= 8 ? '#6ee7b7' : r.aiScore >= 6 ? '#fbbf24' : '#fca5a5' }}>
                      {r.aiScore ? `${r.aiScore}/10` : 'Pending'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
