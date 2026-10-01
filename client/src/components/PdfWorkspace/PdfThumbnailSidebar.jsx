import React from 'react'
import { FileText, Plus, Trash2, ArrowUp, ArrowDown, RotateCw } from 'lucide-react'

export const PdfThumbnailSidebar = ({
  pageCount = 1,
  currentPage = 1,
  onSelectPage,
  pageRotations = {},
  onRotatePage,
  onAddBlankPage,
  onDeletePage,
  onMovePageUp,
  onMovePageDown,
  canWrite = true,
}) => {
  return (
    <aside className="pdfw-sidebar-thumbnails">
      <div className="pdfw-sidebar-header">
        <FileText size={14} />
        <span>Pages ({pageCount})</span>
        {canWrite && (
          <button
            type="button"
            className="pdfw-icon-btn"
            onClick={onAddBlankPage}
            title="Add new blank page"
          >
            <Plus size={14} />
          </button>
        )}
      </div>

      <div className="pdfw-thumbnails-list">
        {Array.from({ length: pageCount }).map((_, idx) => {
          const pageNum = idx + 1
          const isActive = currentPage === pageNum
          const rotation = pageRotations[pageNum] || 0

          return (
            <div
              key={pageNum}
              className={`pdfw-thumbnail-card ${isActive ? 'is-active' : ''}`}
              onClick={(e) => {
                e.stopPropagation()
                onSelectPage(pageNum)
              }}
            >
              <div
                className="pdfw-thumbnail-preview"
                style={{ transform: `rotate(${rotation}deg)` }}
              >
                <div className="pdfw-thumbnail-paper">
                  <div className="pdfw-thumbnail-lines">
                    <div className="line title" />
                    <div className="line body" />
                    <div className="line body short" />
                  </div>
                </div>
              </div>

              <div className="pdfw-thumbnail-footer">
                <span className="pdfw-thumbnail-label">Page {pageNum}</span>

                {canWrite && (
                  <div className="pdfw-thumbnail-actions" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="pdfw-micro-btn"
                      onClick={() => onRotatePage && onRotatePage(pageNum)}
                      title="Rotate page 90°"
                    >
                      <RotateCw size={11} />
                    </button>
                    {pageNum > 1 && (
                      <button
                        type="button"
                        className="pdfw-micro-btn"
                        onClick={() => onMovePageUp && onMovePageUp(pageNum)}
                        title="Move page up"
                      >
                        <ArrowUp size={11} />
                      </button>
                    )}
                    {pageNum < pageCount && (
                      <button
                        type="button"
                        className="pdfw-micro-btn"
                        onClick={() => onMovePageDown && onMovePageDown(pageNum)}
                        title="Move page down"
                      >
                        <ArrowDown size={11} />
                      </button>
                    )}
                    {pageCount > 1 && (
                      <button
                        type="button"
                        className="pdfw-micro-btn is-danger"
                        onClick={() => onDeletePage && onDeletePage(pageNum)}
                        title="Delete page"
                      >
                        <Trash2 size={11} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </aside>
  )
}

export default PdfThumbnailSidebar
