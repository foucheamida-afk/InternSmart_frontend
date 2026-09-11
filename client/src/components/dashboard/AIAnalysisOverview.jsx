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

      {(analysis.suggestions?.some((item) => item.type !== 'positive') || analysis.generalFeedback?.length) && (
        <div className="mt-4 border-t pt-4" style={{ borderColor: 'var(--line)' }}>
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="text-xs font-semibold" style={{ color: 'var(--text)' }}>Corrections to review</span>
            {analysis.issueCounts && (
              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                {analysis.issueCounts.high || 0} high · {analysis.issueCounts.medium || 0} medium · {analysis.issueCounts.low || 0} low
              </span>
            )}
          </div>
          <div className="space-y-3">
            {(analysis.suggestions || []).filter((item) => item.type !== 'positive').slice(0, 3).map((item) => (
              <div key={item.id || item.title} className="rounded-lg border p-3" style={{ borderColor: 'var(--line)', backgroundColor: 'var(--bg-panel)' }}>
                <div className="flex items-start justify-between gap-2">
                  <strong className="text-xs" style={{ color: 'var(--text)' }}>{item.title || 'Issue'}</strong>
                  <span className="text-[10px] uppercase font-semibold" style={{ color: item.type === 'high' ? '#ef4444' : item.type === 'medium' ? '#d97706' : 'var(--text-muted)' }}>{item.type || 'review'}</span>
                </div>
                {item.location && <p className="text-[10px] mt-1" style={{ color: 'var(--orange-3)' }}>Where: {item.location}</p>}
                {item.originalText && <p className="text-[11px] mt-1 italic" style={{ color: 'var(--text-muted)' }}>&quot;{item.originalText}&quot;</p>}
                {item.suggestion && <p className="text-[11px] mt-1 leading-relaxed" style={{ color: 'var(--text-soft)' }}>Do this: {item.suggestion}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
