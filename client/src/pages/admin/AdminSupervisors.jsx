import { useEffect, useState } from 'react'
import { Search, Shield } from 'lucide-react'
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

export default function AdminSupervisors() {
  const [supervisors, setSupervisors] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  const fetchSupervisors = async () => {
    setLoading(true)
    try {
      const params = { page, limit: 20 }
      if (search) params.search = search
      if (roleFilter) params.role = roleFilter
      const data = await adminApi.getSupervisors(params)
      setSupervisors(data.supervisors || [])
      setTotalPages(data.totalPages || 1)
    } catch {
      setSupervisors([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSupervisors()
  }, [page, search, roleFilter])

  const getRoleBadge = (role) => {
    const styles = {
      academic_supervisor: { bg: 'rgba(99, 102, 241, 0.12)', color: '#a5b4fc', border: 'rgba(99, 102, 241, 0.3)' },
      professional_supervisor: { bg: 'rgba(16, 185, 129, 0.12)', color: '#6ee7b7', border: 'rgba(16, 185, 129, 0.3)' },
    }
    const s = styles[role] || { bg: 'rgba(255,255,255,0.05)', color: 'var(--text-soft)', border: 'var(--line)' }
    return (
      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border" style={{
        backgroundColor: s.bg,
        color: s.color,
        borderColor: s.border
      }}>
        {role?.replace('_', ' ')}
      </span>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-semibold tracking-[-0.06em]" style={{ color: 'var(--text)' }}>Supervisors</h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
          View and manage academic supervisors.
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
              placeholder="Search by name or email..."
              className="w-full rounded-xl border pl-9 pr-3 py-2 text-sm focus:outline-none"
              style={{
                backgroundColor: 'var(--bg)',
                borderColor: 'var(--line)',
                color: 'var(--text)'
              }}
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => { setRoleFilter(e.target.value); setPage(1) }}
            className="rounded-xl border px-3 py-2 text-sm focus:outline-none"
            style={{
              backgroundColor: 'var(--bg)',
              borderColor: 'var(--line)',
              color: 'var(--text)'
            }}
          >
            <option value="">All Types</option>
            <option value="academic_supervisor">Academic Supervisor</option>
            <option value="professional_supervisor">Professional Supervisor</option>
          </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-500 border-t-transparent" />
          </div>
        ) : supervisors.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={Shield}
              title="No supervisors found"
              description="Supervisors will appear here once accounts are created."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs" style={{ color: 'var(--text-soft)' }}>
              <thead>
                <tr className="border-b text-[11px] uppercase tracking-wider" style={{ borderColor: 'var(--line)', color: 'var(--text-muted)' }}>
                  <th className="pb-3 font-semibold px-4">Name</th>
                  <th className="pb-3 font-semibold px-4">Email</th>
                  <th className="pb-3 font-semibold px-4">Type</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'var(--line)' }}>
                {supervisors.map((s) => (
                  <tr key={s.id} className="hover:bg-white/[0.02] transition">
                    <td className="py-3.5 px-4 font-semibold" style={{ color: 'var(--text)' }}>{s.name}</td>
                    <td className="py-3.5 px-4">{s.email}</td>
                    <td className="py-3.5 px-4">{getRoleBadge(s.role)}</td>
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
