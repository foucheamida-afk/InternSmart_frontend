import { useEffect, useState, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import {
  Search, Mail, Upload, X, CheckCircle2, AlertTriangle,
  Loader2, ArrowLeft, CloudUpload, FileSpreadsheet, Trash2
} from 'lucide-react'
import { adminApi } from '../../services/adminService'

/* ─────────────────────────────────────────────
   CSV Parsing & Validation Utilities
   ───────────────────────────────────────────── */

const parseCSVLine = (line) => {
  const result = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') {
      inQuotes = !inQuotes
    } else if (line[i] === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += line[i]
    }
  }
  result.push(current.trim())
  return result
}

const parseCSV = (text) => {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length === 0) return { headers: [], rows: [] }

  const headers = parseCSVLine(lines[0]).map(h =>
    h.toLowerCase().replace(/^['"]|['"]$/g, '').trim()
  )
  const rows = lines.slice(1).map((line, i) => {
    const values = parseCSVLine(line)
    const row = { _rowNumber: i + 2 }
    headers.forEach((h, j) => {
      row[h] = (values[j] || '').replace(/^['"]|['"]$/g, '').trim()
    })
    return row
  })

  return { headers, rows }
}

const REQUIRED_COLUMNS = [
  'student_name',
  'student_email',
  'student_matricule',
  'class',
  'academic_supervisor_name',
  'academic_supervisor_email',
  'professional_supervisor_name',
  'professional_supervisor_email',
  'company',
]

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const validateCSVData = (headers, rows) => {
  const missingColumns = REQUIRED_COLUMNS.filter(c => !headers.includes(c))
  if (missingColumns.length > 0) {
    return { valid: false, missingColumns, validRows: [], invalidRows: [], totalRows: rows.length }
  }

  const seenEmails = new Set()
  const seenMatricules = new Set()
  const validRows = []
  const invalidRows = []

  for (const row of rows) {
    const errors = []

    if (!row.student_name) errors.push('Missing student name')
    if (!row.student_email) {
      errors.push('Missing student email')
    } else if (!EMAIL_RE.test(row.student_email)) {
      errors.push('Invalid email format')
    }
    if (!row.student_matricule) errors.push('Missing matricule')
    if (!row.class) errors.push('Missing class')

    const email = row.student_email?.toLowerCase()
    if (email && seenEmails.has(email)) errors.push('Duplicate email in CSV')
    if (row.student_matricule && seenMatricules.has(row.student_matricule)) errors.push('Duplicate matricule in CSV')

     if (!row.academic_supervisor_name) errors.push('Missing academic supervisor name')
     if (!row.academic_supervisor_email) {
       errors.push('Missing academic supervisor email')
     } else if (!EMAIL_RE.test(row.academic_supervisor_email)) {
       errors.push('Invalid supervisor email format')
     }

     if (!row.professional_supervisor_name) errors.push('Missing professional supervisor name')
     if (!row.professional_supervisor_email) {
       errors.push('Missing professional supervisor email')
     } else if (!EMAIL_RE.test(row.professional_supervisor_email)) {
       errors.push('Invalid professional supervisor email format')
     }

     if (!row.company) errors.push('Missing company')

    if (email) seenEmails.add(email)
    if (row.student_matricule) seenMatricules.add(row.student_matricule)

    if (errors.length > 0) {
      invalidRows.push({ ...row, _errors: errors })
    } else {
      validRows.push(row)
    }
  }

  return { valid: invalidRows.length === 0, validRows, invalidRows, missingColumns: [], totalRows: rows.length }
}

/* ─────────────────────────────────────────────
   Shared UI Components
   ───────────────────────────────────────────── */

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

const formatBytes = (bytes) => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

/* ─────────────────────────────────────────────
   Main Component
   ───────────────────────────────────────────── */

export default function AdminStudents() {
  const location = useLocation()
  /* ── student list state ── */
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  /* ── CSV import state ── */
  const [importOpen, setImportOpen] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [csvFile, setCsvFile] = useState(null)
  const [validation, setValidation] = useState(null)
  const [importStep, setImportStep] = useState('upload')   // upload → preview → importing → done
  const [importResult, setImportResult] = useState(null)
  const fileInputRef = useRef(null)

  /* ── data fetching ── */
  const fetchStudents = async () => {
    setLoading(true)
    try {
      const params = { page, limit: 20 }
      if (search) params.search = search
      const data = await adminApi.getStudents(params)
      setStudents(data.students || [])
      setTotalPages(data.totalPages || 1)
    } catch {
      setStudents([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchStudents() }, [page, search, location.pathname])

  /* ── file helpers ── */
  const acceptFile = (file) => {
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.csv') && file.type !== 'text/csv') {
      return // silently ignore non-CSV
    }
    setCsvFile(file)
    setValidation(null)
  }

  /* ── drag & drop ── */
  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true)
    else if (e.type === 'dragleave') setDragActive(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    acceptFile(e.dataTransfer?.files?.[0])
  }

  /* ── validate ── */
  const handleValidate = async () => {
    if (!csvFile) return
    try {
      const text = await csvFile.text()
      const { headers, rows } = parseCSV(text)
      const result = validateCSVData(headers, rows)
      setValidation(result)
      setImportStep('preview')
    } catch {
      setValidation({ valid: false, missingColumns: [], validRows: [], invalidRows: [], totalRows: 0, parseError: true })
      setImportStep('preview')
    }
  }

  /* ── import ── */
  const handleImport = async () => {
    if (!csvFile) return
    setImportStep('importing')
    try {
      const formData = new FormData()
      formData.append('csv', csvFile)
      const res = await adminApi.importCSV(formData)
      setImportResult(res)
      setImportStep('done')
      fetchStudents()
    } catch (err) {
      setImportResult({
        results: {
          success: 0,
          errors: [{ row: 0, error: err?.response?.data?.message || 'Import failed. Please try again.' }],
          warnings: [],
        }
      })
      setImportStep('done')
    }
  }

  /* ── reset / close ── */
  const resetImport = () => {
    setCsvFile(null)
    setValidation(null)
    setImportStep('upload')
    setImportResult(null)
    setDragActive(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }
  const closeImport = () => { setImportOpen(false); resetImport() }

  /* ── preview columns ── */
  const previewCols = [
    { key: 'student_name',               label: 'Student' },
    { key: 'student_email',              label: 'Email' },
    { key: 'student_matricule',          label: 'Matricule' },
    { key: 'class',                      label: 'Class' },
    { key: 'academic_supervisor_name',   label: 'Academic Supervisor' },
    { key: 'professional_supervisor_name', label: 'Professional Supervisor' },
    { key: 'company',                    label: 'Company' },
  ]

  /* ────────────────────────────────────────
     RENDER
     ──────────────────────────────────────── */
  return (
    <div>
      {/* ─── Page Header ─── */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-[-0.06em]" style={{ color: 'var(--text)' }}>Students</h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
            View and manage all registered students.
          </p>
        </div>
        <button
          onClick={() => setImportOpen(true)}
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

      {/* ─── Student List Table ─── */}
      <div className="rounded-2xl border" style={{ backgroundColor: 'var(--bg-panel)', borderColor: 'var(--line)' }}>
        <div className="p-4 border-b" style={{ borderColor: 'var(--line)' }}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2" size={14} style={{ color: 'var(--text-muted)' }} />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              placeholder="Search by matricule or class..."
              className="w-full rounded-xl border pl-9 pr-3 py-2 text-sm focus:outline-none max-w-md"
              style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--line)', color: 'var(--text)' }}
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-500 border-t-transparent" />
          </div>
        ) : students.length === 0 ? (
          <div className="p-6">
            <EmptyState icon={Mail} title="No students registered" description="Students will appear here once they are created through the admin panel." />
          </div>
        ) : (
          <div className="overflow-x-auto">
              <table className="w-full text-left text-xs" style={{ color: 'var(--text-soft)' }}>
                <thead>
                  <tr className="border-b text-[11px] uppercase tracking-wider" style={{ borderColor: 'var(--line)', color: 'var(--text-muted)' }}>
                    <th className="pb-3 font-semibold px-4">Name</th>
                    <th className="pb-3 font-semibold px-4">Email</th>
                    <th className="pb-3 font-semibold px-4">Matricule</th>
                    <th className="pb-3 font-semibold px-4">Class</th>
                    <th className="pb-3 font-semibold px-4">Academic Supervisor</th>
                    <th className="pb-3 font-semibold px-4">Professional Supervisor</th>
                    <th className="pb-3 font-semibold px-4">Company</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: 'var(--line)' }}>
                  {students.map((s) => (
                    <tr key={s.id} className="hover:bg-white/[0.02] transition">
                      <td className="py-3.5 px-4 font-semibold" style={{ color: 'var(--text)' }}>{s.user?.name}</td>
                      <td className="py-3.5 px-4">{s.user?.email}</td>
                      <td className="py-3.5 px-4">{s.matricule}</td>
                      <td className="py-3.5 px-4">{s.class}</td>
                      <td className="py-3.5 px-4">{s.internship?.academicSupervisor?.name || '—'}</td>
                      <td className="py-3.5 px-4">{s.internship?.professionalSupervisor?.name || '—'}</td>
                      <td className="py-3.5 px-4">{s.internship?.company || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t" style={{ borderColor: 'var(--line)' }}>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 rounded-lg border text-xs disabled:opacity-40 cursor-pointer"
              style={{ borderColor: 'var(--line)', color: 'var(--text)' }}
            >Previous</button>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 rounded-lg border text-xs disabled:opacity-40 cursor-pointer"
              style={{ borderColor: 'var(--line)', color: 'var(--text)' }}
            >Next</button>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════
          CSV IMPORT MODAL
          ═══════════════════════════════════════ */}
      {importOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div
            className="w-full rounded-2xl border shadow-2xl flex flex-col"
            style={{
              backgroundColor: 'var(--bg-panel)',
              borderColor: 'var(--line)',
              color: 'var(--text)',
              maxWidth: importStep === 'preview' ? 900 : 560,
              maxHeight: 'calc(100vh - 48px)',
            }}
          >
            {/* ── Modal Header ── */}
            <div className="flex items-center justify-between p-6 pb-4 border-b shrink-0" style={{ borderColor: 'var(--line)' }}>
              <div className="flex items-center gap-3">
                {importStep === 'preview' && (
                  <button
                    onClick={() => { setImportStep('upload'); setValidation(null) }}
                    className="p-1.5 rounded-lg transition cursor-pointer hover:bg-white/5"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    <ArrowLeft size={18} />
                  </button>
                )}
                <div>
                  <h2 className="text-base font-bold">Import Students &amp; Internship Data</h2>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {importStep === 'upload' && 'Upload a CSV file to bulk import students'}
                    {importStep === 'preview' && 'Review data before importing'}
                    {importStep === 'importing' && 'Import in progress…'}
                    {importStep === 'done' && 'Import complete'}
                  </p>
                </div>
              </div>
              <button
                onClick={closeImport}
                className="p-1.5 rounded-lg transition cursor-pointer hover:bg-white/5"
                style={{ color: 'var(--text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* ── Modal Body ── */}
            <div className="p-6 overflow-y-auto flex-1">

              {/* ╔═══ STEP: UPLOAD ═══╗ */}
              {importStep === 'upload' && (
                <div className="space-y-5">
                  {/* Drag & Drop Zone */}
                  <div
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => !csvFile && fileInputRef.current?.click()}
                    className="relative rounded-2xl border-2 border-dashed transition-all cursor-pointer"
                    style={{
                      borderColor: dragActive
                        ? 'var(--orange)'
                        : csvFile
                          ? 'rgba(16, 185, 129, 0.4)'
                          : 'var(--line)',
                      backgroundColor: dragActive
                        ? 'rgba(255, 122, 0, 0.06)'
                        : csvFile
                          ? 'rgba(16, 185, 129, 0.04)'
                          : 'transparent',
                    }}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,text/csv"
                      className="hidden"
                      onChange={(e) => acceptFile(e.target.files?.[0])}
                    />

                    {!csvFile ? (
                      /* ── Empty dropzone ── */
                      <div className="flex flex-col items-center justify-center py-14 px-6">
                        <div
                          className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border transition-colors"
                          style={{
                            backgroundColor: dragActive ? 'rgba(255, 122, 0, 0.15)' : 'rgba(255, 122, 0, 0.08)',
                            borderColor: dragActive ? 'rgba(255, 122, 0, 0.4)' : 'rgba(255, 122, 0, 0.25)',
                            color: 'var(--orange-3)',
                          }}
                        >
                          <CloudUpload size={28} />
                        </div>
                        <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text)' }}>
                          Drop CSV file here
                        </p>
                        <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>or</p>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click() }}
                          className="rounded-full border px-5 py-2 text-xs font-medium transition hover:border-orange-500/50 cursor-pointer"
                          style={{ borderColor: 'var(--line)', color: 'var(--text)' }}
                        >
                          Browse files
                        </button>
                        <p className="text-[11px] mt-4" style={{ color: 'var(--text-muted)' }}>
                          Supports .csv files only
                        </p>
                      </div>
                    ) : (
                      /* ── File selected ── */
                      <div className="flex items-center gap-4 p-5">
                        <div
                          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border"
                          style={{
                            backgroundColor: 'rgba(16, 185, 129, 0.1)',
                            borderColor: 'rgba(16, 185, 129, 0.3)',
                            color: '#6ee7b7',
                          }}
                        >
                          <FileSpreadsheet size={22} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>
                            {csvFile.name}
                          </p>
                          <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                            {formatBytes(csvFile.size)}
                          </p>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); setCsvFile(null); setValidation(null); if (fileInputRef.current) fileInputRef.current.value = '' }}
                          className="p-1.5 rounded-lg transition cursor-pointer hover:bg-white/5"
                          style={{ color: 'var(--text-muted)' }}
                          title="Remove file"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Expected CSV Structure Hint */}
                  <div className="rounded-xl border p-4" style={{ borderColor: 'var(--line)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                    <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                      Expected CSV columns
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {REQUIRED_COLUMNS.map((col) => (
                        <span
                          key={col}
                          className="rounded-lg border px-2 py-0.5 text-[11px] font-mono"
                          style={{ borderColor: 'var(--line)', color: 'var(--text-soft)' }}
                        >
                          {col}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Validate Button */}
                  {csvFile && (
                    <button
                      onClick={handleValidate}
                      className="w-full rounded-xl py-3 text-sm font-semibold shadow-lg transition cursor-pointer"
                      style={{
                        background: 'linear-gradient(135deg, var(--orange), var(--orange-3))',
                        color: 'white',
                      }}
                    >
                      Validate CSV
                    </button>
                  )}
                </div>
              )}

              {/* ╔═══ STEP: PREVIEW ═══╗ */}
              {importStep === 'preview' && validation && (
                <div className="space-y-5">

                  {/* Column Error */}
                  {validation.missingColumns?.length > 0 && (
                    <div className="rounded-xl border p-4" style={{
                      borderColor: 'rgba(239, 68, 68, 0.4)',
                      backgroundColor: 'rgba(239, 68, 68, 0.06)',
                    }}>
                      <div className="flex items-start gap-3">
                        <AlertTriangle size={18} className="shrink-0 mt-0.5" style={{ color: '#f87171' }} />
                        <div>
                          <p className="text-sm font-semibold" style={{ color: '#f87171' }}>Missing required columns</p>
                          <p className="text-xs mt-1" style={{ color: 'var(--text-soft)' }}>
                            The following columns are missing from your CSV:
                          </p>
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {validation.missingColumns.map((c) => (
                              <span key={c} className="rounded-lg border px-2 py-0.5 text-[11px] font-mono" style={{
                                borderColor: 'rgba(239, 68, 68, 0.4)',
                                color: '#fca5a5',
                              }}>{c}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Parse Error */}
                  {validation.parseError && (
                    <div className="rounded-xl border p-4" style={{
                      borderColor: 'rgba(239, 68, 68, 0.4)',
                      backgroundColor: 'rgba(239, 68, 68, 0.06)',
                    }}>
                      <div className="flex items-center gap-3">
                        <AlertTriangle size={18} style={{ color: '#f87171' }} />
                        <p className="text-sm font-semibold" style={{ color: '#f87171' }}>
                          Unable to parse CSV file. Please check the format.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Validation Summary */}
                  {!validation.missingColumns?.length && !validation.parseError && (
                    <>
                      <div className="flex flex-col sm:flex-row gap-3">
                        {/* Valid rows */}
                        <div className="flex-1 rounded-xl border p-4" style={{
                          borderColor: 'rgba(16, 185, 129, 0.3)',
                          backgroundColor: 'rgba(16, 185, 129, 0.06)',
                        }}>
                          <div className="flex items-center gap-2.5">
                            <CheckCircle2 size={18} style={{ color: '#6ee7b7' }} />
                            <div>
                              <span className="text-lg font-bold" style={{ color: '#6ee7b7' }}>
                                {validation.validRows.length}
                              </span>
                              <span className="text-xs ml-1.5" style={{ color: 'var(--text-muted)' }}>
                                valid {validation.validRows.length === 1 ? 'row' : 'rows'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Invalid rows */}
                        {validation.invalidRows.length > 0 && (
                          <div className="flex-1 rounded-xl border p-4" style={{
                            borderColor: 'rgba(245, 158, 11, 0.3)',
                            backgroundColor: 'rgba(245, 158, 11, 0.06)',
                          }}>
                            <div className="flex items-center gap-2.5">
                              <AlertTriangle size={18} style={{ color: '#fbbf24' }} />
                              <div>
                                <span className="text-lg font-bold" style={{ color: '#fbbf24' }}>
                                  {validation.invalidRows.length}
                                </span>
                                <span className="text-xs ml-1.5" style={{ color: 'var(--text-muted)' }}>
                                  {validation.invalidRows.length === 1 ? 'row requires' : 'rows require'} attention
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Preview Table */}
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
                          Data Preview
                        </p>
                        <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--line)' }}>
                          <div className="overflow-x-auto" style={{ maxHeight: 380 }}>
                            <table className="w-full text-left text-[11px]" style={{ color: 'var(--text-soft)' }}>
                              <thead className="sticky top-0" style={{ backgroundColor: 'var(--bg-panel)' }}>
                                <tr className="border-b text-[10px] uppercase tracking-wider" style={{ borderColor: 'var(--line)', color: 'var(--text-muted)' }}>
                                  <th className="py-2.5 px-3 font-semibold w-8">#</th>
                                  {previewCols.map(c => (
                                    <th key={c.key} className="py-2.5 px-3 font-semibold whitespace-nowrap">{c.label}</th>
                                  ))}
                                  <th className="py-2.5 px-3 font-semibold">Status</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y" style={{ borderColor: 'var(--line)' }}>
                                {/* Valid rows */}
                                {validation.validRows.map((row, i) => (
                                  <tr key={`v-${i}`} className="transition hover:bg-white/[0.02]">
                                    <td className="py-2.5 px-3" style={{ color: 'var(--text-muted)' }}>{row._rowNumber}</td>
                                    {previewCols.map(c => (
                                      <td key={c.key} className="py-2.5 px-3 max-w-[180px] truncate">
                                        {row[c.key] || <span style={{ color: 'var(--text-muted)' }}>—</span>}
                                      </td>
                                    ))}
                                    <td className="py-2.5 px-3">
                                      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{
                                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                                        color: '#6ee7b7',
                                        border: '1px solid rgba(16, 185, 129, 0.25)',
                                      }}>
                                        <CheckCircle2 size={10} /> Valid
                                      </span>
                                    </td>
                                  </tr>
                                ))}

                                {/* Invalid rows */}
                                {validation.invalidRows.map((row, i) => (
                                  <tr
                                    key={`e-${i}`}
                                    className="transition"
                                    style={{ backgroundColor: 'rgba(239, 68, 68, 0.04)' }}
                                  >
                                    <td className="py-2.5 px-3" style={{ color: 'var(--text-muted)' }}>{row._rowNumber}</td>
                                    {previewCols.map(c => (
                                      <td key={c.key} className="py-2.5 px-3 max-w-[180px] truncate">
                                        {row[c.key] || <span style={{ color: 'var(--text-muted)' }}>—</span>}
                                      </td>
                                    ))}
                                    <td className="py-2.5 px-3">
                                      <div className="space-y-0.5">
                                        {row._errors.map((err, j) => (
                                          <span key={j} className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap" style={{
                                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                            color: '#fca5a5',
                                            border: '1px solid rgba(239, 68, 68, 0.25)',
                                          }}>
                                            <AlertTriangle size={10} /> {err}
                                          </span>
                                        ))}
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ╔═══ STEP: IMPORTING ═══╗ */}
              {importStep === 'importing' && (
                <div className="flex flex-col items-center justify-center py-16">
                  <Loader2 size={36} className="animate-spin mb-4" style={{ color: 'var(--orange-3)' }} />
                  <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Importing students…</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                    Creating accounts and internship assignments
                  </p>
                </div>
              )}

              {/* ╔═══ STEP: DONE ═══╗ */}
              {importStep === 'done' && importResult && (
                <div className="space-y-5">
                  {/* Success summary */}
                  {importResult.results?.success > 0 && (
                    <div className="rounded-xl border p-5" style={{
                      borderColor: 'rgba(16, 185, 129, 0.3)',
                      backgroundColor: 'rgba(16, 185, 129, 0.06)',
                    }}>
                      <div className="flex items-center gap-3">
                        <CheckCircle2 size={22} style={{ color: '#6ee7b7' }} />
                        <div>
                          <p className="text-sm font-bold" style={{ color: '#6ee7b7' }}>
                            {importResult.results.success} {importResult.results.success === 1 ? 'student' : 'students'} imported successfully
                          </p>
                          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                            Accounts created with temporary passwords
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Warnings */}
                  {importResult.results?.warnings?.length > 0 && (
                    <div className="rounded-xl border p-4" style={{
                      borderColor: 'rgba(245, 158, 11, 0.3)',
                      backgroundColor: 'rgba(245, 158, 11, 0.06)',
                    }}>
                      <div className="flex items-start gap-3">
                        <AlertTriangle size={18} className="shrink-0 mt-0.5" style={{ color: '#fbbf24' }} />
                        <div className="space-y-1">
                          <p className="text-sm font-semibold" style={{ color: '#fbbf24' }}>Warnings</p>
                          {importResult.results.warnings.map((w, i) => (
                            <p key={i} className="text-xs" style={{ color: 'var(--text-soft)' }}>
                              Row {w.row}: {w.warning}
                            </p>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Errors */}
                  {importResult.results?.errors?.length > 0 && (
                    <div className="rounded-xl border p-4" style={{
                      borderColor: 'rgba(239, 68, 68, 0.3)',
                      backgroundColor: 'rgba(239, 68, 68, 0.06)',
                    }}>
                      <div className="flex items-start gap-3">
                        <AlertTriangle size={18} className="shrink-0 mt-0.5" style={{ color: '#f87171' }} />
                        <div className="space-y-1">
                          <p className="text-sm font-semibold" style={{ color: '#f87171' }}>
                            {importResult.results.errors.length} {importResult.results.errors.length === 1 ? 'error' : 'errors'}
                          </p>
                          {importResult.results.errors.map((e, i) => (
                            <p key={i} className="text-xs" style={{ color: 'var(--text-soft)' }}>
                              {e.row > 0 ? `Row ${e.row}: ` : ''}{e.error}
                            </p>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Modal Footer ── */}
            <div className="p-6 pt-0 shrink-0">
              {/* Preview step: Import button */}
              {importStep === 'preview' && validation && !validation.missingColumns?.length && !validation.parseError && (
                <div className="flex items-center justify-between gap-3 pt-4 border-t" style={{ borderColor: 'var(--line)' }}>
                  <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    {validation.invalidRows.length > 0
                      ? `${validation.invalidRows.length} invalid ${validation.invalidRows.length === 1 ? 'row' : 'rows'} will be skipped by the server`
                      : `${validation.validRows.length} ${validation.validRows.length === 1 ? 'row' : 'rows'} ready to import`
                    }
                  </p>
                  <button
                    onClick={handleImport}
                    disabled={validation.validRows.length === 0}
                    className="rounded-xl px-6 py-2.5 text-sm font-semibold shadow-lg transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{
                      background: 'linear-gradient(135deg, var(--orange), var(--orange-3))',
                      color: 'white',
                    }}
                  >
                    Import {validation.validRows.length} {validation.validRows.length === 1 ? 'Student' : 'Students'}
                  </button>
                </div>
              )}

              {/* Preview step with column errors: Back button only */}
              {importStep === 'preview' && (validation?.missingColumns?.length > 0 || validation?.parseError) && (
                <div className="flex justify-end pt-4 border-t" style={{ borderColor: 'var(--line)' }}>
                  <button
                    onClick={() => { setImportStep('upload'); setValidation(null) }}
                    className="rounded-xl border px-5 py-2.5 text-sm font-medium transition cursor-pointer hover:border-orange-500/40"
                    style={{ borderColor: 'var(--line)', color: 'var(--text)' }}
                  >
                    Go Back
                  </button>
                </div>
              )}

              {/* Done step */}
              {importStep === 'done' && (
                <div className="flex items-center justify-end gap-3 pt-4 border-t" style={{ borderColor: 'var(--line)' }}>
                  <button
                    onClick={resetImport}
                    className="rounded-xl border px-5 py-2.5 text-sm font-medium transition cursor-pointer hover:border-orange-500/40"
                    style={{ borderColor: 'var(--line)', color: 'var(--text)' }}
                  >
                    Import Another
                  </button>
                  <button
                    onClick={closeImport}
                    className="rounded-xl px-6 py-2.5 text-sm font-semibold shadow-lg transition cursor-pointer"
                    style={{
                      background: 'linear-gradient(135deg, var(--orange), var(--orange-3))',
                      color: 'white',
                    }}
                  >
                    Done
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
