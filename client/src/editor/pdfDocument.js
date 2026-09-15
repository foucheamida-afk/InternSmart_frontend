import { jsPDF } from 'jspdf'

/**
 * The PDF document model.
 *
 * A PDF report is imported, interpreted, edited - and then written back out as a
 * PDF. This module owns both ends of that: the helpers that read a stored/edited
 * document tree, and the renderer that turns it into a real A4 PDF.
 *
 * The rendering deliberately does not try to reproduce the original file's
 * drawing instructions. It lays the *text* out again with its own margins, line
 * wrapping and page breaks - which is the only way edited text can reflow. That
 * is the whole point of the exercise: deleting the word "modern" shortens the
 * paragraph instead of leaving a gap.
 *
 * jsPDF is already a dependency (the Word workspace exports PDFs with it), so no
 * new package is involved, and the output is a text PDF - selectable, searchable,
 * and small - rather than a screenshot of the page.
 */

// A4, in points, with 2 cm margins.
export const PAGE = {
  width: 595.28,
  height: 841.89,
  marginX: 56.7,
  marginY: 56.7,
}

export const CONTENT_WIDTH = PAGE.width - PAGE.marginX * 2

export const EMPTY_DOC = { type: 'doc', content: [{ type: 'paragraph' }] }

const HEADING_SIZES = { 1: 18, 2: 15, 3: 13, 4: 12, 5: 11, 6: 10.5 }
const BODY_SIZE = 11.5
const LINE_FACTOR = 1.38
const SPACING = { paragraph: 8, headingBefore: 16, headingAfter: 7, listItem: 3, image: 10, quote: 8 }

/**
 * Mapping a document font onto one of the 14 fonts every PDF reader has.
 *
 * Order matters and the generic families are matched explicitly: "sans-serif"
 * contains the word "serif", so a serif-first pattern set every sans-serif block
 * in Times. Times is wider than Helvetica, so blocks that fitted on one line in
 * the original wrapped onto two - which is what pushed text into its neighbour
 * and made a round trip look like it had moved.
 */
const FONT_FAMILIES = [
  [/mono|courier|consolas|menlo/i, 'courier'],
  [/sans-serif|helvetica|arial|calibri|segoe|verdana|tahoma|roboto|lato|inter/i, 'helvetica'],
  [/serif|times|georgia|garamond|cambria|book|roman/i, 'times'],
]
const fontFamilyFor = (value) => FONT_FAMILIES.find(([pattern]) => pattern.test(String(value || '')))?.[1] || 'helvetica'

// --- reading the document ---------------------------------------------------

/** All text inside a node, with an optional per-node override. */
export const textOfNode = (node) => {
  if (!node || typeof node !== 'object') return ''
  if (typeof node.text === 'string') return node.text
  return (node.content || []).map(textOfNode).filter(Boolean).join(' ')
}

/**
 * The blocks of a document, whether it is page-faithful or flowed.
 *
 * A PDF imported by this workspace is a list of `pdfPage` nodes; a Word document
 * (or content stored before the layout was preserved) is a flat list of
 * paragraphs, headings, lists and figures. Everything that reads a document -
 * the outline, the plain-text view, the renderer - goes through here so both
 * shapes work.
 */
export const blocksOf = (document) => {
  const content = Array.isArray(document?.content) ? document.content : []
  const pages = content.filter((node) => node?.type === 'pdfPage')
  if (!pages.length) return content

  return pages.flatMap((page) => (
    (page.content || []).map((node) => ({ ...node, pageAttrs: page.attrs }))
  ))
}

export const flattenText = (document) =>
  blocksOf(document)
    .map((block) => textOfNode(block))
    .filter((text) => text.trim())

/** Does the editor hold anything at all? An empty paragraph does not count. */
export const documentHasContent = (document) =>
  blocksOf(document).some((block) => {
    if (!block || typeof block !== 'object') return false
    if (block.type === 'image' || block.type === 'pdfFigure') return true
    if (block.type === 'pageBreak' || block.type === 'horizontalRule' || block.type === 'table') return true
    if (block.type === 'pdfPage') return true
    return textOfNode(block).trim().length > 0
  })

