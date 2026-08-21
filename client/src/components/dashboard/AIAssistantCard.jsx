import React, { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Brain, ArrowRight } from 'lucide-react'

export default function AIAssistantCard() {
  const navigate = useNavigate()
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * window.devicePixelRatio
    canvas.height = rect.height * window.devicePixelRatio
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio)

    const width = rect.width
    const height = rect.height

    // Create nodes
    const nodes = [
      // Center cluster
      { x: width / 2, y: height / 2, r: 4, vx: 0.5, vy: 0.3 },
      { x: width / 2 - 30, y: height / 2 - 20, r: 3, vx: -0.3, vy: 0.4 },
      { x: width / 2 + 30, y: height / 2 - 20, r: 3, vx: 0.3, vy: 0.4 },
      { x: width / 2 - 25, y: height / 2 + 25, r: 3, vx: -0.2, vy: -0.3 },
      { x: width / 2 + 25, y: height / 2 + 25, r: 3, vx: 0.2, vy: -0.3 },
      // Outer nodes
      { x: width / 2 - 50, y: height / 2, r: 2, vx: 0.2, vy: -0.2 },
      { x: width / 2 + 50, y: height / 2, r: 2, vx: -0.2, vy: 0.2 },
      { x: width / 2, y: height / 2 - 40, r: 2, vx: 0.1, vy: 0.3 },
      { x: width / 2, y: height / 2 + 40, r: 2, vx: -0.1, vy: -0.3 },
    ]

    const connections = [
      [0, 1],
      [0, 2],
      [0, 3],
      [0, 4],
      [0, 5],
      [0, 6],
      [0, 7],
      [0, 8],
      [1, 2],
      [1, 3],
      [2, 4],
      [3, 4],
      [5, 1],
      [6, 2],
      [7, 3],
      [8, 4],
    ]

    let animationId
    const animate = () => {
      // Clear canvas
      ctx.fillStyle = 'transparent'
      ctx.clearRect(0, 0, width, height)

      // Update node positions
      nodes.forEach((node) => {
        node.x += node.vx
        node.y += node.vy

        // Bounce off edges
        if (node.x - node.r < 0 || node.x + node.r > width) node.vx *= -1
        if (node.y - node.r < 0 || node.y + node.r > height) node.vy *= -1

        // Keep in bounds
        node.x = Math.max(node.r, Math.min(width - node.r, node.x))
        node.y = Math.max(node.r, Math.min(height - node.r, node.y))
      })

      // Draw connections
      connections.forEach(([from, to]) => {
        const node1 = nodes[from]
        const node2 = nodes[to]

        ctx.strokeStyle = `rgba(255, 122, 0, 0.2)`
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(node1.x, node1.y)
        ctx.lineTo(node2.x, node2.y)
        ctx.stroke()
      })

      // Draw nodes with glow
      nodes.forEach((node) => {
        // Glow
        const gradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, node.r * 3)
        gradient.addColorStop(0, `rgba(255, 122, 0, 0.4)`)
        gradient.addColorStop(1, `rgba(255, 122, 0, 0)`)
        ctx.fillStyle = gradient
        ctx.fillRect(node.x - node.r * 3, node.y - node.r * 3, node.r * 6, node.r * 6)

        // Node
        ctx.fillStyle = `rgba(255, 122, 0, 0.8)`
        ctx.beginPath()
        ctx.arc(node.x, node.y, node.r, 0, Math.PI * 2)
        ctx.fill()
      })

      animationId = requestAnimationFrame(animate)
    }

    animate()
    return () => cancelAnimationFrame(animationId)
  }, [])

  return (
    <div className="card ai-assistant-card">
      <div className="card-header">
        <div>
          <h3 className="card-title">AI Assistant</h3>
          <p className="assistant-subtitle">Need help improving your report?</p>
        </div>
      </div>

      <div className="assistant-content">
        <div className="assistant-text-section">
          <p className="assistant-description">
            I can help you understand suggestions, improve your writing, and prepare for your defense.
          </p>

          <button className="assistant-btn cursor-pointer" onClick={() => navigate('/ai-analysis')}>
            Ask AI Assistant
            <ArrowRight size={16} />
          </button>
        </div>

        <div className="assistant-visualization">
          <canvas ref={canvasRef} className="neural-network-canvas"></canvas>
        </div>
      </div>
    </div>
  )
}
