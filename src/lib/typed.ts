/* What a parent types about the morning, read on the phone into the wake-up and the sleeps. From
   mock type-what-happened v1, 11 October 2026. The words are never sent anywhere.

   Each piece between commas is one thing that happened. A piece with two times is a sleep. A sleep
   word and one time start a sleep that the next wake-up ends, or that is still going. A wake-up
   before anything else is the morning. A feed, the night, a piece with no time and a time still to
   come are not added, and the sheet lists each one in the parent's own words. A time with no am or
   pm goes on the latest time of day that has passed, in the order the pieces were typed. */
import { DAY, MIN, asLogged, dayAt, dayFloor, isMark, kindFor, withMorning, type Baby, type Sleep } from './engine.ts'

export type TypedRow = { k: 'wake'; t: number; p: string } | { k: 'sleep'; s: number; e: number | null; p: string }
export type Typed = { rows: (TypedRow & { i: number })[]; left: string[]; drop: string[] }

const HR = '(\\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)'
const TIME = new RegExp(`\\b(?:(quarter|half|five|ten|twenty(?:[- ]five)?)\\s+(past|to)\\s+${HR}|half\\s+${HR}|(\\d{1,2})(?:[:.](\\d{2}))?\\s*(am|pm|a\\.m\\.|p\\.m\\.)?|(noon|midday))(?![\\w:])`, 'gi')
const WORD: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 }
const PAST: Record<string, number> = { quarter: 15, half: 30, five: 5, ten: 10, twenty: 20, 'twenty five': 25, 'twenty-five': 25 }
const LONG = /\bfor\s+(?:(an?|one|\d+)\s*(?:h|hr|hrs|hour|hours)\b)?\s*(?:and\s+)?(?:(\d+)\s*(?:m|min|mins|minute|minutes)\b)?/i
const NOT_SLEEP = /\b(fed|feed|feeding|bottle|breast|boob|nappy|nappies|diaper|poo|wee|bath|ate|solids|milk|changed)\b/i
const NIGHT = /\b(night|bed|bedtime|tonight)\b/i
const WAKES = /\b(up|woke|wakes|awake|waking|wake)\b/i
const SLEEPS = /\b(nap|naps|napped|napping|asleep|slept|sleep|down|dozed|dozing|snoozed|conked)\b/i
const ENDS = /\b(woke|awake)\b/i
const SPLIT = /[,;\n]+|\.(?=\s|$)|\s+then\s+|\s+and\s+(?=(?:then\s+)?(?:up|woke|awake|nap|napped|down|asleep|slept|back|went|fed|feed|had)\b)/i

type Clock = { h: number; m: number; ap: 'am' | 'pm' | null }
const hourOf = (x: string) => WORD[x.toLowerCase()] ?? parseInt(x, 10)

function clocks (text: string): Clock[] {
  const out: Clock[] = []
  for (const m of text.matchAll(TIME)) {
    if (m[1]) { const n = PAST[m[1].toLowerCase()], h = hourOf(m[3]); out.push(m[2].toLowerCase() === 'past' ? { h, m: n, ap: null } : { h: h - 1, m: 60 - n, ap: null }) }
    else if (m[4]) out.push({ h: hourOf(m[4]), m: 30, ap: null })
    else if (m[8]) out.push({ h: 12, m: 0, ap: 'pm' })
    else if (m[5]) out.push({ h: +m[5], m: m[6] ? +m[6] : 0, ap: m[7] ? (m[7][0].toLowerCase() === 'p' ? 'pm' : 'am') : null })
  }
  return out.filter((c) => c.h >= 0 && c.h <= 23 && c.m < 60)
}

// The latest time the clock showed it, at or before now and not before `after`. A time still to
// come comes back after now, and the piece is not added.
function place (c: Clock, after: number, now: number) {
  const hours = c.ap ? [(c.h % 12) + (c.ap === 'pm' ? 12 : 0)] : c.h >= 13 ? [c.h] : [c.h % 12, (c.h % 12) + 12]
  const all = [-1, 0].flatMap((k) => hours.map((h) => dayAt(now + k * DAY, h, c.m))).filter((t) => t >= after)
  const past = all.filter((t) => t <= now)
  return past.length ? Math.max(...past) : all.length ? Math.min(...all) : Infinity
}

