// The sums behind every screen. Nothing in here draws or stores anything: it takes the baby,
// the log and the time, and answers. The same file runs on the phone, in the web build the
// gate walks, and under `node --test`.

import type { Chair } from './chair.ts'

export const MIN = 6e4
export const HOUR = 36e5
export const DAY = 864e5

export type Kind = 'nap' | 'night'

export type Sleep = {
  id: string
  s: number
  e: number | null
  kind: Kind
  // A night stretch that ended with the baby up for the day. A night with no length (s equals e)
  // is the wake-up a parent typed in for a morning when the night was not logged.
  up?: boolean
  updatedAt: number
  deleted?: boolean
}

export const isMark = (x: Sleep) => x.kind === 'night' && !!x.up && x.e != null && x.e === x.s

export type Baby = {
  name: string
  born: string // yyyy-mm-dd
  due: string // yyyy-mm-dd, or '' when born on time
  wake: number // usual wake-up, minutes after midnight
  bed: number // bedtime, minutes after midnight
  target: number // day sleep to aim for, minutes
  // The chair method, while it runs. It rides here so a shared log carries it to every phone.
  chair?: Chair | null
  // No nap after this, minutes after midnight, so bedtime can come on time or early. Unset, it is
  // bedtime less the shortest wake window for the age. A nap still running then gets a time to wake.
  napsEnd?: number | null
  // After a short nap the parent picks how to make it up: the next nap sooner, or bedtime earlier
  // by `by` minutes. `day` is the day it was picked for, and `first` the way that was on top at the
  // tap, so the two stay where they were for the rest of that day. `routeLikes` is the last pick,
  // shown first the next time.
  route?: { day: number; pick: Route; by: number; first?: Route } | null
  routeLikes?: Route | null
  // Naps a day, when the parent moved to one fewer than most babies this age take. It lapses once
  // the age's own count is no higher. `napsAsked` is when the move was last offered on Today.
  naps?: number | null
  napsAsked?: number | null
  // The parent's own wake window before each nap, in minutes, by nap. An empty place is worked out.
  windows?: (number | null)[] | null
  // The parent set the day sleep aim. Until then it follows the last week of nights, from 1.0.23.
  aimSet?: boolean
  // Stretches with no nap logged that the parent said held no nap, from 1.0.28. Today's list and
  // the day's graph stop asking about them. It rides here so a shared log carries the answer.
  noNap?: [number, number][] | null
}

export type Route = 'sooner' | 'bed'

// The last moment a nap runs to on the day of t, from the bedtime of that day.
export const napsEndOf = (baby: Baby, bedT: number, wks: number) =>
  baby.napsEnd != null ? atMins(bedT - 12 * HOUR, baby.napsEnd) : bedT - bandFor(baby, wks).min * MIN


// A window to put the baby down. A plan for going out adds how long the nap is planned to run,
// the nap in the car, how far it moved from the usual time, and a bedtime brought forward.
export type Window = { k: number; s: number; c: number; e: number; bed?: boolean; cat?: boolean; car?: boolean; len?: number; diff?: number; early?: boolean }

// A trip the parent planned the day around: when they leave, when they are home, and whether the
// baby naps in the car or stays awake.
export type Out = { leave: number; home: number; mode: 'car' | 'awake' }

// A nap under this many minutes is a short one.
const SHORT = 40

/* Wake windows by age in weeks, in minutes, and the usual number of naps. */
export const BANDS = [
  { w: 4, min: 35, max: 60, naps: 5 },
  { w: 8, min: 45, max: 75, naps: 5 },
  { w: 12, min: 60, max: 90, naps: 4 },
  { w: 17, min: 75, max: 120, naps: 4 },
  { w: 26, min: 105, max: 150, naps: 3 },
  { w: 35, min: 120, max: 180, naps: 3 },
  { w: 52, min: 150, max: 210, naps: 2 },
  { w: 65, min: 180, max: 240, naps: 2 },
  { w: 9999, min: 270, max: 360, naps: 1 },
]
export type Band = (typeof BANDS)[number]

/* Day sleep to aim for by age in weeks, in minutes. The parent can change it. */
const TARGETS: [number, number][] = [[8, 360], [13, 300], [17, 240], [26, 210], [35, 180], [52, 150], [78, 120], [9999, 90]]

export const band = (w: number): Band => BANDS.find((b) => w < b.w) || BANDS[BANDS.length - 1]
// The windows the day runs on: the age's, or with one nap fewer picked, those of the first age that
// takes that many naps.
export const bandFor = (baby: Baby, w: number): Band => {
  const b = band(w), n = baby.naps
  return n == null || n >= b.naps ? b : BANDS.find((x) => x.naps <= n) ?? b
}
export const targetFor = (w: number) => (TARGETS.find((x) => w < x[0]) || TARGETS[TARGETS.length - 1])[1]

/* A night's sleep for most babies by age in weeks, in minutes. With the day sleep above it makes the
   day's total in the baby sleep charts: about 15 and a half hours at two months, 14 and a half at four,
   14 at six and 13 at a year. A week of short nights asks for more day sleep, and long nights less. */
const NIGHTS: [number, number][] = [[8, 570], [13, 600], [17, 630], [9999, 660]]
const nightFor = (w: number) => (NIGHTS.find((x) => w < x[0]) || NIGHTS[NIGHTS.length - 1])[1]
export const defaultBed = (w: number) => (w < 12 ? 1200 : 1140)

