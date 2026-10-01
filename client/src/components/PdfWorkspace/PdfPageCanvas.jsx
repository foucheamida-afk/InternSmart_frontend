import { useEffect, useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.js?url'
import api from '../../api/axios'

// Configure PDF.js worker URL using local Vite bundle
if (typeof window !== 'undefined') {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl || 'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js'
  } catch {
    // Ignore worker set exception
  }
}

const pdfDocCache = new Map()

const loadPdfDoc = async (reportId, revision) => {
  const cacheKey = `${reportId}:${revision || '0'}`
  if (pdfDocCache.has(cacheKey)) return pdfDocCache.get(cacheKey)

  try {
    const endpoint = `/workspace/reports/${reportId}/pdf/file${revision ? `?v=${revision}` : ''}`
    const response = await api.get(endpoint, { responseType: 'arraybuffer' })
    const data = new Uint8Array(response.data)

    // Validate PDF magic bytes header (%PDF)
    const isPdfHeader = data.length >= 4 && data[0] === 0x25 && data[1] === 0x50 && data[2] === 0x44 && data[3] === 0x46
    if (!isPdfHeader) {
      const text = new TextDecoder().decode(data)
      let errMsg = 'The server did not return a valid PDF document.'
      try {
        const parsed = JSON.parse(text)
        if (parsed.message) errMsg = parsed.message
      } catch {
        // Not JSON
      }
      throw new Error(errMsg)
    }

    const loadingTask = pdfjsLib.getDocument({
      data: data.slice(0),
      cMapUrl: 'https://unpkg.com/pdfjs-dist@3.11.174/cmaps/',
      cMapPacked: true,
      isEvalSupported: false,
      useSystemFonts: true,
      disableFontFace: false,
    })
    const pdfDoc = await loadingTask.promise

    console.log(`[DEBUG-PDF.JS] Document loaded successfully. numPages: ${pdfDoc.numPages}, ArrayBuffer size: ${data.byteLength} bytes`)
    pdfDocCache.set(cacheKey, pdfDoc)
    return pdfDoc
  } catch (error) {
    console.error('[DEBUG-PDF.JS] Failed to load PDF document binary:', error)
    pdfDocCache.delete(cacheKey)
    throw error
  }
}

