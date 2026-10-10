// The chair method, from Kim West's Good Night, Sleep Tight and the HSE's gradual retreat: the
// parent sits by the cot until the baby is asleep, and every three nights the chair moves closer
// to the door, from mock chair-method v4. The plan rides on the baby's details, so a shared log
// carries it to every phone. Nothing in here draws or stores anything.
import { DAY, HOUR, MIN, ageWeeks, type Baby, type Engine } from './engine.ts'
import { mainAction, type Hero } from './model.ts'
import { dur, fmt, times } from './words.ts'

// One night's settling: when the baby went into the cot and fell asleep, how many times the
// parent went over to pat or shush, how much crying there was, and anything that made it harder.
export type Cry = 'none' | 'some' | 'lot'
export type Why = 'unwell' | 'teething' | 'away'
export type Settle = { night: string; inCot: number; asleep: number; trips?: number; cry?: Cry; why?: Why[] }

// `from` is the evening of night 1. `held` holds the evenings the parent kept the chair where it
// was for one more night. `inCot` and `trips` are set while the baby is settling.
export type Chair = { from: string; held: string[]; settles: Settle[]; inCot: number | null; trips?: number }

export const CRY: { value: Cry; label: string }[] = [{ value: 'none', label: 'None' }, { value: 'some', label: 'Some' }, { value: 'lot', label: 'A lot' }]
export const WHY: { value: Why; label: string }[] = [{ value: 'unwell', label: 'Unwell' }, { value: 'teething', label: 'Teething' }, { value: 'away', label: 'Away from home' }]

// Where the chair goes, in order. The fifth is the night the parent says goodnight and leaves.
export const PLACES = ['beside the cot', 'halfway to the door', 'by the door', 'in the hall', 'out of the room']
const STAY = ['by the cot', 'halfway to the door', 'by the door', 'in the hall']
const MOVE_TO = ['beside the cot', 'halfway to the door', 'to the door', 'into the hall']
const NIGHTS_AT = 3

// The HSE and Kim West both start it at six months. Settings offers it at every age since 1.0.18,
// and tells a parent whose baby is younger what the HSE suggests.
export const chairEarly = (baby: Baby, now: number) => ageWeeks(baby, now) < 26