const median = (a: number[]) => {
  if (!a.length) return null
  const b = [...a].sort((x, y) => x - y), m = b.length >> 1
  return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2
}
export const round5 = (ms: number) => Math.round(ms / (5 * MIN)) * 5 * MIN

// The nights of the last week, from going down to up for the day, in minutes asleep. A morning typed
// in without its night, and a night logged from partway through, are left out. `sleeps` is the log
// as `readLog` gives it.
export function nightsOf (sleeps: Sleep[], now: number): number[] {
  const out: number[] = []
  sleeps.forEach((u, i) => {
    if (u.kind !== 'night' || !u.up || u.e == null || isMark(u) || u.e > now || u.e < now - 7 * DAY) return
    let j = i
    while (j > 0 && sleeps[j - 1].kind === 'night' && !sleeps[j - 1].up && sleeps[j - 1].e != null) j--
    if (u.e - sleeps[j].s < 6 * HOUR) return
    let asleep = 0
    for (let k = j; k <= i; k++) asleep += sleeps[k].e! - sleeps[k].s
    out.push(asleep / MIN)
  })
  return out
}

/* The day sleep to aim for. Once 3 nights of the last week are logged it is the age's day sleep moved
   by how far the nights fall short of a usual night for the age, or run past it, by up to half an
   hour either way. Before then it is the age's, and once the parent sets it, it is theirs. */
export type Aim = { min: number; set: boolean; night: number | null }
export function aimOf (baby: Baby, sleeps: Sleep[], now: number): Aim {
  if (baby.aimSet) return { min: baby.target, set: true, night: null }
  const w = ageWeeks(baby, now), base = targetFor(w), v = nightsOf(sleeps, now)
  if (v.length < 3) return { min: base, set: false, night: null }
  const night = median(v)!
  return { min: Math.round(Math.max(base - 30, Math.min(base + 30, base + nightFor(w) - night)) / 15) * 15, set: false, night }
}
export const hourOf = (t: number) => { const d = new Date(t); return d.getHours() + d.getMinutes() / 60 }
export const dayAt = (t: number, h: number, m: number) => { const d = new Date(t); d.setHours(h, m, 0, 0); return d.getTime() }
export const atMins = (t: number, mins: number) => dayAt(t, Math.floor(mins / 60), mins % 60)
const parseDay = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d).getTime() }

// The stretch of a logged night that ended in the three hours before `t`, when nothing else was
// logged in between. A morning typed in without its night is no such stretch.
const NIGHT_ON = 3 * HOUR
function nightBefore (baby: Baby, log: Sleep[], t: number): Sleep | null {
  const done = readLog(baby, log).filter((x) => x.e != null && x.e <= t)
  const p = done.length ? done.reduce((a, x) => (x.e! > a.e! ? x : a)) : null
  return p && p.kind === 'night' && !isMark(p) && t - p.e! <= NIGHT_ON ? p : null
}

// A sleep added by hand or typed, as it goes in the log. It is a nap or a night by when it started.
// Up to version 1.0.4 it went by the clock when it was typed in, so a morning nap added after
// bedtime was saved as a night. From 1.0.28 a sleep that starts before the usual wake-up carries on
// the night logged before it: the baby went back down, and up for the day moves to when this sleep
// ends. Up to 1.0.27 a baby awake from 5 to 6am and asleep again until 7:30 was up for the day at 5
// with a nap at 6.
export function newSleep (baby: Baby, log: Sleep[], s: number, e: number | null): { kind: Kind; up: boolean } {
  const m = hourOf(s) * 60, p = m < baby.wake ? nightBefore(baby, log, s) : null
  const kind: Kind = m < baby.wake - 90 || m >= baby.bed - 30 || p ? 'night' : 'nap'
  return { kind, up: !!p && !!p.up && e != null }
}
export const kindFor = (baby: Baby, s: number, log: Sleep[] = []): Kind => newSleep(baby, log, s, null).kind

// How a saved sleep is read. A night that started an hour or more into the day and was over by
// bedtime is a nap that went in as a night, so it is counted as the nap it was. That brings back
// the morning naps 1.0.4 saved as nights, and a nap started in the hour before bedtime. From 1.0.28
// it goes the other way too: a nap that started in the two hours before bedtime, or after it, and
// ran three hours or more is the night. Up to 1.0.27 a tap on the timer for an early bedtime went in
// as a nap, and the week counted the whole night as day sleep. `now` reads one still going.
export const asLogged = (baby: Baby, x: Sleep, now?: number): Sleep => {
  if (x.kind === 'night' && !x.up && x.e != null && napHours(baby, x.s) && x.e <= atMins(x.s, baby.bed)) return { ...x, kind: 'nap' }
  const e = x.e ?? now
  return x.kind === 'nap' && e != null && e - x.s >= 3 * HOUR && x.s >= atMins(x.s, baby.bed - 120) ? { ...x, kind: 'night' } : x
}

// From an hour after the usual wake-up to an hour before bedtime, a sleep that starts is a nap.
export const napHours = (baby: Baby, t: number) => t >= atMins(t, baby.wake + 60) && t < atMins(t, baby.bed - 60)

