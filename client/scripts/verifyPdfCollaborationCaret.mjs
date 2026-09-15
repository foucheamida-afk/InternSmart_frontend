/**
 * Why the PDF workspace must not build its editor before the collaboration
 * provider exists.
 *
 *   node scripts/verifyPdfCollaborationCaret.mjs
 *
 * `CollaborationCaret.addProseMirrorPlugins()` reads `provider.awareness` with no
 * null guard, and TipTap installs extension plugins while the editor is being
 * constructed - i.e. during the first render. The Hocuspocus provider is created
 * in an effect, so that first render has none. The result was a blank page and:
 *
 *   Uncaught TypeError: Cannot read properties of null (reading 'awareness')
 *     at Object.addProseMirrorPlugins (@tiptap/extension-collaboration-caret)
 *
 * This asserts both halves of that story at the failing line: a null provider
 * really does throw there, and a provider whose socket is not connected yet does
 * not, because the extension needs the awareness instance rather than a live
 * connection. The page therefore mounts the editor only once the provider is
 * non-null (see PdfEditableDocument in src/pages/PdfWorkspace.jsx).
 */
import * as Y from 'yjs'
import { Awareness } from 'y-protocols/awareness.js'
import { CollaborationCaret } from '@tiptap/extension-collaboration-caret'

let failures = 0
const check = (name, passed, detail = '') => {
  if (!passed) failures += 1
  console.log(`${passed ? 'PASS' : 'FAIL'}  ${name}${detail ? `  [${detail}]` : ''}`)
}

// The call an extension manager makes, with just the context this extension
// reads: its resolved options and the storage slot it was given.
const installPlugins = (options) => {
  const extension = CollaborationCaret.configure(options)
  return extension.config.addProseMirrorPlugins.call({
    options: extension.options,
    storage: { users: [] },
  })
}

// 1. The reported failure, reproduced at its source.
let failure = null
try {
  installPlugins({ provider: null, user: { name: 'Nobody', color: '#ff7a00' } })
} catch (error) {
  failure = error
}

check(
  'a null provider throws while the caret extension installs its plugins',
  failure instanceof TypeError && /awareness/.test(failure.message),
  failure ? failure.message : 'no error thrown',
)

// 2. The provider the page actually waits for: awareness present, socket not yet
// connected - exactly what an effect-created provider looks like on first use.
const awareness = new Awareness(new Y.Doc())
const ydoc = new Y.Doc()

let plugins = null
let okError = null
try {
  plugins = installPlugins({
    provider: { awareness, document: ydoc },
    user: { name: 'Student', color: '#ff7a00' },
  })
} catch (error) {
  okError = error
}

check(
  'a provider with an awareness instance installs cleanly',
  Array.isArray(plugins) && plugins.length === 2,
  okError ? okError.message : `${plugins?.length ?? 0} plugin(s)`,
)

// 3. An awareness instance exists from the moment the provider is constructed,
// with no connection required - which is why waiting for a non-null provider is
// sufficient to make the two orders (render vs. effect) compatible.
awareness.setLocalStateField('user', { name: 'Student', color: '#ff7a00' })
check(
  'awareness is usable before the provider connects',
  typeof awareness.getStates === 'function' && awareness.getStates().size === 1,
  `${awareness.getStates().size} state(s)`,
)

console.log(`\n${failures === 0 ? 'CARET PROVIDER REQUIREMENT VERIFIED' : `${failures} CHECK(S) FAILED`}`)
process.exit(failures === 0 ? 0 : 1)
