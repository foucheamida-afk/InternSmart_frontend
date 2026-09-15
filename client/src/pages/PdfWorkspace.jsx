import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  AlertTriangle, ArrowLeft, Bold, Check, ChevronLeft, ChevronRight, Columns, Download, Eye,
  FileText, Heading1, Heading2, Italic, Link2, List, ListOrdered, LoaderCircle, MessageSquare,
  Minus, PanelRightClose, PanelRightOpen, PenLine, Quote, Redo2, Save, Send, Strikethrough,
  Table as TableIcon, Trash2, Underline as UnderlineIcon, Undo2, Users, ZoomIn, ZoomOut,
} from 'lucide-react'

import PdfFilePreview from '../components/PdfWorkspace/PdfFilePreview'
import { usePdfCollaboration } from '../components/PdfWorkspace/usePdfCollaboration'
import { buildPdfEditorExtensions } from '../editor/pdfEditorExtensions'
import { sanitizeEditorContent } from '../editor/contentGuards'
import { documentHasContent, outlineFromDocument, renderDocumentToPdf } from '../editor/pdfDocument'
import { getStoredUser } from '../utils/storage'
import {
  addPdfComment,
  deletePdfComment,
  downloadPdfFile,
  getPdfWorkspace,
  savePdfFile,
} from '../services/pdfWorkspaceService'
import '../assets/css/pdf-workspace.css'

/**
 * The PDF writing workspace.
 *
 * A PDF report opened here is an *imported document*: its pages are read into an
 * editable structure, that structure is what everyone edits together, and saving
 * renders it back to PDF and writes it over the stored file. The page shows both
 * halves at once - the file exactly as the server holds it, and the editable text
 * that produces it - because they are one document seen from two sides.
 *
 * What is deliberately absent: any stored copy of the document tree. Only the
 * report's name and file location live in the database, so every session starts
 * from the file itself.
 */

const AUTOSAVE_DELAY = 3000

const ROLE_LABEL = {
  student: 'Student',
  academic_supervisor: 'Academic supervisor',
  professional_supervisor: 'Professional supervisor',
  admin: 'Administrator',
}

const formatWhen = (value) => {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString()
}

const ToolButton = ({ label, onClick, active, disabled, children }) => (
  <button
    type="button"
    className={`pdfw-tool ${active ? 'is-active' : ''}`}
    onClick={onClick}
    disabled={disabled}
    title={label}
    aria-label={label}
  >
    {children}
  </button>
)

/**
 * One editing session over one report.
 *
 * Mounted only once the workspace has loaded, so the collaboration provider is
 * created with the document name already known and the editor is built exactly
 * once against it.
 */
/**
 * The collaborative editor.
 *
 * Deliberately its own component, mounted only once the collaboration provider
 * exists. `CollaborationCaret` reads `provider.awareness` while it is being
 * installed, so building the editor with a null provider throws during
 * construction - before this page can render anything, and before React has a
 * chance to re-render with the real provider. The provider is created in an
 * effect (the right place for an external resource), so a session's first render
 * has none; waiting for it here is what makes the two orders compatible.
 */
const PdfEditableDocument = ({ ydoc, provider, canWrite, userName, onUpdate, onEditorReady }) => {
  const editor = useEditor({
    // The same extension list the schema check in scripts/verifyPdfLayoutSchema.mjs
    // builds, so what that check approves is what runs here.
    extensions: buildPdfEditorExtensions({ ydoc, provider, userName }),
    editable: false,
    editorProps: { attributes: { class: 'pdfw-editor' } },
    onUpdate: ({ editor: instance }) => onUpdate(instance),
  }, [ydoc, provider])

  useEffect(() => {
    if (!editor) return
    editor.setEditable(canWrite, false)
  }, [canWrite, editor])

  useEffect(() => {
    if (!editor) return undefined
    onEditorReady(editor)
    // Publishing null on the way out matters: this component is unmounted when
    // the view switches to the PDF only, and the page must not be left holding a
    // destroyed editor.
    return () => onEditorReady(null)
  }, [editor, onEditorReady])

  return <EditorContent editor={editor} />
}

