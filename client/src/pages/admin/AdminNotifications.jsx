import { useEffect, useState } from 'react'
import { Bell, Plus, Trash2 } from 'lucide-react'
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

const typeStyles = {
  info: { bg: 'rgba(99, 102, 241, 0.1)', color: '#a5b4fc', border: 'rgba(99, 102, 241, 0.3)' },
  warning: { bg: 'rgba(245, 158, 11, 0.1)', color: '#fbbf24', border: 'rgba(245, 158, 11, 0.3)' },
  success: { bg: 'rgba(16, 185, 129, 0.1)', color: '#6ee7b7', border: 'rgba(16, 185, 129, 0.3)' },
  error: { bg: 'rgba(239, 68, 68, 0.1)', color: '#fca5a5', border: 'rgba(239, 68, 68, 0.3)' },
}

export default function AdminNotifications() {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [newNotif, setNewNotif] = useState({ userId: '', title: '', message: '', type: 'info' })
  const [creating, setCreating] = useState(false)

  const fetchNotifications = async () => {
    setLoading(true)
    try {
      const params = { page, limit: 20 }
      const data = await adminApi.getNotifications(params)
      setNotifications(data.notifications || [])
      setTotalPages(data.totalPages || 1)
    } catch {
      setNotifications([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchNotifications()
  }, [page])

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!newNotif.title.trim() || !newNotif.message.trim() || !newNotif.userId) return
    setCreating(true)
    try {
      await adminApi.createNotification(newNotif)
      setNewNotif({ userId: '', title: '', message: '', type: 'info' })
      setIsCreateOpen(false)
      fetchNotifications()
    } catch {
      // error
    } finally {
      setCreating(false)
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-[-0.06em]" style={{ color: 'var(--text)' }}>Notifications</h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
            View and send notifications to users.
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
          <Plus size={16} /> Send Notification
        </button>
      </div>

      <div className="rounded-2xl border" style={{
        backgroundColor: 'var(--bg-panel)',
        borderColor: 'var(--line)'
      }}>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-500 border-t-transparent" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={Bell}
              title="No notifications"
              description="Notifications will appear here once sent."
            />
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--line)' }}>
            {notifications.map((n) => {
              const s = typeStyles[n.type] || typeStyles.info
              return (
                <div key={n.id} className="p-4 hover:bg-white/[0.02] transition flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border" style={{
                        backgroundColor: s.bg,
                        color: s.color,
                        borderColor: s.border
                      }}>
                        {n.type}
                      </span>
                      <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>To: {n.user?.name || `User #${n.userId}`}</span>
                    </div>
                    <div className="font-semibold text-sm" style={{ color: 'var(--text)' }}>{n.title}</div>
                    <div className="text-xs mt-1" style={{ color: 'var(--text-soft)' }}>{n.message}</div>
                  </div>
                </div>
              )
            })}
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
                <h3 className="text-base font-bold">Send Notification</h3>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Send a notification to a user</p>
              </div>
              <button onClick={() => setIsCreateOpen(false)} className="rounded-full p-1 transition cursor-pointer" style={{ color: 'var(--text-muted)' }}>
                <Trash2 size={18} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold mb-1" style={{ color: 'var(--text-soft)' }}>User ID</label>
                <input
                  required
                  type="number"
                  value={newNotif.userId}
                  onChange={(e) => setNewNotif({ ...newNotif, userId: e.target.value })}
                  placeholder="User ID"
                  className="w-full rounded-xl border p-2.5 text-xs focus:outline-none"
                  style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--line)', color: 'var(--text)' }}
                />
              </div>
              <div>
                <label className="block font-semibold mb-1" style={{ color: 'var(--text-soft)' }}>Title</label>
                <input
                  required
                  value={newNotif.title}
                  onChange={(e) => setNewNotif({ ...newNotif, title: e.target.value })}
                  className="w-full rounded-xl border p-2.5 text-xs focus:outline-none"
                  style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--line)', color: 'var(--text)' }}
                />
              </div>
              <div>
                <label className="block font-semibold mb-1" style={{ color: 'var(--text-soft)' }}>Message</label>
                <textarea
                  required
                  value={newNotif.message}
                  onChange={(e) => setNewNotif({ ...newNotif, message: e.target.value })}
                  rows={3}
                  className="w-full rounded-xl border p-2.5 text-xs focus:outline-none"
                  style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--line)', color: 'var(--text)' }}
                />
              </div>
              <div>
                <label className="block font-semibold mb-1" style={{ color: 'var(--text-soft)' }}>Type</label>
                <select
                  value={newNotif.type}
                  onChange={(e) => setNewNotif({ ...newNotif, type: e.target.value })}
                  className="w-full rounded-xl border p-2.5 text-xs focus:outline-none"
                  style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--line)', color: 'var(--text)' }}
                >
                  <option value="info">Info</option>
                  <option value="warning">Warning</option>
                  <option value="success">Success</option>
                  <option value="error">Error</option>
                </select>
              </div>
              <div className="pt-3 border-t flex justify-end gap-2" style={{ borderColor: 'var(--line)' }}>
                <button type="button" onClick={() => setIsCreateOpen(false)} className="px-4 py-2 rounded-xl transition cursor-pointer" style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: 'var(--text)' }}>
                  Cancel
                </button>
                <button type="submit" disabled={creating} className="px-4 py-2 rounded-xl font-semibold shadow-lg transition cursor-pointer disabled:opacity-50" style={{ background: 'linear-gradient(135deg, var(--orange), var(--orange-3))', color: 'white' }}>
                  {creating ? 'Sending...' : 'Send Notification'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