export const PdfPageCanvas = ({ reportId, pageNumber = 1, width = 595.28, height = 841.89, revision }) => {
  const containerRef = useRef(null)
  const canvasRef = useRef(null)
  const renderTaskRef = useRef(null)
  const lastRenderedKeyRef = useRef('')

  const [loading, setLoading] = useState(true)
  const [renderError, setRenderError] = useState(null)
  const [retryCount, setRetryCount] = useState(0)
  const [isVisible, setIsVisible] = useState(pageNumber <= 2)

  // IntersectionObserver for view detection on long documents
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const rootContainer = container.closest('.pdfw-main') || null

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (entry) {
          setIsVisible(entry.isIntersecting)
        }
      },
      { root: rootContainer, rootMargin: '1200px 0px 1200px 0px', threshold: 0.01 }
    )

    observer.observe(container)
    return () => {
      observer.disconnect()
    }
  }, [])

  // Render PDF page to canvas with deduplication to prevent infinite render loops
  useEffect(() => {
    if (!isVisible) {
      lastRenderedKeyRef.current = ''
      setLoading(false)
      return
    }

    const targetW = Math.round(width)
    const targetH = Math.round(height)
    const renderKey = `${reportId}:${pageNumber}:${targetW}:${targetH}:${revision}:${retryCount}`

    if (lastRenderedKeyRef.current === renderKey && canvasRef.current) {
      console.log(`[DEBUG-PDF-CANVAS] Page ${pageNumber} render skipped (already rendered with key: ${renderKey})`)
      return
    }

    let cancelled = false

    const render = async () => {
      setRenderError(null)

      try {
        console.log(`[DEBUG-PDF-CANVAS] Starting render for Page ${pageNumber}. targetW: ${targetW}, targetH: ${targetH}`)
        const pdfDoc = await loadPdfDoc(reportId, revision)
        if (cancelled) return

        const page = await pdfDoc.getPage(pageNumber)
        if (cancelled) return

        // Direct PDF.js Text Extraction Verification
        try {
          const directTextContent = await page.getTextContent()
          console.log(`[DEBUG-PDF-DIRECT-TEXT] Page ${pageNumber} direct getTextContent() items count: ${directTextContent.items.length}`)
          if (directTextContent.items.length > 0) {
            console.log(`[DEBUG-PDF-DIRECT-TEXT] Page ${pageNumber} first 3 text items:`, directTextContent.items.slice(0, 3).map(it => ({ str: it.str, transform: it.transform, width: it.width, height: it.height, fontName: it.fontName })))
          }
        } catch (textErr) {
          console.error(`[DEBUG-PDF-DIRECT-TEXT] Error getting text content for page ${pageNumber}:`, textErr)
        }

        const canvas = canvasRef.current
        if (!canvas) {
          console.warn(`[DEBUG-PDF-CANVAS] Page ${pageNumber} canvas ref is NULL`)
          return
        }

        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const dpr = Math.min(window.devicePixelRatio || 1, 2)
        const pdfViewport = page.getViewport({ scale: 1 })
        console.log(`[DEBUG-PDF-VIEWPORT] Page ${pageNumber} unscaled PDF viewport: width=${pdfViewport.width}, height=${pdfViewport.height}`)

        const scaleX = targetW / pdfViewport.width
        const viewport = page.getViewport({ scale: scaleX * dpr })
        console.log(`[DEBUG-PDF-VIEWPORT] Page ${pageNumber} scaled viewport (dpr=${dpr}, scaleX=${scaleX}): width=${viewport.width}, height=${viewport.height}`)

        const renderWidth = Math.round(viewport.width)
        const renderHeight = Math.round(viewport.height)

        if (renderWidth <= 0 || renderHeight <= 0) {
          console.warn(`[DEBUG-PDF-CANVAS] Invalid render dimensions: ${renderWidth}x${renderHeight}`)
          return
        }

        canvas.width = renderWidth
        canvas.height = renderHeight
        canvas.style.width = '100%'
        canvas.style.height = '100%'

        // Pre-fill canvas with white background
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, renderWidth, renderHeight)

        // Cancel previous render task if active
        if (renderTaskRef.current) {
          try {
            renderTaskRef.current.cancel()
          } catch {
            // Ignore cancel exception
          }
        }

        const renderContext = {
          canvasContext: ctx,
          viewport,
        }

        console.log(`[DEBUG-PDF-CANVAS] Executing page.render() for Page ${pageNumber} onto canvas ${renderWidth}x${renderHeight}...`)
        const task = page.render(renderContext)
        renderTaskRef.current = task

        await task.promise
        console.log(`[DEBUG-PDF-CANVAS] page.render() PROMISE RESOLVED SUCCESSFULLY for Page ${pageNumber}!`)

        // Pixel check on rendered canvas
        try {
          const imgData = ctx.getImageData(0, 0, renderWidth, renderHeight)
          const data = imgData.data
          let nonWhitePixels = 0
          for (let i = 0; i < data.length; i += 16) {
            const r = data[i], g = data[i+1], b = data[i+2], a = data[i+3]
            // check if pixel is not pure white (255,255,255)
            if (r < 250 || g < 250 || b < 250 || a < 250) {
              nonWhitePixels++
            }
          }
          console.log(`[DEBUG-PDF-CANVAS-PIXELS] Page ${pageNumber} canvas non-white pixels sample count: ${nonWhitePixels} (out of ${data.length / 16} sampled). Canvas HAS PIXELS: ${nonWhitePixels > 0}`)
        } catch (pxErr) {
          console.error(`[DEBUG-PDF-CANVAS-PIXELS] Pixel verification error:`, pxErr)
        }

        if (!cancelled) {
          lastRenderedKeyRef.current = renderKey
          setLoading(false)
          renderTaskRef.current = null
        }
      } catch (err) {
        if (!cancelled && err?.name !== 'RenderingCancelledException') {
          console.warn(`[DEBUG-PDF-CANVAS-ERROR] (page ${pageNumber}):`, err?.message || err)
          setRenderError(err?.message || 'Failed to render PDF page background')
          setLoading(false)
        }
      }
    }

    render()

    return () => {
      cancelled = true
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel()
        } catch {
          // Ignore
        }
      }
    }
  }, [height, pageNumber, reportId, revision, width, retryCount, isVisible])

  return (
    <div
      ref={containerRef}
      className="pdfw-canvas-layer"
      style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none' }}
    >
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
      {loading && (
        <div className="pdfw-canvas-loading" style={{ position: 'absolute', inset: 0, background: 'rgba(255, 255, 255, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="pdfw-spinner" style={{ width: '18px', height: '18px', border: '2px solid #ccc', borderTopColor: '#ff7a00', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        </div>
      )}
      {renderError && (
        <div className="pdfw-canvas-error" style={{ position: 'absolute', inset: 0, background: '#ffffff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: '#888888', pointerEvents: 'auto', padding: '12px', textAlign: 'center' }}>
          <span>{renderError}</span>
          <button
            type="button"
            className="pdfw-ghost"
            style={{ marginTop: '8px', fontSize: '11px', padding: '3px 10px' }}
            onClick={() => setRetryCount((c) => c + 1)}
          >
            Retry Loading Page
          </button>
        </div>
      )}
    </div>
  )
}

export default PdfPageCanvas
