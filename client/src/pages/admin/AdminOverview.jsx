import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users,
  Shield,
  Briefcase,
  Bell,
  LayoutDashboard,
  BarChart3,
  ChevronDown,
  Upload,
} from 'lucide-react'
import { adminApi } from '../../services/adminService'
import useCountUp from '../../hooks/useCountUp'

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

const KpiCard = ({ label, value, icon: Icon, accent = false, onClick }) => {
  const animatedValue = useCountUp(typeof value === 'number' ? value : 0, 900)

  const content = (
    <div className="rounded-2xl border p-5 transition-all hover:border-orange-500/30" style={{
      backgroundColor: 'var(--bg-panel)',
      borderColor: 'var(--line)',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)'
    }}>
      <div className="flex items-center justify-between">
        <div className="text-[11px] uppercase tracking-[0.18em]" style={{ color: 'var(--text-muted)' }}>{label}</div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border" style={{
          backgroundColor: accent ? 'rgba(255, 122, 0, 0.12)' : 'rgba(255, 255, 255, 0.04)',
          borderColor: accent ? 'rgba(255, 122, 0, 0.25)' : 'var(--line)',
          color: accent ? 'var(--orange-3)' : 'var(--text-muted)'
        }}>
          <Icon size={20} />
        </div>
      </div>
      <div className={`mt-4 text-3xl font-semibold tracking-[-0.05em]`} style={{ color: accent ? 'var(--orange-3)' : 'var(--text)' }}>
        {animatedValue}
      </div>
    </div>
  )

  if (onClick) {
    return (
      <div onClick={onClick} className="cursor-pointer">
        {content}
      </div>
    )
  }
  return content
}

const RANGE_OPTIONS = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
  { value: 'semester', label: 'This Semester' },
]

const METRIC_OPTIONS = [
  { value: 'internships', label: 'Internships' },
  { value: 'users', label: 'Users' },
  { value: 'ai', label: 'AI Analysis' },
]

function SimpleBarChart({ data, metric }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-sm" style={{ color: 'var(--text-muted)' }}>
        No data available for the selected range
      </div>
    )
  }

  const values = data.map(d => Number(d.count || d.avgScore || 0))
  const maxValue = Math.max(...values, 1)
  const width = 800
  const height = 300
  const padding = { top: 20, right: 20, bottom: 40, left: 40 }
  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom
  const barWidth = Math.min(40, (chartWidth / data.length) * 0.7)
  const gap = (chartWidth - barWidth * data.length) / (data.length - 1 || 1)

  const formatLabel = (dateStr) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(date)
  }

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-64" preserveAspectRatio="xMidYMid meet">
        {values.map((val, i) => {
          const barHeight = (val / maxValue) * chartHeight
          const x = padding.left + i * (barWidth + gap)
          const y = padding.top + chartHeight - barHeight
          return (
            <g key={i}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                rx={4}
                fill="url(#orangeGradient)"
                style={{ filter: 'drop-shadow(0 4px 6px rgba(255, 122, 0, 0.25))' }}
              />
              <text
                x={x + barWidth / 2}
                y={padding.top + chartHeight + 16}
                textAnchor="middle"
                fill="var(--text-muted)"
                fontSize="10"
              >
                {formatLabel(data[i].date)}
              </text>
              <text
                x={x + barWidth / 2}
                y={y - 8}
                textAnchor="middle"
                fill="var(--text)"
                fontSize="10"
                fontWeight="600"
              >
                {metric === 'ai' ? Number(val).toFixed(1) : val}
              </text>
            </g>
          )
        })}
        <defs>
          <linearGradient id="orangeGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--orange)" />
            <stop offset="100%" stopColor="var(--orange-3)" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  )
}

export default function AdminOverview() {
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [chartData, setChartData] = useState([])
  const [chartLoading, setChartLoading] = useState(true)
  const [metric, setMetric] = useState('reports')
  const [range, setRange] = useState('30d')

  useEffect(() => {
    adminApi.getDashboardStats()
      .then(data => {
        setStats(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    setChartLoading(true)
    adminApi.getChartData({ metric, range })
      .then(res => {
        setChartData(res.data || [])
        setChartLoading(false)
      })
      .catch(() => {
        setChartData([])
        setChartLoading(false)
      })
  }, [metric, range])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-500 border-t-transparent" />
      </div>
    )
  }

  const kpis = stats ? [
    { label: 'Total Students', value: stats.totalStudents, icon: Users, href: '/admin/students' },
    { label: 'Active Supervisors', value: stats.totalSupervisors, icon: Shield, href: '/admin/supervisors' },
    { label: 'Active Internships', value: stats.totalInternships, icon: Briefcase, href: '/admin/internships' },
    { label: 'Defense Alerts', value: stats.defenseAlerts, icon: Bell, href: '/admin/defense-alerts' },
  ] : []

  const hasData = stats && kpis.some(k => k.value > 0)

  return (
    <div>
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-[-0.06em]" style={{ color: 'var(--text)' }}>Dashboard</h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
            Platform overview and key metrics.
          </p>
        </div>
        <button
          onClick={() => navigate('/admin/students')}
          className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium shadow-lg transition cursor-pointer"
          style={{
            background: 'linear-gradient(135deg, var(--orange), var(--orange-3))',
            color: 'white',
          }}
        >
          <Upload size={16} />
          Import Students
        </button>
      </div>

      {!hasData ? (
        <div className="rounded-2xl border p-8 text-center" style={{
          backgroundColor: 'var(--bg-panel)',
          borderColor: 'var(--line)'
        }}>
          <EmptyState
            icon={LayoutDashboard}
            title="No data yet"
            description="The platform is empty. Start by creating students, supervisors, and internships from the Users page."
          />
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
            {kpis.map((kpi) => (
              <KpiCard key={kpi.label} {...kpi} onClick={() => navigate(kpi.href)} />
            ))}
          </div>

          <div className="rounded-2xl border p-6" style={{
            backgroundColor: 'var(--bg-panel)',
            borderColor: 'var(--line)'
          }}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border" style={{
                  backgroundColor: 'rgba(255, 122, 0, 0.1)',
                  borderColor: 'rgba(255, 122, 0, 0.25)',
                  color: 'var(--orange-3)'
                }}>
                  <BarChart3 size={20} />
                </div>
                <div>
                  <h2 className="text-base font-bold" style={{ color: 'var(--text)' }}>Platform Overview</h2>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Real-time platform analytics</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={metric}
                  onChange={(e) => setMetric(e.target.value)}
                  className="rounded-xl border px-3 py-2 text-xs focus:outline-none cursor-pointer"
                  style={{
                    backgroundColor: 'var(--bg)',
                    borderColor: 'var(--line)',
                    color: 'var(--text)'
                  }}
                >
                  {METRIC_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <div className="relative">
                  <select
                    value={range}
                    onChange={(e) => setRange(e.target.value)}
                    className="rounded-xl border px-3 py-2 text-xs focus:outline-none cursor-pointer appearance-none pr-8"
                    style={{
                      backgroundColor: 'var(--bg)',
                      borderColor: 'var(--line)',
                      color: 'var(--text)'
                    }}
                  >
                    {RANGE_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
                </div>
              </div>
            </div>

            {chartLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-500 border-t-transparent" />
              </div>
            ) : (
              <SimpleBarChart data={chartData} metric={metric} />
            )}
          </div>
        </>
      )}
    </div>
  )
}