/** Headings, in document order - what the outline panel shows. */
export const outlineFromDocument = (document) => {
  const items = []
  const walk = (node) => {
    if (!node || typeof node !== 'object') return
    // Page-faithful blocks carry their heading level as an attribute; flowed
    // documents use a heading node.
    if (node.type === 'heading' || (node.type === 'pdfBlock' && Number(node.attrs?.heading) > 0)) {
      const text = textOfNode(node).trim()
      if (text) {
        items.push({
          id: text.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60),
          label: text,
          level: Math.min(4, Number(node.attrs?.level ?? node.attrs?.heading) || 1),
        })
      }
    }
    if (Array.isArray(node.content)) node.content.forEach(walk)
  }
  walk(document)
  return items
}

/** Plain text, one line per block: what the similarity engine and search see. */
export const documentToPlainText = (document) => flattenText(document).join('\n\n')

// --- runs ------------------------------------------------------------------

const HIGHLIGHT_COLORS = {
  yellow: [255, 241, 0],
  green: [187, 247, 208],
  blue: [191, 219, 254],
  pink: [251, 207, 232],
  purple: [221, 214, 254],
  red: [254, 202, 202],
  orange: [254, 215, 170],
}

const parseColor = (value) => {
  const raw = String(value || '').trim()
  if (!raw) return null
  const hex = raw.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)
  if (hex) {
    const digits = hex[1].length === 3 ? hex[1].split('').map((d) => d + d).join('') : hex[1]
    return [
      parseInt(digits.slice(0, 2), 16),
      parseInt(digits.slice(2, 4), 16),
      parseInt(digits.slice(4, 6), 16),
    ]
  }
  const rgb = raw.match(/^rgba?\(([^)]+)\)$/i)
  if (rgb) {
    const parts = rgb[1].split(',').map((part) => Number.parseFloat(part))
    if (parts.length >= 3 && parts.slice(0, 3).every((part) => Number.isFinite(part))) {
      return parts.slice(0, 3).map((part) => Math.max(0, Math.min(255, Math.round(part))))
    }
  }
  return null
}

const runStyle = (marks = [], blockAttrs = {}) => {
  const style = {
    bold: false,
    italic: false,
    underline: false,
    strike: false,
    color: null,
    highlight: null,
    fontSize: Number.parseFloat(String(blockAttrs.fontSize || '').replace('pt', '')) || null,
    fontFamily: blockAttrs.fontFamily || null,
    link: null,
  }

  for (const mark of marks) {
    switch (mark?.type) {
      case 'bold': style.bold = true; break
      case 'italic': style.italic = true; break
      case 'underline': style.underline = true; break
      case 'strike': style.strike = true; break
      case 'link': style.link = mark.attrs?.href || null; break
      case 'textStyle':
        if (mark.attrs?.fontSize) style.fontSize = Number.parseFloat(String(mark.attrs.fontSize).replace('pt', '')) || style.fontSize
        if (mark.attrs?.fontFamily) style.fontFamily = mark.attrs.fontFamily
        break
      case 'color':
        style.color = parseColor(mark.attrs?.color) || style.color
        break
      case 'highlight': {
        const named = HIGHLIGHT_COLORS[String(mark.attrs?.color || '').toLowerCase()]
        style.highlight = parseColor(mark.attrs?.color) || named || [255, 241, 0]
        break
      }
      default: break
    }
  }

  return style
}

/** Split an inline node list into styled runs, keeping hard breaks. */
const runsOf = (nodes = [], inherited = {}) => {
  const runs = []
  for (const node of nodes) {
    if (!node || typeof node !== 'object') continue
    if (node.type === 'hardBreak') {
      runs.push({ break: true })
      continue
    }
    if (node.type !== 'text' || typeof node.text !== 'string' || !node.text) continue
    runs.push({ text: node.text, style: runStyle(node.marks || [], inherited) })
  }
  return runs
}

