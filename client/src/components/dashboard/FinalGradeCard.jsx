import React, { useState, useEffect } from 'react'
import { GraduationCap, Trophy } from 'lucide-react'
import { studentDashboardService } from '../../services/api'

export default function FinalGradeCard() {
  const [grades, setGrades] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchGrade = async () => {
      try {
        const data = await studentDashboardService.fetchFinalGrade()
        setGrades(data.grade || null)
      } catch (err) {
        console.error('Fetch final grade error:', err)
        setError('Unable to load your final grade')
      } finally {
        setLoading(false)
      }
    }
    fetchGrade()
  }, [])

  if (loading) {
    return (
      <div className="card p-5 flex flex-col min-h-[220px]">
        <div className="card-header"><h3 className="card-title">Final Grades</h3></div>
        <div className="flex-1 flex items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-3 border-orange-500 border-t-transparent" />
        </div>
      </div>
    )
  }

  const academic = grades?.academic
  const professional = grades?.professional

  const isAcademicSubmitted = academic?.gradeStatus === 'submitted' && academic?.finalGrade != null
  const isProfessionalSubmitted = professional?.gradeStatus === 'submitted' && professional?.finalGrade != null

  const academicMaxTotal = academic?.maxTotal || 20
  const academicTotal = academic?.finalGrade ?? 0
  const academicPercent = academicMaxTotal ? Math.round((academicTotal / academicMaxTotal) * 100) : 0

  const professionalMaxTotal = professional?.maxTotal || 10
  const professionalTotal = professional?.finalGrade ?? 0
  const professionalPercent = professionalMaxTotal ? Math.round((professionalTotal / professionalMaxTotal) * 100) : 0

  return (
    <div className="card p-5 flex flex-col">
      <div className="card-header">
        <h3 className="card-title">Final Grades</h3>
      </div>

      <div className="mt-4 space-y-6">
        {/* Academic Supervisor Grade (20%) */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              Academic Supervisor (20%)
            </span>
            {isAcademicSubmitted && (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider border" style={{
                backgroundColor: 'rgba(99, 102, 241, 0.12)',
                color: '#a5b4fc',
                borderColor: 'rgba(99, 102, 241, 0.3)',
              }}>
                Submitted
              </span>
            )}
          </div>

          {isAcademicSubmitted ? (
            <>
              <div className="flex items-end gap-2">
                <span className="text-3xl font-bold" style={{ color: '#a5b4fc' }}>{academicTotal}</span>
                <span className="text-lg mb-1" style={{ color: 'var(--text-muted)' }}>/ {academicMaxTotal}</span>
                <span className="text-sm mb-1 ml-1" style={{ color: 'var(--text-soft)' }}>({academicPercent}%)</span>
              </div>

              {academic.breakdown && academic.breakdown.length > 0 && (
                <div className="mt-3 space-y-2">
                  {academic.breakdown.map((item, index) => {
                    const itemPercent = item.max ? Math.round((item.score / item.max) * 100) : 0
                    return (
                      <div key={index}>
                        <div className="flex items-center justify-between text-xs" style={{ color: 'var(--text-soft)' }}>
                          <span>{item.label}</span>
                          <span style={{ color: 'var(--text-muted)' }}>{item.score}/{item.max}</span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${itemPercent}%`, background: 'linear-gradient(to right, #6366f1, #818cf8)' }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              <div className="mt-3 flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                <Trophy size={14} style={{ color: '#a5b4fc' }} />
                Submitted {academic.gradeSubmittedAt ? new Date(academic.gradeSubmittedAt).toLocaleDateString() : ''}
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>
              <GraduationCap size={16} />
              <span>Not submitted yet</span>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="border-t" style={{ borderColor: 'var(--line)' }} />

        {/* Professional Supervisor Grade (10%) */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              Professional Supervisor (10%)
            </span>
            {isProfessionalSubmitted && (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider border" style={{
                backgroundColor: 'rgba(16, 185, 129, 0.12)',
                color: '#6ee7b7',
                borderColor: 'rgba(16, 185, 129, 0.3)',
              }}>
                Submitted
              </span>
            )}
          </div>

          {isProfessionalSubmitted ? (
            <>
              <div className="flex items-end gap-2">
                <span className="text-3xl font-bold" style={{ color: '#6ee7b7' }}>{professionalTotal}</span>
                <span className="text-lg mb-1" style={{ color: 'var(--text-muted)' }}>/ {professionalMaxTotal}</span>
                <span className="text-sm mb-1 ml-1" style={{ color: 'var(--text-soft)' }}>({professionalPercent}%)</span>
              </div>

              {professional.breakdown && professional.breakdown.length > 0 && (
                <div className="mt-3 space-y-2">
                  {professional.breakdown.map((item, index) => {
                    const itemPercent = item.max ? Math.round((item.score / item.max) * 100) : 0
                    return (
                      <div key={index}>
                        <div className="flex items-center justify-between text-xs" style={{ color: 'var(--text-soft)' }}>
                          <span>{item.label}</span>
                          <span style={{ color: 'var(--text-muted)' }}>{item.score}/{item.max}</span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${itemPercent}%`, background: 'linear-gradient(to right, #10b981, #34d399)' }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              <div className="mt-3 flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                <Trophy size={14} style={{ color: '#6ee7b7' }} />
                Submitted {professional.gradeSubmittedAt ? new Date(professional.gradeSubmittedAt).toLocaleDateString() : ''}
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>
              <GraduationCap size={16} />
              <span>Not submitted yet</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
