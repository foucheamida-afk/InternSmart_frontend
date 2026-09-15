import { Node, mergeAttributes } from '@tiptap/core'

/**
 * Page break.
 *
 * This was a command-only extension that inserted a horizontal rule, which meant
 * the editor schema had no `pageBreak` node at all. That is invisible until a
 * document *contains* one: importing a Word file whose content has a page break
 * failed outright with "Unknown node type: pageBreak", because TipTap throws on
 * the whole document rather than the offending node.
 *
 * It is a real atom node now, with two looks:
 *
 *   - imported page break (the default) - a compact dashed divider. A real Word
 *     report has a page break on most pages, and the `[data-page-break]` rule in
 *     writing-workspace.css is a full A4 page tall (it was written for the "insert
 *     a blank page" command and never actually rendered, because no node ever
 *     carried the attribute). Rendering an import with one 1123px grey slab per
 *     page break buried the document.
 *   - `blank: true` - the explicit "Blank Page" command, which keeps the
 *     full-page look.
 */
export const PageBreak = Node.create({
  name: 'pageBreak',
  group: 'block',
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      blank: {
        default: false,
        parseHTML: (element) => element.hasAttribute('data-blank'),
        renderHTML: (attributes) => (attributes.blank ? { 'data-blank': 'true' } : {}),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-page-break]' }]
  },

  renderHTML({ HTMLAttributes }) {
    const blank = HTMLAttributes.blank === true || HTMLAttributes['data-blank'] === 'true'
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-page-break': 'true',
        class: blank ? 'ww-page-break is-blank' : 'ww-page-break',
        contenteditable: 'false',
      }),
      blank ? 'Blank page' : 'Page break',
    ]
  },

  addCommands() {
    return {
      insertPageBreak: (options = {}) => ({ chain }) =>
        chain()
          .insertContent({ type: 'pageBreak', attrs: { blank: Boolean(options.blank) } })
          .insertContent({ type: 'paragraph' })
          .run(),
    }
  },
})

export default PageBreak
