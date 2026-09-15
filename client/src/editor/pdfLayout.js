import { Node, mergeAttributes } from '@tiptap/core'

/**
 * Page-faithful nodes for an imported PDF.
 *
 * A PDF is not prose. Its meaning is partly *where* things are: a two-column
 * page, a cover sheet, a table, a figure with a caption beside it. Re-flowing
 * that into ordinary paragraphs and headings - which is what the first version of
 * this workspace did - loses all of it, and the result reads as disorder.
 *
 * So the structure keeps the page: `pdfPage` is a sheet of the original size,
 * `pdfBlock` is a run of text at the position, width, size, family and alignment
 * the file gave it, and `pdfFigure` is a picture in its original box. Text
 * remains fully editable - it just stays where it was, and reflows inside its own
 * column instead of being poured into a different layout.
 *
 * Leaving the geometry real (points, not "somewhere on the page") is also what
 * lets the exporter draw the same page back out instead of inventing a new one.
 */

const FONT_STACKS = {
  serif: '"Times New Roman", Times, "Liberation Serif", Georgia, serif',
  'sans-serif': 'Helvetica, Arial, "Liberation Sans", "Segoe UI", sans-serif',
  monospace: '"Courier New", Courier, "Liberation Mono", monospace',
}

/**
 * A font stack for a block.
 *
 * The PDF's own font name is tried first when the reader resolved one, because a
 * document set in Calibri looks wrong in Times and the browser may well have the
 * font. An unknown name is simply skipped by the browser, so the generic family
 * behind it is the real guarantee.
 */
const fontStack = (fontFamily, fontName) => {
  const fallback = FONT_STACKS[fontFamily] || FONT_STACKS.serif
  if (!fontName) return fallback
  const safe = String(fontName).replace(/["\\]/g, '')
  if (!safe || /^(serif|sans-serif|monospace)$/i.test(safe)) return fallback
  return `"${safe}", ${fallback}`
}

const points = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback)

const blockStyle = (attrs) => [
  'position:absolute',
  `left:${points(attrs.x)}pt`,
  `top:${points(attrs.y)}pt`,
  `width:${points(attrs.width, 240)}pt`,
  `font-size:${points(attrs.fontSize, 11)}pt`,
  `font-family:${fontStack(attrs.fontFamily, attrs.fontName)}`,
  `line-height:${points(attrs.lineHeight, 1.3)}`,
  `text-align:${['left', 'right', 'center', 'justify'].includes(attrs.align) ? attrs.align : 'left'}`,
  // A block is a column of text, not a paragraph with default margins: the
  // spacing in the file is already encoded in where the next block sits.
  'margin:0',
  'padding:0',
  'white-space:pre-wrap',
  'overflow-wrap:break-word',
].join(';')

const pageStyle = (attrs) => [
  'position:relative',
  `width:${points(attrs.width, 612)}pt`,
  `height:${points(attrs.height, 792)}pt`,
  'overflow:hidden',
].join(';')

/**
 * One sheet of the original document.
 *
 * Blocks are positioned against this element, so its size and `position:
 * relative` are what keep every coordinate meaningful.
 */
export const PdfPage = Node.create({
  name: 'pdfPage',
  group: 'block',
  content: '(pdfFigure | pdfBlock)*',
  isolating: true,
  selectable: false,

  addAttributes() {
    return {
      width: { default: 612 },
      height: { default: 792 },
      page: { default: 1 },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-pdf-page]' }]
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-pdf-page': 'true',
        class: 'pdfw-page',
        style: pageStyle(node.attrs),
      }),
      0,
    ]
  },
})

/** A run of text where the file had it. */
export const PdfBlock = Node.create({
  name: 'pdfBlock',
  group: 'block',
  content: 'inline*',
  defining: true,

  addAttributes() {
    return {
      x: { default: 0 },
      y: { default: 0 },
      width: { default: 240 },
      fontSize: { default: 11 },
      fontFamily: { default: 'serif' },
      fontName: { default: null },
      align: { default: 'left' },
      lineHeight: { default: 1.3 },
      // Distance from the block's top to its first baseline, as a fraction of the
      // font size. The browser derives this from the font's own metrics; the
      // exporter needs the number to put the baseline back where it was.
      ascent: { default: 0.8 },
      page: { default: 1 },
      heading: { default: 0 },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-pdf-block]' }]
  },

  renderHTML({ node, HTMLAttributes }) {
    const heading = Number(node.attrs.heading) || 0
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-pdf-block': 'true',
        'data-heading': heading ? String(heading) : undefined,
        class: heading ? `pdfw-block is-heading h${heading}` : 'pdfw-block',
        style: blockStyle(node.attrs),
      }),
      0,
    ]
  },
})

/** A picture in its original box. */
export const PdfFigure = Node.create({
  name: 'pdfFigure',
  group: 'block',
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      src: { default: null },
      x: { default: 0 },
      y: { default: 0 },
      width: { default: 100 },
      height: { default: 100 },
      alt: { default: null },
      page: { default: 1 },
    }
  },

  parseHTML() {
    return [{ tag: 'img[data-pdf-figure]' }]
  },

  renderHTML({ node, HTMLAttributes }) {
    const attrs = node.attrs
    return [
      'img',
      mergeAttributes(HTMLAttributes, {
        'data-pdf-figure': 'true',
        class: 'pdfw-figure',
        src: attrs.src,
        alt: attrs.alt || '',
        draggable: 'false',
        style: [
          'position:absolute',
          `left:${points(attrs.x)}pt`,
          `top:${points(attrs.y)}pt`,
          `width:${points(attrs.width, 100)}pt`,
          `height:${points(attrs.height, 100)}pt`,
        ].join(';'),
      }),
    ]
  },
})

export const PDF_LAYOUT_NODES = [PdfPage, PdfBlock, PdfFigure]

export default { PdfPage, PdfBlock, PdfFigure, PDF_LAYOUT_NODES }
