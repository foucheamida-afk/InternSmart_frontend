import React from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, Circle } from 'lucide-react'

export default function InternshipTimeline() {
  const navigate = useNavigate()
  const events = [
    { name: 'Internship started', date: 'Feb 1, 2025', status: 'completed' },
    { name: 'First report submitted', date: 'Mar 1, 2025', status: 'completed' },
    { name: 'Midterm review', date: 'Apr 12, 2025', status: 'completed' },
    { name: 'Final report deadline', date: 'May 30, 2025', status: 'current' },
    { name: 'Final defense', date: 'Jun 15, 2025', status: 'pending' },
  ]

  return (
    <div className="card internship-timeline-card">
      <div className="card-header">
        <h3 className="card-title">Internship Timeline</h3>
        <button className="card-action cursor-pointer" onClick={() => navigate('/my-reports')}>
          View full
        </button>
      </div>

      <div className="timeline-vertical">
        {events.map((event, index) => (
          <div key={index} className={`timeline-item timeline-item-${event.status}`}>
            <div className="timeline-marker">
              {event.status === 'completed' && <CheckCircle2 size={24} />}
              {event.status === 'current' && <Circle size={24} />}
              {event.status === 'pending' && <Circle size={24} />}
            </div>

            {index < events.length - 1 && (
              <div className={`timeline-line timeline-line-${event.status}`}></div>
            )}

            <div className="timeline-content">
              <div className="timeline-event-name">{event.name}</div>
              <div className="timeline-event-date">{event.date}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
