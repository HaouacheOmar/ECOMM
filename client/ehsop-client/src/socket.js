import { API_URL } from './api.js'

const WS_BASE = API_URL.replace(/^http/, 'ws').replace(/\/api\/?$/, '')
const UNAUTHORIZED = 4001

/**
 * The shared WebSocket client: sends the access token as the first message, and when the server
 * closes with 4001 (token expired or refused) refreshes the session and reconnects. Other drops
 * reconnect with backoff. `onReady` runs on every (re)connection so callers can refetch what they
 * may have missed. Returns a function that closes the socket for good.
 */
export function connectSocket(path, { getToken, refresh, onReady, onEvent }) {
  let socket
  let timer
  let attempt = 0
  let stopped = false

  const open = () => {
    socket = new WebSocket(`${WS_BASE}${path}`)
    socket.onopen = () => socket.send(JSON.stringify({ type: 'auth', token: getToken() }))
    socket.onmessage = (e) => {
      const message = JSON.parse(e.data)
      if (message.type === 'ready') {
        attempt = 0
        onReady()
      } else {
        onEvent(message)
      }
    }
    socket.onclose = async (e) => {
      if (stopped) return
      if (e.code === UNAUTHORIZED && !(await refresh())) return // the session is over
      // First retry is immediate (a routine token expiry); repeated failures back off up to 10 s.
      const delay = attempt === 0 ? 0 : Math.min(1000 * 2 ** attempt, 10000)
      attempt += 1
      if (!stopped) timer = setTimeout(open, delay)
    }
  }

  open()
  return () => {
    stopped = true
    clearTimeout(timer)
    socket.close()
  }
}
