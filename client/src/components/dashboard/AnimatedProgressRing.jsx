import React, { useEffect, useState } from 'react'

export default function AnimatedProgressRing({ percentage = 68, size = 120, strokeWidth = 8 }) {
  const [displayPercentage, setDisplayPercentage] = useState(0)
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (displayPercentage / 100) * circumference

  useEffect(() => {
    let animationFrame
    let currentPercentage = 0

    const animate = () => {
      if (currentPercentage < percentage) {
        currentPercentage += percentage / 60
        setDisplayPercentage(Math.min(currentPercentage, percentage))
        animationFrame = requestAnimationFrame(animate)
      }
    }

    animationFrame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animationFrame)
  }, [percentage])

  return (
    <div className="progress-ring-container">
      <svg width={size} height={size} className="progress-ring-svg">
        {/* Background ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255, 255, 255, 0.08)"
          strokeWidth={strokeWidth}
        />
        {/* Progress ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#progressGradient)"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="progress-ring"
          style={{
            transition: 'stroke-dashoffset 50ms linear',
          }}
        />
        <defs>
          <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--orange)" />
            <stop offset="100%" stopColor="var(--orange-2)" />
          </linearGradient>
        </defs>
      </svg>
      <div className="progress-ring-text">
        <div className="progress-ring-value">{Math.round(displayPercentage)}%</div>
      </div>
    </div>
  )
}
