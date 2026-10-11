/* What a parent types about the day, read on the phone into the wake-up and the sleeps, from
   11 October 2026. The words are never sent anywhere.

   Each piece between commas is one thing that happened, and `and` before two times starts a new
   piece. A piece with two times is a sleep, unless a wake word comes first: then the baby was up
   from the first time and went down at the second. Four times are two sleeps, and a nap's number
   before its times is no time. A sleep word and one time start a sleep that the next wake-up ends,
   or that is still going, and a sleep word with until or till before its time is that wake-up. A
   wake word with until or till before its one time is the baby going down then. A wake-up before
   anything else is the morning. The night slept until a time is the morning too, with the night's
   start when one is typed, and so is a sleep from yesterday evening to a time this morning. Bedtime
   with one time starts the night that the morning ends, or tonight's once it has come. A feed, a
   waking in the night, a piece with no time and a time still to come are not added, and the sheet
   lists each one in the parent's own words. A length such as `(45 min)` is no time of day. Each
   time with no am or pm after the first goes on the first time the clock shows it after the one
   before. */
import { DAY, HOUR, MIN, asLogged, dayAt, dayFloor, engine, isMark, newSleep, withMorning, type Baby, type Kind, type Sleep } from './engine.ts'

// A wake-up typed with the night's start carries it in `from`. A sleep carries what it goes in the
// log as, once it has been checked against the log: a nap, or the night, and `up` when it carries
// the night on to up for the day.
export type TypedRow = { k: 'wake'; t: number; p: string; from?: number } | { k: 'sleep'; s: number; e: number | null; p: string; kind?: Kind; up?: boolean }
// A wake-up that ends the sleep the timer is running: a nap, or the night, which is then up for the day.
export type TypedEnd = { k: 'end'; id: string; s: number; t: number; night: boolean; p: string }
export type Typed = { rows: ((TypedRow | TypedEnd) & { i: number })[]; left: string[]; drop: string[] }

