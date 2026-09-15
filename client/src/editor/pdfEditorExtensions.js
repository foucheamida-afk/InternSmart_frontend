import { StarterKit } from '@tiptap/starter-kit'
import { Underline } from '@tiptap/extension-underline'
import { TextAlign } from '@tiptap/extension-text-align'
import { Highlight } from '@tiptap/extension-highlight'
import { TextStyle, FontSize, FontFamily } from '@tiptap/extension-text-style'
import { Color } from '@tiptap/extension-color'
import { Placeholder } from '@tiptap/extension-placeholder'
import { Link as LinkExtension } from '@tiptap/extension-link'
import { Image as ImageExtension } from '@tiptap/extension-image'
import { Table as TableExtension, TableRow, TableCell, TableHeader } from '@tiptap/extension-table'
import { Collaboration } from '@tiptap/extension-collaboration'
import { CollaborationCaret } from '@tiptap/extension-collaboration-caret'

// Explicit extensions: this module is also imported by a Node script
// (scripts/verifyPdfLayoutSchema.mjs), and Node - unlike Vite - does not resolve
// an extensionless relative import.
import { PageBreak } from './pageBreak.js'
import { PDF_LAYOUT_NODES } from './pdfLayout.js'

/**
 * The schema and extensions of the PDF workspace editor.
 *
 * Kept out of the page component so the *schema* can be built without a browser:
 * `getSchema(extensions)` validates the structure the server extracts against the
 * exact node and mark set the editor will load it into. That check matters -
 * TipTap throws on the whole document when a single node type is unknown, which
 * is how a Word import once failed outright over one page break - and it is not
 * something a build or a lint run can catch.
 *
 * @param {object} options
 * @param {import('yjs').Doc} options.ydoc            required by Collaboration
 * @param {object} options.provider                   required by CollaborationCaret
 * @param {string} [options.userName]
 */
export const buildPdfEditorExtensions = ({ ydoc, provider, userName = 'Someone' }) => [
  // History comes from Collaboration (a Yjs undo manager). Two undo stacks over
  // one document would undo each other's work.
  StarterKit.configure({ history: false, link: false, underline: false }),
  Underline,
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
  Highlight.configure({ multicolor: true }),
  TextStyle,
  FontSize.configure({ types: ['textStyle'] }),
  FontFamily.configure({ types: ['textStyle'] }),
  Color.configure({ types: ['textStyle'] }),
  LinkExtension.configure({ openOnClick: false }),
  // Imported figures arrive as data URIs, which the extension refuses by default.
  ImageExtension.configure({ allowBase64: true }),
  TableExtension.configure({ resizable: false }),
  TableRow,
  TableCell,
  TableHeader,
  PageBreak,
  // The page-faithful nodes an imported PDF is made of: a sheet of the original
  // size, a run of text at its original position, a figure in its original box.
  // Everything above is the flowed fallback, still needed for a report written
  // here or imported from Word.
  ...PDF_LAYOUT_NODES,
  Placeholder.configure({ placeholder: 'Edit the text of this PDF…' }),
  Collaboration.configure({ document: ydoc }),
  CollaborationCaret.configure({ provider, user: { name: userName, color: '#ff7a00' } }),
]

export default buildPdfEditorExtensions
