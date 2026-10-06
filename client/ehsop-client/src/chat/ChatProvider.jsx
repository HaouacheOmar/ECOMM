import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useDispatch, useSelector, useStore } from 'react-redux'
import { api } from '../api.js'
import { authApi } from '../auth/authApi.js'
import { connectSocket } from '../socket.js'
import { ChatContext } from './chatContext.js'

/**
 * Owns the chat socket for a Customer or Employee. Messages are sent over the socket with a
 * client_id and stay "pending" until acknowledged; whatever is still unacknowledged is resent after
 * a reconnect (the server stores each client_id once). Incoming messages and Support Queue changes
 * refetch the cached history and lists, as does every reconnection.
 */
export default function ChatProvider({ children }) {
  const dispatch = useDispatch()
  const store = useStore()
  const userId = useSelector((state) => state.auth.user?.id)
  const socket = useRef(null)
  // client_id -> { client_id, body, to, status: 'sending' | 'sent' | 'failed', error }
  const [pending, setPending] = useState({})
  const pendingRef = useRef(pending) // read by the socket callbacks
  useEffect(() => {
    pendingRef.current = pending
  }, [pending])

  const update = (clientId, changes) =>
    setPending((all) => (all[clientId] ? { ...all, [clientId]: { ...all[clientId], ...changes } } : all))

  useEffect(() => {
    if (!userId) return
    const refetch = () => dispatch(api.util.invalidateTags(['Chat', 'ChatQueue']))
    const transmit = ({ client_id, body, to }) => socket.current?.send({ type: 'send', client_id, body, ...(to && { to }) })
    socket.current = connectSocket('/ws/chat/', {
      getToken: () => store.getState().auth.accessToken,
      refresh: async () => Boolean((await dispatch(authApi.endpoints.restoreSession.initiate())).data),
      onReady: () => {
        refetch()
        Object.values(pendingRef.current).filter((m) => m.status === 'sending').forEach(transmit)
      },
      onEvent: (event) => {
        if (event.type === 'ack') update(event.client_id, { status: 'sent' })
        if (event.type === 'error') update(event.client_id, { status: 'failed', error: event.detail })
        refetch()
      },
    })
    return () => {
      socket.current.close()
      socket.current = null
    }
  }, [userId, dispatch, store])

  const send = useCallback((body, to) => {
    const message = { client_id: crypto.randomUUID(), body, to, status: 'sending', created_at: new Date().toISOString() }
    setPending((all) => ({ ...all, [message.client_id]: message }))
    socket.current?.send({ type: 'send', client_id: message.client_id, body, ...(to && { to }) }) // else sent on reconnect
  }, [])

  const dismiss = useCallback((clientId) => setPending((all) => {
    const rest = { ...all }
    delete rest[clientId]
    return rest
  }), [])

  const value = useMemo(() => ({ pending: Object.values(pending), send, dismiss }), [pending, send, dismiss])
  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}
