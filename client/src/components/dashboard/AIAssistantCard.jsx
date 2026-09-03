import React from 'react'
import { Brain } from 'lucide-react'

export default function AIAssistantCard() {
  return (
    <div className="card ai-assistant-card flex flex-col min-h-[250px]">
      <div className="card-header">
        <div>
          <h3 className="card-title">AI Assistant</h3>
          <p className="assistant-subtitle">Need help improving your report?</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
        <Brain size={32} style={{ color: 'var(--text-muted)' }} className="mb-3" />
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          AI suggestions will appear when reports are analyzed
        </p>
      </div>
    </div>
  )
}
