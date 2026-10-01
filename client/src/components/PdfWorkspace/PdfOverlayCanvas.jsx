import React, { useState, useRef, useEffect } from 'react'
import { Trash2, Move, Type, Image as ImageIcon, Highlighter, Edit3, Copy, EyeOff } from 'lucide-react'

/**
 * Interactive PDF Page Overlay Layer
 *
 * Positioned directly on top of rendered PDF.js page canvas.
 * Elements use PDF point coordinates (72 DPI) so zoom and window resize
 * maintain 100% position accuracy.
 *
 * screenCoordinate = pdfCoordinate * scale
 */
export const PdfOverlayCanvas = ({
  pageNum = 1,
  elements = [],
  allElements = [],
  onUpdateElements,
  onDeleteElement,
  activeTool = 'select',
  scale = 1,
  pdfWidth = 595.28,
  pdfHeight = 841.89,
  selectedId = null,
  onSelectElement,
  canWrite = true,
}) => {
  const containerRef = useRef(null)
  const [draggingId, setDraggingId] = useState(null)
  const [resizingId, setResizingId] = useState(null)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, initialElemX: 0, initialElemY: 0, initialW: 0, initialH: 0 })
  const [editingTextId, setEditingTextId] = useState(null)
  const [contextMenu, setContextMenu] = useState(null) // { x, y, elem }

  const fullList = allElements.length > 0 ? allElements : elements
  const elementsRef = useRef(fullList)
  elementsRef.current = fullList

  // Close context menu on outside click
  useEffect(() => {
    const handleOutsideClick = () => setContextMenu(null)
    window.addEventListener('click', handleOutsideClick)
    return () => window.removeEventListener('click', handleOutsideClick)
  }, [])

  // Filter elements belonging to this page (if elements is already filtered, use elements directly)
  const pageElements = Array.isArray(elements)
    ? elements.filter((el) => Number(el.page) === Number(pageNum) && !el.isDeleted)
    : []

  useEffect(() => {
    console.log(`[DEBUG-OVERLAY] Page ${pageNum} overlay rendering ${pageElements.length} elements (out of ${elements.length} total elements). scale: ${scale}, pdfWidth: ${pdfWidth}, pdfHeight: ${pdfHeight}`)
    if (pageElements.length > 0) {
      console.log(`[DEBUG-OVERLAY] Page ${pageNum} first 3 elements:`, pageElements.slice(0, 3).map(el => ({
        id: el.id, type: el.type, isOriginal: el.isOriginal, x: el.x, y: el.y, width: el.width, height: el.height, text: el.text?.slice(0, 30), color: el.color, bgColor: el.bgColor
      })))
    }
  }, [pageNum, pageElements.length, elements.length, scale, pdfWidth, pdfHeight])

  // Handle canvas click to deselect or insert new element
  const handleCanvasClick = (e) => {
    if (!canWrite) return
    const isOverlayElement = e.target.closest('.pdfw-overlay-element')
    if (isOverlayElement) return

    if (contextMenu) setContextMenu(null)
    if (selectedId) onSelectElement(null)

    const rect = containerRef.current.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const clickY = e.clientY - rect.top

    const pdfX = Math.max(0, Math.min(pdfWidth - 50, clickX / scale))
    const pdfY = Math.max(0, Math.min(pdfHeight - 20, clickY / scale))

    if (activeTool === 'text') {
      const newElem = {
        id: `txt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        type: 'text',
        page: pageNum,
        x: Math.round(pdfX),
        y: Math.round(pdfY),
        width: 180,
        height: 32,
        text: 'New Text Box',
        fontSize: 14,
        fontFamily: 'Helvetica',
        color: '#000000',
        bgColor: '#ffffff',
        bold: false,
        italic: false,
        alignment: 'left',
        isNew: true,
      }
      onUpdateElements([...fullList, newElem], undefined, true)
      onSelectElement(newElem.id)
      setEditingTextId(newElem.id)
    } else if (activeTool === 'highlight') {
      const newElem = {
        id: `hl-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        type: 'highlight',
        page: pageNum,
        x: Math.round(pdfX),
        y: Math.round(pdfY),
        width: 200,
        height: 24,
        color: '#ffeb3b',
        opacity: 0.38,
        isNew: true,
      }
      onUpdateElements([...fullList, newElem], undefined, true)
      onSelectElement(newElem.id)
    }
  }

  // Double click anywhere shortcut to insert text box
  const handleCanvasDoubleClick = (e) => {
    if (!canWrite) return
    const isOverlayElement = e.target.closest('.pdfw-overlay-element')
    if (isOverlayElement) return

    const rect = containerRef.current.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const clickY = e.clientY - rect.top

    const pdfX = Math.max(0, Math.min(pdfWidth - 50, clickX / scale))
    const pdfY = Math.max(0, Math.min(pdfHeight - 20, clickY / scale))

    const newElem = {
      id: `txt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      type: 'text',
      page: pageNum,
      x: Math.round(pdfX),
      y: Math.round(pdfY),
      width: 180,
      height: 32,
      text: 'New Text Box',
      fontSize: 14,
      fontFamily: 'Helvetica',
      color: '#000000',
      bgColor: '#ffffff',
      bold: false,
      italic: false,
      alignment: 'left',
      isNew: true,
    }
    onUpdateElements([...fullList, newElem], undefined, true)
    onSelectElement(newElem.id)
    setEditingTextId(newElem.id)
  }

  // Mouse drag element handler (prevents native browser HTML image ghost drag!)
  const handleMouseDownElem = (e, elem) => {
    if (!canWrite) return
    e.stopPropagation()
    e.preventDefault() // Prevents native HTML5 image drag & text selection traps
    onSelectElement(elem.id)
    setContextMenu(null)

    setDraggingId(elem.id)
    setDragStart({
      x: e.clientX,
      y: e.clientY,
      initialElemX: elem.x,
      initialElemY: elem.y,
      initialW: elem.width,
      initialH: elem.height,
    })
  }

  // Mouse resize element handler
  const handleMouseDownResize = (e, elem) => {
    if (!canWrite) return
    e.stopPropagation()
    e.preventDefault()
    onSelectElement(elem.id)
    setResizingId(elem.id)
    setDragStart({
      x: e.clientX,
      y: e.clientY,
      initialElemX: elem.x,
      initialElemY: elem.y,
      initialW: elem.width,
      initialH: elem.height,
    })
  }

  // Right-click Context Menu handler
  const handleContextMenuElem = (e, elem) => {
    if (!canWrite) return
    e.preventDefault()
    e.stopPropagation()
    onSelectElement(elem.id)
    const rect = containerRef.current.getBoundingClientRect()
    setContextMenu({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      elem,
    })
  }

  // Global mousemove and mouseup listeners for smooth dragging and resizing
  useEffect(() => {
    const handleMouseMove = (e) => {
      const currentList = elementsRef.current
      if (draggingId) {
        const dx = (e.clientX - dragStart.x) / scale
        const dy = (e.clientY - dragStart.y) / scale

        const updated = currentList.map((el) => {
          if (el.id === draggingId) {
            const newX = Math.max(0, Math.min(pdfWidth - (el.width || 20), dragStart.initialElemX + dx))
            const newY = Math.max(0, Math.min(pdfHeight - (el.height || 20), dragStart.initialElemY + dy))
            return {
              ...el,
              x: Math.round(newX),
              y: Math.round(newY),
              moved: true,
              bgColor: el.isOriginal ? (el.bgColor && el.bgColor !== 'transparent' ? el.bgColor : '#ffffff') : el.bgColor,
            }
          }
          return el
        })
        onUpdateElements(updated, undefined, false)
      } else if (resizingId) {
        const dx = (e.clientX - dragStart.x) / scale
        const dy = (e.clientY - dragStart.y) / scale

        const updated = currentList.map((el) => {
          if (el.id === resizingId) {
            const newW = Math.max(20, Math.min(pdfWidth - el.x, dragStart.initialW + dx))
            const newH = Math.max(14, Math.min(pdfHeight - el.y, dragStart.initialH + dy))
            return {
              ...el,
              width: Math.round(newW),
              height: Math.round(newH),
              moved: true,
            }
          }
          return el
        })
        onUpdateElements(updated, undefined, false)
      }
    }

    const handleMouseUp = () => {
      if (draggingId || resizingId) {
        onUpdateElements(elementsRef.current, undefined, true)
        setDraggingId(null)
        setResizingId(null)
      }
    }

    if (draggingId || resizingId) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [draggingId, resizingId, dragStart, scale, pdfWidth, pdfHeight, onUpdateElements])

  // Text inline edit change
  const handleTextChange = (id, newText) => {
    const updated = fullList.map((el) => {
      if (el.id === id) {
        return {
          ...el,
          text: newText,
          textChanged: true,
          bgColor: el.isOriginal ? (el.bgColor && el.bgColor !== 'transparent' ? el.bgColor : '#ffffff') : el.bgColor,
        }
      }
      return el
    })
    onUpdateElements(updated, undefined, false)
  }

  // Duplicate an element
  const handleDuplicate = (elem) => {
    const clone = {
      ...elem,
      id: `${elem.type || 'txt'}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      x: elem.x + 12,
      y: elem.y + 12,
      isOriginal: false,
      isNew: true,
    }
    onUpdateElements([...fullList, clone], undefined, true)
    onSelectElement(clone.id)
    setContextMenu(null)
  }

  return (
    <div
      ref={containerRef}
      className="pdfw-overlay-container"
      onClick={handleCanvasClick}
      onDoubleClick={handleCanvasDoubleClick}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: `${pdfWidth * scale}px`,
        height: `${pdfHeight * scale}px`,
        pointerEvents: 'auto',
        zIndex: 10,
        cursor: activeTool === 'text' ? 'text' : activeTool === 'highlight' ? 'crosshair' : 'default',
      }}
    >
      {/* Context Menu Popover */}
      {contextMenu && (
        <div
          style={{
            position: 'absolute',
            left: `${contextMenu.x}px`,
            top: `${contextMenu.y}px`,
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)',
            zIndex: 100,
            padding: '4px',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            minWidth: '150px',
            fontSize: '12px',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.elem.type === 'text' && (
            <button
              type="button"
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', border: 'none', background: 'transparent', width: '100%', textAlign: 'left', cursor: 'pointer', borderRadius: '4px' }}
              onClick={() => {
                const target = contextMenu.elem
                // Guarantee original PDF text is replaced with white background cover
                handleTextChange(target.id, target.text || '')
                setEditingTextId(target.id)
                setContextMenu(null)
              }}
            >
              <Edit3 size={13} style={{ color: '#3b82f6' }} /> Edit / Replace Text
            </button>
          )}

          <button
            type="button"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', border: 'none', background: 'transparent', width: '100%', textAlign: 'left', cursor: 'pointer', borderRadius: '4px' }}
            onClick={() => handleDuplicate(contextMenu.elem)}
          >
            <Copy size={13} style={{ color: '#10b981' }} /> Duplicate Box
          </button>

          <button
            type="button"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', border: 'none', background: 'transparent', width: '100%', textAlign: 'left', cursor: 'pointer', borderRadius: '4px', color: '#ef4444' }}
            onClick={() => {
              onDeleteElement(contextMenu.elem.id)
              setContextMenu(null)
            }}
          >
            <Trash2 size={13} /> Delete Element
          </button>
        </div>
      )}

      {pageElements.map((elem) => {
        const isSelected = selectedId === elem.id
        const left = elem.x * scale
        const top = elem.y * scale
        const width = elem.width * scale
        const height = elem.height * scale

        // Highlight element
        if (elem.type === 'highlight') {
          return (
            <div
              key={elem.id}
              className={`pdfw-overlay-element is-highlight ${isSelected ? 'is-selected' : ''}`}
              onMouseDown={(e) => handleMouseDownElem(e, elem)}
              onContextMenu={(e) => handleContextMenuElem(e, elem)}
              style={{
                position: 'absolute',
                left: `${left}px`,
                top: `${top}px`,
                width: `${width}px`,
                height: `${height}px`,
                backgroundColor: elem.color || '#ffeb3b',
                opacity: elem.opacity || 0.38,
                mixBlendMode: 'multiply',
                border: isSelected ? '2px solid #3b82f6' : '1px dashed transparent',
                borderRadius: '2px',
                cursor: canWrite ? 'move' : 'default',
              }}
            >
              {isSelected && canWrite && (
                <>
                  <div
                    className="pdfw-resize-handle br"
                    onMouseDown={(e) => handleMouseDownResize(e, elem)}
                  />
                  <button
                    type="button"
                    className="pdfw-elem-delete"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDeleteElement(elem.id)
                    }}
                    title="Delete highlight"
                  >
                    <Trash2 size={12} />
                  </button>
                </>
              )}
            </div>
          )
        }

        // Image element
        if (elem.type === 'image') {
          return (
            <div
              key={elem.id}
              className={`pdfw-overlay-element is-image ${isSelected ? 'is-selected' : ''}`}
              onMouseDown={(e) => handleMouseDownElem(e, elem)}
              onContextMenu={(e) => handleContextMenuElem(e, elem)}
              style={{
                position: 'absolute',
                left: `${left}px`,
                top: `${top}px`,
                width: `${width}px`,
                height: `${height}px`,
                border: isSelected ? '2px solid #3b82f6' : '1px solid transparent',
                boxSizing: 'border-box',
                cursor: canWrite ? 'move' : 'default',
                transform: elem.rotation ? `rotate(${elem.rotation}deg)` : 'none',
                userSelect: 'none',
              }}
            >
              {elem.src ? (
                <img
                  src={elem.src}
                  alt="PDF figure or overlay image"
                  onDragStart={(e) => e.preventDefault()}
                  style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none', userSelect: 'none' }}
                />
              ) : (
                <div className="pdfw-img-placeholder" style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(241, 245, 249, 0.8)', border: '1px dashed #94a3b8', borderRadius: '4px', fontSize: '11px', color: '#64748b', gap: '4px' }}>
                  <ImageIcon size={16} /> Image Box
                </div>
              )}

              {isSelected && canWrite && (
                <>
                  <div
                    className="pdfw-resize-handle br"
                    onMouseDown={(e) => handleMouseDownResize(e, elem)}
                  />
                  <button
                    type="button"
                    className="pdfw-elem-delete"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDeleteElement(elem.id)
                    }}
                    title="Delete image"
                  >
                    <Trash2 size={12} />
                  </button>
                </>
              )}
            </div>
          )
        }

        // Text element
        const fontPx = Math.max(8, (elem.fontSize || 12) * scale)
        const isEditingThis = editingTextId === elem.id

        const showWhiteCover = elem.isOriginal && (elem.textChanged || elem.moved || (elem.bgColor && elem.bgColor !== 'transparent'))
        const bgColorStyle = showWhiteCover
          ? (elem.bgColor || '#ffffff')
          : (elem.bgColor && elem.bgColor !== 'transparent' ? elem.bgColor : 'transparent')

        const isUneditedOriginal = elem.isOriginal && !showWhiteCover
        const textColorStyle = isUneditedOriginal
          ? 'transparent'
          : (elem.color && elem.color !== 'transparent' ? elem.color : '#111111')

        return (
          <div
            key={elem.id}
            className={`pdfw-overlay-element is-text ${isSelected ? 'is-selected' : ''} ${elem.isOriginal ? 'is-pdf-original' : ''}`}
            onMouseDown={(e) => handleMouseDownElem(e, elem)}
            onContextMenu={(e) => handleContextMenuElem(e, elem)}
            onDoubleClick={(e) => {
              e.stopPropagation()
              if (canWrite) {
                onSelectElement(elem.id)
                // Mark text as changed and apply white cover background to replace original text cleanly
                handleTextChange(elem.id, elem.text || '')
                setEditingTextId(elem.id)
              }
            }}
            style={{
              position: 'absolute',
              left: `${left}px`,
              top: `${top}px`,
              width: `${width}px`,
              height: `${height}px`,
              backgroundColor: bgColorStyle,
              border: isSelected ? '2px dashed #3b82f6' : showWhiteCover ? '1px solid #e2e8f0' : '1px solid transparent',
              boxSizing: 'border-box',
              cursor: canWrite ? (isEditingThis ? 'text' : 'move') : 'default',
              padding: '1px 2px',
              borderRadius: '2px',
              zIndex: isSelected || isEditingThis ? 25 : 12,
            }}
          >
            {isEditingThis && canWrite ? (
              <textarea
                autoFocus
                value={elem.text || ''}
                onChange={(e) => handleTextChange(elem.id, e.target.value)}
                onBlur={() => {
                  setEditingTextId(null)
                  onUpdateElements(elementsRef.current, undefined, true)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setEditingTextId(null)
                    onUpdateElements(elementsRef.current, undefined, true)
                  }
                }}
                style={{
                  width: '100%',
                  height: '100%',
                  fontSize: `${fontPx}px`,
                  fontFamily: elem.fontFamily || 'Helvetica',
                  fontWeight: elem.bold ? 'bold' : 'normal',
                  fontStyle: elem.italic ? 'italic' : 'normal',
                  color: elem.color || '#111111',
                  backgroundColor: 'transparent',
                  textAlign: elem.alignment || 'left',
                  border: 'none',
                  outline: 'none',
                  resize: 'none',
                  lineHeight: elem.lineHeight || 1.15,
                  padding: 0,
                  margin: 0,
                }}
              />
            ) : (
              <div
                onClick={(e) => {
                  e.stopPropagation()
                  if (canWrite) {
                    onSelectElement(elem.id)
                  }
                }}
                style={{
                  width: '100%',
                  height: '100%',
                  fontSize: `${fontPx}px`,
                  fontFamily: elem.fontFamily || 'Helvetica',
                  fontWeight: elem.bold ? 'bold' : 'normal',
                  fontStyle: elem.italic ? 'italic' : 'normal',
                  color: textColorStyle,
                  opacity: 1,
                  textAlign: elem.alignment || 'left',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  lineHeight: elem.lineHeight || 1.15,
                  userSelect: 'none',
                  cursor: 'move',
                  overflow: 'visible',
                }}
              >
                {elem.text || ''}
              </div>
            )}

            {isSelected && canWrite && (
              <>
                <div
                  className="pdfw-resize-handle br"
                  onMouseDown={(e) => handleMouseDownResize(e, elem)}
                  title="Resize text box"
                />
                <button
                  type="button"
                  className="pdfw-elem-delete"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDeleteElement(elem.id)
                  }}
                  title="Delete text box"
                >
                  <Trash2 size={12} />
                </button>
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default PdfOverlayCanvas