// --- renderer ---------------------------------------------------------------

const applyFont = (doc, run, baseSize) => {
  const family = fontFamilyFor(run.style.fontFamily)
  const style = run.style.bold && run.style.italic
    ? 'bolditalic'
    : run.style.bold
      ? 'bold'
      : run.style.italic
        ? 'italic'
        : 'normal'
  doc.setFont(family, style)
  doc.setFontSize(run.style.fontSize || baseSize)
  const color = run.style.color || [17, 17, 17]
  doc.setTextColor(color[0], color[1], color[2])
}

// A token is one word together with the whitespace around it. Keeping the space
// attached to its word - rather than emitting whitespace-only pieces - is what
// makes the text layer correct: a lone " " measures to zero here, so relying on
// its width silently swallowed the space between two runs, and a PDF whose text
// reads "principlesto" is useless to copy/paste and to the similarity engine.
// Global on purpose: `String.match` with a non-global regex returns only the
// first match, which would render the first word of every run and drop the rest.
const WORDS_RE = /\s*\S+\s*/g

/**
 * Lay out one styled paragraph, wrapping at the content width.
 *
 * Runs are laid out word by word rather than with `splitTextToSize` because a
 * single line may mix fonts, sizes, colours and decorations, and only the run
 * walk can measure and draw each piece in its own style.
 */
const renderRuns = (doc, runs, { width, size, lineFactor = LINE_FACTOR }) => {
  const lines = []
  let line = []
  let lineWidth = 0

  const pushLine = () => {
    lines.push(line)
    line = []
    lineWidth = 0
  }

  for (const run of runs) {
    if (run.break) {
      pushLine()
      continue
    }

    applyFont(doc, run, size)
    const runSize = doc.getFontSize()

    for (const token of run.text.match(WORDS_RE) || []) {
      let word = token
      let wordWidth = doc.getTextWidth(word)

      const wouldOverflow = lineWidth + wordWidth > width
      if ((wouldOverflow && line.length > 0) || line.length === 0) {
        if (wouldOverflow && line.length > 0) pushLine()
        // A line never begins with its separator: the leading whitespace is
        // dropped at the margin and after a wrap.
        const trimmed = word.replace(/^\s+/, '')
        if (trimmed) {
          word = trimmed
          wordWidth = doc.getTextWidth(word)
        }
      }

      line.push({ word, width: wordWidth, style: run.style, size: runSize })
      lineWidth += wordWidth
    }
  }
  if (line.length) pushLine()

  const lineHeight = size * lineFactor
  return { lines, lineHeight }
}

const renderImage = (doc, node, cursor) => {
  const src = node.attrs?.src
  if (!src) return

  let properties
  try {
    properties = doc.getImageProperties(src)
  } catch {
    // An image jsPDF cannot read is reported in the document rather than
    // crashing the export: the text around it is still worth saving.
    cursor.addText('(A figure could not be included in this PDF.)', { italic: true, size: BODY_SIZE - 1.5 })
    return
  }

  const scale = Math.min(1, CONTENT_WIDTH / properties.width)
  const renderWidth = properties.width * scale
  const renderHeight = properties.height * scale

  cursor.ensureSpace(renderHeight + SPACING.image)
  const x = PAGE.marginX + (CONTENT_WIDTH - renderWidth) / 2
  doc.addImage(src, properties.fileType || 'PNG', x, cursor.y, renderWidth, renderHeight, undefined, 'FAST')
  cursor.y += renderHeight + SPACING.image
}

