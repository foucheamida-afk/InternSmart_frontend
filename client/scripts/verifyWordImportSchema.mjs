/**
 * Regression check: can this editor actually load what the Word importer produces?
 *
 *   cd client && node scripts/verifyWordImportSchema.mjs
 *
 * This is the check that was missing when importing a Word document failed with
 * "Unknown node type: pageBreak". It builds the *real* editor schema headlessly
 * (same extensions as WritingWorkspace, pageBreak included from src/editor), runs
 * the real server converter over a document containing every construct the
 * workspace can produce, and then makes the exact call TipTap makes when loading
 * imported content: `schema.nodeFromJSON(...)`.
 *
 * A node the server can emit but this schema does not know fails here, in a
 * script, instead of in the browser for the person trying to import their report.
 */
import { getSchema } from '@tiptap/core'
import { StarterKit } from '@tiptap/starter-kit'
import { Underline } from '@tiptap/extension-underline'
import { TextAlign } from '@tiptap/extension-text-align'
import { Highlight } from '@tiptap/extension-highlight'
import { TextStyle, FontSize, FontFamily } from '@tiptap/extension-text-style'
import { Color } from '@tiptap/extension-color'
import { Link } from '@tiptap/extension-link'
import { Image } from '@tiptap/extension-image'
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table'

import { PageBreak } from '../src/editor/pageBreak.js'
import { plainTextDocument, sanitizeEditorContent } from '../src/editor/contentGuards.js'
import { docxBufferToEditorContent, editorContentToDocxBuffer } from '../../server/services/docxService.js'

const results = []
const check = (name, passed, detail = '') => {
  results.push(passed)
  console.log(`${passed ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`)
}

// The extensions used by WritingWorkspace.jsx. IndentExtension only adds commands
// and contributes no node/mark, so it is deliberately not repeated here.
const schema = getSchema([
  StarterKit.configure({ history: false, link: false, underline: false }),
  Underline,
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
  Highlight.configure({ multicolor: true }),
  TextStyle,
  FontSize.configure({ types: ['textStyle'] }),
  FontFamily.configure({ types: ['textStyle'] }),
  Color.configure({ types: ['textStyle'] }),
  Link.configure({ openOnClick: false }),
  Image,
  Table.configure({ resizable: true }),
  TableRow,
  TableCell,
  TableHeader,
  PageBreak,
])

const sampleDocument = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Internship Report' }] },
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Written in ' },
        { type: 'text', marks: [{ type: 'bold' }], text: 'InternSmart' },
        { type: 'text', text: ', ' },
        { type: 'text', marks: [{ type: 'italic' }], text: 'exported' },
        { type: 'text', text: ', ' },
        { type: 'text', marks: [{ type: 'underline' }], text: 'underlined' },
        { type: 'text', text: ' and ' },
        { type: 'text', marks: [{ type: 'strike' }], text: 'struck' },
        { type: 'text', text: '.' },
      ],
    },
    {
      type: 'paragraph',
      content: [{ type: 'text', marks: [{ type: 'link', attrs: { href: 'https://example.com' } }], text: 'A link' }],
    },
    {
      type: 'paragraph',
      content: [{ type: 'text', marks: [{ type: 'textStyle', attrs: { color: '#c00000', fontSize: '18px' } }], text: 'Styled' }],
    },
    { type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'highlight', attrs: { color: 'yellow' } }], text: 'Highlighted' }] },
    // A picture, the way the importer produces one: Word wraps images in a
    // paragraph, so the picture arrives among that paragraph's inline content.
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Figure 1: ' },
        { type: 'image', attrs: { src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', width: 300, height: 150 } },
      ],
    },
    { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Bullet' }] }] }] },
    { type: 'orderedList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Numbered' }] }] }] },
    { type: 'blockquote', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Quoted' }] }] },
    { type: 'codeBlock', content: [{ type: 'text', text: 'SELECT 1;' }] },
    {
      type: 'table',
      content: [
        {
          type: 'tableRow',
          content: [
            { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'H' }] }] },
            { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'C' }] }] },
          ],
        },
      ],
    },
    { type: 'horizontalRule' },
    { type: 'pageBreak' },
    { type: 'paragraph', content: [{ type: 'text', text: 'After the page break.' }] },
  ],
}

