import { useEffect, useState } from 'react'
import { CalendarClock, Plus, Trash2, Save, Pencil, X } from 'lucide-react'
import { adminApi } from '../../services/adminService'

const toDateInput = (value) => (value ? new Date(value).toISOString().slice(0, 10) : '')

const emptyForm = { id: null, label: '', startDate: '', endDate: '', milestones: [] }

export default function AdminTimeline() {
  const [timelines, setTimelines] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)

  const fetchTimelines = async () => {
    setLoading(true)
    try {
      const data = await adminApi.getTimelines()
      setTimelines(data.timelines || [])
    } catch (err) {
      console.error('Fetch timelines error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchTimelines() }, [])

  const openCreate = () => {
    setForm(emptyForm)
    setError('')
    setIsModalOpen(true)
  }

  const openEdit = (timeline) => {
    setForm({
      id: timeline.id,
      label: timeline.label || '',
      startDate: toDateInput(timeline.startDate),
      endDate: toDateInput(timeline.endDate),
      milestones: (timeline.milestones || []).map((m) => ({ title: m.title, date: toDateInput(m.date) })),
    })
    setError('')
    setIsModalOpen(true)
  }

  const addMilestone = () => setForm((f) => ({ ...f, milestones: [...f.milestones, { title: '', date: '' }] }))
  const updateMilestone = (i, field, value) =>
    setForm((f) => ({ ...f, milestones: f.milestones.map((m, idx) => (idx === i ? { ...m, [field]: value } : m)) }))
  const removeMilestone = (i) => setForm((f) => ({ ...f, milestones: f.milestones.filter((_, idx) => idx !== i) }))

  const handleSave = async () => {
    setSaving(true)
    setError('')
    const payload = {
      label: form.label,
      startDate: form.startDate || null,
      endDate: form.endDate || null,
      milestones: form.milestones.filter((m) => m.title && m.date),
    }
    try {
      if (form.id) {
        await adminApi.updateTimeline(form.id, payload)
      } else {
        await adminApi.createTimeline(payload)
      }
      setIsModalOpen(false)
      fetchTimelines()
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to save timeline')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this internship timeline?')) return
    try {
      await adminApi.deleteTimeline(id)
      fetchTimelines()
    } catch (err) {
      console.error('Delete timeline error:', err)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-[-0.06em]" style={{ color: 'var(--text)' }}>Internship Timelines</h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
            Create multiple internship timelines (e.g. per cohort). Each new timeline is added separately and will not overwrite existing ones.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition cursor-pointer"
          style={{ background: 'linear-gradient(135deg, var(--orange), var(--orange-3))' }}
        >
          <Plus size={16} /> Add Timeline
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border px-3 py-2 text-sm" style={{ borderColor: 'rgba(239,68,68,0.3)', backgroundColor: 'rgba(239,68,68,0.1)', color: '#fca5a5' }}>
          {error}
        </div>
      )}

      {timelines.length === 0 ? (
        <div className="rounded-2xl border p-12 text-center" style={{ backgroundColor: 'var(--bg-panel)', borderColor: 'var(--line)' }}>
          <CalendarClock size={32} className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No internship timelines yet. Click “Add Timeline” to create one.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {timelines.map((t) => (
            <div key={t.id} className="rounded-2xl border p-5" style={{ backgroundColor: 'var(--bg-panel)', borderColor: 'var(--line)' }}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold" style={{ color: 'var(--text)' }}>{t.label || 'Untitled Timeline'}</h3>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                    {t.startDate ? new Date(t.startDate).toLocaleDateString() : '—'} → {t.endDate ? new Date(t.endDate).toLocaleDateString() : '—'}
                    {t.milestones?.length ? ` · ${t.milestones.length} milestones` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => openEdit(t)} className="p-2 rounded-lg cursor-pointer" style={{ color: 'var(--orange-3)' }} title="Edit">
                    <Pencil size={15} />
                  </button>
                  <button onClick={() => handleDelete(t.id)} className="p-2 rounded-lg cursor-pointer" style={{ color: '#ef4444' }} title="Delete">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
              {t.milestones && t.milestones.length > 0 && (
                <ul className="list-disc pl-5 mt-3 text-sm" style={{ color: 'var(--text-soft)' }}>
                  {t.milestones.map((m, i) => (
                    <li key={i}>{m.title} — {m.date ? new Date(m.date).toLocaleDateString() : '—'}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border p-6 shadow-2xl max-h-[90vh] overflow-y-auto" style={{ backgroundColor: 'var(--bg-panel)', borderColor: 'var(--line)', color: 'var(--text)' }}>
            <div className="flex items-center justify-between border-b pb-3 mb-4" style={{ borderColor: 'var(--line)' }}>
              <h3 className="text-base font-bold">{form.id ? 'Edit Timeline' : 'New Internship Timeline'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="rounded-full p-1 transition cursor-pointer" style={{ color: 'var(--text-muted)' }}>
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-soft)' }}>Label</label>
                <input
                  value={form.label}
                  onChange={(e) => setForm({ ...form, label: e.target.value })}
                  placeholder="e.g. 2025/2026 Internship"
                  className="w-full rounded-xl border p-2.5 focus:outline-none"
                  style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--line)', color: 'var(--text)' }}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-soft)' }}>Start Date</label>
                  <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="w-full rounded-xl border p-2.5 focus:outline-none" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--line)', color: 'var(--text)' }} />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-soft)' }}>End Date</label>
                  <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className="w-full rounded-xl border p-2.5 focus:outline-none" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--line)', color: 'var(--text)' }} />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-soft)' }}>Milestones</label>
                  <button type="button" onClick={addMilestone} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg cursor-pointer" style={{ color: 'var(--orange-3)', backgroundColor: 'rgba(255,122,0,0.1)' }}>
                    <Plus size={12} /> Add
                  </button>
                </div>
                <div className="space-y-2">
                  {form.milestones.map((m, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input value={m.title} onChange={(e) => updateMilestone(i, 'title', e.target.value)} placeholder="Milestone title" className="flex-1 rounded-lg border p-2 focus:outline-none" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--line)', color: 'var(--text)' }} />
                      <input type="date" value={m.date} onChange={(e) => updateMilestone(i, 'date', e.target.value)} className="rounded-lg border p-2 focus:outline-none" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--line)', color: 'var(--text)' }} />
                      <button type="button" onClick={() => removeMilestone(i)} className="p-1.5 rounded-lg cursor-pointer" style={{ color: 'var(--text-muted)' }}><Trash2 size={13} /></button>
                    </div>
                  ))}
                  {form.milestones.length === 0 && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No milestones added.</p>}
                </div>
              </div>

              {error && <p className="text-xs" style={{ color: '#ef4444' }}>{error}</p>}

              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded-xl transition cursor-pointer" style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: 'var(--text)' }}>Cancel</button>
                <button type="button" onClick={handleSave} disabled={saving} className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition disabled:opacity-50 cursor-pointer" style={{ background: 'linear-gradient(135deg, var(--orange), var(--orange-3))' }}>
                  <Save size={16} /> {saving ? 'Saving...' : 'Save Timeline'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
