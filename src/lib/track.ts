// What Baby Nap Track tells PostHog. Counts only: no name, no sleep times, and no
// id kept on the phone, so PostHog counts how many phones reach each step and cannot follow one
// phone from day to day. The free week ending is `snug_free_week_ended`, sent the first time the
// nap times lock.
import { DAY, isMark, type Baby, type Sleep } from './engine.ts'
import type { Gate, Paid } from './shop.ts'

// Where the phone installed Baby Nap Track from, read once from Google Play and sent with the first open. Play
// keeps the tags of the link that led to the install: `google-play` and `organic` for a Play search,
// and the campaign's own name for a link from an ad. A Google Ads click id becomes `ad: true`
// and is never sent.
export type Source = { source: string | null; medium: string | null; campaign: string | null; ad: boolean }
export const NO_SOURCE: Source = { source: null, medium: null, campaign: null, ad: false }

// A tag keeps letters, digits, dots, dashes and underscores, up to 40, so nothing else in a link
// reaches PostHog.
const tag = (v: string | undefined) => (v ?? '').toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 40) || null
const safe = (s: string) => { try { return decodeURIComponent(s) } catch { return s } }

export function parseReferrer (raw: string | null | undefined): Source {
  if (!raw) return NO_SOURCE
  // A link that encoded its tags twice reaches the phone as `utm_source%3Dgoogle%26...`.
  const text = !raw.includes('=') && /%3d/i.test(raw) ? safe(raw) : raw
  const q = new Map<string, string>()
  for (const part of text.split('&')) {
    const i = part.indexOf('=')
    if (i > 0) q.set(safe(part.slice(0, i)), safe(part.slice(i + 1).replace(/\+/g, ' ')))
  }
  return { source: tag(q.get('utm_source')), medium: tag(q.get('utm_medium')), campaign: tag(q.get('utm_campaign')), ad: ['gclid', 'gbraid', 'wbraid'].some((k) => q.has(k)) }
}

// Every event and the only fields it may carry.
export type Event =
  | ({ event: 'snug_first_open' } & Source)
  | { event: 'snug_setup_done'; naps: number }
  | { event: 'snug_day'; day: number | null; gate: Gate['kind']; sleeps: number; shared: boolean }
  | { event: 'snug_free_week_started'; price: string }
  | { event: 'snug_free_week_ended'; sleeps: number; shared: boolean }
  | { event: 'snug_buy_tapped'; gate: Gate['kind'] }
  | { event: 'snug_purchase'; outcome: string; late: boolean }
  | { event: 'snug_restore'; outcome: string }
  | { event: 'snug_share_started' }
  | { event: 'snug_share_joined' }
  | { event: 'snug_log_deleted' }

// The steps sent once per phone. Each is marked after PostHog has it, so a phone that was offline
// sends it the next time the app opens. `day` is the last date `snug_day` went for.
export type Told = { first: boolean; started: boolean; ended: boolean; day: string | null }
export const NOT_TOLD: Told = { first: false, started: false, ended: false, day: null }

const midnight = (t: number) => new Date(t).setHours(0, 0, 0, 0)

export const dayKey = (t: number) => {
  const d = new Date(t)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Day 0 is the day the free week started. The nap times lock on day 8. Rounding keeps a day that
// a clock change made 23 or 25 hours long.
export const freeDay = (from: number | null, now: number) => (from == null ? null : Math.round((midnight(now) - midnight(from)) / DAY))

type State = { baby: Baby | null; sleeps: Sleep[]; share: unknown; paid: Paid; told: Told }

const logged = (s: State) => s.sleeps.filter((x) => !x.deleted && !isMark(x)).length

// The once-only steps due now, with the events that tell them.
export function due (s: State, g: Gate, now: number, from: Source = NO_SOURCE): { key: keyof Told; ev: Event }[] {
  const out: { key: keyof Told; ev: Event }[] = []
  if (!s.told.first) out.push({ key: 'first', ev: { event: 'snug_first_open', ...from } })
  if (!s.told.started && s.paid.price && s.paid.trialFrom != null) out.push({ key: 'started', ev: { event: 'snug_free_week_started', price: s.paid.price } })
  if (!s.told.ended && g.kind === 'locked') out.push({ key: 'ended', ev: { event: 'snug_free_week_ended', sleeps: logged(s), shared: !!s.share } })
  if (s.told.day !== dayKey(now)) out.push({ key: 'day', ev: { event: 'snug_day', day: freeDay(s.paid.trialFrom, now), gate: g.kind, sleeps: logged(s), shared: !!s.share } })
  return out
}

// A phone that saved its log before this version counts as opened already, and its free week as
// started if it had one.
export function toldOnLoad (saved: { told?: Partial<Told>; paid?: Partial<Paid> } | null): Told {
  if (!saved) return NOT_TOLD
  if (saved.told) return { ...NOT_TOLD, ...saved.told }
  return { ...NOT_TOLD, first: true, started: saved.paid?.trialFrom != null }
}
