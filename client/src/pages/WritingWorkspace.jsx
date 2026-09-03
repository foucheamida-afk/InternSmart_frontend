import { useEffect, useRef, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import { Node, mergeAttributes } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Collaboration from '@tiptap/extension-collaboration'
import Underline from '@tiptap/extension-underline'
import * as Y from 'yjs'
import { IndexeddbPersistence } from 'y-indexeddb'
import { HocuspocusProvider } from '@hocuspocus/provider'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import { useLocation, useNavigate } from 'react-router-dom'
import api from '../api/axios'
import { ArrowLeft, Bold, Check, ChevronDown, Download, FileText, Italic, List, ListOrdered, Lock, MessageSquare, PanelRight, Plus, Quote, Redo2, Save, Strikethrough, Underline as UnderlineIcon, Undo2, Wifi } from 'lucide-react'
import '../assets/css/writing-workspace.css'
import '../assets/css/writing-pagination.css'
import '../assets/css/writing-review.css'

const DOCUMENT_PREFIX = 'internsmart-report-v2-'

const PageBreak = Node.create({
  name: 'pageBreak',
  group: 'block',
  atom: true,
  selectable: true,
  parseHTML: () => [{ tag: 'div[data-page-break]' }],
  renderHTML: ({ HTMLAttributes }) => ['div', mergeAttributes(HTMLAttributes, { 'data-page-break': '' }), 'Page break'],
  addCommands() {
    return { insertPageBreak: () => ({ commands }) => commands.insertContent({ type: this.name }) }
  },
})

const ToolbarButton = ({ label, onClick, active, children, disabled = false }) => (
  <button type="button" className={`writing-tool ${active ? 'is-active' : ''}`} onClick={onClick} disabled={disabled} aria-label={label} title={label}>{children}</button>
)

export default function WritingWorkspace() {
  const navigate = useNavigate()
  const paperRef = useRef(null)
  const location = useLocation()
  const [reportId, setReportId] = useState(new URLSearchParams(location.search).get('reportId'))
  const [report, setReport] = useState(null)
  const [comments, setComments] = useState([])
  const [commentSection, setCommentSection] = useState('General')
  const [commentBody, setCommentBody] = useState('')
  const [workspaceError, setWorkspaceError] = useState('')
  const [title, setTitle] = useState('')
  const [isReadOnly, setIsReadOnly] = useState(false)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [savedAt, setSavedAt] = useState(null)
  const [pageCount, setPageCount] = useState(1)
  const [document] = useState(() => new Y.Doc())
  const storageKey = `${DOCUMENT_PREFIX}${reportId || 'new'}`

  const editor = useEditor({
    extensions: [StarterKit.configure({ history: false }), Underline, PageBreak, Collaboration.configure({ document })],
    content: null,
    editable: !isReadOnly,
    editorProps: { attributes: { class: 'writing-editor' } },
    onUpdate: () => {
      setSavedAt(new Date())
      setPageCount(Math.max(1, Math.ceil((paperRef.current?.scrollHeight || 1123) / 1123)))
      if (reportId && !isReadOnly) api.put(`/workspace/reports/${reportId}/workspace`, { documentContent: editor?.getJSON() }).catch(() => {})
    },
  })

  useEffect(() => {
    const loadWorkspace = async (id) => {
      try {
        const { data } = await api.get(`/workspace/reports/${id}/workspace`)
        setReportId(id)
        setReport(data.report)
        setComments(data.comments || [])
        setTitle(data.report.title || '')
        setIsReadOnly(Boolean(data.readOnly))
        if (data.report.documentContent && editor) editor.commands.setContent(data.report.documentContent)
      } catch (error) {
        setWorkspaceError(error.response?.data?.message || 'Unable to load this report workspace.')
      }
    }
    if (reportId) { loadWorkspace(reportId); return }
    api.get('/students/my-reports').then(({ data }) => {
      const first = data.reports?.[0]
      if (first?.id) loadWorkspace(first.id)
      else setWorkspaceError('No report is available to edit yet.')
    }).catch(() => setWorkspaceError('Unable to load your reports.'))
  }, [editor, reportId])

  useEffect(() => {
    const persistence = new IndexeddbPersistence(storageKey, document)
    const collaborationUrl = import.meta.env.VITE_HOCUSPOCUS_URL
    const provider = collaborationUrl ? new HocuspocusProvider({ url: collaborationUrl, name: storageKey, document }) : null
    return () => { persistence.destroy(); provider?.destroy() }
  }, [document, storageKey])

  useEffect(() => { editor?.setEditable(!isReadOnly) }, [editor, isReadOnly])

  useEffect(() => {
    const markOnline = () => setIsOnline(true)
    const markOffline = () => setIsOnline(false)
    window.addEventListener('online', markOnline)
    window.addEventListener('offline', markOffline)
    return () => { window.removeEventListener('online', markOnline); window.removeEventListener('offline', markOffline) }
  }, [])

  const exportPdf = async () => {
    if (!paperRef.current) return
    const canvas = await html2canvas(paperRef.current, { scale: 2, backgroundColor: '#ffffff', windowWidth: paperRef.current.scrollWidth })
    const pdf = new jsPDF('p', 'mm', 'a4')
    const pageHeight = Math.round(canvas.width * 297 / 210)
    for (let top = 0; top < canvas.height; top += pageHeight) {
      if (top > 0) pdf.addPage()
      const pageCanvas = document.createElement('canvas')
      pageCanvas.width = canvas.width
      pageCanvas.height = Math.min(pageHeight, canvas.height - top)
      pageCanvas.getContext('2d').drawImage(canvas, 0, top, canvas.width, pageCanvas.height, 0, 0, canvas.width, pageCanvas.height)
      pdf.addImage(pageCanvas.toDataURL('image/png'), 'PNG', 0, 0, 210, 297 * pageCanvas.height / pageHeight)
    }
    pdf.save(`${title || 'internship-report'}.pdf`)
  }

  const insertBlankPage = () => editor?.chain().focus().insertPageBreak().insertPageBreak().run()

  const addComment = async () => {
    if (!reportId || !commentBody.trim()) return
    try {
      const { data } = await api.post(`/workspace/reports/${reportId}/comments`, { section: commentSection, body: commentBody.trim() })
      setComments((current) => [...current, data.comment])
      setCommentBody('')
    } catch (error) { setWorkspaceError(error.response?.data?.message || 'Unable to add comment.') }
  }

  return (
    <main className="writing-shell">
      <header className="writing-topbar">
        <div className="writing-brand-group">
          <button type="button" className="writing-icon-button" onClick={() => navigate('/student/dashboard')} aria-label="Back to dashboard" title="Back to dashboard"><ArrowLeft size={18} /></button>
          <div className="writing-brand-mark"><FileText size={18} /></div>
          <div><div className="writing-brand-name">InternSmart <span>/ Workspace</span></div><div className="writing-save-state">{savedAt ? `Saved ${savedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'All changes saved locally'}</div></div>
        </div>
        <div className="writing-top-actions"><span className={`connection-state ${isOnline ? 'online' : 'offline'}`}><Wifi size={14} /> {isOnline ? 'Online' : 'Offline mode'}</span><button type="button" className="writing-secondary-button" onClick={() => setSavedAt(new Date())}><Save size={15} /> Save</button><button type="button" className="writing-primary-button" onClick={exportPdf}><Download size={15} /> Export PDF</button></div>
      </header>
      <section className="writing-documentbar"><div className="writing-title-wrap"><FileText size={16} /><input value={title} onChange={(event) => setTitle(event.target.value)} aria-label="Document title" /></div><div className="writing-document-meta"><span>Last edited just now</span><span className="meta-divider" /><span>A4 · {pageCount} {pageCount === 1 ? 'page' : 'pages'}</span></div></section>
      <section className="writing-toolbar" aria-label="Document formatting">
        <select className="writing-style-select" aria-label="Text style" onChange={(event) => { const level = Number(event.target.value); level ? editor?.chain().focus().setHeading({ level }).run() : editor?.chain().focus().setParagraph().run() }} defaultValue="0"><option value="0">Normal text</option><option value="1">Heading 1</option><option value="2">Heading 2</option></select><span className="toolbar-divider" />
        <ToolbarButton label="Undo" onClick={() => editor?.chain().focus().undo().run()} disabled={!editor?.can().undo()}><Undo2 size={17} /></ToolbarButton><ToolbarButton label="Redo" onClick={() => editor?.chain().focus().redo().run()} disabled={!editor?.can().redo()}><Redo2 size={17} /></ToolbarButton><span className="toolbar-divider" />
        <ToolbarButton label="Bold" active={editor?.isActive('bold')} onClick={() => editor?.chain().focus().toggleBold().run()}><Bold size={17} /></ToolbarButton><ToolbarButton label="Italic" active={editor?.isActive('italic')} onClick={() => editor?.chain().focus().toggleItalic().run()}><Italic size={17} /></ToolbarButton><ToolbarButton label="Underline" active={editor?.isActive('underline')} onClick={() => editor?.chain().focus().toggleUnderline().run()}><UnderlineIcon size={17} /></ToolbarButton><ToolbarButton label="Strikethrough" active={editor?.isActive('strike')} onClick={() => editor?.chain().focus().toggleStrike().run()}><Strikethrough size={17} /></ToolbarButton><span className="toolbar-divider" /><ToolbarButton label="Bullet list" active={editor?.isActive('bulletList')} onClick={() => editor?.chain().focus().toggleBulletList().run()}><List size={18} /></ToolbarButton><ToolbarButton label="Numbered list" active={editor?.isActive('orderedList')} onClick={() => editor?.chain().focus().toggleOrderedList().run()}><ListOrdered size={18} /></ToolbarButton><ToolbarButton label="Block quote" active={editor?.isActive('blockquote')} onClick={() => editor?.chain().focus().toggleBlockquote().run()}><Quote size={17} /></ToolbarButton><span className="toolbar-divider" /><ToolbarButton label="Insert page break" onClick={() => editor?.chain().focus().insertPageBreak().run()}><Plus size={17} /></ToolbarButton><button type="button" className="page-action-button" onClick={insertBlankPage}><FileText size={14} /> Blank page</button><div className="toolbar-spacer" />
        <button type="button" className={`read-only-toggle ${isReadOnly ? 'is-active' : ''}`} onClick={() => setIsReadOnly((value) => !value)}><Lock size={14} /> {isReadOnly ? 'Read only' : 'Editing'} <ChevronDown size={14} /></button>
      </section>
      {workspaceError && <div className="workspace-error">{workspaceError}</div>}
      <div className="writing-body"><div className="paper-stage"><article ref={paperRef} className="a4-paper"><EditorContent editor={editor} /></article></div><aside className="grading-sidebar"><div className="sidebar-heading"><div><span className="sidebar-eyebrow">{isReadOnly ? 'Supervisor review' : 'Report progress'}</span><h2>{report?.title || title}</h2></div><PanelRight size={18} /></div><div className="grade-score"><div className="score-ring"><strong>{report?.progress ?? 0}</strong><span>% complete</span></div><div><strong>{report?.status || 'Draft'}</strong><p>Live progress from this report.</p></div></div><div className="grade-section"><div className="grade-section-title"><span>Section comments</span><span>{comments.length}</span></div>{comments.length ? comments.map((comment) => <div className="comment-item" key={comment.id}><strong>{comment.section}</strong><p>{comment.body}</p><small>{comment.author?.name || 'Supervisor'}</small></div>) : <p className="empty-comments">No supervisor comments yet.</p>}</div>{isReadOnly && <div className="feedback-note"><MessageSquare size={16} /><div><strong>Comment on a section</strong><input value={commentSection} onChange={(event) => setCommentSection(event.target.value)} placeholder="Section name" /><textarea value={commentBody} onChange={(event) => setCommentBody(event.target.value)} placeholder="Write feedback for this section..." rows="4" /><button type="button" className="comment-button" onClick={addComment}><MessageSquare size={15} /> Add comment</button></div></div>}<div className="privacy-note"><Lock size={14} /><span>{isReadOnly ? 'This report is read-only for supervisors.' : 'Only assigned supervisors can review this report.'}</span></div></aside></div>
      <footer className="writing-footer"><span><Check size={14} /> Autosave enabled</span><span>Local document storage · Private by default</span></footer>
    </main>
  )
}