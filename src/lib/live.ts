// Hears another phone's change the moment it is saved. The shared log's database sends a ping on the
// log's own Realtime channel after every change, and `listen` calls `onChange` when one arrives, so
// the phone reads the change through sleep_pull at once instead of at the next minute. The ping
// carries no sleep and no name, and only the phones holding the share link are told the channel.
// Supabase Realtime speaks the Phoenix channel protocol over a WebSocket: join, a heartbeat every
// 25 seconds, and a `broadcast` message per ping.
import { KEY, PROJECT } from './sync.ts'

const SOCKET = `wss://${PROJECT}.supabase.co/realtime/v1/websocket?apikey=${KEY}&vsn=1.0.0`
const BEAT = 25000
const LONGEST_WAIT = 60000

type Socket = Pick<WebSocket, 'send' | 'close' | 'readyState'> & {
  onopen: (() => void) | null
  onmessage: ((m: { data: unknown }) => void) | null
  onclose: (() => void) | null
  onerror: (() => void) | null
}

// Returns the function that stops listening. A dropped connection comes back after 1, 2, 4 seconds
// and so on up to a minute, and every join after the first calls `onChange`, since a ping may have
// gone out while the phone was away.
export function listen (topic: string, onChange: () => void, open: (url: string) => Socket = (url) => new WebSocket(url) as unknown as Socket) {
  let ws: Socket | null = null
  let ref = 0
  let beat: ReturnType<typeof setInterval> | null = null
  let retry: ReturnType<typeof setTimeout> | null = null
  let wait = 1000
  let joined = false
  let stopped = false
  const send = (t: string, event: string, payload: object) => {
    if (ws && ws.readyState === 1) ws.send(JSON.stringify({ topic: t, event, payload, ref: String(++ref) }))
  }
  const connect = () => {
    if (stopped) return
    const s = open(SOCKET)
    ws = s
    s.onopen = () => {
      send(`realtime:${topic}`, 'phx_join', { config: { broadcast: { self: false, ack: false }, presence: { key: '' }, private: false } })
      beat = setInterval(() => send('phoenix', 'heartbeat', {}), BEAT)
    }
    s.onmessage = (m) => {
      let d: { topic?: string; event?: string; payload?: { status?: string; event?: string } }
      try { d = JSON.parse(String(m.data)) } catch { return }
      if (d.topic !== `realtime:${topic}`) return
      if (d.event === 'phx_reply' && d.payload?.status === 'ok') {
        wait = 1000
        if (joined) onChange()
        joined = true
      } else if (d.event === 'broadcast' && d.payload?.event === 'changed') onChange()
    }
    s.onerror = () => {}
    s.onclose = () => {
      if (beat) clearInterval(beat)
      beat = null
      if (stopped || ws !== s) return
      retry = setTimeout(connect, wait)
      wait = Math.min(wait * 2, LONGEST_WAIT)
    }
  }
  connect()
  return () => {
    stopped = true
    if (beat) clearInterval(beat)
    if (retry) clearTimeout(retry)
    ws?.close()
    ws = null
  }
}