// The log as the app reads it, oldest first. A night with a nap straight after it ended the night,
// so its last waking is up for the day even when nobody tapped it, and that day keeps its naps.
// A tap of the timer to add a nap is left out until its times are set.
// A stretch of night that starts within three hours of up for the day carries the night on, so that
// wake-up was a waking, from 1.0.28.
export function readLog (baby: Baby, log: Sleep[], now?: number): Sleep[] {
  const v = log.filter((x) => !x.deleted).map((x) => asLogged(baby, x, now)).filter((x) => !isTap(x)).sort((a, b) => a.s - b.s)
  const on = (x: Sleep, n?: Sleep) => !!n && n.kind === 'night' && !isMark(n) && !isMark(x) && n.s >= x.e! && n.s - x.e! <= NIGHT_ON
  return v.map((x, i) => {
    if (x.kind !== 'night' || x.e == null) return x
    if (x.up) return on(x, v[i + 1]) ? { ...x, up: false } : x
    return v[i + 1]?.kind === 'nap' ? { ...x, up: true } : x
  })
}

export function ageWeeks (baby: Baby, t: number) { return (t - parseDay(baby.due || baby.born)) / (7 * DAY) }

// Today starts two and a half hours before the usual wake-up, where a tap on the button stops
// counting as the night. A wake-up from before then belongs to an earlier day.
export function dayFloor (baby: Baby, now: number) {
  const f = atMins(now, Math.max(0, baby.wake - 150))
  return now >= f ? f : atMins(now - DAY, Math.max(0, baby.wake - 150))
}

/* A time picked on the phone's clock, put on the right day. */
// The last time the clock showed it, for a sleep that is already over.
export const lastAt = (now: number, h: number, m: number) => { const t = dayAt(now, h, m); return t > now ? dayAt(now - DAY, h, m) : t }
// The first time the clock shows it after a sleep started, for when it ended.
export const afterAt = (from: number, h: number, m: number) => { const t = dayAt(from, h, m); return t <= from ? dayAt(from + DAY, h, m) : t }
// An end more than a day after the start comes back a day at a time, keeping its clock time.
// 11 October 2026: a wake-up picked before the start went on tomorrow, the start was then moved
// earlier, and the nap read 25 h 18 min asleep with Save greyed out.
export const fitEnd = (x: Sleep): Sleep => {
  if (x.e == null) return x
  const d = new Date(x.e)
  while (d.getTime() - x.s > DAY) d.setDate(d.getDate() - 1)
  return d.getTime() === x.e ? x : { ...x, e: d.getTime() }
}
// A new start keeps the sleep the same length if the old end would now come first.
export const pickStart = (x: Sleep, now: number, h: number, m: number): Sleep => {
  const s = lastAt(now, h, m)
  return fitEnd({ ...x, s, e: x.e != null && x.e <= s ? s + (x.e - x.s) : x.e })
}
// A sleep under five minutes long was a tap on the timer to add a sleep. A wake-up picked for it
// goes on the last time the clock showed it, and the start moves back with it. Any other wake-up
// goes on the first time the clock shows it after the start.
const TAP = 5 * MIN
// A nap under five minutes is that tap, from 11 October 2026. It waits in Today's list for its
// times, and the nap times, the day's sleep and the two ways leave it out until then.
export const isTap = (x: Sleep) => x.kind === 'nap' && x.e != null && x.e - x.s < TAP
export const pickEnd = (x: Sleep, now: number, h: number, m: number): Sleep => {
  const e = afterAt(x.s, h, m), len = x.e != null ? x.e - x.s : -1
  if (e <= now + MIN || len < 0 || len >= TAP) return { ...x, e }
  const back = lastAt(now, h, m)
  return { ...x, s: back - len, e: back }
}
export const moveStart = (x: Sleep, mins: number): Sleep => fitEnd({ ...x, s: x.s + mins * MIN })
// This morning's wake-up. A time still to come stays on today, and the Save button waits.
export const morningAt = (baby: Baby, now: number, h: number, m: number) => {
  const t = dayAt(now, h, m), y = dayAt(now - DAY, h, m)
  return t > now && y >= dayFloor(baby, now) ? y : t
}

