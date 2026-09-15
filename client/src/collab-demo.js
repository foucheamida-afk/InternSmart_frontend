import * as Y from 'yjs'
import { HocuspocusProvider } from '@hocuspocus/provider'

// Dev-only connection test for the collaboration server.
// Two independent Yjs clients join the same document over the real WebSocket
// server. Typing in either pane appears in the other - that is the whole point.

const status = (id, text, cls) => {
  const el = document.getElementById(id)
  if (!el) return
  el.textContent = text
  el.className = cls || ''
}

const build = (paneId, statusId, label, token, cfg) => {
  const doc = new Y.Doc()
  const provider = new HocuspocusProvider({
    url: cfg.url,
    name: cfg.documentName,
    document: doc,
    token,
  })

  const textarea = document.getElementById(paneId)
  const ytext = doc.getText('content')

  ytext.observe(() => {
    const value = ytext.toString()
    if (textarea.value !== value) textarea.value = value
  })

  textarea.addEventListener('input', () => {
    doc.transact(() => {
      ytext.delete(0, ytext.length)
      ytext.insert(0, textarea.value)
    })
  })

  provider.on('synced', () => {
    textarea.value = ytext.toString()
    status(statusId, `${label}: connected - live`, 'ok')
  })
  provider.on('authenticationFailed', (data) => {
    status(statusId, `${label}: refused (${data?.reason || 'denied'})`, 'bad')
  })
  provider.on('status', ({ status: s }) => {
    if (s === 'disconnected') status(statusId, `${label}: disconnected`, 'warn')
  })

  return provider
}

const main = async () => {
  const res = await fetch('/collab-demo-tokens.json')
  const cfg = await res.json()

  document.getElementById('meta').textContent =
    `${cfg.url}  /  document ${cfg.documentName}  (report id ${cfg.reportId})`

  build('student-pane', 'student-status', 'Student', cfg.studentToken, cfg)
  build('supervisor-pane', 'supervisor-status', 'Supervisor', cfg.supervisorToken, cfg)
}

main().catch((err) => {
  document.getElementById('meta').textContent = `Failed to start: ${err.message}`
})
