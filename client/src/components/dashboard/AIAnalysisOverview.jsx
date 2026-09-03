import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, RefreshCw, Brain } from 'lucide-react'
import api from '../../api/axios'
import AnimatedProgressRing from './AnimatedProgressRing'
import { CardSkeleton } from './SkeletonLoader'

export default function AIAnalysisOverview() {
  const navigate = useNavigate()
  const [analysis, setAnalysis] = useState(null)
  const [overallScore, setOverallScore] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [displayValues, setDisplayValues] = useState({})

  const fetchAnalysis = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.get('/students/my-reports')
      const reports = res.data.reports || []
      // Find the latest report that has AI analysis
      const reportWithAnalysis = reports.find((r) => r.aiAnalysis && r.aiScore != null)
      if (reportWithAnalysis) {
        setAnalysis(reportWithAnalysis.aiAnalysis)
        setOverallScore(Math.round((reportWithAnalysis.aiScore / 10) * 100))
      } else {
        setAnalysis(null)
        setOverallScore(0)
      }
    } catch (err) {
      console.error('Fetch AI analysis error:', err)
      setError('Unable to load AI analysis.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAnalysis()
  }, [])

  // Extract metrics from aiAnalysis JSON
  const metrics = React.useMemo(() => {
    if (!analysis) return []
    // Support both formats: { metrics: { structure: 85, ... } } or { structure: 85, ... }
    const source = analysis.metrics || analysis
    const keys = ['structure', 'clarity', 'grammar', 'originality', 'references']
    return keys
      .filter((key) => source[key] != null)
      .map((key) => ({
        name: key.charAt(0).toUpperCase() + key.slice(1),
        value: typeof source[key] === 'number' ? source[key] : parseInt(source[key]) || 0,
        key,
      }))
  }, [analysis])

  // Animate metric values
  useEffect(() => {
    if (metrics.length === 0) return

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
  }, [metrics])

  if (loading) {
    return (
      <div className="card ai-analysis-card flex flex-col min-h-[300px]">
        <div className="card-header">
          <h3 className="card-title">AI Analysis Overview</h3>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-3 border-orange-500 border-t-transparent" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="card ai-analysis-card flex flex-col min-h-[300px]">
        <div className="card-header">
          <h3 className="card-title">AI Analysis Overview</h3>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <AlertCircle size={24} style={{ color: '#ef4444' }} />
          <p className="text-sm mt-2" style={{ color: '#ef4444' }}>{error}</p>
          <button
            onClick={fetchAnalysis}
            className="mt-2 flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg cursor-pointer"
            style={{ color: 'var(--orange-3)', backgroundColor: 'rgba(245,166,35,0.1)' }}
          >
            <RefreshCw size={12} /> Try Again
          </button>
        </div>
      </div>
    )
  }

  if (!analysis || metrics.length === 0) {
    return (
      <div className="card ai-analysis-card flex flex-col min-h-[300px]">
        <div className="card-header">
          <h3 className="card-title">AI Analysis Overview</h3>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <Brain size={32} style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm mt-3" style={{ color: 'var(--text-muted)' }}>No AI analysis available</p>
        </div>
      </div>
    )
  }

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
          <AnimatedProgressRing percentage={overallScore} size={120} strokeWidth={10} />
        </div>

        <div className="analysis-bars-section">
          {metrics.map((metric) => (
            <div key={metric.key} className="metric-bar-container">
              <div className="metric-label">
                <span className="metric-name">{metric.name}</span>
                <span className="metric-value">{displayValues[metric.key] || 0}%</span>
              </div>
              <div className="metric-bar-background">
                <div
                  className="metric-bar-fill"
                  style={{
                    width: `${displayValues[metric.key] || 0}%`,
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