function minutes (long: RegExpMatchArray | null) {
  if (!long || (!long[1] && !long[2])) return 0
  return (long[1] ? (/^(an?|one)$/i.test(long[1]) ? 60 : +long[1] * 60) : 0) + (long[2] ? +long[2] : 0)
}

export function readTyped (text: string, baby: Baby, now: number): { rows: TypedRow[]; left: string[] } {
  const rows: TypedRow[] = [], left: string[] = []
  let after = dayFloor(baby, now) - 90 * MIN, open: { s: number; p: string } | null = null
  const shut = () => { if (open) left.push(open.p); open = null }
  for (const p of text.split(SPLIT).map((x) => x.trim()).filter(Boolean)) {
    if (NOT_SLEEP.test(p) || NIGHT.test(p)) { left.push(p); continue }
    const long = p.match(LONG), mins = minutes(long), cs = clocks(long ? p.replace(long[0], ' ') : p)
    if (cs.length >= 2) {
      const s = place(cs[0], after, now), e = place(cs[1], s + 1, now)
      if (e <= now) { shut(); rows.push({ k: 'sleep', s, e, p }); after = e } else left.push(p)
    } else if (cs.length === 1 && SLEEPS.test(p) && !ENDS.test(p)) {
      const s = place(cs[0], after, now)
      if (s > now) left.push(p)
      else if (mins && s + mins * MIN <= now) { shut(); rows.push({ k: 'sleep', s, e: s + mins * MIN, p }); after = s + mins * MIN }
      else { shut(); open = { s, p }; after = s }
    } else if (cs.length === 1 && WAKES.test(p)) {
      const t = place(cs[0], after, now)
      if (t > now) left.push(p)
      else if (open) { rows.push({ k: 'sleep', s: open.s, e: t, p: `${open.p}, ${p}` }); open = null; after = t }
      else if (!rows.length) { rows.push({ k: 'wake', t, p }); after = t }
      else left.push(p)
    } else left.push(p)
  }
  const o = open as { s: number; p: string } | null
  if (o) rows.push({ k: 'sleep', s: o.s, e: null, p: o.p })
  return { rows, left }
}

// The rows checked against the log, after the parent's own changes to them. A sleep over a nap in
// the log takes its place, the timer's running nap too. A sleep over the night is not added.
export function typed (text: string, baby: Baby, log: Sleep[], now: number, fixes: Record<number, TypedRow | null> = {}): Typed {
  const r = readTyped(text, baby, now), left = [...r.left], drop: string[] = [], rows: Typed['rows'] = []
  const read = r.rows.map((x, i) => { const f = i in fixes ? fixes[i] : x; return f ? { ...f, i } : null }).filter((x): x is TypedRow & { i: number } => x != null)
  const wake = read.find((x) => x.k === 'wake')
  const after = (wake ? withMorning(baby, log, now, wake.t, 'typed').sleeps : log).filter((x) => !x.deleted && !isMark(x)).map((x) => asLogged(baby, x))
  for (const x of read) {
    if (x.k === 'wake') { rows.push(x); continue }
    const end = x.e ?? now, hits = after.filter((y) => y.s < end && (y.e ?? now) > x.s)
    if (hits.some((y) => y.kind === 'night')) left.push(x.p)
    else { drop.push(...hits.map((y) => y.id)); rows.push(x) }
  }
  return { rows, left, drop: [...new Set(drop)] }
}

// The log with the typed rows in it: the morning first, then the naps that are replaced, then
// each new sleep. `ids` lists every row that changed, for a shared log.
export function applyTyped (baby: Baby, log: Sleep[], now: number, r: Typed, id: () => string, share: boolean): { sleeps: Sleep[]; ids: string[] } {
  let sleeps = log
  const ids: string[] = []
  for (const x of r.rows) if (x.k === 'wake') { const m = withMorning(baby, sleeps, now, x.t, id()); sleeps = m.sleeps; ids.push(m.id) }
  const gone = new Set(r.drop)
  sleeps = share ? sleeps.map((x) => (gone.has(x.id) ? { ...x, deleted: true, updatedAt: now } : x)) : sleeps.filter((x) => !gone.has(x.id))
  ids.push(...r.drop)
  for (const x of r.rows) {
    if (x.k !== 'sleep') continue
    const n = id()
    sleeps = [...sleeps, { id: n, s: x.s, e: x.e, kind: kindFor(baby, x.s), up: false, updatedAt: now }]
    ids.push(n)
  }
  return { sleeps: sleeps.sort((a, b) => a.s - b.s), ids }
}