const HR = '(\\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)'
const TIME = new RegExp(`\\b(?:(quarter|half|five|ten|twenty(?:[- ]five)?)\\s+(past|to)\\s+${HR}|half\\s+${HR}|(\\d{1,2})(?:[:.](\\d{2}))?\\s*(am|pm|a\\.m\\.|p\\.m\\.)?|(noon|midday))(?:ish)?(?![\\w:])`, 'gi')
const WORD: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 }
const PAST: Record<string, number> = { quarter: 15, half: 30, five: 5, ten: 10, twenty: 20, 'twenty five': 25, 'twenty-five': 25 }
// A length, `(45 min)` or `1 h 18 min`, read as minutes and kept out of the times of day.
const DUR = /\(?\b(\d+)\s*(h|hr|hrs|hour|hours|m|min|mins|minute|minutes)\b\)?/gi
const LONG = /\bfor\s+(?:(an?|one|\d+)\s*(?:h|hr|hrs|hour|hours)\b)?\s*(?:and\s+)?(?:(\d+)\s*(?:m|min|mins|minute|minutes)?\b)?/i
const NOT_SLEEP = /\b(fed|feed|feeding|bottle|breast|boob|nappy|nappies|diaper|poo|wee|bath|ate|solids|milk|changed)\b/i
const NIGHT = /\b(night|bed|bedtime|tonight)\b/i
const WAKES = /\b(up|woke|wakes|awake|waking|wake)\b/i
const SLEEPS = /\b(nap|naps|napped|napping|asleep|slept|sleep|down|dozed|dozing|snoozed|conked)\b/i
const ENDS = /\b(woke|awake)\b/i
const BACK = /\bback\b/i
// `Nap 1 9:10-10:20`: the nap's number before its times.
const COUNT = /\b(naps?|sleep)\s+(?:no\.?\s*|#)?\d\b(?=\s*:?\s+\d{1,2}(?:[:.]\d{2}|\s*[ap]\.?m))/gi
const TILL = /\b(?:until|till|til|to)\s+$/i
const SPLIT = /[,;\n]+|\.(?=\s|$)|\s+then\s+|\s+and\s+(?=(?:then\s+)?(?:up|woke|awake|nap|napped|down|asleep|slept|back|went|fed|feed|had)\b)|\s+and\s+(?=(?:from\s+)?\d{1,2}(?:[:.]\d{2})?\s*(?:am|pm)?\s*(?:to|till|til|until|-|\u2013)\s*\d)/i

type Clock = { h: number; m: number; ap: 'am' | 'pm' | null; at: number }
const hourOf = (x: string) => WORD[x.toLowerCase()] ?? parseInt(x, 10)

function clocks (text: string): Clock[] {
  const out: Clock[] = []
  for (const m of text.matchAll(TIME)) {
    const at = m.index
    if (m[1]) { const n = PAST[m[1].toLowerCase()], h = hourOf(m[3]); out.push(m[2].toLowerCase() === 'past' ? { h, m: n, ap: null, at } : { h: h - 1, m: 60 - n, ap: null, at }) }
    else if (m[4]) out.push({ h: hourOf(m[4]), m: 30, ap: null, at })
    else if (m[8]) out.push({ h: 12, m: 0, ap: 'pm', at })
    else if (m[5]) out.push({ h: +m[5], m: m[6] ? +m[6] : 0, ap: m[7] ? (m[7][0].toLowerCase() === 'p' ? 'pm' : 'am') : null, at })
  }
  return out.filter((c) => c.h >= 0 && c.h <= 23 && c.m < 60)
}

const hoursOf = (c: Clock) => (c.ap ? [(c.h % 12) + (c.ap === 'pm' ? 12 : 0)] : c.h >= 13 ? [c.h] : [c.h % 12, (c.h % 12) + 12])

// A time at or before now and not before `after`: the latest the clock showed it, or with `next`
// the first after `after`. A time still to come comes back after now, and the piece is not added.
// 11 October 2026: `Up at 5am until 6` typed at 6pm put the baby down at 6pm.
function place (c: Clock, after: number, now: number, next = false) {
  const all = [-1, 0].flatMap((k) => hoursOf(c).map((h) => dayAt(now + k * DAY, h, c.m))).filter((t) => t >= after)
  const past = all.filter((t) => t <= now)
  return past.length ? (next ? Math.min(...past) : Math.max(...past)) : all.length ? Math.min(...all) : Infinity
}

// The last time the clock showed it before `t`, for the start of the night that ended at `t`.
const before = (c: Clock, t: number) => Math.max(...[-1, 0].flatMap((k) => hoursOf(c).map((h) => dayAt(t + k * DAY, h, c.m))).filter((x) => x < t))

function minutes (long: RegExpMatchArray | null) {
  if (!long || (!long[1] && !long[2])) return 0
  return (long[1] ? (/^(an?|one)$/i.test(long[1]) ? 60 : +long[1] * 60) : 0) + (long[2] ? +long[2] : 0)
}
const lengthOf = (text: string) => [...text.matchAll(DUR)].reduce((a, m) => a + (/^h/i.test(m[2]) ? +m[1] * 60 : +m[1]), 0)

// A wake word before any sleep word: `up at 5 until 6` is awake, `napped 6:10 woke 7:28` is asleep.
const upFirst = (p: string) => WAKES.test(p) && (!SLEEPS.test(p) || p.search(WAKES) < p.search(SLEEPS))
const am = (c: Clock): Clock => ({ ...c, ap: c.ap ?? (c.h < 12 ? 'am' : null) })
const pm = (c: Clock): Clock => ({ ...c, ap: c.ap ?? (c.h < 12 ? 'pm' : null) })

// The words read twice, with a wake-up typed first on the latest the clock showed it and then on
// the first after the day starts, and the reading that leaves less under Not added is kept. Typed
// in the evening, `woke 5:30, nap 9 to 10` is 5:30am, while `woke at 5:30` on its own is 5:30pm.
export function readTyped (text: string, baby: Baby, now: number): { rows: TypedRow[]; left: string[] } {
  const late = read(text, baby, now, false), early = read(text, baby, now, true)
  return early.left.length < late.left.length ? early : late
}

function read (text: string, baby: Baby, now: number, early: boolean): { rows: TypedRow[]; left: string[] } {
  const rows: TypedRow[] = [], left: string[] = [], floor = dayFloor(baby, now) - 90 * MIN
  // A sleep that starts where a time awake ends is quiet: its words went into the wake-up, so a
  // sleep typed after it in its place leaves nothing under Not added. Bedtime waits in `bed` for the
  // morning that ends the night, or starts tonight's.
  let after = floor, open: { s: number; p: string; c?: Clock; quiet?: boolean } | null = null, bed: { c: Clock; p: string; i: number } | null = null
  const shut = () => { if (open && !open.quiet) left.push(open.p); open = null }
  // Each time after the first goes on the first time the clock shows it after the one before.
  const at = (c: Clock, up = false) => place(c, after, now, (early && up) || after > floor)
  // When the night that ended at `t` started, if that was yesterday evening.
  const eve = (c: Clock, t: number) => { const f = before(c, t); return f >= dayAt(t - DAY, 0, 0) + (baby.bed - 240) * MIN && f < dayAt(t, 0, 0) ? f : 0 }
  // The night that ended this morning at `c`: `slept 7pm to 6:30am`, `down 7:10, up 6:40`. With
  // `need`, only when the start reads as yesterday evening.
  const night = (start: Clock | null, c: Clock, p: string, need: boolean) => {
    if (rows.some((x) => x.k === 'wake')) return false
    const t = place(am(c), floor, now), f = start && t <= now ? eve(start, t) : 0
    if (t > now || (need && !f)) return false
    rows.unshift({ k: 'wake', t, p, ...(f ? { from: f } : {}) })
    after = Math.max(after, t)
    return true
  }
  // A wake-up ends the sleep still going, or before anything else it is the morning, which ends the
  // night from the bedtime typed before it.
  const woke = (t: number, p: string) => {
    if (open) { rows.push({ k: 'sleep', s: open.s, e: t, p: open.quiet ? p : `${open.p}, ${p}` }); open = null; after = t; return true }
    if (rows.length) return false
    const f = bed ? eve(bed.c, t) : 0
    rows.push({ k: 'wake', t, p: f && bed ? `${bed.p}, ${p}` : p, ...(f ? { from: f } : {}) })
    if (f) bed = null
    after = t
    return true
  }
  // A wake-up that cannot come after the sleep typed before it ends last night instead.
  const wake = (c: Clock, p: string) => {
    const t = at(c, true)
    if (t <= now && woke(t, p)) return
    if (open?.c && !rows.length && night(open.c, c, `${open.p}, ${p}`, true)) { open = null; return }
    left.push(p)
  }
  for (const p of text.split(SPLIT).map((x) => x.trim()).filter(Boolean)) {
    if (NOT_SLEEP.test(p)) { left.push(p); continue }
    const long = p.match(LONG), q0 = long ? p.replace(long[0], ' ') : p, mins = minutes(long) || lengthOf(q0)
    const q = q0.replace(DUR, ' ').replace(COUNT, '$1'), cs = clocks(q)
    if (NIGHT.test(p)) {
      // `slept from 7:53pm last night until 5am` or `slept through the night till 6` is the morning,
      // with the night's start when it is typed. `bed at 7:10` is when the night started, and a
      // waking in the night is not added.
      const end = cs[cs.length - 1]
      if (!end || upFirst(p)) left.push(p)
      else if (cs.length >= 2 || TILL.test(q.slice(0, end.at))) { if (!night(cs.length >= 2 ? cs[0] : null, end, p, false)) left.push(p) }
      else if (bed) left.push(p)
      else bed = { c: end, p, i: left.length }
    } else if (cs.length === 1 && BACK.test(p) && SLEEPS.test(p) && !rows.length && !open && (am(cs[0]).ap === 'pm' ? false : (cs[0].h % 12) * 60 + cs[0].m < baby.wake - 150)) {
      // `back down at 2:30` before the morning is typed is a waking in the night.
      left.push(p)
    } else if (cs.length >= 2 && upFirst(p)) {
      // Awake from the first time, down at the second, and asleep until the next wake-up.
      const t = at(cs[0], true), d = place(cs[1], t + 1, now, true)
      if (t > now) { left.push(p); continue }
      const used = woke(t, p)
      after = Math.max(after, t)
      if (d <= now) { open = { s: d, p, quiet: used }; after = d } else if (!used) left.push(p)
    } else if (cs.length >= 2) {
      // Each two times are a sleep: `10:35 to 11:11 and 2:50 to 3:15`. A time left over is not added.
      let all = cs.length % 2 === 0
      for (let i = 0; i + 1 < cs.length; i += 2) {
        const s = at(cs[i]), e = place(cs[i + 1], s + 1, now, true)
        if (e > now) { all = all && i === 0 && cs.length === 2 && !open && night(cs[0], cs[1], p, true); break }
        shut(); rows.push({ k: 'sleep', s, e, p }); after = e
      }
      if (!all) left.push(p)
    } else if (cs.length === 1 && upFirst(p) && TILL.test(q.slice(0, cs[0].at))) {
      // `awake until 6` is down at 6, asleep until the next wake-up.
      const d = at(cs[0])
      if (d > now) left.push(p)
      else { shut(); open = { s: d, p, c: cs[0] }; after = d }
    } else if (cs.length === 1 && SLEEPS.test(p) && TILL.test(q.slice(0, cs[0].at))) {
      // `slept until 7:30` is the wake-up at 7:30.
      wake(cs[0], p)
    } else if (cs.length === 1 && SLEEPS.test(p) && !ENDS.test(p)) {
      const s = at(cs[0])
      if (s > now) left.push(p)
      else if (mins && s + mins * MIN <= now) { shut(); rows.push({ k: 'sleep', s, e: s + mins * MIN, p }); after = s + mins * MIN }
      else { shut(); open = { s, p, c: cs[0] }; after = s }
    } else if (cs.length === 1 && WAKES.test(p)) wake(cs[0], p)
    else left.push(p)
  }
  const o = open as { s: number; p: string } | null
  if (o) rows.push({ k: 'sleep', s: o.s, e: null, p: o.p })
  // A bedtime no morning followed is tonight's, once it has come.
  const b = bed as { c: Clock; p: string; i: number } | null
  if (b) { const s = place(pm(b.c), floor, now); if (s <= now && !o) rows.push({ k: 'sleep', s, e: null, p: b.p }); else left.splice(b.i, 0, b.p) }
  return { rows, left }
}

// The rows checked against the log, after the parent's own changes to them. A wake-up on its own
// ends the sleep the timer is running. With nothing running it is the morning, while no nap comes
// before it and it is within three hours of the wake-up already logged; later in the day it is not
// added. A sleep over a nap in the log takes its place, the timer's running nap too. A sleep over
// the night is not added.
export function typed (text: string, baby: Baby, log: Sleep[], now: number, fixes: Record<number, TypedRow | null> = {}): Typed {
  const r = readTyped(text, baby, now), left = [...r.left], drop: string[] = [], rows: Typed['rows'] = []
  const live = log.filter((x) => !x.deleted && !isMark(x)).map((x) => asLogged(baby, x, now)), ds = engine(baby, log, now).dayStart()
  const read: Typed['rows'] = []
  r.rows.forEach((x0, i) => {
    const x = i in fixes ? fixes[i] : x0
    if (!x) return
    if (x.k !== 'wake') { read.push({ ...x, i }); return }
    const run = live.find((y) => y.e == null && y.s < x.t)
    const morning = ds.unknown || (Math.abs(x.t - ds.t) <= 3 * HOUR && !live.some((y) => y.kind === 'nap' && y.s >= ds.t && y.s < x.t))
    if (run) read.push({ k: 'end', id: run.id, s: run.s, t: x.t, night: run.kind === 'night', p: x.p, i })
    else if (morning) read.push({ ...x, i })
    else left.push(x.p)
  })
  const wake = read.find((x) => x.k === 'wake')
  const ended = ends(log, read, now)
  const base = wake && wake.k === 'wake' ? withMorning(baby, ended, now, wake.t, 'typed', wake.from).sleeps : ended
  const after = base.filter((x) => !x.deleted && !isMark(x)).map((x) => asLogged(baby, x, now))
  // Each sleep is a nap or the night by the log as it stands once the ones typed before it are in.
  // One still going is read the way a tap on the timer at its start would be, so the baby put down
  // for an early bedtime is down for the night.
  const made: Sleep[] = []
  for (const x of read) {
    if (x.k !== 'sleep') { rows.push(x); continue }
    const end = x.e ?? now, hits = after.filter((y) => y.s < end && (y.e ?? now) > x.s)
    if (hits.some((y) => y.kind === 'night')) { left.push(x.p); continue }
    drop.push(...hits.map((y) => y.id))
    const gone = new Set(drop), cur = [...base.filter((y) => !y.deleted && !gone.has(y.id)), ...made]
    const k = x.e == null ? { kind: engine(baby, cur, x.s).startKind().kind, up: false } : newSleep(baby, cur, x.s, x.e)
    made.push({ id: `typed-${x.i}`, s: x.s, e: x.e, kind: k.kind, up: k.up, updatedAt: now })
    rows.push({ ...x, kind: k.kind, up: k.up })
  }
  return { rows, left, drop: [...new Set(drop)] }
}

// The running sleep each typed wake-up ends, ended then. A night that ends is up for the day.
function ends (log: Sleep[], rows: Typed['rows'], now: number) {
  const end = new Map(rows.flatMap((x) => (x.k === 'end' ? [[x.id, x] as const] : [])))
  return log.map((y) => { const x = end.get(y.id); return x ? { ...y, e: x.t, up: x.night ? true : y.up, updatedAt: now } : y })
}

// The log with the typed rows in it: the running sleep ended, the morning, then the naps that are
// replaced, then each new sleep. `ids` lists every row that changed, for a shared log.
export function applyTyped (baby: Baby, log: Sleep[], now: number, r: Typed, id: () => string, share: boolean): { sleeps: Sleep[]; ids: string[] } {
  let sleeps = ends(log, r.rows, now)
  const ids: string[] = r.rows.flatMap((x) => (x.k === 'end' ? [x.id] : []))
  for (const x of r.rows) if (x.k === 'wake') { const m = withMorning(baby, sleeps, now, x.t, id(), x.from); sleeps = m.sleeps; ids.push(...m.ids) }
  const gone = new Set(r.drop)
  sleeps = share ? sleeps.map((x) => (gone.has(x.id) ? { ...x, deleted: true, updatedAt: now } : x)) : sleeps.filter((x) => !gone.has(x.id))
  ids.push(...r.drop)
  for (const x of r.rows) {
    if (x.k !== 'sleep') continue
    const n = id()
    const k = x.kind ? { kind: x.kind, up: !!x.up } : newSleep(baby, sleeps, x.s, x.e)
    sleeps = [...sleeps, { id: n, s: x.s, e: x.e, kind: k.kind, up: k.up, updatedAt: now }]
    ids.push(n)
  }
  return { sleeps: sleeps.sort((a, b) => a.s - b.s), ids }
}
