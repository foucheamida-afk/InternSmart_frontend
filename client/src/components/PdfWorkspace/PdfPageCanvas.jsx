import { useEffect, useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { pdfFileViewerUrl } from '../../services/pdfWorkspaceService'

// Configure PDF.js worker URL
if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`
}

const pdfDocCache = new Map()

const loadPdfDoc = async (url) => {
  if (pdfDocCache.has(url)) return pdfDocCache.get(url)
  const loadingTask = pdfjsLib.getDocument({
    url,
    withCredentials: false,
  })
  const pdfDoc = await loadingTask.promise
  pdfDocCache.set(url, pdfDoc)
  return pdfDoc
}

export const PdfPageCanvas = ({ reportId, pageNumber = 1, width = 612, height = 792, revision }) => {
  const canvasRef = useRef(null)
  const [loading, setLoading] = useState(true)
  const [renderError, setRenderError] = useState(null)

  useEffect(() => {
    let cancelled = false
    const url = pdfFileViewerUrl(reportId, revision)

    const render = async () => {
      setLoading(true)
      setRenderError(null)

      try {
        const pdfDoc = await loadPdfDoc(url)
        if (cancelled) return

        const page = await pdfDoc.getPage(pageNumber)
        if (cancelled) return

        const canvas = canvasRef.current
        if (!canvas) return

        const ctx = canvas.getContext('2d')
        const dpr = window.devicePixelRatio || 1

        // Real PDF viewport scale based on page dimensions
        const pdfViewport = page.getViewport({ scale: 1 })
        const scaleX = width / pdfViewport.width
        const viewport = page.getViewport({ scale: scaleX * dpr })

        canvas.width = Math.round(viewport.width)
        canvas.height = Math.round(viewport.height)
        canvas.style.width = `${width}pt`
        canvas.style.height = `${height}pt`

        const renderContext = {
          canvasContext: ctx,
          viewport,
        }

        await page.render(renderContext).promise
        if (!cancelled) setLoading(false)
      } catch (err) {
        if (!cancelled) {
          console.warn(`PdfPageCanvas error (page ${pageNumber}):`, err.message)
          setRenderError(err.message)
          setLoading(false)
        }
      }
    }

    render()
    return () => {
      cancelled = true
    }
  }, [height, pageNumber, reportId, revision, width])

  return (
    <div className="pdfw-canvas-layer" style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none' }}>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
      {loading && (
        <div className="pdfw-canvas-loading">
          <div className="pdfw-spinner" />
        </div>
      )}
      {renderError && (
        <div className="pdfw-canvas-error">
          <span>Failed to render original PDF background</span>
        </div>
      )}
    </div>
  )
}

export default PdfPageCanvas
