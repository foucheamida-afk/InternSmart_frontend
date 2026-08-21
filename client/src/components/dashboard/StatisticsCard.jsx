import React, { useState, useEffect } from 'react'
import AnimatedProgressRing from './AnimatedProgressRing'

export default function StatisticsCard({ title, value, change, icon: Icon, type = 'default', onClick }) {
  const [displayValue, setDisplayValue] = useState('0')

  useEffect(() => {
    if (type === 'score') {
      let current = 0
      const target = parseFloat(value)
      const interval = setInterval(() => {
        if (current < target) {
          current += 0.1
          setDisplayValue(Math.min(current, target).toFixed(1))
        } else {
          clearInterval(interval)
        }
      }, 30)
      return () => clearInterval(interval)
    } else {
      setDisplayValue(value)
    }
  }, [value, type])

  const renderChart = () => {
    if (type === 'progress') {
      const points = [
        { x: 0, y: 15 },
        { x: 15, y: 12 },
        { x: 30, y: 18 },
        { x: 45, y: 8 },
        { x: 60, y: 10 },
        { x: 75, y: 5 },
        { x: 90, y: 2 },
        { x: 105, y: 0 },
      ]
      const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')

      return (
        <svg className="stats-card-chart" viewBox="0 0 110 20" preserveAspectRatio="none">
          <defs>
            <linearGradient id="chartGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="var(--orange)" />
              <stop offset="100%" stopColor="var(--orange-2)" />
            </linearGradient>
          </defs>
          <path d={pathData} stroke="url(#chartGradient)" strokeWidth="2" fill="none" vectorEffect="non-scaling-stroke" />
        </svg>
      )
    }

    if (type === 'score') {
      const points = [
        { x: 0, y: 8 },
        { x: 15, y: 6 },
        { x: 30, y: 7 },
        { x: 45, y: 5 },
        { x: 60, y: 4 },
        { x: 75, y: 2 },
        { x: 90, y: 0 },
        { x: 105, y: 1 },
      ]
      const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')

      return (
        <svg className="stats-card-chart" viewBox="0 0 110 20" preserveAspectRatio="none">
          <defs>
            <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="rgba(255, 122, 0, 0.6)" />
              <stop offset="100%" stopColor="rgba(255, 122, 0, 0.2)" />
            </linearGradient>
          </defs>
          <path
            d={pathData}
            stroke="url(#scoreGradient)"
            strokeWidth="2"
            fill="none"
            vectorEffect="non-scaling-stroke"
            opacity="0.7"
          />
        </svg>
      )
    }

    // Default chart for other types
    const points = [
      { x: 0, y: 12 },
      { x: 15, y: 10 },
      { x: 30, y: 13 },
      { x: 45, y: 6 },
      { x: 60, y: 8 },
      { x: 75, y: 3 },
      { x: 90, y: 5 },
      { x: 105, y: 1 },
    ]
    const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')

    return (
      <svg className="stats-card-chart" viewBox="0 0 110 20" preserveAspectRatio="none">
        <defs>
          <linearGradient id="defaultGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(255, 122, 0, 0.5)" />
            <stop offset="100%" stopColor="rgba(255, 122, 0, 0.1)" />
          </linearGradient>
        </defs>
        <path d={pathData} stroke="url(#defaultGradient)" strokeWidth="2" fill="none" vectorEffect="non-scaling-stroke" />
      </svg>
    )
  }

  return (
    <div
      className={`stats-card ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="stats-card-header">
        <span className="stats-card-title">{title}</span>
        <Icon className="stats-card-icon" size={20} />
      </div>

      <div className="stats-card-value">{displayValue}</div>

      <div className="stats-card-change">{change}</div>

      {renderChart()}
    </div>
  )
}