const renderTable = (doc, node, cursor) => {
  const rows = (node.content || []).filter((row) => row?.type === 'tableRow')
  if (!rows.length) return

  const columnCount = Math.max(...rows.map((row) => (row.content || []).filter((cell) => /tableCell|tableHeader/.test(cell?.type || '')).length), 1)
  const columnWidth = CONTENT_WIDTH / columnCount
  const cellPadding = 4

  for (const row of rows) {
    const cells = (row.content || []).filter((cell) => /tableCell|tableHeader/.test(cell?.type || ''))
    const isHeader = cells.some((cell) => cell.type === 'tableHeader')

    // A row is as tall as its tallest cell, so heights are measured first.
    const cellLines = cells.map((cell) => {
      doc.setFont('helvetica', isHeader ? 'bold' : 'normal')
      doc.setFontSize(BODY_SIZE - 1)
      return doc.splitTextToSize(textOfNode(cell), columnWidth - cellPadding * 2)
    })
    const rowHeight = Math.max(14, ...cellLines.map((lines) => lines.length * (BODY_SIZE - 1) * 1.3 + cellPadding * 2))

    cursor.ensureSpace(rowHeight)
    const rowTop = cursor.y

    cells.forEach((cell, index) => {
      const cellX = PAGE.marginX + index * columnWidth

      if (isHeader) {
        doc.setFillColor(240, 240, 240)
        doc.rect(cellX, rowTop, columnWidth, rowHeight, 'F')
      }

      doc.setDrawColor(170, 170, 170)
      doc.rect(cellX, rowTop, columnWidth, rowHeight)

      doc.setFont('helvetica', isHeader ? 'bold' : 'normal')
      doc.setFontSize(BODY_SIZE - 1)
      doc.setTextColor(17, 17, 17)
      doc.text(cellLines[index] || [], cellX + cellPadding, rowTop + cellPadding + (BODY_SIZE - 1))
    })

    cursor.y += rowHeight
  }

  cursor.y += SPACING.paragraph
}

/**
 * Draw a page-faithful document back out.
 *
 * Every page keeps its own size and every block is drawn where the file had it,
 * at its own font size and alignment, wrapping inside its own column. That is
 * what makes an edited PDF still look like the document it came from: the
 * alternative - pouring the text into one A4 flow - silently rewrites the layout
 * of a cover sheet, a two-column page or a table.
 *
 * @returns {Blob} an application/pdf blob
 */