const typesOf = (node, found = new Set()) => {
  if (!node || typeof node !== 'object') return found
  if (node.type) found.add(node.type)
  for (const mark of node.marks || []) found.add(`mark:${mark.type}`)
  for (const child of node.content || []) typesOf(child, found)
  return found
}

const run = async () => {
  check('editor schema knows the pageBreak node', Boolean(schema.nodes.pageBreak))

  // The whole point: a real .docx -> server converter -> editor schema, including
  // the page break that used to make this throw.
  const buffer = await editorContentToDocxBuffer(sampleDocument, { title: 'Schema check' })
  const { document: imported } = await docxBufferToEditorContent(buffer)

  let parsed = null
  try {
    parsed = schema.nodeFromJSON(imported)
  } catch (error) {
    check('imported content loads into the editor schema', false, error.message)
  }
  if (parsed) {
    check('imported content loads into the editor schema', true, `${parsed.nodeSize} nodes`)
    check('the page break survived the round trip', JSON.stringify(imported).includes('pageBreak'))
  }

  // A picture has to arrive with the display size Word recorded for it: without
  // one, every figure is drawn at its intrinsic pixel size and a scaled-down
  // screenshot fills the page.
  const pictures = []
  const collectPictures = (node) => {
    if (!node || typeof node !== 'object') return
    if (node.type === 'image') pictures.push(node.attrs || {})
    for (const child of node.content || []) collectPictures(child)
  }
  collectPictures(imported)
  check(
    'the picture kept the size Word stored',
    pictures.length === 1 && pictures[0].width === 300 && pictures[0].height === 150,
    JSON.stringify(pictures[0] || {}).replace(/"src":"[^"]*"/, '"src":"..."'),
  )

  // Every node/mark the importer emitted has to exist in this schema.
  const unknown = [...typesOf(imported)].filter((type) => (type.startsWith('mark:')
    ? !schema.marks[type.slice(5)]
    : !schema.nodes[type]))
  check('every imported node/mark exists in the schema', unknown.length === 0, unknown.join(', ') || 'none missing')

  // And if the server ever emits something this build genuinely lacks, the guards
  // have to keep the rest of the document rather than throwing.
  const withUnknown = {
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Kept' }] },
      { type: 'notARealNode', content: [{ type: 'text', text: 'Fallback text' }] },
      { type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'notARealMark' }], text: 'Marks dropped' }] },
    ],
  }
  const { content, dropped } = sanitizeEditorContent(withUnknown, schema)
  let guardedOk = true
  try {
    schema.nodeFromJSON(content)
  } catch (error) {
    guardedOk = false
    check('guarded content loads when a node is unknown', false, error.message)
  }
  if (guardedOk) check('guarded content loads when a node is unknown', true, `${dropped} unsupported element(s)`)
  check('the unknown node kept its text', JSON.stringify(content).includes('Fallback text'))
  check('the unknown mark was dropped', !JSON.stringify(content).includes('notARealMark'))

  const plain = plainTextDocument(withUnknown)
  let plainOk = true
  try {
    schema.nodeFromJSON(plain)
  } catch (error) {
    plainOk = false
    check('plain-text fallback always loads', false, error.message)
  }
  if (plainOk) check('plain-text fallback always loads', true, `${plain.content.length} paragraph(s)`)

  const failed = results.filter((passed) => !passed).length
  console.log(`\n${results.length - failed}/${results.length} checks passed`)
  if (failed) process.exitCode = 1
}

run().catch((error) => {
  console.error('VERIFY FAILED:', error)
  process.exitCode = 1
})
