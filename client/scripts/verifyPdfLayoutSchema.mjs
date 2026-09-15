/**
 * Does the structure the server extracts actually load into the editor?
 *
 *   npm run verify:layout
 *
 * TipTap throws on the *entire* document when a single node type or mark is not
 * in the schema ("Unknown node type: pageBreak" is how a Word import once failed
 * outright over one page break). A build cannot catch that, and neither can a
 * lint run - the structure is data from the server, and it is parsed against the
 * editor's schema at runtime.
 *
 * So the schema is built here from the same extension list PdfWorkspace uses -
 * no browser needed - and a realistic extracted structure is parsed into it,
 * including the page, block, figure and mark attributes the extractor emits.
 */
import * as Y from 'yjs'
import { Awareness } from 'y-protocols/awareness.js'
import { getSchema } from '@tiptap/core'

import { buildPdfEditorExtensions } from '../src/editor/pdfEditorExtensions.js'

let failures = 0
const check = (name, passed, detail = '') => {
  if (!passed) failures += 1
  console.log(`${passed ? 'PASS' : 'FAIL'}  ${name}${detail ? `  [${detail}]` : ''}`)
}

const ydoc = new Y.Doc()
const provider = { awareness: new Awareness(new Y.Doc()) }
const schema = getSchema(buildPdfEditorExtensions({ ydoc, provider, userName: 'Check' }))

// What `readPdfStructure` returns for a page of a real report: two columns of
// text, a bold run inside a paragraph, a heading, and a figure in its own box.
const structure = {
  type: 'doc',
  content: [
    {
      type: 'pdfPage',
      attrs: { width: 595.32, height: 841.92, page: 1 },
      content: [
        {
          type: 'pdfFigure',
          attrs: {
            src: 'data:image/png;base64,iVBORw0KGgo=',
            x: 241.2, y: 70.85, width: 129.6, height: 140.8, alt: 'Figure 1 from page 1', page: 1,
          },
        },
        {
          type: 'pdfBlock',
          attrs: {
            x: 54.24, y: 55.67, width: 169.14, fontSize: 12, fontFamily: 'serif',
            fontName: 'TimesNewRomanPSMT', align: 'left', lineHeight: 1.28, ascent: 0.891, page: 1, heading: 0,
          },
          content: [{ type: 'text', text: 'REPUBLIQUE DU CAMEROUN' }],
        },
        {
          type: 'pdfBlock',
          attrs: {
            x: 56.7, y: 107.78, width: 468.4, fontSize: 12, fontFamily: 'serif',
            fontName: null, align: 'justify', lineHeight: 1.28, ascent: 0.891, page: 1, heading: 1,
          },
          content: [
            { type: 'text', text: 'Software engineering is the application of ' },
            { type: 'text', marks: [{ type: 'bold' }], text: 'engineering principles' },
            { type: 'text', marks: [{ type: 'italic' }], text: ' and design' },
            { type: 'text', marks: [{ type: 'bold' }, { type: 'italic' }], text: ' together' },
            { type: 'text', marks: [{ type: 'underline' }], text: ' underlined' },
            { type: 'text', text: ' to software development.' },
          ],
        },
      ],
    },
    {
      type: 'pdfPage',
      attrs: { width: 595.32, height: 841.92, page: 2 },
      content: [],
    },
  ],
}

let node = null
let error = null
try {
  node = schema.nodeFromJSON(structure)
  node.check()
} catch (parseError) {
  error = parseError
}

check(
  'the extracted structure parses into the editor schema',
  Boolean(node) && !error,
  error ? error.message : `${node.descendants ? node.nodeSize : 0} document size`,
)

const names = new Set()
if (node) node.descendants((child) => { names.add(child.type.name) })

check('pages are part of the schema', names.has('pdfPage'))
check('positioned blocks are part of the schema', names.has('pdfBlock'))
check('positioned figures are part of the schema', names.has('pdfFigure'))

// The attributes carry the layout: without them the blocks would stack at 0,0.
const block = node?.child(0)?.child(1)
check(
  'a block keeps its position, size, alignment and ascent',
  block?.attrs?.x === 54.24
    && block?.attrs?.width === 169.14
    && block?.attrs?.fontSize === 12
    && block?.attrs?.align === 'left'
    && block?.attrs?.ascent === 0.891,
  JSON.stringify(block?.attrs || {}).slice(0, 90),
)
check(
  'an empty page is allowed (the file had a blank page)',
  node?.childCount === 2 && node.child(1).childCount === 0,
  `${node?.childCount} page(s)`,
)

// The flowed fallback must still accept what a Word import or an older session
// holds, or those documents would stop opening.
const flowed = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Internship Report' }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'Written in the workspace.' }] },
    { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'One' }] }] }] },
    { type: 'pageBreak', attrs: { blank: false } },
    { type: 'paragraph', content: [{ type: 'text', text: 'After the break.' }] },
  ],
}

let flowedNode = null
let flowedError = null
try {
  flowedNode = schema.nodeFromJSON(flowed)
  flowedNode.check()
} catch (parseError) {
  flowedError = parseError
}

check(
  'flowed content (Word import, older sessions) still parses',
  Boolean(flowedNode) && !flowedError,
  flowedError ? flowedError.message : 'headings, lists, paragraphs and page breaks',
)

console.log(`\n${failures === 0 ? 'PDF EDITOR SCHEMA VERIFIED' : `${failures} CHECK(S) FAILED`}`)
process.exit(failures === 0 ? 0 : 1)
