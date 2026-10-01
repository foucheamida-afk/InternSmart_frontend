import React from 'react'
import PdfPageCanvas from './PdfPageCanvas'
import PdfOverlayCanvas from './PdfOverlayCanvas'

/**
 * Single PDF Page View Component
 *
 * Renders the original PDF page background using PDF.js along with the transparent
 * interactive overlay layer mapped to PDF page coordinates.
 */
export const PdfPageView = ({
  reportId,
  pageNumber = 1,
  pdfWidth = 595.28,
  pdfHeight = 841.89,
  zoom = 100,
  revision = 0,
  elements = [],
  allElements = [],
  onUpdateElements,
  onDeleteElement,
  activeTool = 'select',
  selectedId = null,
  onSelectElement,
  canWrite = true,
}) => {
  const scale = zoom / 100
  const widthPx = Math.round(pdfWidth * scale)
  const heightPx = Math.round(pdfHeight * scale)

  return (
    <div
      className="pdfw-page-wrapper"
      data-page-number={pageNumber}
      id={`pdf-page-${pageNumber}`}
      style={{
        position: 'relative',
        width: `${widthPx}px`,
        height: `${heightPx}px`,
        margin: '0 auto 24px auto',
        backgroundColor: '#ffffff',
        color: '#111111',
        boxShadow: '0 4px 18px rgba(0, 0, 0, 0.18)',
        borderRadius: '2px',
        overflow: 'hidden',
      }}
    >
      {/* 1. Original PDF Background rendered via PDF.js */}
      <PdfPageCanvas
        reportId={reportId}
        pageNumber={pageNumber}
        width={widthPx}
        height={heightPx}
        revision={revision}
      />

      {/* 2. Interactive Overlay Layer */}
      <PdfOverlayCanvas
        pageNum={pageNumber}
        elements={elements}
        allElements={allElements.length > 0 ? allElements : elements}
        onUpdateElements={onUpdateElements}
        onDeleteElement={onDeleteElement}
        activeTool={activeTool}
        scale={scale}
        pdfWidth={pdfWidth}
        pdfHeight={pdfHeight}
        selectedId={selectedId}
        onSelectElement={onSelectElement}
        canWrite={canWrite}
      />

      <div
        className="pdfw-page-badge"
        style={{
          position: 'absolute',
          bottom: '8px',
          right: '12px',
          fontSize: '11px',
          color: '#888888',
          pointerEvents: 'none',
          zIndex: 20,
        }}
      >
        Page {pageNumber}
      </div>
    </div>
  )
}

export default PdfPageView
