import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as Y from 'yjs'
import { HocuspocusProvider } from '@hocuspocus/provider'
import { getStoredToken } from '../../utils/storage'

/**
 * Real-time collaboration for a PDF report.
 *
 * The collaboration server is the same one the Word workspace uses; the document
 * name is what separates them (`report-pdf-<id>`). For a PDF the server keeps the
 * CRDT state in memory only, because the document itself is a file: nothing about
 * its content may land in the database.
 *
 * That leaves one question this hook has to answer: if the session starts empty
 * every time, who fills it from the file's extracted structure? Not everyone -
 * several clients seeding at once would insert the whole document several times
 * over, and CRDT merge cannot deduplicate that. So seeding is an election: the
 * connected *editor* with the lowest client id does it, once, and everyone else
 * waits for the result.
 */

const seedDelay = 300

const collabUrl = () => {
  if (import.meta.env.VITE_COLLAB_URL) return import.meta.env.VITE_COLLAB_URL
  const api = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
  try {
    const url = new URL(api)
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
    url.port = String(import.meta.env.VITE_COLLAB_PORT || 1234)
    url.pathname = ''
    url.search = ''
    return url.origin
  } catch {
    return 'ws://localhost:1234'
  }
}

export const usePdfCollaboration = ({ documentName, canWrite, user }) => {
  const [ydoc] = useState(() => new Y.Doc())
  const [provider, setProvider] = useState(null)
  const [status, setStatus] = useState(documentName ? 'connecting' : 'idle')
  const [deniedReason, setDeniedReason] = useState('')
  const [synced, setSynced] = useState(false)
  const [peers, setPeers] = useState([])
  const [seeded, setSeeded] = useState(false)

  // Read by the election below without re-subscribing on every render.
  const identityRef = useRef({ canWrite, user })
  useEffect(() => {
    identityRef.current = { canWrite, user }
  }, [canWrite, user])

  useEffect(() => {
    if (!documentName) return undefined

    const instance = new HocuspocusProvider({
      url: collabUrl(),
      name: documentName,
      document: ydoc,
      token: getStoredToken() || '',
    })
    // The provider is an external resource owned by this effect, and publishing
    // it is what lets the editor bind its collaboration extensions to it - so a
    // state update here is the effect doing its job, not a render cascade.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProvider(instance)

    const describe = (state) => {
      if (!state?.user) return null
      return {
        clientId: state.clientId ?? null,
        id: state.user.id,
        name: state.user.name || 'Someone',
        role: state.user.role || 'user',
        canWrite: Boolean(state.canWrite),
      }
    }

    const readAwareness = () => {
      const states = instance.awareness?.getStates?.()
      if (!states) return
      const next = []
      states.forEach((state, clientId) => {
        const peer = describe({ ...state, clientId })
        if (peer) next.push(peer)
      })
      setPeers(next)
    }

    const onSynced = () => {
      setSynced(true)
      // Publish who we are, so the others can show a presence list and so the
      // seeding election can exclude read-only viewers.
      instance.awareness?.setLocalStateField('user', identityRef.current.user || { id: 0, name: 'You' })
      instance.awareness?.setLocalStateField('canWrite', Boolean(identityRef.current.canWrite))
      readAwareness()
    }

    instance.on('synced', onSynced)
    instance.on('awarenessChange', readAwareness)
    instance.on('status', ({ status: next }) => setStatus(next))
    instance.on('authenticationFailed', ({ reason }) => {
      setStatus('denied')
      setDeniedReason(reason || 'This document is not shared with you.')
    })

    return () => {
      instance.destroy()
      setProvider(null)
    }
  }, [documentName, ydoc])

  /**
   * Is this client the one that should write the extracted structure into the
   * shared document? Only the lowest-id connected *writer* says yes, and only
   * while the shared document is still empty.
   */
  const isSeedLeader = useCallback(() => {
    if (!canWrite) return false
    const fragment = ydoc.getXmlFragment('default')
    if (fragment.length > 0) return false

    const states = provider?.awareness?.getStates?.()
    const writerIds = [ydoc.clientID]
    states?.forEach((state, clientId) => {
      if (state?.canWrite) writerIds.push(clientId)
    })
    return Math.min(...writerIds) === ydoc.clientID
  }, [canWrite, provider, ydoc])

  /**
   * Run `seed` once the document is synced, if this client won the election.
   * Resolves true when this client actually seeded.
   */
  const seedWhenLeader = useCallback(async (seed) => {
    if (!synced || seeded) return false
    // A short pause so the awareness states of the others arrive before the
    // election is decided - otherwise two clients that connect at the same
    // moment both see only themselves and both seed.
    await new Promise((resolve) => { setTimeout(resolve, seedDelay) })
    if (!isSeedLeader()) return false

    setSeeded(true)
    seed()
    return true
  }, [isSeedLeader, seeded, synced])

  /** Mark the shared document as already populated (used by the first editor). */
  const markSeeded = useCallback(() => setSeeded(true), [])

  const value = useMemo(() => ({
    ydoc,
    provider,
    status,
    deniedReason,
    synced,
    peers,
    seedWhenLeader,
    markSeeded,
    collabUrl: collabUrl(),
  }), [deniedReason, markSeeded, peers, provider, seedWhenLeader, status, synced, ydoc])

  return value
}

export default usePdfCollaboration
