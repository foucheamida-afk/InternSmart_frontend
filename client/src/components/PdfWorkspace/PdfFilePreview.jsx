import { useEffect, useMemo, useState } from 'react'
import { ExternalLink, FileWarning, LoaderCircle, RefreshCw } from 'lucide-react'
import { pdfFileViewerUrl } from '../../services/pdfWorkspaceService'

/**
 * The PDF itself, displayed as the file it is.
 *
 * This is deliberately the browser's own PDF viewer rather than a re-rendering
 * of the document: the report is a PDF file, the server serves that file, and
 * what the reader sees is exactly what is stored. After a save the file is a
 * different one, so the frame is reloaded with the revision that came back from
 * the server - otherwise the browser would keep showing the previous bytes.
 */
const PdfFilePreview = ({ reportId, revision, fileName, zoom = 100, page = 1, onReload }) => {
  // Which source has finished loading, and which one failed. Tracking the source
  // itself (rather than a boolean reset in an effect) means a reload is simply a
  // different source, and the spinner comes back without a second render pass.
  const [loadedSrc, setLoadedSrc] = useState(null)
  const [failedSrc, setFailedSrc] = useState(null)

  const src = useMemo(() => {
    const url = pdfFileViewerUrl(reportId, revision)
    const hash = []
    if (page > 1) hash.push(`page=${page}`)
    if (zoom !== 100) hash.push(`zoom=${zoom}`)
    return hash.length ? `${url}#${hash.join('&')}` : url
  }, [page, reportId, revision, zoom])

  const failed = failedSrc === src
  const loading = !failed && loadedSrc !== src

  useEffect(() => {
    // A PDF frame does not reliably fire `load` in every browser, so a timeout is
    // what stops the spinner from becoming permanent.
    const timer = setTimeout(() => setLoadedSrc(src), 3000)
    return () => clearTimeout(timer)
  }, [src])

  return (
    <div className="pdfv-frame">
      <div className="pdfv-frame-bar">
        <span className="pdfv-frame-name" title={fileName}>{fileName || 'report.pdf'}</span>
        <div className="pdfv-frame-actions">
          <button type="button" className="pdfv-icon-button" onClick={onReload} title="Reload the file from the server">
            <RefreshCw size={13} />
          </button>
          <a className="pdfv-icon-button" href={src} target="_blank" rel="noopener noreferrer" title="Open the PDF in a new tab">
            <ExternalLink size={13} />
          </a>
        </div>
      </div>

      <div className="pdfv-frame-body">
        {loading && (
          <div className="pdfv-frame-overlay">
            <LoaderCircle size={18} className="animate-spin" />
            <span>Loading the PDF…</span>
          </div>
        )}
        {failed ? (
          <div className="pdfv-frame-overlay is-error">
            <FileWarning size={18} />
            <span>This browser could not display the PDF inline. Use the open-in-new-tab button.</span>
          </div>
        ) : (
          <iframe
            key={src}
            src={src}
            title={fileName || 'Report PDF'}
            className="pdfv-frame-pdf"
            // Deliberately not sandboxed: the response is `application/pdf` from
            // our own origin and is handed to the browser's PDF viewer, which is
            // not a document running in this origin. Sandboxing it makes some
            // browsers refuse to render the file at all.
            onLoad={() => setLoadedSrc(src)}
            onError={() => setFailedSrc(src)}
          />
        )}
      </div>
    </div>
  )
}

export default PdfFilePreview