const renderPageFaithfulToPdf = (document, options = {}) => {
  const {
    title = 'Internship Report',
    author = '',
  } = options

  const pages = (document?.content || []).filter((node) => node?.type === 'pdfPage')
  const first = pages[0]?.attrs || {}
  const doc = new jsPDF({
    unit: 'pt',
    format: [Number(first.width) || 612, Number(first.height) || 792],
    compress: true,
  })
  doc.setProperties({ title, author, creator: 'InternSmart PDF workspace' })

  let firstPage = true

  for (const page of pages) {
    const pageWidth = Number(page.attrs?.width) || PAGE.width
    const pageHeight = Number(page.attrs?.height) || PAGE.height

    if (!firstPage) doc.addPage([pageWidth, pageHeight], pageWidth > pageHeight ? 'landscape' : 'portrait')
    else if (doc.internal.pageSize.getWidth() !== pageWidth || doc.internal.pageSize.getHeight() !== pageHeight) {
      // The document's first page is not the size the header assumed.
      doc.deletePage(1)
      doc.addPage([pageWidth, pageHeight], pageWidth > pageHeight ? 'landscape' : 'portrait')
    }
    firstPage = false

    for (const node of page.content || []) {
      const attrs = node.attrs || {}

      if (node.type === 'pdfFigure') {
        if (!attrs.src) continue
        try {
          doc.addImage(
            attrs.src,
            (String(attrs.src).match(/^data:image\/(\w+)/)?.[1] || 'PNG').toUpperCase(),
            Number(attrs.x) || 0,
            Number(attrs.y) || 0,
            Number(attrs.width) || 100,
            Number(attrs.height) || 100,
            undefined,
            'FAST',
          )
        } catch {
          // A figure jsPDF cannot decode must not lose the page's text.
        }
        continue
      }

      if (node.type !== 'pdfBlock') continue

      const size = Number(attrs.fontSize) || BODY_SIZE
      const lineHeight = Number(attrs.lineHeight) || LINE_FACTOR
      const ascent = Number(attrs.ascent) > 0 && Number(attrs.ascent) <= 1.2 ? Number(attrs.ascent) : 0.8
      const x = Number(attrs.x) || 0
      const top = Number(attrs.y) || 0
      const width = Number(attrs.width) || 200
      const align = ['left', 'right', 'center', 'justify'].includes(attrs.align) ? attrs.align : 'left'
      const runs = runsOf(node.content, attrs)
      if (!runs.length) continue

      // The block's top is where the line box starts, so the first baseline is one
      // ascent below it - the same relationship the extractor measured. Drawing at
      // `top + size` instead (a full em) put every block a couple of points too
      // low, which compounded on every save.
      const measured = renderRuns(doc, runs, { width, size, lineFactor: lineHeight })
      let y = top + size * ascent - size

      for (const [lineIndex, line] of measured.lines.entries()) {
        const lineWidth = line.reduce((total, piece) => total + piece.width, 0)
        const isLastLine = lineIndex === measured.lines.length - 1
        const gapCount = line.filter((piece) => /\s$/.test(piece.word)).length
        const justified = align === 'justify' && !isLastLine && gapCount > 0
        const extraPerGap = justified ? Math.max(0, (width - lineWidth) / gapCount) : 0
        const offset = align === 'center' ? (width - lineWidth) / 2 : align === 'right' ? width - lineWidth : 0
        let drawX = x + Math.max(0, offset)

        for (const piece of line) {
          const baseY = y + piece.size
          const color = piece.style.color || [17, 17, 17]
          doc.setFont(
            fontFamilyFor(piece.style.fontFamily || attrs.fontFamily),
            piece.style.bold && piece.style.italic
              ? 'bolditalic'
              : piece.style.bold
                ? 'bold'
                : piece.style.italic
                  ? 'italic'
                  : 'normal',
          )
          doc.setFontSize(piece.size)
          doc.setTextColor(color[0], color[1], color[2])
          doc.text(piece.word, drawX, baseY)

          if (piece.style.underline) {
            doc.setDrawColor(color[0], color[1], color[2])
            doc.setLineWidth(0.5)
            doc.line(drawX, baseY + 1.5, drawX + piece.width, baseY + 1.5)
          }

          drawX += piece.width + (/\s$/.test(piece.word) ? extraPerGap : 0)
        }

        y += size * lineHeight
      }
    }
  }

  if (!pages.length) return null
  return doc.output('blob')
}

/**
 * Turn a document into PDF bytes.
 *
 * A document that came from a PDF keeps its pages and positions; anything else
 * (a Word import, content written here) is laid out as an A4 document.
 *
 * @returns {Blob} an application/pdf blob, ready to be sent to the server
 */
