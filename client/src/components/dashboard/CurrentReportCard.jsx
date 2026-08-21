import React from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, ArrowRight } from 'lucide-react'

export default function CurrentReportCard() {
  const navigate = useNavigate()
  const stages = [
    { name: 'Uploaded', status: 'completed' },
    { name: 'AI Analysis', status: 'completed' },
    { name: 'Supervisor Review', status: 'current' },
    { name: 'Final Approval', status: 'pending' },
  ]

  return (
    <div className="card current-report-card">
      <div className="card-header">
        <h3 className="card-title">My Current Report</h3>
        <button className="card-action" onClick={() => navigate('/my-reports')}>
          View all
        </button>
      </div>

      <div
        className="report-meta-section cursor-pointer"
        onClick={() => navigate('/my-reports')}
      >
        <div className="report-icon-container">
          <FileText size={24} />
        </div>
        <div className="report-info">
          <h4 className="report-title">AI-Powered Internship Platform</h4>
          <p className="report-meta">Version 3 • Last updated 2 days ago</p>
        </div>
      </div>

      {/* Progress Timeline */}
      <div className="timeline-section">
        <div className="timeline-header">
          <span className="timeline-label">Report Progress</span>
          <span className="timeline-status">In progress</span>
        </div>

        <div className="timeline-stages">
          {stages.map((stage, index) => (
            <div key={index} className="timeline-stage">
              <div className={`timeline-dot timeline-${stage.status}`}></div>
              <span className="timeline-stage-name">{stage.name}</span>
              {index < stages.length - 1 && <div className="timeline-connector"></div>}
            </div>
          ))}
        </div>
      </div>

      {/* AI Analysis Summary */}
      <div className="ai-summary-section">
        <h5 className="ai-summary-title">AI Analysis Summary</h5>
        <p className="ai-summary-text">
          Great work! Your report is engaging and well-structured.
          <br />
          Some improvements were suggested.
        </p>

        <div className="ai-summary-footer">
          <button className="ai-suggestions-btn cursor-pointer" onClick={() => navigate('/ai-analysis')}>
            View AI Suggestions
            <ArrowRight size={16} />
          </button>

          <div className="ai-score-badge cursor-pointer" onClick={() => navigate('/ai-analysis')}>
            <div className="score-text">8.4/10</div>
          </div>
        </div>
      </div>
    </div>
  )
}
