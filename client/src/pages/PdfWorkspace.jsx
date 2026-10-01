/**
 * PdfWorkspace — PDF editing page powered by Apryse WebViewer.
 *
 * Architecture:
 *   /pdf-workspace/:id  →  This component
 *     ├── Fetches workspace metadata (title, canWrite, fileRevision)
 *     │     via  GET /api/workspace/reports/:id/pdf
 *     ├── Loads the PDF binary directly into WebViewer
 *     │     via  GET /api/workspace/reports/:id/pdf/file?token=<JWT>
 *     └── Saves the modified PDF back (same file, same report)
 *           via  PUT /api/workspace/reports/:id/pdf/file
 *
 * No database columns change. No new visible files are created.
 * The same PDF, on the same report, is updated in-place.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import WebViewer from '@pdftron/webviewer'
import { getPdfWorkspace, savePdfFile, pdfFileViewerUrl } from '../services/pdfWorkspaceService'
import '../assets/css/pdf-workspace.css'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Apryse WebViewer static assets — copied into public/ at setup time. */
const WEBVIEWER_PATH = '/webviewer'

/**
 * Client-side Apryse license key.
 * Set VITE_APRYSE_LICENSE_KEY=<your_key> in client/.env.local (gitignored).
 * An empty string activates the free evaluation mode (trial watermark on exports).
 */