export const renderDocumentToPdf = (document, options = {}) => {
  // A page-faithful document is drawn page by page, at its own size and with
  // every block in place. Only content with no page geometry (a Word import, or
  // a document written from scratch) is flowed into A4 below.
  if (Array.isArray(document?.content) && document.content.some((node) => node?.type === 'pdfPage')) {
    const faithful = renderPageFaithfulToPdf(document, options)
    if (faithful) return faithful
  }

  const {
    title = 'Internship Report',
    author = '',
    pageNumbers = true,
  } = options

  const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true })
  doc.setProperties({ title, author, creator: 'InternSmart PDF workspace' })

  let y = PAGE.marginY

  const newPage = () => {
    doc.addPage()
    y = PAGE.marginY
  }

  const cursor = {
    get y() { return y },
    set y(value) { y = value },
    ensureSpace(height) {
      if (y + height > PAGE.height - PAGE.marginY) newPage()
    },
    addText(text, { italic = false, size = BODY_SIZE } = {}) {
      this.ensureSpace(size * LINE_FACTOR)
      doc.setFont('helvetica', italic ? 'italic' : 'normal')
      doc.setFontSize(size)
      doc.setTextColor(90, 90, 90)
      doc.text(text, PAGE.marginX, y + size)
      y += size * LINE_FACTOR
    },
    /** A wrapped block of styled runs, shared by paragraphs, headings and lists. */
    block(runs, { size = BODY_SIZE, align = 'left', indent = 0, bold = false, italic = false, spaceAfter = 0 } = {}) {
      const effective = runs.map((run) => ({ ...run, style: { ...run.style, bold: run.style.bold || bold, italic: run.style.italic || italic } }))
      const { lines, lineHeight } = renderRuns(doc, effective, { width: CONTENT_WIDTH - indent, size })
      const startX = PAGE.marginX + indent

      for (const [lineIndex, line] of lines.entries()) {
        this.ensureSpace(lineHeight)
        const lineWidth = line.reduce((total, piece) => total + piece.width, 0)
        // Justification stretches the gaps of every line but the last, which is
        // how a justified paragraph actually looks.
        const isLastLine = lineIndex === lines.length - 1
        const gapCount = line.filter((piece) => /\s$/.test(piece.word)).length
        const justified = align === 'justify' && !isLastLine && gapCount > 0
        const extraPerGap = justified ? Math.max(0, (CONTENT_WIDTH - indent - lineWidth) / gapCount) : 0

        const offset = align === 'center'
          ? (CONTENT_WIDTH - indent - lineWidth) / 2
          : align === 'right'
            ? CONTENT_WIDTH - indent - lineWidth
            : 0
        let x = startX + Math.max(0, offset)

        for (const piece of line) {
          const baseY = y + piece.size
          const pieceColor = piece.style.link ? [37, 99, 235] : piece.style.color || [17, 17, 17]

          if (piece.style.highlight) {
            doc.setFillColor(piece.style.highlight[0], piece.style.highlight[1], piece.style.highlight[2])
            doc.rect(x, y + piece.size * 0.2, piece.width, piece.size * 1.05, 'F')
          }

          doc.setFont(
            fontFamilyFor(piece.style.fontFamily),
            piece.style.bold && piece.style.italic
              ? 'bolditalic'
              : piece.style.bold
                ? 'bold'
                : piece.style.italic
                  ? 'italic'
                  : 'normal',
          )
          doc.setFontSize(piece.size)
          doc.setTextColor(pieceColor[0], pieceColor[1], pieceColor[2])
          // Drawn untrimmed: the trailing space is part of the text the reader
          // copies out, so word boundaries survive extraction.
          doc.text(piece.word, x, baseY)

          if (piece.style.underline || piece.style.link) {
            doc.setDrawColor(pieceColor[0], pieceColor[1], pieceColor[2])
            doc.setLineWidth(0.5)
            doc.line(x, baseY + 1.5, x + piece.width, baseY + 1.5)
          }
          if (piece.style.strike) {
            doc.setDrawColor(pieceColor[0], pieceColor[1], pieceColor[2])
            doc.setLineWidth(0.5)
            doc.line(x, baseY - piece.size * 0.28, x + piece.width, baseY - piece.size * 0.28)
          }

          x += piece.width + (/\s$/.test(piece.word) ? extraPerGap : 0)
        }

        y += lineHeight
      }

      y += spaceAfter
    },
    pageBreak() { newPage() },
    listMarker(marker, { indent = 0, size = BODY_SIZE } = {}) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(size)
      doc.setTextColor(17, 17, 17)
      doc.text(marker, PAGE.marginX + indent - 14, y + size)
    },
  }

  const renderNode = (node, context = {}) => {
    if (!node || typeof node !== 'object') return
    const attrs = node.attrs || {}
    const align = ['center', 'right', 'justify'].includes(attrs.textAlign) ? attrs.textAlign : 'left'

    switch (node.type) {
      case 'heading': {
        const level = Math.min(6, Math.max(1, Number(attrs.level) || 1))
        cursor.ensureSpace(HEADING_SIZES[level] * 2)
        y += SPACING.headingBefore
        cursor.block(runsOf(node.content, attrs), {
          size: HEADING_SIZES[level],
          align,
          bold: true,
          spaceAfter: SPACING.headingAfter,
        })
        return
      }

      case 'paragraph':
        if (context.inListItem) {
          cursor.block(runsOf(node.content, attrs), { size: BODY_SIZE, align, indent: context.indent || 0 })
          return
        }
        cursor.block(runsOf(node.content, attrs), { size: BODY_SIZE, align, spaceAfter: SPACING.paragraph })
        return

      case 'blockquote': {
        const startY = y
        for (const child of node.content || []) {
          if (child?.type === 'paragraph') {
            cursor.block(runsOf(child.content, child.attrs || {}), { size: BODY_SIZE, italic: true, indent: 24, spaceAfter: 4 })
          } else {
            renderNode(child, { ...context, indent: 24 })
          }
        }
        doc.setDrawColor(200, 200, 200)
        doc.setLineWidth(2)
        doc.line(PAGE.marginX + 6, startY + 4, PAGE.marginX + 6, Math.max(startY + 10, y - 4))
        y += SPACING.quote
        return
      }

      case 'bulletList':
      case 'orderedList': {
        let counter = 1
        for (const item of node.content || []) {
          if (item?.type !== 'listItem') continue
          cursor.ensureSpace(BODY_SIZE * LINE_FACTOR)
          const marker = node.type === 'orderedList' ? `${counter}.` : '\u2022'
          counter += 1
          const indent = (context.indent || 0) + 20
          const startPage = doc.getNumberOfPages()
          const markerY = y
          renderNode(item.content?.find((child) => child?.type === 'paragraph') || { type: 'paragraph', content: [] }, { ...context, inListItem: true, indent })
          // The marker shares the first line's baseline, which is only still on
          // this page if the item did not immediately overflow onto the next one.
          if (doc.getNumberOfPages() === startPage) {
            const savedY = y
            y = markerY
            cursor.listMarker(marker, { indent })
            y = savedY
          }
          y += SPACING.listItem
        }
        y += SPACING.paragraph
        return
      }

      case 'image':
        renderImage(doc, node, cursor)
        return

      case 'table':
        renderTable(doc, node, cursor)
        return

      case 'horizontalRule':
        cursor.ensureSpace(12)
        doc.setDrawColor(180, 180, 180)
        doc.setLineWidth(0.7)
        doc.line(PAGE.marginX, y + 4, PAGE.width - PAGE.marginX, y + 4)
        y += 14
        return

      case 'pageBreak':
        cursor.pageBreak()
        return

      case 'codeBlock':
        cursor.block(runsOf(node.content, attrs), { size: BODY_SIZE - 1.5, spaceAfter: SPACING.paragraph })
        return

      default: {
        // Unknown block: its text is still rendered, so a node this build does
        // not know cannot silently delete a paragraph from the exported PDF.
        const text = textOfNode(node)
        if (text.trim()) cursor.block([{ text, style: runStyle([], attrs) }], { size: BODY_SIZE, spaceAfter: SPACING.paragraph })
      }
    }
  }

  for (const node of Array.isArray(document?.content) ? document.content : []) {
    renderNode(node)
  }

  if (pageNumbers) {
    const total = doc.getNumberOfPages()
    for (let page = 1; page <= total; page += 1) {
      doc.setPage(page)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(120, 120, 120)
      doc.text(`${page} / ${total}`, PAGE.width / 2, PAGE.height - PAGE.marginY / 2, { align: 'center' })
      if (title) {
        doc.text(String(title).slice(0, 70), PAGE.marginX, PAGE.height - PAGE.marginY / 2)
      }
    }
  }

  return doc.output('blob')
}

export default {
  PAGE,
  CONTENT_WIDTH,
  EMPTY_DOC,
  renderDocumentToPdf,
  documentHasContent,
  outlineFromDocument,
  documentToPlainText,
  textOfNode,
  blocksOf,
}
