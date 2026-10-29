/// <reference types="node" />
// The shared log's live channel, 15 October 2026. A partner's timer used to reach the other phone
// only at the next minute's read or when the app came back to the front. The listener joins the
// log's channel, reads on each ping, and comes back after a dropped connection.
import { test, mock as fake } from 'node:test'
import assert from 'node:assert/strict'
import { listen } from '../src/lib/live.ts'

type Sent = { topic: string; event: string; payload: { config?: { private?: boolean } } }

function fakeSockets () {
  const all: { url: string; sent: Sent[]; s: any }[] = []
  const open = (url: string) => {
    const s: any = { readyState: 0, onopen: null, onmessage: null, onclose: null, onerror: null, closed: false }
    const rec = { url, sent: [] as Sent[], s }
    s.send = (t: string) => rec.sent.push(JSON.parse(t))
    s.close = () => { s.closed = true; s.readyState = 3; s.onclose?.() }
    all.push(rec)
    return s
  }
  const up = (i: number) => { all[i].s.readyState = 1; all[i].s.onopen() }
  const say = (i: number, msg: object) => all[i].s.onmessage({ data: JSON.stringify(msg) })
  return { all, open, up, say }
}

const TOPIC = 'sleep-7c192351-45d7-4306-9144-ed2a08f10001'
const joined = { topic: `realtime:${TOPIC}`, event: 'phx_reply', payload: { status: 'ok', response: {} } }
const ping = { topic: `realtime:${TOPIC}`, event: 'broadcast', payload: { event: 'changed', payload: { at: 1 }, type: 'broadcast' } }

test('it joins the log’s own public channel with the app’s public key', () => {
  const f = fakeSockets()
  const stop = listen(TOPIC, () => {}, f.open)
  f.up(0)
  assert.match(f.all[0].url, /^wss:\/\/eynuujdjarqnwkjofrpw\.supabase\.co\/realtime\/v1\/websocket\?apikey=sb_publishable_/)
  assert.equal(f.all[0].sent[0].topic, `realtime:${TOPIC}`)
  assert.equal(f.all[0].sent[0].event, 'phx_join')
  assert.equal(f.all[0].sent[0].payload.config?.private, false)
  stop()
})

test('a ping reads the log, and the join and other traffic do not', () => {
  const f = fakeSockets()
  let reads = 0
  const stop = listen(TOPIC, () => reads++, f.open)
  f.up(0)
  f.say(0, joined)
  assert.equal(reads, 0)
  f.say(0, { topic: 'phoenix', event: 'phx_reply', payload: { status: 'ok' } })
  f.say(0, { topic: 'realtime:sleep-another-log', event: 'broadcast', payload: { event: 'changed' } })
  assert.equal(reads, 0)
  f.say(0, ping)
  f.say(0, ping)
  assert.equal(reads, 2)
  stop()
})

test('a dropped connection comes back, reads on rejoining, and waits longer each time it fails', () => {
  fake.timers.enable({ apis: ['setTimeout', 'setInterval'] })
  try {
    const f = fakeSockets()
    let reads = 0
    const stop = listen(TOPIC, () => reads++, f.open)
    f.up(0); f.say(0, joined)
    f.all[0].s.onclose()
    fake.timers.tick(999)
    assert.equal(f.all.length, 1)
    fake.timers.tick(1)
    assert.equal(f.all.length, 2)
    f.all[1].s.onclose()
    fake.timers.tick(1999)
    assert.equal(f.all.length, 2)
    fake.timers.tick(1)
    assert.equal(f.all.length, 3)
    f.up(2); f.say(2, joined)
    assert.equal(reads, 1)
    stop()
  } finally {
    fake.timers.reset()
  }
})

test('the heartbeat goes every 25 seconds, and stopping closes the line for good', () => {
  fake.timers.enable({ apis: ['setTimeout', 'setInterval'] })
  try {
    const f = fakeSockets()
    const stop = listen(TOPIC, () => {}, f.open)
    f.up(0)
    fake.timers.tick(25000)
    assert.equal(f.all[0].sent.filter((m) => m.event === 'heartbeat').length, 1)
    stop()
    assert.equal(f.all[0].s.closed, true)
    fake.timers.tick(120000)
    assert.equal(f.all.length, 1)
  } finally {
    fake.timers.reset()
  }
})
