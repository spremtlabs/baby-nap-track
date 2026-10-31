// Sends Baby Nap Track's events to PostHog's servers in the EU, into a Spremt Labs project,
// each marked `product: snug`. The project throws away IP addresses. Each run of the app makes a
// random id that is never saved, so PostHog builds no profile of anyone. The web build sends
// nothing; it keeps the events on the page for the gate to read. The token here is the public one
// every copy of the app on Play and the App Store carries. The open source copy has none, so a phone
// built from it sends nothing.
import * as Application from 'expo-application'
import Constants from 'expo-constants'
import * as Crypto from 'expo-crypto'
import { Platform } from 'react-native'
import { IPHONE } from './phone.ts'
import { NO_SOURCE, parseReferrer, type Event, type Source } from './track.ts'

// On an iPhone Baby Nap Track asks before it sends a single count, and sends
// nothing until the parent says yes in setup or turns the switch on in Settings. Android sends the
// counts as it always has. Android can ask the same question in a release of its own, by changing
// this one line.
export const ASK_COUNTS = IPHONE
let allowed = !ASK_COUNTS

const URL = 'https://eu.i.posthog.com/batch/'
const TOKEN = ''
export const EVENTS_KEY = 'snug.events'

const run = Crypto.randomUUID()
const version = Constants.expoConfig?.version ?? 'unknown'

type Wire = { event: string; timestamp: string; properties: Record<string, unknown> }
let queue: { w: Wire; done: (ok: boolean) => void }[] = []
let timer: ReturnType<typeof setTimeout> | null = null

const wire = ({ event, ...fields }: Event): Wire => ({
  event,
  timestamp: new Date().toISOString(),
  properties: { ...fields, distinct_id: run, product: 'snug', app_version: version, platform: Platform.OS, $process_person_profile: false, $geoip_disable: true, $lib: 'snug' },
})

// The parent's answer. A no drops anything still waiting to go.
export function allowCounts (yes: boolean) {
  allowed = !ASK_COUNTS || yes
  if (allowed) return
  if (timer) clearTimeout(timer)
  timer = null
  const dropped = queue
  queue = []
  for (const x of dropped) x.done(false)
}

// Resolves true once PostHog has the event. Events wait a second so a start sends one request.
// Without a yes on an iPhone it resolves false and nothing is kept.
export function track (e: Event): Promise<boolean> {
  if (!allowed || (!TOKEN && Platform.OS !== 'web')) return Promise.resolve(false)
  return new Promise((done) => {
    queue.push({ w: wire(e), done })
    if (!timer) timer = setTimeout(flush, 1000)
  })
}

// An event that fails to send is dropped. The once-only steps are sent again on the next start.
export async function flush () {
  if (timer) clearTimeout(timer)
  timer = null
  const batch = queue
  queue = []
  if (!batch.length) return
  let ok = false
  try {
    if (Platform.OS === 'web') {
      const kept = JSON.parse(globalThis.localStorage?.getItem(EVENTS_KEY) || '[]')
      globalThis.localStorage?.setItem(EVENTS_KEY, JSON.stringify([...kept, ...batch.map((x) => x.w)]))
      ok = true
    } else {
      const res = await fetch(URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ api_key: TOKEN, batch: batch.map((x) => x.w) }) })
      ok = res.ok
    }
  } catch {}
  for (const x of batch) x.done(ok)
}

// The tags Google Play kept for this install, or none after three seconds. Play answers only on
// Android; the web build and an iPhone send none.
export async function installSource (): Promise<Source> {
  if (Platform.OS !== 'android') return NO_SOURCE
  try {
    const raw = await Promise.race([Application.getInstallReferrerAsync(), new Promise<null>((r) => setTimeout(() => r(null), 3000))])
    return parseReferrer(raw)
  } catch { return NO_SOURCE }
}
