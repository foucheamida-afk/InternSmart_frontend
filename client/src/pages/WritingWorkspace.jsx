import { useEffect, useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import { StarterKit } from '@tiptap/starter-kit'
import { Underline } from '@tiptap/extension-underline'
import { TextAlign } from '@tiptap/extension-text-align'
import { Highlight } from '@tiptap/extension-highlight'
import { TextStyle, FontSize, FontFamily } from '@tiptap/extension-text-style'
import { Color } from '@tiptap/extension-color'
import { Placeholder } from '@tiptap/extension-placeholder'
import { Extension } from '@tiptap/core'
import * as Y from 'yjs'
import { IndexeddbPersistence } from 'y-indexeddb'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import api from '../api/axios'
import {
  Undo2, Redo2, Printer, Eye, Download, Share2, Search, Replace, CheckCircle2,
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  AlignLeft, AlignCenter, AlignRight, AlignJustify, List, ListOrdered, Quote,
  ZoomIn, ZoomOut, FileText, Wifi, PanelRight, X, MoreHorizontal, MessageSquare,
  Lock, ChevronUp, ChevronDown as ChevronDownIcon, Type, Palette, Highlighter,
  Table, Image as ImageIcon, Link as LinkIcon, BookOpen, Bookmark, SpellCheck, PenLine, Ruler, Layout, Mail,
  HelpCircle, File, Home, Plus, Minus, Clipboard, Paintbrush, Hash,
  Lightbulb, CheckSquare, Clock, ChevronRight,
  PanelLeftClose, PanelLeftOpen, Scissors, Copy, Trash2
} from 'lucide-react'
import { Link as LinkExtension } from '@tiptap/extension-link'
import { Image as ImageExtension } from '@tiptap/extension-image'
import { Table as TableExtension, TableRow, TableCell, TableHeader } from '@tiptap/extension-table'
import '../assets/css/writing-workspace.css'
import '../assets/css/writing-pagination.css'
import '../assets/css/writing-review.css'

// FontSize and FontFamily are built into @tiptap/extension-text-style v3
// — no custom extension needed

/**
 * Indent — adds indent / outdent commands via CSS margin-left on paragraphs.
 */
const INDENT_PX = 24
const IndentExtension = Extension.create({
  name: 'indent',
  addCommands() {
    return {
      indent: () => ({ tr, state, dispatch }) => {
        const { selection } = state
        const { from, to } = selection
        tr.doc.nodesBetween(from, to, (node, pos) => {
          if (node.type.name === 'paragraph' || node.type.name === 'heading') {
            const current = parseInt(node.attrs?.style?.match(/margin-left:\s*(\d+)px/)?.[1] || '0', 10)
            const next = current + INDENT_PX
            tr.setNodeMarkup(pos, undefined, { ...node.attrs, style: `margin-left: ${next}px` })
          }
        })
        if (dispatch) dispatch(tr)
        return true
      },
      outdent: () => ({ tr, state, dispatch }) => {
        const { selection } = state
        const { from, to } = selection
        tr.doc.nodesBetween(from, to, (node, pos) => {
          if (node.type.name === 'paragraph' || node.type.name === 'heading') {
            const current = parseInt(node.attrs?.style?.match(/margin-left:\s*(\d+)px/)?.[1] || '0', 10)
            const next = Math.max(0, current - INDENT_PX)
            const style = next > 0 ? `margin-left: ${next}px` : ''
            tr.setNodeMarkup(pos, undefined, { ...node.attrs, style })
          }
        })
        if (dispatch) dispatch(tr)
        return true
      },
    }
  },
})

/**
 * PageBreak — inserts a horizontal rule styled as a page-break divider.
 */
const PageBreak = Extension.create({
  name: 'pageBreak',
  addCommands() {
    return {
      insertPageBreak: () => ({ chain }) =>
        chain()
          .insertContent({ type: 'horizontalRule' })
          .insertContent({ type: 'paragraph' })
          .run(),
    }
  },
})

const DOCUMENT_PREFIX = 'internsmart-report-v2-'

const ToolbarButton = ({ label, onClick, active, children, disabled = false, title }) => {
  const btn = (
    <button
      type="button"
      className={`ww-tool ${active ? 'is-active' : ''}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={title || label}
    >
      {children}
    </button>
  )
  return btn
}

const ToolbarSelect = ({ label, value, onChange, options, title }) => (
  <select
    className="ww-select"
    aria-label={label}
    title={title || label}
    value={value}
    onChange={(e) => onChange(e.target.value)}
  >
    {options.map((opt) => (
      <option key={opt.value} value={opt.value}>{opt.label}</option>
    ))}
  </select>
)

const WORD_RIBBON_TABS = [
  { id: 'file', label: 'File', icon: File },
  { id: 'home', label: 'Home', icon: Home },
  { id: 'insert', label: 'Insert', icon: Plus },
  { id: 'design', label: 'Design', icon: Layout },
  { id: 'layout', label: 'Layout', icon: Ruler },
  { id: 'references', label: 'References', icon: Bookmark },
  { id: 'mailings', label: 'Mailings', icon: Mail },
  { id: 'review', label: 'Review', icon: PenLine },
  { id: 'view', label: 'View', icon: Eye },
  { id: 'help', label: 'Help', icon: HelpCircle },
]

const OUTLINE_SECTIONS = [
  { id: 'cover', label: 'Cover Page', level: 0 },
  { id: 'dedication', label: 'Dedication', level: 0 },
  { id: 'acknowledgement', label: 'Acknowledgement', level: 0 },
  { id: 'summary', label: 'Summary', level: 0 },
  { id: 'list-of-figures', label: 'List of Figures', level: 0 },
  { id: 'list-of-tables', label: 'List of Tables', level: 0 },
  { id: 'glossary', label: 'Glossary', level: 0 },
  { id: 'abbreviations', label: 'List of Abbreviations', level: 0 },
  { id: 'abstract', label: 'Abstract', level: 0 },
  { id: 'resume', label: 'Résumé', level: 0 },
  { id: 'general-introduction', label: 'General Introduction', level: 0 },
  { id: 'part1', label: 'Part 1 — Insertion Phase', level: 0 },
  { id: 'part2', label: 'Part 2 — Technical Phase', level: 0 },
  { id: 'file1', label: 'File 1 — Existing System', level: 1 },
  { id: 'file2', label: 'File 2 — Specification Book', level: 1 },
  { id: 'file3', label: 'File 3 — Analysis Book', level: 1 },
  { id: 'file4', label: 'File 4 — Conception Phase', level: 1 },
  { id: 'file5', label: 'File 5 — Realization Phase', level: 1 },
  { id: 'file6', label: 'File 6 — Functional Testing', level: 1 },
  { id: 'file7', label: 'File 7 — Installation and User Guide', level: 1 },
  { id: 'perspectives', label: 'Perspectives', level: 0 },
  { id: 'general-conclusion', label: 'General Conclusion', level: 0 },
  { id: 'bibliography', label: 'Bibliography', level: 0 },
  { id: 'webography', label: 'Webography', level: 0 },
  { id: 'videography', label: 'Videography', level: 0 },
  { id: 'table-of-contents', label: 'Table of Contents', level: 0 },
]

const FALLBACK_OUTLINE = [
  { id: 'general-introduction', label: 'General Introduction', level: 0 },
  { id: 'part1', label: 'Part 1 — Insertion Phase', level: 0 },
  { id: 'part2', label: 'Part 2 — Technical Phase', level: 0 },
  { id: 'file1', label: 'File 1 — Existing System', level: 1 },
  { id: 'file2', label: 'File 2 — Specification Book', level: 1 },
  { id: 'file3', label: 'File 3 — Analysis Book', level: 1 },
  { id: 'file4', label: 'File 4 — Conception Phase', level: 1 },
  { id: 'file5', label: 'File 5 — Realization Phase', level: 1 },
  { id: 'file6', label: 'File 6 — Functional Testing', level: 1 },
  { id: 'file7', label: 'File 7 — Installation and User Guide', level: 1 },
  { id: 'general-conclusion', label: 'General Conclusion', level: 0 },
  { id: 'bibliography', label: 'Bibliography', level: 0 },
]

const pickOutline = (sections = [], documentContent) => {
  const backend = sections.filter((s) => s.label && s.label.trim())
  if (backend.length) return backend
  try {
    const content = documentContent || {}
    const extract = (node, items = []) => {
      if (!node) return items
      if (node.type === 'heading' && node.content) {
        const text = node.content.map((n) => n.text || '').join('').trim()
        if (text) items.push({ id: text.toLowerCase().replace(/[^a-z0-9]+/g, '-'), label: text, level: node.attrs?.level || 1 })
      }
      if (Array.isArray(node.content)) node.content.forEach((child) => extract(child, items))
      return items
    }
    const fromDoc = extract(content)
    if (fromDoc.length) return fromDoc
  } catch {
    // ignore
  }
  return FALLBACK_OUTLINE
}

export default function WritingWorkspace() {
  const navigate = useNavigate()
  const location = useLocation()
  const params = useParams()
  const paperRef = useRef(null)
  const rulerRef = useRef(null)
  const [reportId, setReportId] = useState(location.search ? new URLSearchParams(location.search).get('reportId') : (params.id || null))
  const [comments, setComments] = useState([])
  const [commentSection, setCommentSection] = useState('General')
  const [commentBody, setCommentBody] = useState('')
  const [workspaceError, setWorkspaceError] = useState('')
  const [title, setTitle] = useState('')
  const [isReadOnly, setIsReadOnly] = useState(false)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [savedAt, setSavedAt] = useState(null)
  const [saveStatus, setSaveStatus] = useState('Saved')
  const [activeTab, setActiveTab] = useState('home')
  const [pageCount, setPageCount] = useState(1)
  const [zoom, setZoom] = useState(100)
  const [showRuler, setShowRuler] = useState(true)
  const [showOutline, setShowOutline] = useState(true)
  const [showAssistant, setShowAssistant] = useState(true)
  const [assistantTab, setAssistantTab] = useState('comments')
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [yjsDoc] = useState(() => new Y.Doc())
  const storageKey = `${DOCUMENT_PREFIX}${reportId || 'new'}`
  const [isPreview, setIsPreview] = useState(false)
  const [showMore, setShowMore] = useState(false)
  const [sections, setSections] = useState([])
  const [currentCommentIndex, setCurrentCommentIndex] = useState(0)
  const [searchMatches, setSearchMatches] = useState([])
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0)
  const [replacementText, setReplacementText] = useState('')
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [showSpecialChars, setShowSpecialChars] = useState(false)

  const normalizeWorkspaceContent = (raw) => {
    let content = raw
    if (typeof content === 'string') {
      const trimmed = content.trim()
      if (!trimmed) return { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: '' }] }] }
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
          content = JSON.parse(trimmed)
          if (typeof content === 'string') {
            try { content = JSON.parse(content) } catch { content = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: content }] }] } }
          }
        } catch {
          content = { type: 'doc', content: trimmed.split(/\n\s*\n/).filter(Boolean).map((paragraph) => ({ type: 'paragraph', content: [{ type: 'text', text: paragraph }] })) }
        }
      } else {
        content = { type: 'doc', content: trimmed.split(/\n\s*\n/).filter(Boolean).map((paragraph) => ({ type: 'paragraph', content: [{ type: 'text', text: paragraph }] })) }
      }
    }
    if (!content || typeof content !== 'object' || !content.type) {
      content = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: '' }] }] }
    }
    return content
  }

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ history: false, link: false, underline: false }),
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Highlight.configure({ multicolor: true }),
      TextStyle,
      FontSize.configure({ types: ['textStyle'] }),
      FontFamily.configure({ types: ['textStyle'] }),
      Color.configure({ types: ['textStyle'] }),
      LinkExtension.configure({ openOnClick: false }),
      ImageExtension,
      TableExtension.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      IndentExtension,
      PageBreak,
      Placeholder.configure({ placeholder: 'Start typing your internship report...' }),
    ],
    content: null,
    editable: !isReadOnly,
    editorProps: {
      attributes: {
        class: 'ww-editor',
      },
    },
    onUpdate: () => {
      setSaveStatus('Saving...')
      setSavedAt(new Date())
      setPageCount(Math.max(1, Math.ceil((paperRef.current?.scrollHeight || 1123) / 1123)))
      if (reportId && !isReadOnly) {
        api.put(`/workspace/reports/${reportId}/workspace`, { documentContent: editor?.getJSON() }).then(() => {
          setSaveStatus('Saved')
        }).catch(() => {
          setSaveStatus('Offline - saved locally')
        })
      }
    },
  })

  const initialLoadRef = useRef(false)

  const [pendingReportId, setPendingReportId] = useState(null)

  useEffect(() => {
    const loadWorkspace = async (id) => {
      try {
        setSaveStatus('Loading...')
        const { data } = await api.get(`/workspace/reports/${id}/workspace`)
        setReportId(id)
        setComments(data.comments || [])
        setTitle(data.report.title || '')
        setIsReadOnly(Boolean(data.readOnly))
        setPendingReportId((current) => current === id ? current : id)
        if (data.report.documentContent && editor) {
          editor.commands.setContent(normalizeWorkspaceContent(data.report.documentContent))
          setSaveStatus('Saved')
        } else if (!data.report.documentContent) {
          editor?.commands.setContent({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: '' }] }] })
          setSaveStatus('Saved')
        }
        const nextSections = pickOutline(data.sections, data.report?.documentContent)
        setSections(nextSections)
        initialLoadRef.current = true
      } catch (error) {
        setWorkspaceError(error.response?.data?.message || 'Unable to load this report workspace.')
        setSaveStatus('Error')
        initialLoadRef.current = true
      }
    }
    if (reportId) { loadWorkspace(reportId); return }
    if (!initialLoadRef.current) {
      setSaveStatus('Saved')
      setTitle('New report')
      setSections(FALLBACK_OUTLINE)
      initialLoadRef.current = true
    }
  }, [editor, reportId])

  useEffect(() => {
    if (!editor || !pendingReportId) return
    const loadPending = async () => {
      try {
        const { data } = await api.get(`/workspace/reports/${pendingReportId}/workspace`)
        if (data.report.documentContent) {
          editor.commands.setContent(normalizeWorkspaceContent(data.report.documentContent))
        }
      } catch {
        // ignore pending load errors
      } finally {
        setPendingReportId(null)
      }
    }
    loadPending()
  }, [editor, pendingReportId])

  useEffect(() => {
    if (!editor || !reportId) return
    const updateSections = () => {
      try {
        const doc = editor.getJSON()
        setSections(pickOutline([], doc))
      } catch {
        // ignore
      }
    }
    updateSections()
    const handler = () => updateSections()
    editor.on('update', handler)
    return () => { editor.off('update', handler) }
  }, [editor, reportId])

  useEffect(() => {
    const persistence = new IndexeddbPersistence(storageKey, yjsDoc)
    return () => { persistence.destroy() }
  }, [yjsDoc, storageKey])

  useEffect(() => { editor?.setEditable(!isReadOnly && !isPreview) }, [editor, isReadOnly, isPreview])

  useEffect(() => {
    if (!reportId || !title || isReadOnly) return
    const timeout = setTimeout(() => {
      api.put(`/workspace/reports/${reportId}/workspace`, { title }).catch(() => {})
    }, 1000)
    return () => clearTimeout(timeout)
  }, [title, reportId, isReadOnly])

  useEffect(() => {
    const markOnline = () => setIsOnline(true)
    const markOffline = () => setIsOnline(false)
    window.addEventListener('online', markOnline)
    window.addEventListener('offline', markOffline)
    return () => { window.removeEventListener('online', markOnline); window.removeEventListener('offline', markOffline) }
  }, [])

  useEffect(() => {
    editor?.on('selectionUpdate', () => {
      if (window.__formatPainter && editor && editor.view.state.selection.from !== editor.view.state.selection.to) {
        const marks = window.__formatPainter
        Object.entries(marks).forEach(([name, attrs]) => {
          editor.chain().focus().setMark(name, attrs).run()
        })
        window.__formatPainter = null
      }
    })
  }, [editor])

  const exportPdf = async () => {
    if (!paperRef.current) return
    try {
      const canvas = await html2canvas(paperRef.current, { scale: 2, backgroundColor: '#ffffff', windowWidth: paperRef.current.scrollWidth })
      const pdf = new jsPDF('p', 'mm', 'a4')
      const pageHeight = Math.round(canvas.width * 297 / 210)
      for (let top = 0; top < canvas.height; top += pageHeight) {
        if (top > 0) pdf.addPage()
        const pageCanvas = window.document.createElement('canvas')
        pageCanvas.width = canvas.width
        pageCanvas.height = Math.min(pageHeight, canvas.height - top)
        pageCanvas.getContext('2d').drawImage(canvas, 0, top, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height)
        pdf.addImage(pageCanvas.toDataURL('image/png'), 'PNG', 0, 0, 210, 297 * pageCanvas.height / pageHeight)
      }

      const pdfBlob = new Blob([pdf.output('blob')], { type: 'application/pdf' })
      const formData = new FormData()
      formData.append('report', pdfBlob, `${title || 'internship-report'}.pdf`)
      formData.append('title', title || 'Internship report')

      const token = localStorage.getItem('token')
      const response = await fetch('http://localhost:3000/api/students/reports', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Unable to upload report')

      pdf.save(`${title || 'internship-report'}.pdf`)

      if (data.report?.id) {
        const newReportId = String(data.report.id)
        setReportId(newReportId)
        await api.put(`/workspace/reports/${newReportId}/workspace`, { documentContent: editor?.getJSON() })
        setWorkspaceError('Report exported and saved. You can continue editing this report here, or find it in My Reports.')
        setTimeout(() => setWorkspaceError(''), 4000)
      } else {
        setWorkspaceError('Report exported. You can continue editing here, or find it in My Reports later.')
        setTimeout(() => setWorkspaceError(''), 4000)
      }
    } catch (error) {
      console.error('PDF export error:', error)
      setWorkspaceError('PDF export failed. Please try again.')
    }
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

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      editor?.chain().focus().insertContent(text).run()
    } catch {
      window.document.execCommand('paste')
    }
  }

  const handleFontFamily = (font) => {
    if (!font) {
      editor?.chain().focus().unsetFontFamily().run()
    } else {
      editor?.chain().focus().setFontFamily(font).run()
    }
  }

  const handleFontSize = (size) => {
    if (!size) {
      editor?.chain().focus().unsetFontSize().run()
    } else {
      editor?.chain().focus().setFontSize(size).run()
    }
  }

  const handleTextColor = (color) => {
    editor?.chain().focus().setColor(color).run()
  }

  const handleSearch = async () => {
    if (!searchQuery || !editor) return
    const matches = []
    editor.state.doc.descendants((node, pos) => {
      if (node.isText && node.text) {
        const regex = new RegExp(searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
        let match
        while ((match = regex.exec(node.text)) !== null) {
          matches.push({ from: pos + match.index, to: pos + match.index + match[0].length })
        }
      }
    })
    setSearchMatches(matches)
    if (matches.length > 0) {
      setCurrentMatchIndex(0)
      editor.commands.setTextSelection(matches[0])
      editor.commands.scrollIntoView()
    }
  }

  const nextMatch = () => {
    if (searchMatches.length === 0) return
    const next = (currentMatchIndex + 1) % searchMatches.length
    setCurrentMatchIndex(next)
    editor.commands.setTextSelection(searchMatches[next])
    editor.commands.scrollIntoView()
  }

  const prevMatch = () => {
    if (searchMatches.length === 0) return
    const prev = (currentMatchIndex - 1 + searchMatches.length) % searchMatches.length
    setCurrentMatchIndex(prev)
    editor.commands.setTextSelection(searchMatches[prev])
    editor.commands.scrollIntoView()
  }

  const replaceMatch = () => {
    if (searchMatches.length === 0 || !replacementText) return
    const match = searchMatches[currentMatchIndex]
    const { state } = editor.view
    const tr = state.tr.replaceWith(match.from, match.to, state.schema.text(replacementText))
    editor.view.dispatch(tr)
    handleSearch()
  }

  const replaceAll = () => {
    if (!searchQuery || !replacementText || !editor) return
    const { state } = editor.view
    const tr = state.tr
    let offset = 0
    searchMatches.forEach((match) => {
      const from = match.from + offset
      const to = match.to + offset
      tr.replaceWith(from, to, state.schema.text(replacementText))
      offset += replacementText.length - (to - from)
    })
    editor.view.dispatch(tr)
    setSearchMatches([])
    setCurrentMatchIndex(0)
    setReplacementText('')
  }

  const handleInsertLink = () => {
    const url = prompt('Enter URL:')
    if (url) {
      editor?.chain().focus().setLink({ href: url }).run()
    }
  }

  const handleInsertImage = () => {
    const url = prompt('Enter image URL:')
    if (url) {
      editor?.chain().focus().setImage({ src: url }).run()
    }
  }

  const handleInsertTable = () => {
    editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
  }

  const handleInsertTOC = () => {
    const headings = []
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'heading') {
        headings.push({
          level: node.attrs.level,
          text: node.textContent,
        })
      }
    })
    if (headings.length === 0) return
    const tocHtml = headings.map(h => {
      const indent = (h.level - 1) * 20
      return `<p style="margin-left:${indent}px"><strong>${h.text}</strong></p>`
    }).join('')
    editor?.chain().focus().insertContent(tocHtml).run()
  }

  const handleInsertCoverPage = () => {
    const coverHtml = `<div style="text-align:center; padding-top: 200px; page-break-after: always;"><h1>${title || 'Internship Report'}</h1><p style="font-size: 18px; margin-top: 50px;">${studentName}</p><p style="font-size: 14px; margin-top: 20px;">Internship Report</p></div>`
    editor?.chain().focus().insertContent(coverHtml).run()
  }

  const handleInsertSpecialChar = (char) => {
    editor?.chain().focus().insertContent(char).run()
    setShowSpecialChars(false)
  }

  const prevComment = () => {
    if (wordComments.length === 0) return
    setCurrentCommentIndex((prev) => (prev - 1 + wordComments.length) % wordComments.length)
  }

  const nextComment = () => {
    if (wordComments.length === 0) return
    setCurrentCommentIndex((prev) => (prev + 1) % wordComments.length)
  }

  const deleteComment = async () => {
    if (!reportId || wordComments.length === 0) return
    const comment = wordComments[currentCommentIndex]
    try {
      await api.delete(`/workspace/reports/${reportId}/comments/${comment.id}`)
      setComments((current) => current.filter((c) => c.id !== comment.id))
      setCurrentCommentIndex((prev) => Math.max(0, prev - 1))
    } catch (error) {
      setWorkspaceError(error.response?.data?.message || 'Unable to delete comment.')
    }
  }

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setWorkspaceError('Link copied to clipboard!')
      setTimeout(() => setWorkspaceError(''), 3000)
    } catch {
      setWorkspaceError('Unable to copy link.')
    }
  }

  const handleFormatPainter = () => {
    if (!editor) return
    const { from, to } = editor.state.selection
    if (from === to) return
    const marks = editor.state.storedMarks || editor.getMarkRange(from) || {}
    window.__formatPainter = marks
  }

  const specialChars = ['©', '®', '™', '€', '£', '¥', '§', '¶', '†', '‡', '•', '…', '‰', '′', '″', '‹', '›', '※', '℠', '™', '←', '↑', '→', '↓', '↔', '≈', '≠', '≤', '≥', '«', '»', '‘', '’', '“', '”', '„', '‟', '‹', '›']

  const presetColors = ['#000000', '#434343', '#666666', '#999999', '#cccccc', '#efefef', '#f3f3f3', '#ffffff', '#980000', '#ff0000', '#ff9900', '#ffff00', '#00ff00', '#00ffff', '#4a86e8', '#0000ff', '#9900ff', '#ff00ff', '#e6b8af', '#f4cccc', '#fce5cd', '#fff2cc', '#d9ead3', '#d0e0e3', '#c9daf8', '#cfe2f3', '#d9d2e9', '#ead1dc', '#dd7e6b', '#ea9999', '#f9cb9c', '#ffe599', '#b6d7a8', '#a2c4c9', '#a4c2f4', '#9fc5e8', '#b4a7d6', '#d5a6bd']

  const fontFamilies = [
    { value: '', label: 'Default Font' },
    { value: 'Calibri', label: 'Calibri' },
    { value: 'Arial', label: 'Arial' },
    { value: 'Times New Roman', label: 'Times New Roman' },
    { value: 'Georgia', label: 'Georgia' },
    { value: 'Verdana', label: 'Verdana' },
    { value: 'Courier New', label: 'Courier New' },
  ]

  const fontSizes = [
    { value: '8pt', label: '8' }, { value: '10pt', label: '10' }, { value: '12pt', label: '12' },
    { value: '14pt', label: '14' }, { value: '18pt', label: '18' }, { value: '24pt', label: '24' },
    { value: '36pt', label: '36' },
  ]

  const styles = [
    { value: '0', label: 'Normal' },
    { value: '1', label: 'Heading 1' },
    { value: '2', label: 'Heading 2' },
    { value: '3', label: 'Heading 3' },
    { value: '4', label: 'Heading 4' },
    { value: '5', label: 'Heading 5' },
    { value: '6', label: 'Quote' },
  ]

  const activeStyle = editor?.isActive('heading', { level: 1 }) ? '1' :
    editor?.isActive('heading', { level: 2 }) ? '2' :
    editor?.isActive('heading', { level: 3 }) ? '3' :
    editor?.isActive('heading', { level: 4 }) ? '4' :
    editor?.isActive('heading', { level: 5 }) ? '5' :
    editor?.isActive('blockquote') ? '6' : '0'

  const handleStyleChange = (val) => {
    const level = Number(val)
    if (level === 0) editor?.chain().focus().setParagraph().run()
    else if (level === 6) editor?.chain().focus().toggleBlockquote().run()
    else editor?.chain().focus().setHeading({ level }).run()
  }

  const saveLabel = isPreview ? 'Preview' : saveStatus
  /* Read student name from whichever key the auth layer uses */
  const studentName = (() => {
    try {
      const raw =
        localStorage.getItem('user') ||
        localStorage.getItem('internSmart_user') ||
        '{}'
      const parsed = JSON.parse(raw)
      return parsed?.student?.name || parsed?.name || 'Student'
    } catch {
      return 'Student'
    }
  })()

  const renderHomeRibbon = () => (
    <div className="ww-ribbon-content">
      <div className="ww-ribbon-group">
        <div className="ww-ribbon-group-title">Clipboard</div>
        <div className="ww-ribbon-buttons">
          <ToolbarButton label="Paste" onClick={handlePaste} title="Paste"><Clipboard size={16} /></ToolbarButton>
          <div className="ww-ribbon-small-group">
            <ToolbarButton label="Cut" onClick={() => {
              const sel = window.getSelection()?.toString()
              if (sel) { navigator.clipboard.writeText(sel).catch(() => {}); editor?.chain().focus().deleteSelection().run() }
            }} title="Cut"><Scissors size={15} /></ToolbarButton>
            <ToolbarButton label="Copy" onClick={() => {
              const sel = window.getSelection()?.toString()
              if (sel) navigator.clipboard.writeText(sel).catch(() => {})
            }} title="Copy"><Copy size={15} /></ToolbarButton>
            <ToolbarButton label="Format Painter" onClick={handleFormatPainter} title="Format Painter"><Paintbrush size={15} /></ToolbarButton>
          </div>
        </div>
      </div>
      <div className="ww-ribbon-group">
        <div className="ww-ribbon-group-title">Font</div>
        <div className="ww-ribbon-buttons">
          <ToolbarSelect label="Font family" value="" onChange={handleFontFamily} options={fontFamilies} title="Font Family" />
          <ToolbarSelect label="Font size" value="" onChange={handleFontSize} options={fontSizes} title="Font Size" />
          <div className="ww-ribbon-small-group">
            <ToolbarButton label="Bold" active={editor?.isActive('bold')} onClick={() => editor?.chain().focus().toggleBold().run()} title="Bold"><Bold size={15} /></ToolbarButton>
            <ToolbarButton label="Italic" active={editor?.isActive('italic')} onClick={() => editor?.chain().focus().toggleItalic().run()} title="Italic"><Italic size={15} /></ToolbarButton>
            <ToolbarButton label="Underline" active={editor?.isActive('underline')} onClick={() => editor?.chain().focus().toggleUnderline().run()} title="Underline"><UnderlineIcon size={15} /></ToolbarButton>
            <ToolbarButton label="Strikethrough" active={editor?.isActive('strike')} onClick={() => editor?.chain().focus().toggleStrike().run()} title="Strikethrough"><Strikethrough size={15} /></ToolbarButton>
            <div style={{ position: 'relative' }}>
              <ToolbarButton label="Text Color" onClick={() => setShowColorPicker(!showColorPicker)} title="Text Color"><Palette size={15} /></ToolbarButton>
              {showColorPicker && (
                <div className="ww-color-picker">
                  {presetColors.map((color) => (
                    <button key={color} type="button" className="ww-color-swatch" style={{ backgroundColor: color }} onClick={() => { handleTextColor(color); setShowColorPicker(false) }} />
                  ))}
                </div>
              )}
            </div>
            <ToolbarButton label="Highlight" active={editor?.isActive('highlight')} onClick={() => editor?.chain().focus().toggleHighlight().run()} title="Highlight"><Highlighter size={15} /></ToolbarButton>
            <ToolbarButton label="Clear Formatting" onClick={() => editor?.chain().focus().unsetAllMarks().run()} title="Clear Formatting"><X size={15} /></ToolbarButton>
          </div>
        </div>
      </div>
      <div className="ww-ribbon-group">
        <div className="ww-ribbon-group-title">Paragraph</div>
        <div className="ww-ribbon-buttons">
          <div className="ww-ribbon-small-group">
            <ToolbarButton label="Bullet List" active={editor?.isActive('bulletList')} onClick={() => editor?.chain().focus().toggleBulletList().run()} title="Bullet List"><List size={15} /></ToolbarButton>
            <ToolbarButton label="Numbered List" active={editor?.isActive('orderedList')} onClick={() => editor?.chain().focus().toggleOrderedList().run()} title="Numbered List"><ListOrdered size={15} /></ToolbarButton>
            <ToolbarButton label="Block Quote" active={editor?.isActive('blockquote')} onClick={() => editor?.chain().focus().toggleBlockquote().run()} title="Quote"><Quote size={15} /></ToolbarButton>
          </div>
          <div className="ww-ribbon-small-group">
            <ToolbarButton label="Align Left" active={editor?.isActive({ textAlign: 'left' })} onClick={() => editor?.chain().focus().setTextAlign('left').run()} title="Align Left"><AlignLeft size={15} /></ToolbarButton>
            <ToolbarButton label="Align Center" active={editor?.isActive({ textAlign: 'center' })} onClick={() => editor?.chain().focus().setTextAlign('center').run()} title="Align Center"><AlignCenter size={15} /></ToolbarButton>
            <ToolbarButton label="Align Right" active={editor?.isActive({ textAlign: 'right' })} onClick={() => editor?.chain().focus().setTextAlign('right').run()} title="Align Right"><AlignRight size={15} /></ToolbarButton>
            <ToolbarButton label="Justify" active={editor?.isActive({ textAlign: 'justify' })} onClick={() => editor?.chain().focus().setTextAlign('justify').run()} title="Justify"><AlignJustify size={15} /></ToolbarButton>
          </div>
          <div className="ww-ribbon-small-group">
            <ToolbarButton label="Decrease Indent" onClick={() => editor?.chain().focus().outdent().run()} title="Decrease Indent"><ChevronDownIcon size={15} /></ToolbarButton>
            <ToolbarButton label="Increase Indent" onClick={() => editor?.chain().focus().indent().run()} title="Increase Indent"><ChevronUp size={15} /></ToolbarButton>
          </div>
          <div className="ww-ribbon-small-group">
            <ToolbarButton label="Indent Left" onClick={() => editor?.chain().focus().outdent().run()} title="Outdent"><Minus size={15} /></ToolbarButton>
            <ToolbarButton label="Indent Right" onClick={() => editor?.chain().focus().indent().run()} title="Indent"><Plus size={15} /></ToolbarButton>
          </div>
        </div>
      </div>
      <div className="ww-ribbon-group">
        <div className="ww-ribbon-group-title">Paragraph Style</div>
        <div className="ww-ribbon-buttons">
          <ToolbarSelect
            label="Paragraph style"
            value={activeStyle}
            onChange={handleStyleChange}
            title="Paragraph Style"
            options={styles}
          />
        </div>
      </div>
      <div className="ww-ribbon-group">
        <div className="ww-ribbon-group-title">Editing</div>
        <div className="ww-ribbon-buttons">
          <ToolbarButton label="Find" onClick={() => setShowSearch(!showSearch)} title="Find"><Search size={15} /></ToolbarButton>
          <ToolbarButton label="Replace" onClick={() => setShowSearch(!showSearch)} title="Replace"><Replace size={15} /></ToolbarButton>
          <ToolbarButton label="Select All" onClick={() => editor?.chain().focus().selectAll().run()} title="Select All"><CheckCircle2 size={15} /></ToolbarButton>
        </div>
      </div>
    </div>
  )

  const renderInsertRibbon = () => (
    <div className="ww-ribbon-content">
      <div className="ww-ribbon-group">
        <div className="ww-ribbon-group-title">Pages</div>
        <div className="ww-ribbon-buttons">
          <ToolbarButton label="Cover Page" onClick={handleInsertCoverPage} title="Cover Page"><FileText size={16} /></ToolbarButton>
          <ToolbarButton label="Blank Page" onClick={insertBlankPage} title="Blank Page"><Plus size={16} /></ToolbarButton>
          <ToolbarButton label="Page Break" onClick={() => editor?.chain().focus().insertPageBreak().run()} title="Page Break"><Minus size={16} /></ToolbarButton>
        </div>
      </div>
      <div className="ww-ribbon-group">
        <div className="ww-ribbon-group-title">Tables</div>
        <div className="ww-ribbon-buttons">
          <ToolbarButton label="Insert Table" onClick={handleInsertTable} title="Insert Table"><Table size={16} /></ToolbarButton>
        </div>
      </div>
      <div className="ww-ribbon-group">
        <div className="ww-ribbon-group-title">Images</div>
        <div className="ww-ribbon-buttons">
          <ToolbarButton label="Insert Image" onClick={handleInsertImage} title="Insert Image"><ImageIcon size={16} /></ToolbarButton>
        </div>
      </div>
      <div className="ww-ribbon-group">
        <div className="ww-ribbon-group-title">Header & Footer</div>
        <div className="ww-ribbon-buttons">
          <ToolbarButton label="Header" onClick={() => editor?.chain().focus().insertContent('<header style="text-align:center; border-bottom: 1px solid #ccc; padding: 10px;">Header</header>').run()} title="Header"><FileText size={16} /></ToolbarButton>
          <ToolbarButton label="Footer" onClick={() => editor?.chain().focus().insertContent('<footer style="text-align:center; border-top: 1px solid #ccc; padding: 10px;">Footer</footer>').run()} title="Footer"><FileText size={16} /></ToolbarButton>
          <ToolbarButton label="Page Number" onClick={() => editor?.chain().focus().insertContent('<span style="float: right;">Page </span>').run()} title="Page Number"><Hash size={16} /></ToolbarButton>
        </div>
      </div>
      <div className="ww-ribbon-group">
        <div className="ww-ribbon-group-title">Links</div>
        <div className="ww-ribbon-buttons">
          <ToolbarButton label="Hyperlink" onClick={handleInsertLink} title="Hyperlink"><LinkIcon size={16} /></ToolbarButton>
        </div>
      </div>
      <div className="ww-ribbon-group">
        <div className="ww-ribbon-group-title">Symbols</div>
        <div className="ww-ribbon-buttons">
          <div style={{ position: 'relative' }}>
            <ToolbarButton label="Special Characters" onClick={() => setShowSpecialChars(!showSpecialChars)} title="Special Characters"><Type size={16} /></ToolbarButton>
            {showSpecialChars && (
              <div className="ww-special-chars">
                {specialChars.map((char) => (
                  <button key={char} type="button" className="ww-special-char" onClick={() => handleInsertSpecialChar(char)}>{char}</button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="ww-ribbon-group">
        <div className="ww-ribbon-group-title">Comments</div>
        <div className="ww-ribbon-buttons">
          <ToolbarButton label="Add Comment" onClick={() => setAssistantTab('comments')} title="Add Comment"><MessageSquare size={16} /></ToolbarButton>
        </div>
      </div>
    </div>
  )

  const renderDesignRibbon = () => (
    <div className="ww-ribbon-content">
      <div className="ww-ribbon-group">
        <div className="ww-ribbon-group-title">Document Formatting</div>
        <div className="ww-ribbon-buttons">
          <ToolbarButton label="Themes" onClick={() => setWorkspaceError('Themes coming soon.')} title="Themes"><Palette size={16} /></ToolbarButton>
          <ToolbarButton label="Colors" onClick={() => setShowColorPicker(!showColorPicker)} title="Colors"><Highlighter size={16} /></ToolbarButton>
          <ToolbarButton label="Fonts" onClick={() => setWorkspaceError('Font themes coming soon.')} title="Fonts"><Type size={16} /></ToolbarButton>
        </div>
      </div>
      <div className="ww-ribbon-group">
        <div className="ww-ribbon-group-title">Page Background</div>
        <div className="ww-ribbon-buttons">
          <ToolbarButton label="Watermark" onClick={() => setWorkspaceError('Watermark coming soon.')} title="Watermark"><FileText size={16} /></ToolbarButton>
          <ToolbarButton label="Page Color" onClick={() => setWorkspaceError('Page color coming soon.')} title="Page Color"><Palette size={16} /></ToolbarButton>
          <ToolbarButton label="Page Borders" onClick={() => setWorkspaceError('Page borders coming soon.')} title="Page Borders"><Ruler size={16} /></ToolbarButton>
        </div>
      </div>
    </div>
  )

  const renderLayoutRibbon = () => (
    <div className="ww-ribbon-content">
      <div className="ww-ribbon-group">
        <div className="ww-ribbon-group-title">Page Setup</div>
        <div className="ww-ribbon-buttons">
          <ToolbarButton label="Margins" onClick={() => setWorkspaceError('Margins coming soon.')} title="Margins"><Ruler size={16} /></ToolbarButton>
          <ToolbarButton label="Orientation" onClick={() => setWorkspaceError('Orientation coming soon.')} title="Orientation"><Ruler size={16} /></ToolbarButton>
          <ToolbarButton label="Paper Size" onClick={() => setWorkspaceError('Paper size coming soon.')} title="Paper Size"><FileText size={16} /></ToolbarButton>
        </div>
      </div>
      <div className="ww-ribbon-group">
        <div className="ww-ribbon-group-title">Paragraph</div>
        <div className="ww-ribbon-buttons">
          <ToolbarButton label="Indent Left" onClick={() => editor?.chain().focus().outdent().run()} title="Indent Left"><ChevronDownIcon size={16} /></ToolbarButton>
          <ToolbarButton label="Indent Right" onClick={() => editor?.chain().focus().indent().run()} title="Indent Right"><ChevronUp size={16} /></ToolbarButton>
          <ToolbarButton label="Spacing Before" onClick={() => setWorkspaceError('Spacing before coming soon.')} title="Spacing Before"><ChevronUp size={16} /></ToolbarButton>
          <ToolbarButton label="Spacing After" onClick={() => setWorkspaceError('Spacing after coming soon.')} title="Spacing After"><ChevronDownIcon size={16} /></ToolbarButton>
        </div>
      </div>
    </div>
  )

  const renderReferencesRibbon = () => (
    <div className="ww-ribbon-content">
      <div className="ww-ribbon-group">
        <div className="ww-ribbon-group-title">Table of Contents</div>
        <div className="ww-ribbon-buttons">
          <ToolbarButton label="Table of Contents" onClick={handleInsertTOC} title="Table of Contents"><BookOpen size={16} /></ToolbarButton>
        </div>
      </div>
      <div className="ww-ribbon-group">
        <div className="ww-ribbon-group-title">Footnotes</div>
        <div className="ww-ribbon-buttons">
          <ToolbarButton label="Insert Footnote" onClick={() => editor?.chain().focus().insertContent('<sup><a href="#fn" id="fnref">[1]</a></sup>').run()} title="Insert Footnote"><Bookmark size={16} /></ToolbarButton>
        </div>
      </div>
      <div className="ww-ribbon-group">
        <div className="ww-ribbon-group-title">Citations & Bibliography</div>
        <div className="ww-ribbon-buttons">
          <ToolbarButton label="Insert Citation" onClick={() => editor?.chain().focus().insertContent('(Author, Year)').run()} title="Insert Citation"><BookOpen size={16} /></ToolbarButton>
          <ToolbarButton label="Bibliography" onClick={() => editor?.chain().focus().insertContent('<h2>Bibliography</h2><p>Author. <em>Title</em>. Publisher, Year.</p>').run()} title="Bibliography"><BookOpen size={16} /></ToolbarButton>
        </div>
      </div>
    </div>
  )

  const renderReviewRibbon = () => (
    <div className="ww-ribbon-content">
      <div className="ww-ribbon-group">
        <div className="ww-ribbon-group-title">Proofing</div>
        <div className="ww-ribbon-buttons">
          <ToolbarButton label="Spelling" onClick={() => setWorkspaceError('Use browser built-in spell check.')} title="Spelling"><SpellCheck size={16} /></ToolbarButton>
          <ToolbarButton label="Grammar" onClick={() => setWorkspaceError('Grammar check coming soon.')} title="Grammar"><BookOpen size={16} /></ToolbarButton>
        </div>
      </div>
      <div className="ww-ribbon-group">
        <div className="ww-ribbon-group-title">Comments</div>
        <div className="ww-ribbon-buttons">
          <ToolbarButton label="New Comment" onClick={() => { setAssistantTab('comments'); setShowAssistant(true); }} title="New Comment"><MessageSquare size={16} /></ToolbarButton>
          <ToolbarButton label="Previous Comment" onClick={prevComment} title="Previous Comment"><ChevronUp size={16} /></ToolbarButton>
          <ToolbarButton label="Next Comment" onClick={nextComment} title="Next Comment"><ChevronDownIcon size={16} /></ToolbarButton>
          <ToolbarButton label="Delete Comment" onClick={deleteComment} title="Delete Comment"><Trash2 size={16} /></ToolbarButton>
        </div>
      </div>
      <div className="ww-ribbon-group">
        <div className="ww-ribbon-group-title">Tracking</div>
        <div className="ww-ribbon-buttons">
          <ToolbarButton label="Track Changes" onClick={() => setWorkspaceError('Track changes coming soon.')} title="Track Changes"><PenLine size={16} /></ToolbarButton>
          <ToolbarButton label="Show Changes" onClick={() => setWorkspaceError('Show changes coming soon.')} title="Show Changes"><Eye size={16} /></ToolbarButton>
        </div>
      </div>
      <div className="ww-ribbon-group">
        <div className="ww-ribbon-group-title">Compare</div>
        <div className="ww-ribbon-buttons">
          <ToolbarButton label="Compare" onClick={() => setWorkspaceError('Compare documents coming soon.')} title="Compare"><FileText size={16} /></ToolbarButton>
          <ToolbarButton label="Protect Document" onClick={() => setWorkspaceError('Document protection coming soon.')} title="Protect Document"><Lock size={16} /></ToolbarButton>
        </div>
      </div>
    </div>
  )

  const renderViewRibbon = () => (
    <div className="ww-ribbon-content">
      <div className="ww-ribbon-group">
        <div className="ww-ribbon-group-title">Views</div>
        <div className="ww-ribbon-buttons">
          <ToolbarButton label="Print Layout" onClick={() => { setZoom(100); setIsPreview(false) }} title="Print Layout"><FileText size={16} /></ToolbarButton>
          <ToolbarButton label="Web Layout" onClick={() => { setZoom(80); setIsPreview(false) }} title="Web Layout"><Eye size={16} /></ToolbarButton>
          <ToolbarButton label="Read Mode" onClick={() => { setZoom(120); setIsPreview(false) }} title="Read Mode"><Eye size={16} /></ToolbarButton>
        </div>
      </div>
      <div className="ww-ribbon-group">
        <div className="ww-ribbon-group-title">Show/Hide</div>
        <div className="ww-ribbon-buttons">
          <ToolbarButton label="Ruler" active={showRuler} onClick={() => setShowRuler(!showRuler)} title="Ruler"><Ruler size={16} /></ToolbarButton>
          <ToolbarButton label="Navigation Pane" active={showOutline} onClick={() => setShowOutline(!showOutline)} title="Navigation Pane"><PanelRight size={16} /></ToolbarButton>
          <ToolbarButton label="Assistant" active={showAssistant} onClick={() => setShowAssistant(!showAssistant)} title="Assistant"><Lightbulb size={16} /></ToolbarButton>
        </div>
      </div>
      <div className="ww-ribbon-group">
        <div className="ww-ribbon-group-title">Zoom</div>
        <div className="ww-ribbon-buttons">
          <ToolbarButton label="Zoom In" onClick={() => setZoom((z) => Math.min(200, z + 10))} title="Zoom In"><ZoomIn size={16} /></ToolbarButton>
          <ToolbarButton label="Zoom Out" onClick={() => setZoom((z) => Math.max(50, z - 10))} title="Zoom Out"><ZoomOut size={16} /></ToolbarButton>
          <ToolbarButton label="Fit Page" onClick={() => setZoom(100)} title="Fit Page"><FileText size={16} /></ToolbarButton>
          <ToolbarButton label="Fit Width" onClick={() => setZoom(80)} title="Fit Width"><Ruler size={16} /></ToolbarButton>
          <span className="ww-zoom-label">{zoom}%</span>
        </div>
      </div>
    </div>
  )

  const renderRibbonContent = () => {
    switch (activeTab) {
      case 'home': return renderHomeRibbon()
      case 'insert': return renderInsertRibbon()
      case 'design': return renderDesignRibbon()
      case 'layout': return renderLayoutRibbon()
      case 'references': return renderReferencesRibbon()
      case 'review': return renderReviewRibbon()
      case 'view': return renderViewRibbon()
      default: return <div className="ww-ribbon-content"><div className="ww-ribbon-group"><div className="ww-ribbon-group-title">{WORD_RIBBON_TABS.find(t => t.id === activeTab)?.label}</div><div className="ww-ribbon-buttons"><p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>This tab content is under development.</p></div></div></div>
    }
  }

  const wordComments = comments.map((c) => ({
    id: c.id,
    section: c.section,
    body: c.body,
    author: c.author?.name || 'Supervisor',
    createdAt: c.createdAt,
  }))

  return (
    <main className="ww-shell">
      {/* Word-style top app bar */}
      <header className="ww-app-bar">
        <div className="ww-app-bar-left">
          <button type="button" className="ww-app-bar-item" onClick={() => navigate('/student/dashboard')}><Undo2 size={16} /></button>
          <div className="ww-app-bar-logo"><FileText size={18} /></div>
          <div className="ww-app-bar-title">
            <span className="ww-app-bar-app">InternSmart</span>
            <span className="ww-app-bar-sep">|</span>
            <span className="ww-app-bar-doc">Report Workspace</span>
          </div>
          <div className="ww-app-bar-divider" />
          <div className="ww-app-bar-doc-title">
            <FileText size={14} />
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              aria-label="Report title"
              className="ww-app-bar-title-input"
            />
          </div>
        </div>

        <div className="ww-app-bar-center">
          <div className={`ww-save-status ${saveStatus.toLowerCase().includes('saved') ? 'is-saved' : saveStatus.toLowerCase().includes('saving') ? 'is-saving' : saveStatus.toLowerCase().includes('offline') || saveStatus.toLowerCase().includes('error') ? 'is-offline' : 'is-saving'}`}>
            {saveStatus.toLowerCase().includes('saved') && <CheckCircle2 size={14} />}
            {saveStatus.toLowerCase().includes('saving') && <Clock size={14} />}
            {(saveStatus.toLowerCase().includes('offline') || saveStatus.toLowerCase().includes('error')) && <Wifi size={14} />}
            <span>{saveLabel}</span>
            {savedAt && <span className="ww-meta-sep">•</span>}
            {savedAt && <span>{isPreview ? 'Preview' : `Last saved ${new Date(savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}</span>}
          </div>
        </div>

        <div className="ww-app-bar-right">
          <div className={`connection-state ${isOnline ? 'online' : 'offline'}`}><Wifi size={13} /> {isOnline ? 'Online' : 'Offline'}</div>
          <ToolbarButton label="Undo" onClick={() => editor?.chain().focus().undo().run()} disabled={!editor?.can().undo()} title="Undo"><Undo2 size={15} /></ToolbarButton>
          <ToolbarButton label="Redo" onClick={() => editor?.chain().focus().redo().run()} disabled={!editor?.can().redo()} title="Redo"><Redo2 size={15} /></ToolbarButton>
          <button type="button" className="ww-app-bar-action" onClick={() => window.print()} title="Print"><Printer size={15} /></button>
          <button type="button" className={`ww-app-bar-action ${isPreview ? 'is-active' : ''}`} onClick={() => setIsPreview(!isPreview)} title="Preview"><Eye size={15} /></button>
          <button type="button" className="ww-app-bar-action" onClick={exportPdf} title="Export PDF"><Download size={15} /></button>
          <button type="button" className="ww-app-bar-action" title="Share / Review status" onClick={handleShare}><Share2 size={15} /></button>
          <div className="ww-app-bar-more">
            <button type="button" className="ww-app-bar-action" onClick={() => setShowMore(!showMore)} title="More"><MoreHorizontal size={15} /></button>
            {showMore && (
              <div className="ww-more-menu">
                <button type="button" className="ww-more-item" onClick={() => { exportPdf(); setShowMore(false); }}>Export PDF</button>
                <button type="button" className="ww-more-item" onClick={() => { window.print(); setShowMore(false); }}>Print</button>
                <button type="button" className="ww-more-item" onClick={() => { setIsPreview(!isPreview); setShowMore(false); }}>{isPreview ? 'Exit Preview' : 'Preview'}</button>
              </div>
            )}
          </div>
          <div className="ww-app-bar-user">
            <div className="ww-avatar">{studentName.charAt(0).toUpperCase()}</div>
          </div>
        </div>
      </header>

      {/* Ribbon tabs */}
      <nav className="ww-ribbon-tabs" aria-label="Ribbon tabs">
        {WORD_RIBBON_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`ww-ribbon-tab ${activeTab === tab.id ? 'is-active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
            title={tab.label}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Ribbon toolbar */}
      <div className="ww-ribbon-toolbar" aria-label="Toolbar">
        {renderRibbonContent()}
      </div>

      {/* Read-only banner for supervisors */}
      {isReadOnly && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 16px',
          backgroundColor: 'rgba(245, 166, 35, 0.12)',
          borderBottom: '1px solid rgba(245, 166, 35, 0.3)',
          fontSize: '12px',
          color: '#F5A623',
          fontWeight: 500,
        }}>
          <Lock size={13} />
          <span>You are viewing this report in <strong>read-only</strong> mode. You can leave comments in the Assistant panel on the right.</span>
        </div>
      )}

      {/* Document outline / canvas / assistant */}
      {workspaceError && <div className="ww-error">{workspaceError}</div>}
      <div className="ww-body">
        {showOutline && (
          <aside className="ww-outline">
            <div className="ww-outline-header">
              <span className="ww-outline-title">Document Outline</span>
              <button type="button" className="ww-outline-toggle" onClick={() => setShowOutline(false)}><PanelLeftClose size={16} /></button>
            </div>
            <div className="ww-outline-body">
              {(sections.length ? sections : OUTLINE_SECTIONS).map((section) => (
                <button
                  key={section.id}
                  type="button"
                  className={`ww-outline-item ${section.level === 0 ? 'is-section' : 'is-subsection'}`}
                  onClick={() => {
                    setTitle(section.label)
                    editor?.chain().focus().setParagraph().run()
                  }}
                  title={section.label}
                >
                  {section.level === 0 ? <ChevronRight size={14} /> : <Minus size={14} />}
                  <span>{section.label}</span>
                </button>
              ))}
            </div>
          </aside>
        )}
        {!showOutline && (
          <button type="button" className="ww-outline-open" onClick={() => setShowOutline(true)} title="Open outline"><PanelLeftOpen size={16} /></button>
        )}

        {showSearch && (
          <div className="ww-search-bar">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); handleSearch() }}
              placeholder="Find in document..."
              className="ww-search-input"
            />
            <span className="ww-search-count">{searchMatches.length > 0 ? `${currentMatchIndex + 1} of ${searchMatches.length}` : '0 results'}</span>
            <button type="button" className="ww-search-btn" onClick={prevMatch}><ChevronUp size={14} /></button>
            <button type="button" className="ww-search-btn" onClick={nextMatch}><ChevronDownIcon size={14} /></button>
            <input
              type="text"
              value={replacementText}
              onChange={(e) => setReplacementText(e.target.value)}
              placeholder="Replace with..."
              className="ww-search-input"
            />
            <button type="button" className="ww-search-btn" onClick={replaceMatch}><Replace size={14} /></button>
            <button type="button" className="ww-search-btn" onClick={replaceAll} title="Replace All"><CheckSquare size={14} /></button>
            <button type="button" className="ww-search-btn" onClick={() => { setShowSearch(false); setSearchQuery(''); setSearchMatches([]); setReplacementText(''); }}><X size={14} /></button>
          </div>
        )}

        <div className="ww-canvas">
          {showRuler && (
            <div className="ww-ruler" ref={rulerRef}>
              <div className="ww-ruler-inner">
                {Array.from({ length: 21 }).map((_, i) => (
                  <div key={i} className="ww-ruler-tick" style={{ left: `${i * 5}%` }}>
                    <span className="ww-ruler-label">{i * 5}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="ww-paper-stage">
            <article ref={paperRef} className="a4-paper" style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }}>
              <EditorContent key={reportId || 'new'} editor={editor} />
            </article>
          </div>
        </div>

        {showAssistant && (
          <aside className="ww-assistant">
            <div className="ww-assistant-header">
              <span className="ww-assistant-title">Assistant</span>
              <button type="button" className="ww-assistant-toggle" onClick={() => setShowAssistant(false)}><PanelRight size={16} /></button>
            </div>
            <div className="ww-assistant-tabs">
              <button type="button" className={`ww-assistant-tab ${assistantTab === 'comments' ? 'is-active' : ''}`} onClick={() => setAssistantTab('comments')}>Comments</button>
              <button type="button" className={`ww-assistant-tab ${assistantTab === 'tasks' ? 'is-active' : ''}`} onClick={() => setAssistantTab('tasks')}>Tasks</button>
              <button type="button" className={`ww-assistant-tab ${assistantTab === 'ai' ? 'is-active' : ''}`} onClick={() => setAssistantTab('ai')}>AI</button>
              <button type="button" className={`ww-assistant-tab ${assistantTab === 'info' ? 'is-active' : ''}`} onClick={() => setAssistantTab('info')}>Info</button>
            </div>
            <div className="ww-assistant-body">
              {assistantTab === 'comments' && (
                <>
                  <div className="ww-assistant-section-header">
                    <span>Comments</span>
                    <span>{wordComments.length}</span>
                  </div>
                  {wordComments.length ? wordComments.map((comment) => (
                    <div className="ww-comment-item" key={comment.id}>
                      <strong>{comment.author}</strong>
                      <span className="ww-comment-section">{comment.section}</span>
                      <p>{comment.body}</p>
                      <small>{comment.createdAt ? new Date(comment.createdAt).toLocaleString() : ''}</small>
                    </div>
                  )) : <p className="ww-empty">No comments yet.</p>}
                  {isReadOnly && (
                    <div className="ww-assistant-add">
                      <input
                        value={commentSection}
                        onChange={(e) => setCommentSection(e.target.value)}
                        placeholder="Section name"
                        aria-label="Comment section"
                      />
                      <textarea
                        value={commentBody}
                        onChange={(e) => setCommentBody(e.target.value)}
                        placeholder="Write feedback for this section..."
                        rows={4}
                        aria-label="Comment body"
                      />
                      <button type="button" className="ww-primary-button" onClick={addComment}><MessageSquare size={15} /> Add comment</button>
                    </div>
                  )}
                  <div className="ww-assistant-privacy">
                    <Lock size={14} />
                    <span>{isReadOnly ? 'This report is read-only for supervisors.' : 'Only assigned supervisors can review this report.'}</span>
                  </div>
                </>
              )}
              {assistantTab === 'tasks' && (
                <div className="ww-empty">
                  <p>Your internship tasks will appear here.</p>
                  <p className="ww-muted">Retrieved from the existing backend.</p>
                </div>
              )}
              {assistantTab === 'ai' && (
                <div className="ww-empty">
                  <p>AI Assistant will help improve academic wording, grammar, and clarity.</p>
                  <p className="ww-muted">Select text and ask for improvements.</p>
                </div>
              )}
              {assistantTab === 'info' && (
                <div className="ww-empty">
                  <p>Report information and metadata will appear here.</p>
                  <p className="ww-muted">Dynamic data comes from the backend.</p>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* Status Bar */}
      <footer className="ww-status-bar">
        <span><CheckSquare size={14} /> Autosave enabled</span>
        <span>Local document storage · Private by default</span>
        <span>Page {pageCount}</span>
      </footer>
    </main>
  )
}