export function ageText (baby: Baby, now: number) {
  const w = Math.floor(ageWeeks(baby, now))
  if (w < 17) return w === 1 ? '1 week' : `${Math.max(0, w)} weeks`
  const a = new Date(parseDay(baby.born)), b = new Date(now)
  const m = (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth() - (b.getDate() < a.getDate() ? 1 : 0)
  return m === 1 ? '1 month' : `${m} months`
}

export type Phase = 'day' | 'nap' | 'night' | 'waking'

export type Engine = ReturnType<typeof engine>

export function engine (baby: Baby, log: Sleep[], now: number, out: Out | null = null) {
  const sleeps = readLog(baby, log, now)
  const taps = log.filter((x) => !x.deleted).map((x) => asLogged(baby, x)).filter((x) => isTap(x) && x.s >= now - DAY).sort((a, b) => a.s - b.s)
  const ageAt = (t: number) => ageWeeks(baby, t)

  const cur = () => { const l = sleeps[sleeps.length - 1]; return l && l.e == null ? l : null }

  function phase (): Phase {
    const l = sleeps[sleeps.length - 1]
    if (!l) return 'day'
    if (l.e == null) return l.kind === 'night' ? 'night' : 'nap'
    if (l.kind === 'night' && !l.up) return 'waking'
    return 'day'
  }

  // When today started. With no wake-up logged since the day floor the morning is unknown, and
  // the screen asks about it before it gives a nap time.
  type DayStart = { t: number; k0: number; up: Sleep | null; unknown: boolean }
  let dsMemo: DayStart | null = null
  function dayStart (): DayStart {
    if (dsMemo) return dsMemo
    let u: Sleep | null = null
    for (const x of sleeps) if (x.kind === 'night' && x.up && x.e != null && x.e <= now) u = x
    const r = u && u.e! >= dayFloor(baby, now) ? { t: u.e!, k0: 0, up: u, unknown: false } : { t: atMins(now, baby.wake), k0: 0, up: null, unknown: true }
    return (dsMemo = r)
  }

  const unknownMorning = () => { const ph = phase(); return (ph === 'day' || ph === 'nap') && dayStart().unknown }

  const napsSince = (t: number) => sleeps.filter((x) => x.kind === 'nap' && x.s >= t)

  function nightSegs () {
    let i = sleeps.length - 1
    while (i > 0 && sleeps[i - 1].kind === 'night' && !sleeps[i - 1].up) i--
    return sleeps.slice(i)
  }

  const bedOf = (t: number) => atMins(t + 2 * HOUR, baby.bed)

  let aimMemo: Aim | null = null
  const aim = () => (aimMemo ??= aimOf(baby, sleeps, now))

  // Today's pick after a short nap, and how far it brings bedtime forward.
  type Alt = { bed: boolean; by: number }
  const route = () => (baby.route && baby.route.day === dayFloor(baby, now) ? baby.route : null)
  const picked = (): Alt => { const r = route(); return r && r.pick === 'bed' ? { bed: true, by: r.by } : { bed: false, by: 0 } }

  /* The past week, read off the log. Asked for many times in one render, so kept. */
  type PastDay = { naps: number; win: { k: number; len: number; nap: number }[]; wake: number; bed: number; day: number }
  let pastMemo: PastDay[] | null = null
  function pastDays (): PastDay[] {
    if (pastMemo) return pastMemo
    const ds = dayStart(), days: PastDay[] = []
    for (const u of sleeps) {
      if (!(u.kind === 'night' && u.up && u.e != null)) continue
      if (u.e >= ds.t) continue
      const next = sleeps.find((x) => x.kind === 'night' && x.s > u.e!)
      if (!next) continue
      const naps = sleeps.filter((x) => x.kind === 'nap' && x.s > u.e! && x.s < next.s && x.e != null)
      // A wake-up typed in during the night, such as one from setup just after midnight, is not a
      // day. A real day with no naps still runs ten hours or more, so a stretch under six with none
      // is left out. Up to 1.0.12 it showed as a second row for the same date with 0 min.
      if (!naps.length && next.s - u.e < 6 * HOUR) continue
      const win: PastDay['win'] = []
      let t = u.e
      naps.forEach((n, k) => { win.push({ k, len: (n.s - t) / MIN, nap: (n.e! - n.s) / MIN }); t = n.e! })
      days.push({ naps: naps.length, win, wake: u.e, bed: next.s, day: naps.reduce((a, n) => a + n.e! - n.s, 0) })
    }
    pastMemo = days.slice(-7)
    return pastMemo
  }

  function personal (k: number) {
    const days = pastDays(), v: number[] = []
    for (const d of days) { const w = d.win.find((x) => x.k === k); if (w && w.nap >= 40) v.push(w.len) }
    return { m: median(v), n: days.length }
  }

  function napLen (k: number) {
    const v: number[] = []
    for (const d of pastDays()) { const w = d.win.find((x) => x.k === k); if (w) v.push(w.nap) }
    return median(v) || (ageAt(now) < 12 ? 45 : 60)
  }

  // The wake window before nap k, in minutes, before a short nap moves it: the parent's own, or the
  // age's moved towards the baby's good naps once three days are logged.
  function windowOf (k: number, wks = ageAt(now)): { len: number; set: boolean } {
    const pin = baby.windows?.[k]
    if (pin != null) return { len: pin, set: true }
    const b = bandFor(baby, wks), base = b.min + (b.max - b.min) * (0.2 + 0.8 * k / b.naps)
    const p = personal(k), w = p.m != null && p.n >= 3 ? Math.min(p.n, 7) / 7 * 0.75 : 0
    return { len: Math.max(b.min * 0.85, Math.min(b.max * 1.1, w * (p.m ?? 0) + (1 - w) * base)), set: false }
  }

  /* The sweet spot. Age sets the wake window, the baby's own good naps move it once three days
     are logged, a short nap brings the next one forward, and the naps fit between the usual
     wake-up and the bedtime the parent set. A wake window the parent set stays as set. */
  function predict (k: number, from: number, prevNap: number | null, alt: Alt = picked()): Window {
    const wks = ageAt(from), b = bandFor(baby, wks), bedT = bedOf(from) - alt.by * MIN, cut = napsEndOf(baby, bedT, wks)
    const bedWin = (): Window => ({ k, bed: true, s: bedT - 15 * MIN, c: bedT, e: bedT + 15 * MIN })
    // With too long to go until bed, a short nap that is over by the end of the naps.
    const last = (): Window => {
      if ((bedT - from) / MIN > b.max * 1.15) {
        const c = round5(Math.min(from + b.max * MIN, Math.max(from + b.min * 0.85 * MIN, bedT - (b.min * 1.1 + 30) * MIN)))
        if (c + 30 * MIN <= cut) return { k, cat: true, s: c - 10 * MIN, c, e: c + 10 * MIN }
      }
      return bedWin()
    }
    if (k >= b.naps) return last()
    let len = windowOf(k, wks).len
    if (prevNap != null && prevNap < SHORT && wks >= 12 && !alt.bed) len *= 0.85
    const c = round5(from + len * MIN)
    // 11 October 2026: at 26 weeks a third nap too late to fit went straight to bedtime, so a baby up
    // at 7 with naps at 9:10 and 12:40 had five hours awake before a 7pm bed. It is a short nap now.
    if (c + (napLen(k) + b.min * 0.9) * MIN > bedT || c + 20 * MIN > cut) return last()
    const half = (personal(k).n < 3 ? 15 : Math.max(5, Math.round(len * 0.08 / 5) * 5)) * MIN
    return { k, s: c - half, c, e: c + half }
  }

  let planMemo: Window[] | null = null
  function planNormal (alt?: Alt): Window[] {
    if (!alt && planMemo) return planMemo
    const ph = phase()
    if (ph === 'night' || ph === 'waking') return alt ? [] : (planMemo = [])
    const ds = dayStart(), naps = napsSince(ds.t), c = cur()
    let k = ds.k0 + naps.length, from: number, prev: number | null
    if (c) { from = Math.max(now + 5 * MIN, c.s + napLen(k - 1) * MIN); prev = null } else {
      const l = naps[naps.length - 1]
      from = l ? l.e! : ds.t
      prev = l ? (l.e! - l.s) / MIN : null
    }
    const out: Window[] = []
    for (let i = 0; i < 7; i++) {
      const w = predict(k, from, prev, alt)
      out.push(w)
      if (w.bed) break
      const L = w.cat ? 30 : napLen(k)
      from = w.c + L * MIN
      prev = L
      k = w.k + 1
    }
    return alt ? out : (planMemo = out)
  }

  /* After a short nap with one nap left in the day there are two ways to make it up, and the
     parent picks: the last nap sooner, or at its usual time with bedtime earlier by the sleep the
     short nap lost, a quarter of an hour to an hour. From 11 October 2026 the choice belongs at the
     last nap, where waking the baby is the other option. After a short nap earlier in the day the
     next nap comes sooner on its own. Null when the last nap ran 40 minutes or more, when more than
     one nap is left or none is, or when both ways give the same times. */
  type Way = { c: number | null; more: number; bed: number }
  function shortNap (): { by: number; day: number; pick: Route | null; sooner: Way; bed: Way } | null {
    if (phase() !== 'day' || dayStart().unknown || activeOut() || ageAt(now) < 12) return null
    const ds = dayStart(), done = napsSince(ds.t).filter((x) => x.e != null), l = done[done.length - 1]
    if (!l) return null
    const got = (l.e! - l.s) / MIN
    if (got >= SHORT) return null
    const by = Math.max(15, Math.min(60, Math.round((napLen(ds.k0 + done.length - 1) - got) / 5) * 5))
    const way = (p: Window[]): Way => {
      const n = p.filter((w) => !w.bed), b = p.find((w) => w.bed)
      return { c: n[0]?.c ?? null, more: Math.max(0, n.length - 1), bed: b ? b.c : bedOf(ds.t) }
    }
    const sooner = way(planNormal({ bed: false, by: 0 })), bed = way(planNormal({ bed: true, by }))
    if (sooner.c == null || sooner.more > 0 || (sooner.c === bed.c && sooner.bed === bed.bed)) return null
    if (now > Math.max(sooner.c, bed.c ?? 0) + 20 * MIN) return null
    return { by, day: dayFloor(baby, now), pick: route()?.pick ?? null, sooner, bed }
  }

  /* Going out. The naps before the trip are spread so each stretch awake stays inside the age's
     window, the trip takes the nap in the car or a stretch awake, and the day after it is worked
     out the usual way. */
  const midWin = (k: number, b: Band) => b.min + (b.max - b.min) * (0.2 + 0.8 * Math.min(k, b.naps) / b.naps)
  const activeOut = () => !!out && now < out.home && out.leave > dayStart().t && !dayStart().unknown && (phase() === 'day' || phase() === 'nap')

  type OutPlan = { wins: Window[]; total: number; long: number | null; up: number }
  function planOut (o: Out): OutPlan {
    const ds = dayStart(), naps = napsSince(ds.t), c = cur(), b = bandFor(baby, ageAt(now)), bedT = bedOf(ds.t)
    let k = ds.k0 + naps.length, from: number
    if (c) from = Math.max(now + 5 * MIN, c.s + napLen(k - 1) * MIN)
    else { const l = naps[naps.length - 1]; from = l ? l.e! : ds.t }
    const L = (i: number) => Math.max(20, Math.round(napLen(i) / 5) * 5), lo = b.min * 0.8, hi = b.max * 1.1, wins: Window[] = []
    const sumL = (a: number, n: number) => { let t = 0; for (let i = 0; i < n; i++) t += L(a + i); return t }
    const push = (kk: number, cc: number, len: number, x: Partial<Window> = {}) => { wins.push({ k: kk, c: cc, s: cc - 10 * MIN, e: cc + 10 * MIN, len, ...x }) }
    let best: { n: number; w: number; cost: number } | null = null, rk = 0, rf: number | null = null, rp = 0, t = from, long: number | null = null
    if (o.mode === 'car') {
      const carC = o.leave + 5 * MIN
      for (let n = 0; n <= 3; n++) {
        const w = ((carC - from) / MIN - sumL(k, n)) / (n + 1)
        if (w <= 0) continue
        let cost = 0
        for (let i = 0; i <= n; i++) cost += (w - midWin(k + i, b)) ** 2
        if (w < lo || w > hi) cost += 1e6
        if (!best || cost < best.cost) best = { n, w, cost }
      }
      const n = best ? best.n : 0
      for (let i = 0; i < n; i++) { const cc = Math.max(round5(t + best!.w * MIN), now); push(k + i, cc, L(k + i)); t = cc + L(k + i) * MIN }
      const carLen = Math.round(Math.max(20, Math.min(L(k + n), (o.home - carC) / MIN)))
      push(k + n, carC, carLen, { car: true, s: o.leave - 10 * MIN, e: o.leave + 10 * MIN })
      rk = k + n + 1; rf = carC + carLen * MIN; rp = carLen
    } else {
      const latest = o.leave - 10 * MIN
      for (let n = 0; n <= 3; n++) {
        const sl = sumL(k, n), starts: number[] = []
        if (!n) { if (from <= latest) starts.push(from) } else for (let x = latest; x >= from + (sl + lo * n) * MIN; x -= 5 * MIN) starts.push(x)
        for (const x of starts) {
          const w = n ? ((x - from) / MIN - sl) / n : 0, outW = (o.home + 10 * MIN - x) / MIN
          let cost = (outW - midWin(k + n, b)) ** 2
          for (let i = 0; i < n; i++) cost += (w - midWin(k + i, b)) ** 2
          if (n && (w < lo || w > hi)) cost += 1e6
          if (outW > hi) cost += 1e5 + (outW - hi) ** 2
          if (!best || cost < best.cost) best = { n, w, cost }
        }
      }
      const n = best ? best.n : 0
      for (let i = 0; i < n; i++) { const cc = Math.max(round5(t + best!.w * MIN), now); push(k + i, cc, L(k + i)); t = cc + L(k + i) * MIN }
      if ((o.home - t) / MIN > hi) long = o.home - t
      const kk = k + n, after = round5(Math.max(o.home + 10 * MIN, t + lo * MIN)), len = kk >= b.naps ? 30 : L(kk)
      if (after + (len + b.min * 0.75) * MIN <= bedT) { push(kk, after, len, { cat: kk >= b.naps }); rk = kk + 1; rf = after + len * MIN; rp = len }
      else { wins.push({ k: kk, bed: true, s: bedT - 15 * MIN, c: bedT, e: bedT + 15 * MIN }); rf = null }
    }
    for (let i = 0; i < 6 && rf != null; i++) {
      const w = predict(rk, rf, rp), Lr = w.cat ? 30 : L(rk)
      wins.push({ ...w, len: Lr })
      if (w.bed) break
      rf = w.c + Lr * MIN; rp = Lr; rk = w.k + 1
    }
    // A long stretch from the last nap to bed brings bedtime forward, up to an hour.
    const bw = wins.find((w) => w.bed)
    if (bw) {
      let lastEnd = from
      for (const w of wins) if (!w.bed) lastEnd = Math.max(lastEnd, w.c + w.len! * MIN)
      if ((bw.c - lastEnd) / MIN > hi) {
        const c2 = Math.max(round5(lastEnd + b.max * MIN), bedT - HOUR)
        if (c2 < bw.c) Object.assign(bw, { c: c2, s: c2 - 15 * MIN, e: c2 + 15 * MIN, early: true })
      }
    }
    const usual = planNormal()
    for (const w of wins) { if (w.bed) continue; const u = usual.find((x) => x.k === w.k && !x.bed); if (u) w.diff = Math.round((w.c - u.c) / MIN) }
    let total = budget().so + (c ? Math.max(0, from - now) : 0)
    for (const w of wins) if (!w.bed) total += w.len! * MIN
    // The last time the baby wakes before leaving: a nap done, the one running, or one planned.
    let up = ds.t
    for (const x of naps) up = Math.max(up, x.e ?? from)
    for (const w of wins) if (!w.bed && !w.car && w.c + w.len! * MIN <= o.leave) up = Math.max(up, w.c + w.len! * MIN)
    return { wins, total, long, up }
  }
  let outMemo: OutPlan | null = null
  const outPlan = (o: Out = out!) => (o === out ? (outMemo ??= planOut(o)) : planOut(o))

  const plan = (): Window[] => (activeOut() ? outPlan().wins : planNormal())

  function lastWake () {
    const n = napsSince(dayStart().t).filter((x) => x.e != null)
    return n.length ? n[n.length - 1].e! : dayStart().t
  }

  /* The day's sleep, and what it takes to make up the rest before bed. */
  function budget () {
    const ds = dayStart(), naps = napsSince(ds.t)
    const so = naps.reduce((a, x) => a + (x.e ?? now) - x.s, 0), target = aim().min * MIN
    const rem = Math.max(0, target - so), bedT = bedOf(ds.t) - picked().by * MIN, b = bandFor(baby, ageAt(now))
    const wakeBy = napsEndOf(baby, bedT, ageAt(now))
    return { so, target, rem, bedT, wakeBy, latest: wakeBy - rem, b }
  }
  type Budget = ReturnType<typeof budget>
  type MakeUp = { kind: 'by'; need: number; by: number; B: Budget } | { kind: 'now'; need: number; B: Budget } | { kind: 'late'; early: number; B: Budget }

  // The make-up nap: when the windows ahead cannot reach the day's aim, how much sleep is still
  // needed and when the baby has to be down to finish by the end of the naps.
  // With earlier bedtime picked after a short nap, the day follows that plan and asks for no more
  // nap than it holds.
  function makeUp (): MakeUp | null {
    if (phase() !== 'day' || dayStart().unknown || activeOut() || picked().bed) return null
    const B = budget()
    if (B.rem < 15 * MIN) return null
    const naps = plan().filter((w) => !w.bed)
    const by = Math.floor(B.latest / (5 * MIN)) * 5 * MIN
    if (naps.length && now <= naps[0].e && naps[0].s <= B.latest) return null
    if (naps.length > 1 && now > naps[0].e && now < by) return null
    if (now < by && !(naps.length && now > naps[0].e)) return { kind: 'by', need: B.rem, by, B }
    if (B.wakeBy - now >= 20 * MIN) return { kind: 'now', need: B.rem, B }
    return { kind: 'late', early: B.bedT - 30 * MIN, B }
  }

  /* One nap fewer. On 3 of the last 5 days logged the baby took one nap less than most babies this
     age, so Today offers the day planned on that many. Asked once a week at most, and not once the
     parent has moved. */
  function fewer (): { n: number; days: number; of: number } | null {
    if (phase() !== 'day' || dayStart().unknown || activeOut()) return null
    const b = band(ageAt(now))
    if (b.naps < 2 || (baby.naps != null && baby.naps < b.naps)) return null
    if (baby.napsAsked != null && now - baby.napsAsked < 7 * DAY) return null
    const last = pastDays().slice(-5), days = last.filter((d) => d.naps === b.naps - 1).length
    return last.length >= 3 && days >= 3 ? { n: b.naps - 1, days, of: last.length } : null
  }

  // The time to wake the baby from the nap running now: the end of the day's naps. Null in the
  // morning, when that is more than three hours off, and for a nap that started after it.
  function wakeAt (): number | null {
    const c = cur()
    if (phase() !== 'nap' || !c || dayStart().unknown) return null
    const t = budget().wakeBy
    return c.s < t && t - now <= 3 * HOUR ? t : null
  }

  /* What a sleep that starts now is, read at the tap on the timer. Bedtime is the night from an hour
     before its window opens, and from 1.0.28 that holds for the early bedtime the screen gives when
     the day's naps fell short, and from half an hour before a bedtime brought forward. Up to 1.0.27 a
     baby put down at 6pm for an early bedtime of 6:30 was logged as napping. Before the usual
     wake-up a sleep carries on the night logged before it, and `back` says so. */
  function startKind (): { kind: Kind; back: boolean } {
    const ph = phase(), m = hourOf(now) * 60
    if (ph === 'waking') return napHours(baby, now) ? { kind: 'nap', back: false } : { kind: 'night', back: true }
    if (ph !== 'day') return { kind: kindFor(baby, now, sleeps), back: false }
    const known = !dayStart().unknown, p = known ? plan()[0] : undefined, mk = known ? makeUp() : null
    const bedS = mk && mk.kind === 'late' ? mk.early - 15 * MIN : p && p.bed ? p.s : null
    if ((bedS != null && now >= bedS - HOUR) || now >= budget().bedT - 30 * MIN || m >= baby.bed - 30 || m < baby.wake - 150) return { kind: 'night', back: false }
    return m < baby.wake && nightBefore(baby, sleeps, now) ? { kind: 'night', back: true } : { kind: 'nap', back: false }
  }

  /* The naps still to come today, with how long to aim for in each. */
  function planNaps (): { w?: Window; mk?: MakeUp; aim: number }[] {
    const ph = phase()
    if ((ph !== 'day' && ph !== 'nap') || dayStart().unknown) return []
    if (activeOut()) return plan().filter((w) => !w.bed).map((w) => ({ w, aim: w.len! * MIN }))
    const B = budget(), mk = makeUp()
    if (mk && mk.kind === 'late') return []
    if (mk) return [{ mk, aim: mk.need }]
    const left = plan().filter((w) => !w.bed), c = cur()
    let need = B.rem
    if (c) need -= Math.max(0, napLen(napsSince(dayStart().t).length - 1) * MIN - (now - c.s))
    return left.map((w, i) => {
      const typical = (w.cat ? 30 : napLen(w.k)) * MIN
      const aim = round5(need > 0 ? Math.max(20 * MIN, Math.min(need / (left.length - i), typical * 1.4)) : typical)
      need -= aim
      return { w, aim }
    })
  }

  /* The night that ended this morning, read in the day and in a nap. `segs` runs from going down
     to up for the day, one stretch of sleep each, and a morning typed in without its night is one
     stretch with no length. `before` is when the last sleep before the night ended, and `after`
     when the first nap of today started. */
  function lastNight () {
    const ph = phase(), ds = dayStart()
    if ((ph !== 'day' && ph !== 'nap') || ds.unknown || !ds.up) return null
    const i = sleeps.findIndex((x) => x.id === ds.up!.id)
    let j = i
    while (j > 0 && sleeps[j - 1].kind === 'night' && !sleeps[j - 1].up && sleeps[j - 1].e != null) j--
    const segs = sleeps.slice(j, i + 1), logged = !isMark(ds.up)
    const prev = sleeps.slice(0, j).filter((x) => x.e != null).pop()
    const first = sleeps.slice(i + 1).find((x) => x.kind === 'nap')
    const asleep = logged ? segs.reduce((a, x) => a + x.e! - x.s, 0) : 0
    return { segs, logged, asleep, wakes: segs.length - 1, before: prev?.e ?? null, after: first?.s ?? null }
  }

  /* The day just gone, read once the night has started. */
  function nightDay () {
    const ns = nightSegs()[0].s
    const up = [...sleeps].reverse().find((x) => x.kind === 'night' && x.up && x.e != null && x.e < ns) ?? null
    const t0 = up?.e ?? ns - 12 * HOUR
    const naps = sleeps.filter((x) => x.kind === 'nap' && x.s > t0 && x.s < ns && x.e != null)
    return { up, t0, ns, naps, so: naps.reduce((a, x) => a + x.e! - x.s, 0), today: new Date(ns).getDate() === new Date(now).getDate() }
  }

  // A stretch awake an hour past the longest window for the age, with no nap logged in it. t1 is
  // bedtime once the night has started, and null while the day is still going.
  function gapsIn (t0: number, t1: number | null, naps: Sleep[]): [number, number][] {
    const b = bandFor(baby, ageAt(t0)), lim = (b.max + 60) * MIN, found: [number, number][] = []
    let t = t0
    for (const x of naps) { if (x.s - t > lim) found.push([t, x.s]); t = x.e ?? now }
    if (t1 != null && t1 - t > lim + 30 * MIN) found.push([t, t1])
    // A stretch the parent said held no nap is not asked about again, while it stays inside the
    // stretch they answered for.
    const no = baby.noNap ?? []
    return found.filter(([a, z]) => !no.some(([na, nz]) => na <= a + MIN && nz >= z - MIN))
  }

  // Dark from the bedtime window until the baby is up for the day.
  function theme (): 'day' | 'night' {
    const ph = phase(), h = hourOf(now) * 60
    return ph === 'night' || ph === 'waking' || h >= baby.bed - 15 || h < 300 ? 'night' : 'day'
  }

  // A tap on the main button between these times asks whether the baby is up for the day.
  const morning = () => { const h = hourOf(now) * 60; return h >= baby.wake - 120 && h < baby.wake + 150 }

  return {
    baby, sleeps, now, out,
    taps: () => taps,
    cur, phase, dayStart, unknownMorning, napsSince, nightSegs, bedOf, pastDays, napLen, plan, planNormal, shortNap, lastWake, budget, makeUp, wakeAt, planNaps, theme, morning, startKind,
    activeOut, outPlan, nightDay, gapsIn, lastNight, aim, fewer, windowOf,
    band: () => bandFor(baby, ageAt(now)),
    age: () => ageAt(now),
  }
}

// The parent's answer that a stretch held no nap, added to the ones kept. Answers older than three
// days are dropped, since the list only asks about today and the day just gone.
export const withNoNap = (baby: Baby, a: number, z: number, now: number): [number, number][] =>
  [...(baby.noNap ?? []).filter((x) => x[1] > now - 3 * DAY && !(x[0] === a && x[1] === z)), [a, z]]

// This morning's wake-up put in the log. The last stretch of the night ends then, or a mark goes in
// when the night was not logged. With `from`, the night's start typed with it, the first stretch
// starts then, and a night not logged goes in whole unless it would sit over a sleep in the log.
// `ids` lists every row that changed, for a shared log.
export function withMorning (baby: Baby, log: Sleep[], at: number, t: number, id: string, from?: number): { sleeps: Sleep[]; id: string; ids: string[] } {
  const E = engine(baby, log, at), ds = E.dayStart()
  const up = ds.up && !ds.unknown ? ds.up : null
  let s = up && !isMark(up) ? up.s : t, first: Sleep | null = null
  if (from != null && from < t) {
    if (up && !isMark(up)) {
      let j = E.sleeps.findIndex((x) => x.id === up.id)
      while (j > 0 && E.sleeps[j - 1].kind === 'night' && !E.sleeps[j - 1].up && E.sleeps[j - 1].e != null) j--
      const f = log.find((x) => x.id === E.sleeps[j].id)
      if (!f || f.id === up.id) s = from
      else if (from < f.e!) first = { ...f, s: from, updatedAt: at }
    } else if (!log.some((x) => !x.deleted && !isMark(x) && x.s < t && (x.e ?? at) > from)) s = from
  }
  const row: Sleep = up ? { ...up, s, e: t, updatedAt: at } : { id, s, e: t, kind: 'night', up: true, updatedAt: at }
  const sleeps = (up ? log.map((x) => (x.id === up.id ? row : first && x.id === first.id ? first : x)) : [...log, row]).sort((a, b) => a.s - b.s)
  return { sleeps, id: row.id, ids: first ? [row.id, first.id] : [row.id] }
}