const PdfWorkspaceSession = ({ workspace, reportId, currentUser, onCommentsChanged }) => {
  const [comments, setComments] = useState(workspace.comments || [])
  const [commentBody, setCommentBody] = useState('')
  const [commentSection, setCommentSection] = useState('General')

  const [revision, setRevision] = useState(workspace.fileRevision)
  const [reloadKey, setReloadKey] = useState(0)
  const [saveStatus, setSaveStatus] = useState(workspace.canWrite ? 'Loaded from the PDF file' : 'Read only')
  const [saveError, setSaveError] = useState('')
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState(null)

  const [zoom, setZoom] = useState(100)
  const [page, setPage] = useState(1)
  const [view, setView] = useState('split') // split | pdf | document
  const [showOutline, setShowOutline] = useState(true)
  const [showComments, setShowComments] = useState(true)
  const [outline, setOutline] = useState([])
  const [notesDismissed, setNotesDismissed] = useState(false)
  // A read-only viewer who arrives before the author: the shared document is
  // still empty, and it is filled from the file by whoever may write. Saying so
  // is better than an editor that looks broken.
  const [awaitingAuthor, setAwaitingAuthor] = useState(false)

  const canWrite = Boolean(workspace.canWrite)
  const canComment = ['academic_supervisor', 'professional_supervisor'].includes(currentUser?.role)
  const authorName = currentUser?.name || ''
  const reportTitle = workspace.report?.title || 'Internship Report'

  const collab = usePdfCollaboration({
    documentName: workspace.collaborationDocument,
    canWrite,
    user: { id: currentUser?.id, name: currentUser?.name || 'Someone', role: currentUser?.role },
  })

  const { ydoc, provider, synced, seedWhenLeader, markSeeded, peers, status, deniedReason } = collab

  const saveTimerRef = useRef(null)
  const savingRef = useRef(false)
  const dirtyRef = useRef(false)
  const autosaveRef = useRef(null)

  // The editor is created by <PdfEditableDocument> and published here, because
  // every action on this page - saving, the toolbar, the outline - needs it.
  const [editor, setEditor] = useState(null)

  const handleEditorUpdate = useCallback((instance) => {
    dirtyRef.current = true
    setDirty(true)
    setSaveStatus('Unsaved changes')
    setOutline(outlineFromDocument(instance.getJSON()))
    autosaveRef.current?.()
  }, [])

  // --- seeding --------------------------------------------------------------
  //
  // A fresh session starts empty, because the server keeps no copy of a PDF's
  // content. The structure read from the file therefore has to be placed into the
  // shared document exactly once, by exactly one client: `seedWhenLeader` is that
  // election (see usePdfCollaboration).

  const structure = workspace.structure
  useEffect(() => {
    if (!editor || !structure || !synced) return undefined

    let cancelled = false

    // Run asynchronously: filling a shared document is coordination with the
    // collaboration server, not a render-phase decision.
    const run = async () => {
      if (ydoc.getXmlFragment('default').length > 0) {
        markSeeded()
        if (!cancelled) {
          setAwaitingAuthor(false)
          setOutline(outlineFromDocument(editor.getJSON()))
        }
        return
      }

      if (!canWrite) {
        if (!cancelled) {
          setAwaitingAuthor(true)
          setSaveStatus('Waiting for the author to open this document…')
        }
        return
      }

      await seedWhenLeader(() => {
        if (cancelled) return
        const { content } = sanitizeEditorContent(structure, editor.schema)
        editor.commands.setContent(content, { emitUpdate: false })
        setOutline(outlineFromDocument(editor.getJSON()))
      })
    }

    run()
    return () => { cancelled = true }
  }, [canWrite, editor, markSeeded, seedWhenLeader, structure, synced, ydoc])

  // --- saving ---------------------------------------------------------------

  const saveNow = useCallback(async ({ manual = false } = {}) => {
    if (!editor || !canWrite || savingRef.current) return null
    if (!dirtyRef.current && !manual) return null

    savingRef.current = true
    setSaving(true)
    setSaveError('')
    setSaveStatus('Saving…')

    try {
      const document = editor.getJSON()
      if (!documentHasContent(document)) {
        dirtyRef.current = false
        setDirty(false)
        setSaveStatus('Nothing to save yet')
        return null
      }

      const blob = renderDocumentToPdf(document, {
        title: reportTitle,
        author: authorName,
      })
      const result = await savePdfFile(reportId, blob)

      setRevision(result.fileRevision)
      setReloadKey((value) => value + 1)
      dirtyRef.current = false
      setDirty(false)
      setLastSavedAt(result.savedAt)
      setSaveStatus('Saved to the PDF file')
      return result
    } catch (error) {
      setSaveError(error?.response?.data?.message || error.message || 'Unable to save this PDF.')
      setSaveStatus('Not saved')
      return null
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }, [authorName, canWrite, editor, reportId, reportTitle])

  useEffect(() => {
    if (!canWrite) return undefined
    autosaveRef.current = () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => { saveNow() }, AUTOSAVE_DELAY)
    }
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      autosaveRef.current = null
    }
  }, [canWrite, saveNow])

  // Whatever is still pending when the page is left is flushed, so navigating
  // away cannot silently discard the last edit.
  useEffect(() => {
    const flush = () => { if (dirtyRef.current) saveNow() }
    window.addEventListener('beforeunload', flush)
    return () => {
      window.removeEventListener('beforeunload', flush)
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      flush()
    }
  }, [saveNow])

  // --- actions --------------------------------------------------------------

  const insertImage = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => editor?.chain().focus().setImage({ src: String(reader.result) }).run()
      reader.readAsDataURL(file)
    }
    input.click()
  }, [editor])

  const addComment = async () => {
    if (!reportId || !commentBody.trim()) return
    try {
      const comment = await addPdfComment(reportId, { section: commentSection, body: commentBody.trim() })
      setComments((current) => [...current, comment])
      setCommentBody('')
      onCommentsChanged?.()
    } catch (error) {
      setSaveError(error?.response?.data?.message || 'Unable to add that comment.')
    }
  }

  const removeComment = async (commentId) => {
    try {
      await deletePdfComment(reportId, commentId)
      setComments((current) => current.filter((comment) => comment.id !== commentId))
      onCommentsChanged?.()
    } catch (error) {
      setSaveError(error?.response?.data?.message || 'Unable to delete that comment.')
    }
  }

  const otherEditors = peers.filter((peer) => peer.clientId !== ydoc.clientID)
  const warnings = workspace.warnings || []
  const showNotes = !notesDismissed
    && (warnings.length > 0 || (canWrite && !lastSavedAt) || Boolean(workspace.report?.locked))

  return (
    <>
      <div className="pdfw-sessionbar">
        <span className={`pdfw-status ${dirty ? 'is-dirty' : ''} ${saveError ? 'is-error' : ''}`}>
          {saveStatus}
          {lastSavedAt && !dirty ? ` · ${formatWhen(lastSavedAt)}` : ''}
        </span>
        <span className="pdfw-spacer" />
        {canWrite && (
          <button type="button" className="pdfw-primary" onClick={() => saveNow({ manual: true })} disabled={saving || !dirty}>
            {saving ? <LoaderCircle size={14} className="animate-spin" /> : <Save size={14} />}
            Save to the PDF file
          </button>
        )}
      </div>

      <div className="pdfw-presence">
        <span className="pdfw-presence-label">
          <Users size={13} /> {1 + otherEditors.length} in this document
        </span>
        <span className="pdfw-presence-me" title="You">
          <PenLine size={12} /> {currentUser?.name || 'You'} (you)
        </span>
        {otherEditors.map((peer) => (
          <span key={`${peer.clientId}-${peer.id}`} className="pdfw-presence-peer" title={ROLE_LABEL[peer.role] || peer.role}>
            {peer.canWrite ? <PenLine size={12} /> : <Eye size={12} />}
            {peer.name}
          </span>
        ))}
        <span className={`pdfw-connection is-${status}`}>
          {status === 'connected' ? 'live' : status}
        </span>
      </div>

      {deniedReason && (
        <div className="pdfw-banner is-error">
          <AlertTriangle size={15} /> Live collaboration was refused: {deniedReason}
        </div>
      )}

      {saveError && (
        <div className="pdfw-banner is-error">
          <AlertTriangle size={15} /> {saveError}
        </div>
      )}

      {showNotes && (
        <div className="pdfw-notes">
          {workspace.report?.locked && (
            <div className="pdfw-note is-warning">
              <AlertTriangle size={14} />
              This report has been finalised, so its file can no longer be changed. You can still read and download it.
            </div>
          )}
          {canWrite && !lastSavedAt && !workspace.report?.locked && (
            <div className="pdfw-note">
              <AlertTriangle size={14} />
              Saving <strong>rewrites this PDF</strong> from the edited text below: the original layout is replaced by an
              A4 layout regenerated from your document. Nothing is written until something changes.
            </div>
          )}
          {warnings.map((warning) => (
            <div key={warning} className="pdfw-note is-muted">{warning}</div>
          ))}
          <button type="button" className="pdfw-note-close" onClick={() => setNotesDismissed(true)} aria-label="Dismiss these notes">
            <Minus size={13} />
          </button>
        </div>
      )}

      <div className={`pdfw-body is-${view}`}>
        {view !== 'pdf' && (
          <aside className="pdfw-outline">
            <button
              type="button"
              className="pdfw-panel-toggle"
              onClick={() => setShowOutline((value) => !value)}
              title={showOutline ? 'Hide the outline' : 'Show the outline'}
            >
              <Columns size={13} /> Outline
            </button>
            {showOutline && (
              <>
                <div className="pdfw-outline-stats">
                  {workspace.pageCount ? `${workspace.pageCount} page${workspace.pageCount === 1 ? '' : 's'}` : 'pages unknown'}
                  {workspace.stats?.figures ? ` · ${workspace.stats.figures} figure${workspace.stats.figures === 1 ? '' : 's'}` : ''}
                  {workspace.stats?.characters ? ` · ${workspace.stats.characters.toLocaleString()} characters` : ''}
                </div>
                <nav className="pdfw-outline-list">
                  {outline.length === 0 && <p className="pdfw-muted">No headings in this document yet.</p>}
                  {outline.map((item, index) => (
                    <button
                      key={`${item.id}-${index}`}
                      type="button"
                      className={`pdfw-outline-item level-${item.level}`}
                      onClick={() => editor?.commands.focus()}
                      title={item.label}
                    >
                      {item.label}
                    </button>
                  ))}
                </nav>
              </>
            )}
          </aside>
        )}

        <main className="pdfw-main">
          <div className="pdfw-toolbar">
            <div className="pdfw-toolbar-group">
              <ToolButton label="Undo" onClick={() => editor?.chain().focus().undo().run()} disabled={!canWrite}><Undo2 size={14} /></ToolButton>
              <ToolButton label="Redo" onClick={() => editor?.chain().focus().redo().run()} disabled={!canWrite}><Redo2 size={14} /></ToolButton>
            </div>
            <div className="pdfw-toolbar-group">
              <ToolButton label="Bold" active={editor?.isActive('bold')} onClick={() => editor?.chain().focus().toggleBold().run()} disabled={!canWrite}><Bold size={14} /></ToolButton>
              <ToolButton label="Italic" active={editor?.isActive('italic')} onClick={() => editor?.chain().focus().toggleItalic().run()} disabled={!canWrite}><Italic size={14} /></ToolButton>
              <ToolButton label="Underline" active={editor?.isActive('underline')} onClick={() => editor?.chain().focus().toggleUnderline().run()} disabled={!canWrite}><UnderlineIcon size={14} /></ToolButton>
              <ToolButton label="Strikethrough" active={editor?.isActive('strike')} onClick={() => editor?.chain().focus().toggleStrike().run()} disabled={!canWrite}><Strikethrough size={14} /></ToolButton>
              <ToolButton label="Highlight" active={editor?.isActive('highlight')} onClick={() => editor?.chain().focus().toggleHighlight({ color: '#fff100' }).run()} disabled={!canWrite}><span className="pdfw-swatch" /></ToolButton>
            </div>
            <div className="pdfw-toolbar-group">
              <ToolButton label="Heading 1" active={editor?.isActive('heading', { level: 1 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()} disabled={!canWrite}><Heading1 size={14} /></ToolButton>
              <ToolButton label="Heading 2" active={editor?.isActive('heading', { level: 2 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} disabled={!canWrite}><Heading2 size={14} /></ToolButton>
              <ToolButton label="Bullet list" active={editor?.isActive('bulletList')} onClick={() => editor?.chain().focus().toggleBulletList().run()} disabled={!canWrite}><List size={14} /></ToolButton>
              <ToolButton label="Numbered list" active={editor?.isActive('orderedList')} onClick={() => editor?.chain().focus().toggleOrderedList().run()} disabled={!canWrite}><ListOrdered size={14} /></ToolButton>
              <ToolButton label="Quote" active={editor?.isActive('blockquote')} onClick={() => editor?.chain().focus().toggleBlockquote().run()} disabled={!canWrite}><Quote size={14} /></ToolButton>
            </div>
            <div className="pdfw-toolbar-group">
              <ToolButton label="Insert table" onClick={() => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} disabled={!canWrite}><TableIcon size={14} /></ToolButton>
              <ToolButton label="Insert image" onClick={insertImage} disabled={!canWrite}><FileText size={14} /></ToolButton>
              <ToolButton
                label="Link"
                onClick={() => {
                  const href = window.prompt('Link address')
                  if (href) editor?.chain().focus().setLink({ href }).run()
                }}
                disabled={!canWrite}
              >
                <Link2 size={14} />
              </ToolButton>
              <ToolButton label="Page break" onClick={() => editor?.chain().focus().insertPageBreak().run()} disabled={!canWrite}><Minus size={14} /></ToolButton>
              {editor?.isActive('table') && (
                <ToolButton label="Delete this table" onClick={() => editor.chain().focus().deleteTable().run()} disabled={!canWrite}><Trash2 size={14} /></ToolButton>
              )}
            </div>
            <div className="pdfw-toolbar-group is-right">
              <div className="pdfw-view-switch">
                <button type="button" className={view === 'split' ? 'is-active' : ''} onClick={() => setView('split')} title="PDF and text side by side"><Columns size={13} /></button>
                <button type="button" className={view === 'pdf' ? 'is-active' : ''} onClick={() => setView('pdf')} title="The PDF only"><Eye size={13} /></button>
                <button type="button" className={view === 'document' ? 'is-active' : ''} onClick={() => setView('document')} title="The editable text only"><PenLine size={13} /></button>
              </div>
              <button
                type="button"
                className="pdfw-panel-toggle"
                onClick={() => setShowComments((value) => !value)}
                title={showComments ? 'Hide comments' : 'Show comments'}
              >
                <MessageSquare size={13} /> {comments.length}
                {showComments ? <PanelRightClose size={12} /> : <PanelRightOpen size={12} />}
              </button>
            </div>
          </div>

          <div className="pdfw-panes">
            {view !== 'document' && (
              <section className="pdfw-pane is-pdf">
                <div className="pdfw-pane-toolbar">
                  <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} title="Previous page"><ChevronLeft size={14} /></button>
                  <input
                    type="number"
                    min={1}
                    value={page}
                    onChange={(event) => setPage(Math.max(1, Number(event.target.value) || 1))}
                    className="pdfw-page-input"
                    aria-label="Page"
                  />
                  <span className="pdfw-muted">/ {workspace.pageCount || '?'}</span>
                  <button type="button" onClick={() => setPage((value) => value + 1)} title="Next page"><ChevronRight size={14} /></button>
                  <span className="pdfw-spacer" />
                  {dirty && <span className="pdfw-stale-hint">The file below is the last saved version.</span>}
                  <button type="button" onClick={() => setZoom((value) => Math.max(50, value - 10))} title="Zoom out"><ZoomOut size={14} /></button>
                  <span className="pdfw-muted">{zoom}%</span>
                  <button type="button" onClick={() => setZoom((value) => Math.min(250, value + 10))} title="Zoom in"><ZoomIn size={14} /></button>
                </div>
                <PdfFilePreview
                  reportId={reportId}
                  revision={`${revision || 0}:${reloadKey}`}
                  fileName={workspace.report?.fileName}
                  zoom={zoom}
                  page={page}
                  onReload={() => setReloadKey((value) => value + 1)}
                />
              </section>
            )}

            {view !== 'pdf' && (
              <section className="pdfw-pane is-document">
                <div className="pdfw-pane-toolbar">
                  <span className="pdfw-muted">
                    {canWrite
                      ? 'Editing the text of this PDF. Everyone connected sees these changes live.'
                      : 'You are reading the live document. Only the student can change it.'}
                  </span>
                </div>
                <div className="pdfw-paper" data-empty={!documentHasContent(editor?.getJSON?.() || {})}>
                  {awaitingAuthor ? (
                    <div className="pdfw-awaiting">
                      <Eye size={16} />
                      <p>
                        The editable text of this PDF has not been opened by its author yet, so this
                        collaborative document is still empty. The file on the left is the current report, and
                        the text will appear here live as soon as the author opens it.
                      </p>
                    </div>
                  ) : provider ? (
                    <PdfEditableDocument
                      ydoc={ydoc}
                      provider={provider}
                      canWrite={canWrite}
                      userName={authorName}
                      onUpdate={handleEditorUpdate}
                      onEditorReady={setEditor}
                    />
                  ) : (
                    <div className="pdfw-awaiting">
                      <LoaderCircle size={16} className="animate-spin" />
                      <p>Connecting to the shared document…</p>
                    </div>
                  )}
                </div>
              </section>
            )}

            {showComments && (
              <aside className="pdfw-pane is-comments">
                <div className="pdfw-pane-toolbar">
                  <MessageSquare size={13} />
                  <span>Supervisor comments ({comments.length})</span>
                </div>

                <div className="pdfw-comments">
                  {comments.length === 0 && (
                    <p className="pdfw-muted">
                      No comments yet. Comments belong to the report and never touch the PDF file.
                    </p>
                  )}
                  {comments.map((comment) => (
                    <article key={comment.id} className="pdfw-comment">
                      <header>
                        <strong>{comment.author?.name || 'Supervisor'}</strong>
                        <span>{ROLE_LABEL[comment.author?.role] || comment.author?.role}</span>
                        <span className="pdfw-spacer" />
                        {canComment && (
                          <button type="button" onClick={() => removeComment(comment.id)} title="Delete this comment">
                            <Trash2 size={12} />
                          </button>
                        )}
                      </header>
                      <p className="pdfw-comment-section">{comment.section}</p>
                      <p>{comment.body}</p>
                      <time>{formatWhen(comment.createdAt)}</time>
                    </article>
                  ))}
                </div>

                {canComment && (
                  <div className="pdfw-comment-form">
                    <input
                      value={commentSection}
                      onChange={(event) => setCommentSection(event.target.value)}
                      placeholder="Section"
                      className="pdfw-input"
                      aria-label="Comment section"
                    />
                    <textarea
                      value={commentBody}
                      onChange={(event) => setCommentBody(event.target.value)}
                      placeholder="Suggest a change instead of editing the file directly."
                      rows={3}
                      className="pdfw-input"
                      aria-label="Comment"
                    />
                    <button type="button" className="pdfw-primary" onClick={addComment} disabled={!commentBody.trim()}>
                      <Send size={13} /> Add comment
                    </button>
                  </div>
                )}
              </aside>
            )}
          </div>
        </main>
      </div>

      {saveStatus === 'Saved to the PDF file' && (
        <div className="pdfw-toast">
          <Check size={14} /> The PDF file has been updated. Everyone viewing it sees the new version.
        </div>
      )}
    </>
  )
}

const PdfWorkspace = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const params = useParams()

  const reportId = useMemo(() => {
    const fromQuery = location.search ? new URLSearchParams(location.search).get('reportId') : null
    return fromQuery || params.id || null
  }, [location.search, params.id])

  // One load result, tagged with the report it belongs to. The loading flag is
  // derived from that tag rather than set at the top of the effect, so a report
  // change shows the spinner without an extra render pass.
  const [loaded, setLoaded] = useState({ forId: null, data: null, error: '', notPdf: false })
  const currentUser = useMemo(() => getStoredUser() || {}, [])

  useEffect(() => {
    if (!reportId) return undefined
    let active = true

    getPdfWorkspace(reportId)
      .then((data) => {
        if (active) setLoaded({ forId: reportId, data, error: '', notPdf: false })
      })
      .catch((error) => {
        if (!active) return
        setLoaded({
          forId: reportId,
          data: null,
          notPdf: error?.response?.data?.code === 'REPORT_NOT_PDF',
          error: error?.response?.data?.message || error.message || 'Unable to open this PDF report.',
        })
      })

    return () => { active = false }
  }, [reportId])

  const workspace = loaded.forId === reportId ? loaded.data : null
  const loadError = reportId
    ? (loaded.forId === reportId ? loaded.error : '')
    : 'No report was named. Open a PDF report from My Reports.'
  const notPdf = loaded.forId === reportId && loaded.notPdf
  const loading = Boolean(reportId) && loaded.forId !== reportId && !loaded.error

  return (
    <div className="pdfw-shell">
      <header className="pdfw-header">
        <div className="pdfw-header-left">
          <button type="button" className="pdfw-ghost" onClick={() => navigate('/my-reports')}>
            <ArrowLeft size={14} /> My Reports
          </button>
          <div className="pdfw-title">
            <FileText size={15} />
            <span>{workspace?.report?.title || 'PDF report'}</span>
            {workspace?.report?.fileName && <span className="pdfw-title-file">{workspace.report.fileName}</span>}
          </div>
        </div>

        <div className="pdfw-header-right">
          <span className="pdfw-status">
            {workspace?.canWrite === false ? 'Read only · supervisors comment instead of editing' : 'Collaborative PDF editing'}
          </span>
          {workspace && (
            <button
              type="button"
              className="pdfw-ghost"
              onClick={() => downloadPdfFile(reportId, workspace.report?.fileName)}
              title="Download the PDF as it is stored on the server"
            >
              <Download size={14} /> PDF
            </button>
          )}
        </div>
      </header>

      {notPdf && (
        <div className="pdfw-banner is-error">
          <AlertTriangle size={15} />
          This report is a Word document.
          <button
            type="button"
            className="pdfw-inline-link"
            onClick={() => navigate(`/writing-workspace?reportId=${reportId}`)}
          >
            Open it in the writing workspace
          </button>
        </div>
      )}

      {loadError && !notPdf && (
        <div className="pdfw-banner is-error">
          <AlertTriangle size={15} /> {loadError}
        </div>
      )}

      {loading ? (
        <div className="pdfw-loading">
          <LoaderCircle size={20} className="animate-spin" />
          <span>Reading the PDF and rebuilding its editable structure…</span>
        </div>
      ) : workspace ? (
        <PdfWorkspaceSession
          key={workspace.report.id}
          workspace={workspace}
          reportId={reportId}
          currentUser={currentUser}
        />
      ) : null}
    </div>
  )
}

export default PdfWorkspace