const LICENSE_KEY = import.meta.env.VITE_APRYSE_LICENSE_KEY || ''

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PdfWorkspace() {
  const { id: routeId } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  // reportId from URL param or ?reportId= query (legacy entry point support)
  const reportId = routeId || searchParams.get('reportId')

  // ── State ──────────────────────────────────────────────────────────────────
  const [workspace, setWorkspace] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState(null) // 'success' | 'error' | null
  const [dirty, setDirty] = useState(false)

  // ── Refs ───────────────────────────────────────────────────────────────────
  const viewerContainer = useRef(null)
  const viewerInstance = useRef(null)   // Apryse WebViewer instance (not a React state)

  // ── Load workspace metadata ────────────────────────────────────────────────
  useEffect(() => {
    if (!reportId) {
      setLoadError('No report ID provided. Please open this page from a report.')
      setLoading(false)
      return
    }

    let cancelled = false

    const load = async () => {
      try {
        setLoading(true)
        setLoadError(null)
        const data = await getPdfWorkspace(reportId)
        if (!cancelled) setWorkspace(data)
      } catch (err) {
        if (cancelled) return
        console.error('[PDF-WORKSPACE] metadata load error:', err)
        const status = err?.response?.status
        if (status === 403) {
          setLoadError('You do not have permission to open this report.')
        } else if (status === 404) {
          setLoadError('Report not found or the PDF file is missing. Please re-upload the document.')
        } else {
          setLoadError('Unable to load this PDF report. Please try again.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [reportId])

  // ── Initialise WebViewer once metadata is ready ────────────────────────────
  useEffect(() => {
    if (!workspace || !viewerContainer.current) return
    if (viewerInstance.current) return // already initialised (StrictMode guard)

    let instance = null

    const init = async () => {
      try {
        // The PDF is fetched directly from the backend using the authenticated
        // token URL that the existing pdfFileViewerUrl helper builds.
        const pdfUrl = pdfFileViewerUrl(reportId, workspace.fileRevision)
        const canWrite = Boolean(workspace.canWrite)

        instance = await WebViewer(
          {
            path: WEBVIEWER_PATH,
            licenseKey: LICENSE_KEY,
            initialDoc: pdfUrl,
            enableFilePicker: false,  // we control file association
            fullAPI: true,            // enable content editing (text/image)
            enableContentEdit: true,  // enable direct inline PDF text editing
          },
          viewerContainer.current,
        )

        viewerInstance.current = instance

        // Enable ContentEdit UI feature explicitly if available
        if (instance.UI.Feature?.ContentEdit) {
          instance.UI.enableFeatures([instance.UI.Feature.ContentEdit])
        }

        const { documentViewer, annotationManager } = instance.Core


        // Mark clean on first document load, then wire up change tracking
        documentViewer.addEventListener('documentLoaded', () => {
          setDirty(false)
          setSaveStatus(null)

          // Apply read-only mode after document is ready (WebViewer 10 API)
          if (!canWrite) {
            // Prevent creating/modifying/deleting annotations in read-only mode
            instance.UI.disableElements([
              'toolbarGroup-Annotate',
              'toolbarGroup-Shapes',
              'toolbarGroup-Insert',
              'toolbarGroup-Edit',
              'toolbarGroup-FillAndSign',
              'toolbarGroup-Forms',
              'annotationPopup',
            ])
          }

          // Track annotation changes (highlights, stamps, comments, etc.)
          annotationManager.addEventListener('annotationChanged', () => setDirty(true))
        })

      } catch (err) {
        console.error('[PDF-WORKSPACE] WebViewer init error:', err)
        setLoadError(`PDF editor could not initialise: ${err.message}`)
      }
    }

    init()
  }, [workspace, reportId])


  // ── Save handler ───────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!viewerInstance.current || !reportId) return

    setSaving(true)
    setSaveStatus(null)

    try {
      const { documentViewer, annotationManager } = viewerInstance.current.Core

      const doc = documentViewer.getDocument()

      // Export all annotations as XFDF and embed them in the PDF binary.
      // flatten:true bakes annotations into the page content so they are
      // visible in every PDF viewer, not only in Apryse.
      const xfdfString = await annotationManager.exportAnnotations()

      const fileData = await doc.getFileData({
        xfdfString,
        flatten: true,
        downloadType: 'pdf',
      })

      const blob = new Blob([fileData], { type: 'application/pdf' })

      // PUT the modified PDF back over the same report record — single-file model.
      await savePdfFile(reportId, blob)

      setDirty(false)
      setSaveStatus('success')
      setTimeout(() => setSaveStatus(null), 4000)
    } catch (err) {
      console.error('[PDF-WORKSPACE] save error:', err)
      setSaveStatus('error')
    } finally {
      setSaving(false)
    }
  }, [reportId])


  // ── Navigation guard ───────────────────────────────────────────────────────
  const handleBack = useCallback(() => {
    if (dirty) {
      // eslint-disable-next-line no-alert
      const ok = window.confirm('You have unsaved changes. Leave anyway?')
      if (!ok) return
    }
    navigate(-1)
  }, [dirty, navigate])

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="pdfw-loading-screen">
        <div className="pdfw-loading-spinner" />
        <p>Opening PDF workspace…</p>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="pdfw-error-screen">
        <div className="pdfw-error-icon">⚠</div>
        <h2>Cannot Open PDF</h2>
        <p>{loadError}</p>
        <button type="button" className="pdfw-btn pdfw-btn-primary" onClick={() => navigate(-1)}>
          ← Go Back
        </button>
      </div>
    )
  }

  const canWrite = Boolean(workspace?.canWrite)
  const title = workspace?.report?.title || 'PDF Report'

  return (
    <div className="pdfw-sdk-root">
      {/* ── Top bar ── */}
      <header className="pdfw-sdk-header">
        <button
          type="button"
          className="pdfw-sdk-back-btn"
          onClick={handleBack}
          title="Back to reports"
        >
          ← Back
        </button>

        <div className="pdfw-sdk-title-area">
          <span className="pdfw-sdk-title">{title}</span>
          {!canWrite && (
            <span className="pdfw-sdk-readonly-badge">Read-only</span>
          )}
          {dirty && canWrite && (
            <span className="pdfw-sdk-dirty-badge">Unsaved changes</span>
          )}
        </div>

        {canWrite && (
          <button
            type="button"
            className={`pdfw-sdk-save-btn ${saving ? 'is-saving' : ''} ${saveStatus === 'success' ? 'is-saved' : ''} ${saveStatus === 'error' ? 'is-error' : ''}`}
            onClick={handleSave}
            disabled={saving}
          >
            {saving
              ? 'Saving…'
              : saveStatus === 'success'
                ? '✓ Saved'
                : saveStatus === 'error'
                  ? '✗ Save Failed'
                  : 'Save'}
          </button>
        )}
      </header>

      {/* ── Save status banner ── */}
      {saveStatus === 'success' && (
        <div className="pdfw-sdk-banner is-success" role="status">
          ✓ PDF saved successfully. Close and reopen the report to confirm changes.
        </div>
      )}
      {saveStatus === 'error' && (
        <div className="pdfw-sdk-banner is-error" role="alert">
          ✗ Save failed — please check your connection and try again.
        </div>
      )}

      {/* ── WebViewer container ── */}
      {/*
        The ref container must always be in the DOM (not conditionally rendered)
        from the moment the WebViewer init effect is ready to run.
        WebViewer injects a full-page <iframe> into this element.
      */}
      <div
        ref={viewerContainer}
        className="pdfw-sdk-viewer"
        aria-label="PDF editor"
      />
    </div>
  )
}
