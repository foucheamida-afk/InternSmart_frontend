import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import AnimatedProgressRing from './AnimatedProgressRing'

export default function AIAnalysisOverview() {
  const navigate = useNavigate()
  const [displayValues, setDisplayValues] = useState({
    structure: 0,
    clarity: 0,
    grammar: 0,
    originality: 0,
    references: 0,
  })

  const metrics = [
    { name: 'Structure', value: 85, key: 'structure' },
    { name: 'Clarity', value: 90, key: 'clarity' },
    { name: 'Grammar', value: 88, key: 'grammar' },
    { name: 'Originality', value: 95, key: 'originality' },
    { name: 'References', value: 86, key: 'references' },
  ]

  useEffect(() => {
    const duration = 1500
    const startTime = Date.now()

    const animateMetrics = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)

      const newValues = {}
      metrics.forEach((metric) => {
        newValues[metric.key] = Math.round(metric.value * progress)
      })
      setDisplayValues(newValues)

      if (progress < 1) {
        requestAnimationFrame(animateMetrics)
      }
    }

    animateMetrics()
  }, [])

  return (
    <div className="card ai-analysis-card">
      <div className="card-header">
        <h3 className="card-title">AI Analysis Overview</h3>
        <button className="card-action cursor-pointer" onClick={() => navigate('/ai-analysis')}>
          View details
        </button>
      </div>

      <div className="analysis-content">
        <div className="analysis-score-section">
          <AnimatedProgressRing percentage={84} size={120} strokeWidth={10} />
        </div>

        <div className="analysis-bars-section">
          {metrics.map((metric) => (
            <div key={metric.key} className="metric-bar-container">
              <div className="metric-label">
                <span className="metric-name">{metric.name}</span>
                <span className="metric-value">{displayValues[metric.key]}%</span>
              </div>
              <div className="metric-bar-background">
                <div
                  className="metric-bar-fill"
                  style={{
                    width: `${displayValues[metric.key]}%`,
                    transition: 'width 50ms linear',
                  }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
