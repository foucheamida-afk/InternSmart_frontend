import React, { useState, useEffect } from 'react'
import { Calendar, Video, AlertCircle, RefreshCw, X, ExternalLink } from 'lucide-react'
import api from '../../api/axios'

export default function UpcomingMeeting() {
  const [meetings, setMeetings] = useState([])
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeMeetingId, setActiveMeetingId] = useState(null)

  const fetchMeeting = async () => {
    setLoading(true)
    setError('')
    try {
      let upcoming = []
      let past = []

      try {
        const res = await api.get('/meetings/student')
        upcoming = res.data.upcomingMeetings || res.data.meetings || []
        past = res.data.meetingHistory || []
      } catch {
        const res = await api.get('/students/my-meetings')
        upcoming = res.data.upcomingMeetings || res.data.meetings || []
        past = res.data.meetingHistory || []
      }

      setMeetings(upcoming)
      setHistory(past)
    } catch (err) {
      console.error('Fetch meeting error:', err)
      setError('Unable to load your meetings.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMeeting()
    const refreshInterval = window.setInterval(fetchMeeting, 10_000)
    return () => window.clearInterval(refreshInterval)
  }, [])

  const formatMonth = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short' }).toUpperCase()
  const formatDay = (d) => new Date(d).getDate()
  const formatWeekday = (d) => new Date(d).toLocaleDateString('en-US', { weekday: 'short' })
  const formatTimeRange = (d) => {
    const start = new Date(d)
    const end = new Date(start.getTime() + 60 * 60 * 1000)
    return `${start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })} – ${end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`
  }

  const renderMeetingCard = (meeting, isHistory = false) => {
    const creatorName = meeting.creator?.name || 'Supervisor'
    const activeMeeting = meeting && meeting.id === activeMeetingId && !isHistory

    return (
      <div key={meeting.id} className="meeting-content" style={{ marginBottom: isHistory ? '0.5rem' : '1rem' }}>
        <div className="meeting-date-block">
          <div className="meeting-month">{formatMonth(meeting.date)}</div>
          <div className="meeting-day">{formatDay(meeting.date)}</div>
          <div className="meeting-weekday">{formatWeekday(meeting.date)}</div>
        </div>

        <div className="meeting-details">
          <h4 className="meeting-title">{meeting.title}</h4>

          <div className="meeting-time">
            <Calendar size={14} />
            <span>{formatTimeRange(meeting.date)}</span>
          </div>

          {meeting.description && (
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>{meeting.description}</p>
          )}

          <div className="meeting-tags">
            {meeting.meetingLink && <span className="meeting-tag">🎥 Online</span>}
            {meeting.location && <span className="meeting-tag">📍 {meeting.location}</span>}
            <span className="meeting-tag">Host: {creatorName}</span>
            {isHistory && <span className="meeting-tag" style={{ opacity: 0.8 }}>History</span>}
          </div>

          {!isHistory && (
            <div className="meeting-buttons">
              {meeting.meetingLink ? (
                <>
                  <button
                    onClick={() => window.open(meeting.meetingLink, '_blank', 'noopener,noreferrer')}
                    className="btn btn-primary cursor-pointer"
                  >
                    <Video size={15} /> Join Meeting
                  </button>
                  <a
                    href={meeting.meetingLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary cursor-pointer"
                    style={{ marginLeft: '8px' }}
                  >
                    <ExternalLink size={15} /> Open in new tab
                  </a>
                </>
              ) : (
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Meeting link will be shared before the session.
                </p>
              )}
            </div>
          )}
        </div>

        {!isHistory && activeMeeting && (
          <div className="fixed inset-0 z-50 flex flex-col bg-black" style={{ display: 'flex' }}>
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 bg-[#0d1419]">
              <div>
                <h3 className="text-lg font-bold text-white">{meeting.title}</h3>
                <p className="text-xs text-white/50">Virtual meeting with Jitsi Meet</p>
              </div>
              <button onClick={() => setActiveMeetingId(null)}
                className="rounded-full p-1.5 hover:bg-white/10 text-white/70 hover:text-white transition cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 relative bg-black">
              <iframe
                src={meeting.meetingLink}
                title="Jitsi Meet"
                allow="camera; microphone; fullscreen; display-capture; autoplay"
                className="w-full h-full border-0"
                allowFullScreen
              />
            </div>
          </div>
        )}
      </div>
    )
  }

  if (loading) return (
    <div className="card upcoming-meeting-card flex flex-col min-h-[250px]">
      <div className="card-header"><h3 className="card-title">Upcoming Meeting</h3></div>
      <div className="flex-1 flex items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-orange-400 border-t-transparent" />
      </div>
    </div>
  )

  if (error) return (
    <div className="card upcoming-meeting-card flex flex-col min-h-[250px]">
      <div className="card-header"><h3 className="card-title">Upcoming Meeting</h3></div>
      <div className="flex-1 flex flex-col items-center justify-center text-center">
        <AlertCircle size={24} style={{ color: '#ef4444' }} />
        <p className="text-sm mt-2" style={{ color: '#ef4444' }}>{error}</p>
        <button onClick={fetchMeeting} className="mt-2 flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg cursor-pointer"
          style={{ color: '#F5A623', backgroundColor: 'rgba(245,166,35,0.1)' }}>
          <RefreshCw size={12} /> Try Again
        </button>
      </div>
    </div>
  )

  if (!meetings.length) return (
    <div className="card upcoming-meeting-card flex flex-col min-h-[250px]">
      <div className="card-header"><h3 className="card-title">Upcoming Meeting</h3></div>
      <div className="flex-1 flex flex-col items-center justify-center text-center">
        <Calendar size={32} style={{ color: 'var(--text-muted)' }} />
        <p className="text-sm mt-3" style={{ color: 'var(--text-muted)' }}>No upcoming meetings</p>
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Your supervisor will schedule one soon</p>

        {history.length > 0 && (
          <div className="mt-4 w-full text-left">
            <p className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Recent history</p>
            <div className="mt-2 space-y-2">
              {history.slice(0, 3).map((item) => (
                <div key={item.id} className="rounded-lg border p-2" style={{ borderColor: 'var(--line)' }}>
                  <p className="text-xs font-medium" style={{ color: 'var(--text)' }}>{item.title}</p>
                  <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{new Date(item.date).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )

  return (
    <>
      <div className="card upcoming-meeting-card">
        <div className="card-header">
          <h3 className="card-title">Upcoming Meetings</h3>
        </div>

        <div className="space-y-3">
          {meetings.map((meeting) => renderMeetingCard(meeting, false))}
        </div>

        {history.length > 0 && (
          <div className="mt-4 border-t pt-3" style={{ borderColor: 'var(--line)' }}>
            <p className="text-[11px] uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>Meeting history</p>
            <div className="space-y-2">
              {history.slice(0, 3).map((meeting) => renderMeetingCard(meeting, true))}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