const pad = (n: number) => String(n).padStart(2, '0')
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
// The evening a time belongs to. Up to 6am it is still last night, so a waking at 2am is part of
// the night that started the evening before.
export const eveningOf = (t: number) => ymd(new Date(t - 6 * HOUR))
const dayNo = (key: string) => { const [y, m, d] = key.split('-').map(Number); return Math.round(Date.UTC(y, m - 1, d) / DAY) }
const keyOf = (c: Chair, n: number) => { const d = new Date((dayNo(c.from) + n - 1) * DAY); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` }
export const nightOf = (c: Chair, key: string) => Math.max(1, dayNo(key) - dayNo(c.from) + 1)

export const newChair = (now: number): Chair => ({ from: eveningOf(now), held: [], settles: [], inCot: null })

// Night by night: three nights at each place, one more for each night the parent held, and from
// the fifth place on the parent is out of the room. `move` is a night the chair would move on.
type Night = { n: number; key: string; place: number; move: boolean }
function nights (c: Chair, upTo: number): Night[] {
  const out: Night[] = []
  let place = 0, at = 0
  for (let n = 1; n <= upTo; n++) {
    const key = keyOf(c, n), move = n > 1 && at >= NIGHTS_AT && place < 4
    if (move && !c.held.includes(key)) { place++; at = 0 }
    at++
    out.push({ n, key, place, move })
  }
  return out
}

// The nights each of the four places covers, past ones as they went and the rest as planned.
export function ranges (c: Chair, n: number): string[] {
  const all = nights(c, n + 4 * NIGHTS_AT + 4), out: string[] = []
  for (let p = 0; p < 4; p++) {
    const at = all.filter((x) => x.place === p)
    out.push(at.length ? (at.length === 1 ? String(at[0].n) : `${at[0].n}–${at[at.length - 1].n}`) : '')
  }
  return out
}

export type Tonight = { key: string; n: number; place: number; move: boolean; held: boolean; settled: boolean; ranges: string[] }

export function tonight (c: Chair, now: number): Tonight {
  const key = eveningOf(now), n = nightOf(c, key), x = nights(c, n)[n - 1]
  return { key, n, place: x.place, move: x.move, held: c.held.includes(key), settled: c.settles.some((s) => s.night === key), ranges: ranges(c, n) }
}

// Settling counts while no sleep has started since the tap, for up to three hours.
export const settling = (E: Engine, c: Chair | null | undefined, now: number): c is Chair & { inCot: number } =>
  !!c && c.inCot != null && E.phase() === 'day' && now - c.inCot >= 0 && now - c.inCot < 3 * HOUR

// The bedtime tap is the baby going into the cot, while tonight has no settling logged.
export function cotTap (E: Engine, c: Chair | null | undefined, now: number) {
  if (!c || settling(E, c, now) || E.unknownMorning()) return false
  const a = mainAction(E)
  return a.kind === 'add' && a.sleep.kind === 'night' && !tonight(c, now).settled
}

export type ChairTap = { kind: 'cot' } | { kind: 'asleep'; inCot: number } | null
export function chairTap (E: Engine, c: Chair | null | undefined, now: number): ChairTap {
  if (settling(E, c, now)) return { kind: 'asleep', inCot: c.inCot }
  return cotTap(E, c, now) ? { kind: 'cot' } : null
}

// The chair's changes to the log, worked out at the tap.
export const putInCot = (c: Chair, now: number): Chair => ({ ...c, inCot: now, trips: 0 })
// Each time the parent gets up to pat or shush while the baby settles.
export const wentOver = (c: Chair): Chair => ({ ...c, trips: (c.trips ?? 0) + 1 })
export const fellAsleep = (c: Chair, inCot: number, now: number): Chair => {
  const night = eveningOf(inCot)
  return { ...c, inCot: null, trips: 0, settles: [...c.settles.filter((s) => s.night !== night), { night, inCot, asleep: now, trips: c.trips ?? 0 }] }
}
const tripLine = (n: number) => (n ? `You went over ${times(n)}.` : 'You stayed in the chair the whole time.')
export const asleepToast = (N: string, inCot: number, now: number, trips = 0) =>
  `Down for the night at ${fmt(now)}. ${now - inCot < MIN ? `${N} was asleep in under a minute.` : `${N} took ${dur(now - inCot)} to fall asleep.`} ${tripLine(trips)}`
export const tripsSoFar = (n: number) => (n ? `${times(n).replace(/^./, (x) => x.toUpperCase())} so far` : 'Not yet')

// After the baby is asleep, two quick questions about settling: how much crying, and anything
// that made it harder. They wait for an answer until the morning is over.
export const answer = (c: Chair, night: string, patch: Partial<Pick<Settle, 'cry' | 'why'>>): Chair =>
  ({ ...c, settles: c.settles.map((s) => (s.night === night ? { ...s, ...patch } : s)) })
export type Ask = { night: string; question: string; why: Why[] }
export function askAbout (E: Engine, c: Chair | null | undefined, now: number): Ask | null {
  if (!c) return null
  const s = [...c.settles].sort((a, b) => b.asleep - a.asleep)[0]
  if (!s || s.cry || now - s.asleep > 16 * HOUR || now < s.asleep) return null
  return { night: s.night, question: `How much did ${E.baby.name} cry while settling?`, why: s.why ?? [] }
}
const hard = (s: Settle | undefined) => !!s && (s.cry === 'lot' || !!s.why?.length)
const latest = (c: Chair) => [...c.settles].sort((a, b) => b.asleep - a.asleep)[0]

// A move night can wait one more night, as the HSE gives three or four nights at each place.
export const hold = (c: Chair, key: string, on: boolean): Chair => ({ ...c, held: on ? [...new Set([...c.held, key])] : c.held.filter((k) => k !== key) })

// The Today screen while the plan runs: settling has its own count, and at bedtime the button
// is the baby going into the cot.
export type ChairHero = Hero & { settling?: boolean; trips?: number }
export function chairHero (E: Engine, c: Chair | null | undefined, h: Hero, now: number): ChairHero {
  if (!c || h.ask) return h
  const N = E.baby.name
  if (settling(E, c, now)) return { ...h, eyebrow: 'Settling', hot: false, big: [], sub: `In the cot at ${fmt(c.inCot)}.`, note: '', run: c.inCot, caption: `Tap when ${N} is asleep.`, upForDay: false, outLink: '', glow: 0, settling: true, trips: c.trips ?? 0 }
  if (cotTap(E, c, now)) return { ...h, caption: `Tap when ${N} is in the cot.` }
  return h
}

// The line on Today through the day while the plan runs: which night it is, of how many, and where
// the chair goes tonight. It gives way to the picture at bedtime.
export function chairDay (E: Engine, c: Chair | null | undefined, now: number): string | null {
  const ph = E.phase()
  if (!c || (ph !== 'day' && ph !== 'nap') || E.unknownMorning() || chairCard(E, c, now)) return null
  const t = tonight(c, now), last = nights(c, t.n + 4 * NIGHTS_AT + 4).find((x) => x.place === 4)
  if (t.place === 4) return `Chair method, night ${t.n}. Say goodnight and leave the room tonight.`
  return `Chair method, night ${t.n}${last ? ` of ${last.n}` : ''}. The chair is ${PLACES[t.place]} tonight.`
}

// The picture on Today: at bedtime, while settling, and when the baby wakes in the night.
export type Card = { eyebrow: string; place: number; done: number; ranges: string[]; hold: string; held: boolean; line: string; key: string }
export function chairCard (E: Engine, c: Chair | null | undefined, now: number): Card | null {
  if (!c) return null
  const ph = E.phase(), live = settling(E, c, now), at = cotTap(E, c, now)
  if (!live && !at && ph !== 'waking') return null
  const t = tonight(c, now), N = E.baby.name
  const canHold = t.move && !t.settled && !live && ph === 'day'
  const prev = Math.max(0, t.held ? t.place : t.place - 1)
  // A hard night before a move night: the chair can stay where it is, and the link is right below.
  const easy = canHold && !t.held && hard(latest(c)) ? `Last night was hard, so you can keep the chair ${STAY[prev]} one more night.` : ''
  return {
    eyebrow: `Chair method, night ${t.n}`,
    place: t.place, done: t.place, ranges: t.ranges, key: t.key, held: t.held,
    hold: canHold ? (t.held ? 'Move the chair tonight' : `Stay ${STAY[prev]} one more night`) : '',
    line: t.place === 4 ? 'Say goodnight and leave the room.' : ph === 'waking' ? `Go back to the chair until ${N} is back asleep.` : easy,
  }
}

// The chart under Today's list: minutes to fall asleep, one bar a night, grouped by place. Under
// it, what the last settling and the night said, and where the chair goes tonight.
export type Chart = { groups: { label: string; bars: ({ min: number; last: boolean } | null)[] }[]; max: number; say: string[] }
export function chairChart (E: Engine, c: Chair | null | undefined, now: number): Chart | null {
  if (!c || !c.settles.length) return null
  const t = tonight(c, now), plan = nights(c, t.n + 4 * NIGHTS_AT + 4), byNight = new Map(c.settles.map((s) => [s.night, s]))
  const last = [...c.settles].sort((a, b) => b.asleep - a.asleep)[0]
  const groups = t.ranges.map((label, p) => ({
    label,
    bars: plan.filter((x) => x.place === p).map((x) => {
      const s = byNight.get(x.key)
      return s ? { min: Math.max(1, Math.round((s.asleep - s.inCot) / MIN)), last: s === last } : null
    }),
  }))
  const max = Math.max(30, ...c.settles.map((s) => (s.asleep - s.inCot) / MIN))
  const N = E.baby.name, say: string[] = []
  // The settling just gone, against night 1.
  if (now - last.asleep < 20 * HOUR) {
    const when = last.night === t.key ? 'Tonight' : 'Last night', ms = last.asleep - last.inCot, first = byNight.get(plan[0].key)
    say.push(ms < MIN ? `${when} ${N} was asleep in under a minute.` : `${when} ${N} fell asleep in ${dur(ms)}.`)
    if (first && first !== last && first.asleep - first.inCot - ms >= 2 * MIN) say.push(`That's ${dur(first.asleep - first.inCot - ms)} faster than night 1.`)
    if (last.trips != null) say.push(tripLine(last.trips))
    if (last.cry === 'none') say.push('There was no crying.')
    if (last.cry === 'some') say.push('There was some crying.')
    if (last.cry === 'lot') say.push("There was a lot of crying. The HSE says it can take a few weeks, so keep going.")
  }
  // The night, from the log: the wakings and how long the baby took to go back to sleep.
  const ln = E.lastNight()
  if (ln && ln.logged) {
    const gaps = ln.segs.slice(1).map((x, k) => x.s - ln.segs[k].e!)
    if (!gaps.length) say.push(`${N} slept through the night.`)
    else {
      const avg = gaps.reduce((a, x) => a + x, 0) / gaps.length
      say.push(gaps.length === 1 ? `${N} woke once and was back asleep in ${dur(avg)}.` : `${N} woke ${times(gaps.length)} and was back asleep in ${dur(avg)} on average.`)
    }
  }
  if (t.key !== last.night || t.place === 4) {
    say.push(t.place === 4
      ? 'Tonight you say goodnight and leave the room.'
      : t.n === 1 ? `Tonight the chair goes ${PLACES[0]}.` : t.move && !t.held ? `Tonight the chair moves ${MOVE_TO[t.place]}.` : `Tonight the chair stays ${PLACES[t.place]}.`)
    if (t.move && !t.held && t.place < 4 && hard(last)) say.push(`Last night was hard, so you can keep the chair ${STAY[t.place - 1]} one more night.`)
  }
  return { groups, max, say }
}

// What Settings says while the plan runs.
export const chairLine = (c: Chair, now: number) => { const t = tonight(c, now); return `Night ${t.n}, ${PLACES[t.place]}` }
