import { useEffect, useState } from 'react'
import { Search, CalendarDays, Plus, Trash2 } from 'lucide-react'
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

export default function AdminMeetings() {
  const [meetings, setMeetings] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [newMeeting, setNewMeeting] = useState({ title: '', description: '', date: '', location: '', meetingLink: '' })
  const [creating, setCreating] = useState(false)

  const fetchMeetings = async () => {
    setLoading(true)
    try {
      const params = { page, limit: 20 }
      if (search) params.search = search
      const data = await adminApi.getMeetings(params)
      setMeetings(data.meetings || [])
      setTotalPages(data.totalPages || 1)
    } catch {
      setMeetings([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMeetings()
  }, [page, search])

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!newMeeting.title.trim() || !newMeeting.date) return
    setCreating(true)
    try {
      await adminApi.createMeeting({ ...newMeeting, createdBy: 1 })
      setNewMeeting({ title: '', description: '', date: '', location: '', meetingLink: '' })
      setIsCreateOpen(false)
      fetchMeetings()
    } catch {
      // error
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this meeting?')) return
    try {
      await adminApi.deleteMeeting(id)
      setMeetings(prev => prev.filter(m => m.id !== id))
    } catch {
      // error
    }
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '—'
    const date = new Date(dateStr)
    if (Number.isNaN(date.getTime())) return '—'
    return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date)
  }

  return (
    <div>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-[-0.06em]" style={{ color: 'var(--text)' }}>Meetings</h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
            Schedule and manage meetings.
          </p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium shadow-lg transition cursor-pointer"
          style={{
            background: 'linear-gradient(135deg, var(--orange), var(--orange-3))',
            color: 'white'
          }}
        >
          <Plus size={16} /> Schedule Meeting
        </button>
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
              placeholder="Search meetings..."
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
        ) : meetings.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={CalendarDays}
              title="No meetings scheduled"
              description="Meetings will appear here once scheduled."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs" style={{ color: 'var(--text-soft)' }}>
              <thead>
                <tr className="border-b text-[11px] uppercase tracking-wider" style={{ borderColor: 'var(--line)', color: 'var(--text-muted)' }}>
                  <th className="pb-3 font-semibold px-4">Title</th>
                  <th className="pb-3 font-semibold px-4">Date</th>
                  <th className="pb-3 font-semibold px-4">Location</th>
                  <th className="pb-3 font-semibold px-4">Status</th>
                  <th className="pb-3 font-semibold px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'var(--line)' }}>
                {meetings.map((m) => (
                  <tr key={m.id} className="hover:bg-white/[0.02] transition">
                    <td className="py-3.5 px-4 font-semibold" style={{ color: 'var(--text)' }}>{m.title}</td>
                    <td className="py-3.5 px-4">{formatDate(m.date)}</td>
                    <td className="py-3.5 px-4">{m.location || '—'}</td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border" style={{
                        backgroundColor: m.status === 'scheduled' ? 'rgba(255, 122, 0, 0.1)' : m.status === 'completed' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        color: m.status === 'scheduled' ? 'var(--orange-3)' : m.status === 'completed' ? '#6ee7b7' : '#fca5a5',
                        borderColor: m.status === 'scheduled' ? 'rgba(255, 122, 0, 0.3)' : m.status === 'completed' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'
                      }}>
                        {m.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => handleDelete(m.id)}
                        className="p-1.5 rounded-lg transition cursor-pointer"
                        style={{ color: 'var(--text-muted)' }}
                        onMouseEnter={(e) => e.target.style.color = '#f87171'}
                        onMouseLeave={(e) => e.target.style.color = 'var(--text-muted)'}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
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

      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border p-6 shadow-2xl" style={{
            backgroundColor: 'var(--bg-panel)',
            borderColor: 'var(--line)',
            color: 'var(--text)'
          }}>
            <div className="flex items-center justify-between border-b pb-3 mb-4" style={{ borderColor: 'var(--line)' }}>
              <div>
                <h3 className="text-base font-bold">Schedule Meeting</h3>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Create a new meeting</p>
              </div>
              <button onClick={() => setIsCreateOpen(false)} className="rounded-full p-1 transition cursor-pointer" style={{ color: 'var(--text-muted)' }}>
                <Trash2 size={18} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold mb-1" style={{ color: 'var(--text-soft)' }}>Title</label>
                <input
                  required
                  value={newMeeting.title}
                  onChange={(e) => setNewMeeting({ ...newMeeting, title: e.target.value })}
                  className="w-full rounded-xl border p-2.5 text-xs focus:outline-none"
                  style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--line)', color: 'var(--text)' }}
                />
              </div>
              <div>
                <label className="block font-semibold mb-1" style={{ color: 'var(--text-soft)' }}>Date & Time</label>
                <input
                  required
                  type="datetime-local"
                  value={newMeeting.date}
                  onChange={(e) => setNewMeeting({ ...newMeeting, date: e.target.value })}
                  className="w-full rounded-xl border p-2.5 text-xs focus:outline-none"
                  style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--line)', color: 'var(--text)' }}
                />
              </div>
              <div>
                <label className="block font-semibold mb-1" style={{ color: 'var(--text-soft)' }}>Location</label>
                <input
                  value={newMeeting.location}
                  onChange={(e) => setNewMeeting({ ...newMeeting, location: e.target.value })}
                  className="w-full rounded-xl border p-2.5 text-xs focus:outline-none"
                  style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--line)', color: 'var(--text)' }}
                />
              </div>
              <div>
                <label className="block font-semibold mb-1" style={{ color: 'var(--text-soft)' }}>Meeting Link</label>
                <input
                  value={newMeeting.meetingLink}
                  onChange={(e) => setNewMeeting({ ...newMeeting, meetingLink: e.target.value })}
                  className="w-full rounded-xl border p-2.5 text-xs focus:outline-none"
                  style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--line)', color: 'var(--text)' }}
                />
              </div>
              <div className="pt-3 border-t flex justify-end gap-2" style={{ borderColor: 'var(--line)' }}>
                <button type="button" onClick={() => setIsCreateOpen(false)} className="px-4 py-2 rounded-xl transition cursor-pointer" style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: 'var(--text)' }}>
                  Cancel
                </button>
                <button type="submit" disabled={creating} className="px-4 py-2 rounded-xl font-semibold shadow-lg transition cursor-pointer disabled:opacity-50" style={{ background: 'linear-gradient(135deg, var(--orange), var(--orange-3))', color: 'white' }}>
                  {creating ? 'Creating...' : 'Create Meeting'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
