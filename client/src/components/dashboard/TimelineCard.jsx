import React, { useState, useEffect } from 'react'
import { CalendarClock, Flag, Milestone } from 'lucide-react'
import { publicTimelineService } from '../../services/api'

const formatDate = (value) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
}

export default function TimelineCard() {
  const [timeline, setTimeline] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchTimeline = async () => {
      try {
        const data = await publicTimelineService.get()
        setTimeline(data.timeline || { label: null, startDate: null, endDate: null, milestones: [] })
      } catch (err) {
        console.error('Fetch timeline error:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchTimeline()
  }, [])

  if (loading) {
    return (
      <div className="card p-5 flex flex-col min-h-[220px]">
        <div className="card-header"><h3 className="card-title">Internship Timeline</h3></div>
        <div className="flex-1 flex items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-3 border-orange-500 border-t-transparent" />
        </div>
      </div>
    )
  }

  if (!timeline || (!timeline.startDate && !timeline.endDate && (!timeline.milestones || timeline.milestones.length === 0))) {
    return (
      <div className="card p-5 flex flex-col">
        <div className="card-header"><h3 className="card-title">Internship Timeline</h3></div>
        <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
          <CalendarClock size={32} style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm mt-3" style={{ color: 'var(--text-muted)' }}>
            The internship timeline hasn&apos;t been configured yet.
          </p>
        </div>
      </div>
    )
  }

  const start = timeline.startDate ? new Date(timeline.startDate) : null
  const end = timeline.endDate ? new Date(timeline.endDate) : null
  const now = new Date()
  let progress = 0
  if (start && end && end > start) {
    const total = end - start
    const elapsed = now - start
    progress = Math.max(0, Math.min(100, Math.round((elapsed / total) * 100)))
  }

  const rawMilestones = timeline.milestones
  const milestones = (Array.isArray(rawMilestones)
    ? rawMilestones
    : typeof rawMilestones === "string"
      ? (() => { try { return JSON.parse(rawMilestones) } catch { return [] } })()
      : []
  ).slice().sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0))

  return (
    <div className="card p-5 flex flex-col">
      <div className="card-header">
        <h3 className="card-title">Internship Timeline</h3>
        {timeline.label && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{timeline.label}</span>}
      </div>

      <div className="mt-3 flex items-center gap-4 text-sm">
        <div className="flex items-center gap-1.5" style={{ color: 'var(--text-soft)' }}>
          <Flag size={14} style={{ color: 'var(--orange-3)' }} /> {formatDate(timeline.startDate)}
        </div>
        <span style={{ color: 'var(--text-muted)' }}>→</span>
        <div className="flex items-center gap-1.5" style={{ color: 'var(--text-soft)' }}>
          <Flag size={14} style={{ color: '#10b981' }} /> {formatDate(timeline.endDate)}
        </div>
      </div>

      {progress > 0 && (
        <div className="mt-4">
          <div className="flex items-center justify-between text-[11px] uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
            <span>Progress</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
            <div className="h-full rounded-full" style={{ width: `${progress}%`, background: 'linear-gradient(to right, #ff7a00, #ff9d3d)' }} />
          </div>
        </div>
      )}

      {milestones.length > 0 && (
        <div className="mt-4 space-y-3">
          {milestones.map((m, index) => {
            const isPast = m.date && new Date(m.date) <= now
            return (
              <div key={index} className="flex items-start gap-3">
                <div
                  className="mt-1 flex h-4 w-4 items-center justify-center rounded-full border"
                  style={{
                    borderColor: isPast ? '#10b981' : 'var(--line)',
                    backgroundColor: isPast ? '#10b981' : 'transparent',
                  }}
                >
                  <Milestone size={10} style={{ color: isPast ? 'white' : 'var(--text-muted)' }} />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium" style={{ color: 'var(--text-soft)' }}>{m.title}</div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{formatDate(m.date)}</div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
