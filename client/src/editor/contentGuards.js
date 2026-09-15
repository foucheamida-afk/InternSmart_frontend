/**
 * Guards that make server-converted content safe to load into the editor.
 *
 * The server converts a Word file into ProseMirror JSON without knowing which
 * extensions this build of the client has, so it can emit a node type or mark
 * that is not in this schema - and TipTap throws on the *entire* document when
 * that happens. "Unknown node type: pageBreak" is how that played out once: a
 * single page break in a Word file made the whole import fail.
 *
 * These helpers keep the rest of the document instead: an unknown node becomes
 * its own text, an unknown mark is dropped, and `plainTextDocument` is the last
 * resort that cannot fail.
 */

/** Every text run inside a node, joined. */
export const textOfNode = (node) => {
  if (!node || typeof node !== 'object') return ''
  if (typeof node.text === 'string') return node.text
  return (node.content || []).map(textOfNode).filter(Boolean).join(' ')
}

/**
 * @param {object} value   ProseMirror JSON from the server
 * @param {object} schema  the live editor schema (`editor.schema`)
 * @returns {{ content: object, dropped: number }}
 */
export const sanitizeEditorContent = (value, schema) => {
  if (!schema || !value || typeof value !== 'object') return { content: value, dropped: 0 }
  let dropped = 0

  const walk = (node) => {
    if (!node || typeof node !== 'object' || typeof node.type !== 'string') return null

    if (!schema.nodes[node.type]) {
      dropped += 1
      const text = textOfNode(node).trim()
      return text ? { type: 'paragraph', content: [{ type: 'text', text }] } : null
    }

    const next = { ...node }
    if (Array.isArray(node.content)) {
      const content = node.content.map(walk).filter(Boolean)
      if (content.length) next.content = content
      else delete next.content
    }
    if (Array.isArray(node.marks)) {
      const marks = node.marks.filter((mark) => {
        const known = Boolean(mark && typeof mark.type === 'string' && schema.marks[mark.type])
        if (!known) dropped += 1
        return known
      })
      if (marks.length) next.marks = marks
      else delete next.marks
    }
    return next
  }

  return { content: walk(value) || { type: 'doc', content: [{ type: 'paragraph' }] }, dropped }
}

/** One paragraph per top-level block: formatting is lost, the text never is. */
export const plainTextDocument = (value) => {
  const blocks = Array.isArray(value?.content) ? value.content : []
  const paragraphs = blocks
    .map((block) => ({ type: 'paragraph', content: [{ type: 'text', text: textOfNode(block) }] }))
    .filter((paragraph) => paragraph.content[0].text.trim())
  return { type: 'doc', content: paragraphs.length ? paragraphs : [{ type: 'paragraph' }] }
}
