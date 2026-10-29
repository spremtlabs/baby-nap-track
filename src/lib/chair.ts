// The chair method, a gradual retreat: the parent sits by the cot until the baby is
// asleep, and every three nights sits closer to the door. The plan rides on the baby's details, so a shared log
// carries it to every phone. Nothing in here draws or stores anything.
// 11 October 2026: every line is said to the parent, who does the sitting and the moving. The chair
// is never the subject of a sentence, and the gate reads the source for it.
import { DAY, HOUR, MIN, ageWeeks, type Baby, type Engine } from './engine.ts'
import { bedTonight, mainAction, type Hero, type Row } from './model.ts'
import { dur, fmt, fmtMins, times } from './words.ts'

// One night's settling: when the baby went into the cot and fell asleep, how many times the
// parent went over to pat or shush, how much crying there was, and anything that made it harder.
export type Cry = 'none' | 'some' | 'lot'
export type Why = 'unwell' | 'teething' | 'away'
// From 12 October 2026 the night sheet also keeps how many times the parent picked the baby up, and a note.
export type Settle = { night: string; inCot: number; asleep: number; trips?: number; picks?: number; note?: string; cry?: Cry; why?: Why[] }

// `from` is the evening of night 1. `held` holds the evenings the parent stayed where they were
// for one more night. `inCot`, `trips` and `picks` are set while the baby is settling. `napCot` is
// when the baby went into the cot for a nap, from 1.0.35.
export type Chair = { from: string; held: string[]; settles: Settle[]; inCot: number | null; trips?: number; picks?: number; napCot?: number | null }

export const CRY: { value: Cry; label: string }[] = [{ value: 'none', label: 'None' }, { value: 'some', label: 'Some' }, { value: 'lot', label: 'A lot' }]
export const WHY: { value: Why; label: string }[] = [{ value: 'unwell', label: 'Unwell' }, { value: 'teething', label: 'Teething' }, { value: 'away', label: 'Away from home' }]

// Where the parent sits, in order. The fifth is the night the parent says goodnight and leaves.
export const PLACES = ['beside the cot', 'halfway to the door', 'inside the door', 'in the hall', 'out of the room']
const STAY = ['by the cot', 'halfway to the door', 'inside the door', 'in the hall']
const NIGHTS_AT = 3

// Settings offers it at every age since 1.0.18, and tells a parent whose baby is under six months
// that it is suggested from six months.
export const chairEarly = (baby: Baby, now: number) => ageWeeks(baby, now) < 26

const pad = (n: number) => String(n).padStart(2, '0')
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
// The evening a time belongs to. Up to 6am it is still last night, so a waking at 2am is part of
// the night that started the evening before.
export const eveningOf = (t: number) => ymd(new Date(t - 6 * HOUR))
const dayNo = (key: string) => { const [y, m, d] = key.split('-').map(Number); return Math.round(Date.UTC(y, m - 1, d) / DAY) }
const keyOf = (c: Chair, n: number) => { const d = new Date((dayNo(c.from) + n - 1) * DAY); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` }
export const nightOf = (c: Chair, key: string) => Math.max(1, dayNo(key) - dayNo(c.from) + 1)

// Night 1 is the coming bedtime: this evening while the baby is up, and the next one once the baby
// is down for the night. Before 6am with the baby up for the day, it is still this evening.
const down = (E: Engine) => { const ph = E.phase(); return ph === 'night' || ph === 'waking' }
export const newChair = (E: Engine, now: number): Chair =>
  ({ from: down(E) ? eveningOf(E.nightSegs()[0].s + DAY) : eveningOf(Math.max(now, E.dayStart().t + 6 * HOUR)), held: [], settles: [], inCot: null })
// A plan started after bedtime has nothing to show until its first evening.
const begun = (c: Chair, now: number) => dayNo(eveningOf(now)) >= dayNo(c.from)
// Night 1 is tonight when it falls on today's date or earlier, and tomorrow when it is the next one.
// Started from the Night tab with Tomorrow night picked, from 1.0.41.
export const newChairTomorrow = (E: Engine, now: number): Chair => {
  const c = newChair(E, now)
  return startsTonight(c, now) ? { ...c, from: eveningOf(Math.max(now, E.dayStart().t + 6 * HOUR) + DAY) } : c
}
export const startsTonight = (c: Chair, now: number) => dayNo(c.from) <= dayNo(ymd(new Date(now)))

// Night by night: three nights at each place, one more for each night the parent held, and from
// the fifth place on the parent is out of the room. `move` is a night the parent would move on.
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

// The night the parent leaves the room, with any nights held back counted in.
const leaveNight = (c: Chair, n: number) => nights(c, n + 4 * NIGHTS_AT + 4).find((x) => x.place === 4)?.n

export type Tonight = { key: string; n: number; place: number; move: boolean; held: boolean; settled: boolean; ranges: string[] }

export function tonight (c: Chair, now: number): Tonight {
  const key = eveningOf(now), n = nightOf(c, key), x = nights(c, n)[n - 1]
  return { key, n, place: x.place, move: x.move, held: c.held.includes(key), settled: c.settles.some((s) => s.night === key), ranges: ranges(c, n) }
}

// The plan is for bedtime only, from 14 October 2026. The cot tap comes in the evening, from noon,
// while the baby is up for the day. A tap in the night or the early morning is the baby back asleep,
// as it is with the plan off. Up to 1.0.32 a tap at 6:34am, awake since 6, read as the coming
// evening's bedtime: the count started, the picture showed night 4, and it kept counting after up
// for the day.
const evening = (t: number) => new Date(t).getHours() >= 12

// Settling counts while no sleep has started since an evening tap, for up to three hours.
export const settling = (E: Engine, c: Chair | null | undefined, now: number): c is Chair & { inCot: number } =>
  !!c && c.inCot != null && evening(c.inCot) && E.phase() === 'day' && now - c.inCot >= 0 && now - c.inCot < 3 * HOUR

// A nap in the cot while the plan runs, from 1.0.35. 16 October 2026: the car or the buggy is for a
// baby you have been sleep training and trying to get to sleep for ages. Up to 1.0.34 every nap time
// said it, so at 23 minutes awake the screen said an overtired baby could nap in the car. Now the
// parent taps when the baby goes into the cot for a nap, and after an hour of settling the screen
// says the car or the buggy. Gentle sleep plans try a nap in the cot for about an hour before the car
// or the buggy. It counts from the day after night 1, the day both of them
// start naps, while a nap is planned, and for up to two hours.
export const napSettling = (E: Engine, c: Chair | null | undefined, now: number): c is Chair & { napCot: number } =>
  !!c && c.napCot != null && E.phase() === 'day' && now - c.napCot >= 0 && now - c.napCot < 2 * HOUR && !E.sleeps.some((x) => x.s >= c.napCot!)
export function napCotTap (E: Engine, c: Chair | null | undefined, now: number) {
  if (!c || dayNo(eveningOf(now)) <= dayNo(c.from) || settling(E, c, now) || napSettling(E, c, now) || E.unknownMorning() || E.phase() !== 'day' || !E.planNaps().length) return false
  const a = mainAction(E)
  return a.kind === 'add' && a.sleep.kind === 'nap'
}
export const napInCot = (c: Chair, now: number): Chair => ({ ...c, napCot: now })
export const napOver = (c: Chair): Chair => ({ ...c, napCot: null })
export const napToast = (toast: string, napCot: number, now: number) => (now - napCot < MIN ? toast : `${toast} Settling took ${dur(now - napCot)}.`)

// The bedtime tap is the baby going into the cot, while tonight has no settling logged.
export function cotTap (E: Engine, c: Chair | null | undefined, now: number) {
  if (!c || !begun(c, now) || settling(E, c, now) || napSettling(E, c, now) || E.unknownMorning() || E.phase() !== 'day' || !evening(now)) return false
  const a = mainAction(E)
  return a.kind === 'add' && a.sleep.kind === 'night' && !a.back && !tonight(c, now).settled
}

export type ChairTap = { kind: 'cot' } | { kind: 'asleep'; inCot: number } | { kind: 'nap'; napCot: number } | null
export function chairTap (E: Engine, c: Chair | null | undefined, now: number): ChairTap {
  if (settling(E, c, now)) return { kind: 'asleep', inCot: c.inCot }
  if (napSettling(E, c, now)) return { kind: 'nap', napCot: c.napCot }
  return cotTap(E, c, now) ? { kind: 'cot' } : null
}

// The chair's changes to the log, worked out at the tap.
export const putInCot = (c: Chair, now: number): Chair => ({ ...c, inCot: now, trips: 0, picks: 0 })
// Each time the parent gets up to pat or shush while the baby settles, and from 14 October 2026
// each time the parent picks the baby up.
export const wentOver = (c: Chair): Chair => ({ ...c, trips: (c.trips ?? 0) + 1 })
export const pickedUp = (c: Chair): Chair => ({ ...c, picks: (c.picks ?? 0) + 1 })
export const fellAsleep = (c: Chair, inCot: number, now: number): Chair => {
  const night = eveningOf(inCot), picks = c.picks || undefined
  return { ...c, inCot: null, trips: 0, picks: 0, settles: [...c.settles.filter((s) => s.night !== night), { night, inCot, asleep: now, trips: c.trips ?? 0, picks }] }
}
// 14 October 2026: the toast credits the parent with the night done. The trips and pick-ups are on
// the chart in the morning.
export const asleepToast = (N: string, inCot: number, now: number, trips = 0, picks = 0, n = 0) =>
  `${now - inCot < MIN ? `${N} was asleep in under a minute.` : `${N} was asleep ${dur(now - inCot)} after going in the cot.`}${trips || picks ? '' : ' You stayed in your chair the whole time.'}${n ? ` That's night ${n} done!` : ''}`
export const tripsSoFar = (n: number) => (n ? `${times(n).replace(/^./, (x) => x.toUpperCase())} so far` : 'None so far')

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

// Last night's bedtime as its sheet holds it, from 12 October 2026: when the baby went into the cot,
// the times the parent went over and picked the baby up, and a note. Asleep is the night's own start,
// so it is kept once. Bedtime is its own record, apart from the wakings in the night, the way sleep
// studies count them. A night before the plan began has none.
export type SettleDraft = { night: string; n: number; inCot: number | null; trips: number; picks: number; note: string }
export function settleDraft (c: Chair | null | undefined, down: number): SettleDraft | null {
  if (!c) return null
  const night = eveningOf(down)
  if (dayNo(night) < dayNo(c.from)) return null
  const s = c.settles.find((x) => x.night === night)
  return { night, n: nightOf(c, night), inCot: s?.inCot ?? null, trips: s?.trips ?? 0, picks: s?.picks ?? 0, note: s?.note ?? '' }
}
// Nothing put in keeps no settling, and a cot time left alone is the moment the baby fell asleep.
export function settleSave (c: Chair, d: SettleDraft, asleep: number): Chair {
  const note = d.note.trim(), old = c.settles.find((x) => x.night === d.night)
  if (!old && d.inCot == null && !d.trips && !d.picks && !note) return c
  const s: Settle = { ...old, night: d.night, inCot: Math.min(d.inCot ?? asleep, asleep), asleep, trips: d.trips, picks: d.picks || undefined, note: note || undefined }
  return { ...c, settles: [...c.settles.filter((x) => x.night !== d.night), s] }
}

// The row above Last night in Today's list while the plan covers last night. A tap opens bedtime.
export function bedtimeRow (E: Engine, c: Chair | null | undefined): Row | null {
  const ln = E.lastNight()
  if (!ln) return null
  const down = ln.segs[0].s, sd = settleDraft(c, down)
  if (!sd) return null
  const s = c!.settles.find((x) => x.night === sd.night)
  if (!s) return { at: (ln.logged ? down : E.dayStart().t) - 2, mark: 'edge', title: 'Bedtime', sub: `Chair method, night ${sd.n}`, right: 'Add', bed: true }
  const ms = s.asleep - s.inCot
  return { at: Math.min(s.inCot, down) - 1, mark: 'done', title: 'Bedtime', sub: `In the cot ${fmt(s.inCot)}, asleep ${fmt(s.asleep)}`, right: ms < MIN ? 'Under a min' : dur(ms), bed: true }
}

// A move night can wait one more night, so a place can have three or four nights.
export const hold = (c: Chair, key: string, on: boolean): Chair => ({ ...c, held: on ? [...new Set([...c.held, key])] : c.held.filter((k) => k !== key) })

// The sheet Settings opens: the plan in five lines, what the HSE says about how it goes, and the
// button that starts it. The steps are the ones the app has given since 1.0.11.
export type Intro = { steps: string[]; goes: string[]; cta: string }
export function chairIntro (E: Engine, now: number): Intro {
  const N = E.baby.name
  return {
    steps: [
      `Put ${N} in the cot awake. Sit in a chair right beside the cot until ${N}'s asleep.`,
      `You can shush, or rest a hand on ${N}. Lift your hand before ${N} nods off.`,
      `Every three nights you move your chair a bit closer to the door. If ${N} gets upset, go over to pat or shush, then sit back down.`,
      `You use the chair at bedtime only. In the night, settle ${N} the way you usually do.`,
      'On night 13 you say goodnight and leave the room.',
    ],
    // Each line carries whose finding it is. The figure is for sleep training as a whole, because no
    // trial tests this plan by itself.
    goes: [KNOWN.most, KNOWN.roomAfter, "The HSE says the first few nights are hard, and you'll start to see a change within a week or so."],
    cta: startsTonight(newChair(E, now), now) ? 'Start tonight' : 'Start tomorrow night',
  }
}

// The same sheet once the plan is on: well done, when bedtime is, and the first night in three steps.
// What the parent can do from the chair is on the card at bedtime, where it applies.
// Bedtime is the one Today's list gives, so a bedtime brought forward after short naps is said as early.
export type Guide = { title: string; when: string; steps: string[]; after: string; cta: string }
export function chairGuide (E: Engine, c: Chair, now: number, lock = false): Guide {
  const N = E.baby.name, last = leaveNight(c, 1)
  // The time is said once, in the line under the heading.
  let bed = `Bedtime is ${fmtMins(E.baby.bed)}.`, at = ' at bedtime'
  if (!down(E)) {
    const b = bedTonight(E, lock)
    if (now >= b.at - 15 * MIN) { bed = "It's bedtime now."; at = '' }
    else bed = b.early ? `Bedtime is early, so aim for ${fmt(b.at)}.` : `Bedtime is ${fmt(b.at)}.`
  }
  return {
    title: 'Well done for starting!',
    when: `${startsTonight(c, now) ? 'Tonight' : 'Tomorrow'} is night 1${last ? ` of ${last}` : ''}. ${bed}`,
    steps: [
      'Put a chair right beside the cot.',
      `Put ${N} in the cot awake${at} and tap Start.`,
      `Sit in your chair, and tap again when ${N}'s asleep.`,
    ],
    after: "Each day we'll tell you where to sit and what to do that night.",
    cta: 'Got it',
  }
}

// The Today screen while the plan runs: settling has its own count, and at bedtime the button
// is the baby going into the cot.
// A nap settling has the count and one line, and no trips or pick-ups, since the chair is for
// bedtime. `napLink` puts the baby in the cot for a nap and `stop` ends the count with no nap.
export type ChairHero = Hero & { settling?: boolean; trips?: number; picks?: number; nap?: boolean; napLink?: string; stop?: string }
export function chairHero (E: Engine, c: Chair | null | undefined, h: Hero, now: number): ChairHero {
  if (!c || h.ask) return h
  const N = E.baby.name
  if (napSettling(E, c, now)) {
    const sub = now - c.napCot >= HOUR ? `You've been at it an hour. If ${N} is overtired, an easier nap in the car or the buggy is a good way to go.` : `Give ${N} up to an hour in the cot.`
    return { ...h, eyebrow: 'Settling', hot: false, big: [], sub, note: '', run: c.napCot, caption: `Tap when ${N} is asleep.`, upForDay: false, outLink: '', glow: 0, ways: null, fewer: null, settling: true, nap: true, stop: `${N} didn't go down` }
  }
  // 14 October 2026: the count says how long, so no line says when the baby went in.
  if (settling(E, c, now)) return { ...h, eyebrow: 'Settling', hot: false, big: [], sub: '', note: '', run: c.inCot, caption: `Tap when ${N} is asleep.`, upForDay: false, outLink: '', glow: 0, settling: true, trips: c.trips ?? 0, picks: c.picks ?? 0 }
  if (cotTap(E, c, now)) return { ...h, caption: `Tap when ${N} is in the cot.` }
  if (napCotTap(E, c, now)) return { ...h, napLink: `${N} is in the cot for a nap` }
  return h
}

// The note on Today through the day while the plan runs: which night it is, of how many, where to
// sit tonight with a word of encouragement, and one finding about sleep training. Once the day's naps
// are done it holds the button that puts the baby in the cot, at any hour, so an early bedtime is
// clocked in before the timer turns into the cot tap. It gives way to the picture at bedtime.
// 12 October 2026: the note gave bedtime, which the day can bring forward, and had nothing to tap.
export type DayNote = { head: string; line: string; known: string; cot: string }
const CHEER = ["You've got this!", "You're doing great!"]
export function chairDay (E: Engine, c: Chair | null | undefined, now: number): DayNote | null {
  const ph = E.phase()
  if (!c || (ph !== 'day' && ph !== 'nap') || E.unknownMorning() || chairCard(E, c, now)) return null
  const t = tonight(c, now), last = leaveNight(c, t.n)
  // A move night already opens on the nights done, so it carries no second cheer.
  const moved = t.move && !t.held
  const sit = t.place === 4 ? (moved ? `You've done ${t.n - 1} nights in the chair! Say goodnight and leave the room tonight.` : 'Say goodnight and leave the room tonight.') : sitLine(t)
  const line = moved ? sit : `${sit} ${CHEER[t.n === 1 ? 0 : t.n % 2]}`
  // The card under the chart can hold a finding the same morning, so this note takes the next one.
  const under = chairChart(E, c, now)?.note ?? ''
  const order = [KNOWN.studies, KNOWN.room, KNOWN.week], k = (t.n - 1) % order.length
  const known = [...order.slice(k), ...order.slice(0, k)].find((x) => !under.startsWith(x)) ?? ''
  const cot = ph === 'day' && begun(c, now) && !t.settled && !E.planNaps().length && !napSettling(E, c, now) ? `${E.baby.name} is in the cot` : ''
  return { head: `Chair method, night ${t.n}${last && t.place < 4 ? ` of ${last}` : ''}`, line, known, cot }
}

// What the card says at bedtime, before the baby goes into the cot: where to sit, and well done
// on the nights that finish a place.
function sitLine (t: Tonight) {
  if (t.n === 1) return 'Sit right beside the cot tonight.'
  if (t.move && !t.held) return `That's ${t.n - 1} nights done! Sit ${PLACES[t.place]} tonight.`
  return `Sit ${PLACES[t.place]} again tonight.`
}
// The card on Today at bedtime and while the baby settles. From 14 October 2026: at
// bedtime it holds the picture, where to sit and three short steps. While the baby settles it holds
// one line, what to do from where the parent sits, and the rows for when it gets hard, with no
// picture. It no longer shows when the baby wakes in the night.
export type Card = { eyebrow: string; place: number; done: number; ranges: string[]; hold: string; held: boolean; line: string; key: string; steps: string[]; help: Help[]; live: boolean }
export function chairCard (E: Engine, c: Chair | null | undefined, now: number): Card | null {
  if (!c || !begun(c, now)) return null
  const ph = E.phase(), live = settling(E, c, now), at = cotTap(E, c, now)
  if (!live && !at) return null
  const t = tonight(c, now), last = leaveNight(c, t.n), plan = nightPlan(E, c, now)
  const canHold = t.move && !t.settled && !live && ph === 'day'
  const prev = Math.max(0, t.held ? t.place : t.place - 1)
  // A hard night before a move night: the parent can stay put, and the link is right below.
  const easy = canHold && !t.held && hard(latest(c)) ? ` Last night was hard. You can stay ${STAY[prev]} one more night if you'd like.` : ''
  const leave = at && t.move ? `You've done ${t.n - 1} nights in the chair! Say goodnight and leave the room tonight.` : 'Say goodnight and leave the room.'
  return {
    eyebrow: `Chair method, night ${t.n}${last && t.place < 4 ? ` of ${last}` : ''}`,
    place: t.place, done: t.place, ranges: t.ranges, key: t.key, held: t.held, live,
    hold: canHold ? (t.held ? 'Move your chair tonight' : `Stay ${STAY[prev]} one more night`) : '',
    line: live ? plan.settle : t.place === 4 ? leave : sitLine(t) + easy,
    steps: live ? [] : plan.steps,
    help: live ? plan.help : [],
  }
}

// Every night of the plan has its own coaching, from 14 October 2026: where to sit, a line for
// tonight, three short steps, what to expect, and what to do when it gets hard. Through the day it
// opens from the note on Today.
export type HelpId = 'cry' | 'quiet' | 'stand' | 'long' | 'finger' | 'sick'
export type Help = { id: HelpId; q: string; a: string }
export type NightPlan = { head: string; where: string; line: string; steps: string[]; settle: string; expect: string; help: Help[]; place: number; ranges: string[] }

// How many nights the parent has been at tonight's place, tonight included, and whether tonight is
// the last one there by the plan as it stands.
function atPlace (c: Chair, n: number) {
  const all = nights(c, n + 1), place = all[n - 1].place
  return { at: all.slice(0, n).filter((x) => x.place === place).length, last: place < 4 && all[n].place !== place }
}

// The night's line never names the place, because the heading above it does. It says what changes
// tonight, and says nothing on night 1 and the nights a place begins, where the heading and the card
// behind the sheet already say it.
function nightLine (t: Tonight, at: number, last: boolean, N: string): string {
  const moved = t.move && !t.held
  if (t.place === 4) return moved ? '' : 'Do the same as last night.'
  if (t.place === 0) {
    if (at === 1) return ''
    if (at === 2) return `Night 1 is behind you! Tonight, pat ${N} a little less and shush a little more.`
    if (at === 3) return `Try shushing first tonight, and pat if ${N} needs it.`
    return 'One more night here before you move. Shush more than you pat.'
  }
  if (t.place === 1) {
    if (at === 1) return ''
    if (last) return 'Tomorrow night you move closer to the door.'
    if (at === 2) return 'Your first night in the new spot is done!'
    return 'One more night here before you move.'
  }
  if (t.place === 2) {
    if (at === 1) return ''
    if (last) return 'Tomorrow you move out to the hall.'
    if (at === 2) return 'Tonight, wait a couple of minutes before you go over.'
    return 'One more night here before you move.'
  }
  if (at === 1) return `Tonight, settle ${N} with your voice.`
  if (last) return 'This is your last night in the chair!'
  return 'Shush a little less often than last night.'
}

const WHERE = ['Sit right beside the cot', 'Sit halfway to the door', 'Sit inside the door with a dim light on', 'Sit in the hall with the door open', 'Say goodnight and leave the room']

// Three steps a night. The second or third is what to do from where the parent sits, and it is the
// one line the card keeps while the baby settles.
function nightSteps (place: number, N: string): { steps: string[]; settle: string } {
  const down = `Put ${N} in the cot sleepy but still awake.`
  const s = [
    [down, `Shush, pat or stroke ${N}, and stop now and then.`, `Stay until ${N} is sound asleep.`],
    [down, `Shush and talk to ${N} from your chair.`, `If ${N} gets upset, go over to pat or shush, then sit back down.`],
    [down, `Shush, or say the same few words each time ${N} fusses.`, `Go over if ${N} is crying hard, then go back to your chair.`],
    [down, `Shush now and then to let ${N} know you're close.`, `Stay until ${N} is asleep.`],
    [down, `Stay close enough to hear ${N}.`, `If ${N} cries, talk to ${N} from the doorway.`],
  ][place]
  return { steps: s, settle: place === 0 || place === 3 ? s[1] : s[2] }
}

// What to expect, on the nights a source says something about.
function nightExpect (t: Tonight, at: number): string {
  if (t.n === 1) return "Night 1 can take up to an hour. The HSE says the first few nights are hard, and that you'll see a change within a week or so."
  if (t.n === 3) return 'The HSE says night 3 or 4 is often harder than night 1. Keep going!'
  if (t.place === 1 && at === 1 && !t.held) return 'Not ready to move? Tap the link on Today for one more night by the cot. The HSE says to move every 3 to 4 nights.'
  if (t.place === 2 && at === 1 && !t.held) return 'Need one more night halfway to the door? Tap the link on Today.'
  return ''
}

// The rows under If it gets hard, each a tap away from what to do.
function nightHelp (place: number, N: string): Help[] {
  const out = place === 4
  return [
    { id: 'cry', q: 'Crying hard', a: out ? `Go in and pick ${N} up for a cuddle. Once the crying stops, put ${N} back in the cot awake and go back out.` : `Pick ${N} up for a cuddle until the crying stops. Then put ${N} back in the cot awake and sit back down.` },
    { id: 'quiet', q: 'Quiet once picked up', a: `Wait a little longer before you pick ${N} up next time.` },
    { id: 'stand', q: 'Standing up', a: `Pat the mattress and say "lie down". Lay ${N} down once at most. After that, wait for ${N} to lie down.` },
    ...(place === 0 ? [{ id: 'finger' as HelpId, q: 'Holding your finger', a: `Slide your finger out gently and pat the top of ${N}'s hand instead. A baby who falls asleep holding on often wakes when you let go.` }] : []),
    { id: 'long', q: 'Taking ages', a: out ? 'Check from the doorway every few minutes. If tonight is too hard, you can go back to the hall for a night.' : `Use the same words${place < 3 ? ' and the same pats' : ''} each time. If bedtime falls apart, take ${N} out of the room, calm down together and start again.` },
    // While a child is unwell the plan stops and the child gets whatever they need. Once better, the
    // parent starts a place or two back.
    { id: 'sick', q: 'Unwell', a: `Look after ${N} the way you always would. Once ${N} is better, start again ${out ? 'inside the door for a few nights' : place === 0 ? 'beside the cot' : 'with your chair a step or two closer to the cot'}.` },
  ]
}

export function nightPlan (E: Engine, c: Chair, now: number): NightPlan {
  const t = tonight(c, now), N = E.baby.name, last = leaveNight(c, t.n), p = atPlace(c, t.n), s = nightSteps(t.place, N)
  return {
    head: `Night ${t.n}${last && t.place < 4 ? ` of ${last}` : ''}`,
    where: WHERE[t.place],
    line: nightLine(t, p.at, p.last, N),
    steps: s.steps, settle: s.settle,
    expect: nightExpect(t, p.at),
    help: nightHelp(t.place, N),
    place: t.place, ranges: t.ranges,
  }
}

// What is known about sleep training, each line with whose finding it is. 11 October 2026: the
// figure is a count of studies, since the share of children who improved came from a few of them.
// Each line says sleep training, since no trial tests this plan by itself.
const STUDIES = 'Sleep training brought easier bedtimes and fewer night wakings in 49 of 52 studies.'
const KNOWN = {
  studies: STUDIES,
  most: `${STUDIES} Over 2,500 babies and toddlers took part.`,
  // On the sheet this follows the line above. Under the chart it stands alone.
  roomAfter: 'Four of those studies had a parent stay in the room, and it worked in all four.',
  room: 'Sleep training with a parent in the room worked in all four studies that tested it.',
  week: "The HSE says you'll start to see a change within a week or so.",
}
// One a morning for the first six, so no two mornings running say the same. After that the figure
// comes back on the morning after a slower night.
const NOTES = [KNOWN.week, KNOWN.most, KNOWN.room, KNOWN.most, KNOWN.week, KNOWN.room]
const PRAISE = ['Brilliant!', 'Amazing!', 'Well done!']
// What the HSE says about how it goes, by the night just gone.
const hseSays = (ln: number) => (ln <= 2 ? 'the first few nights are hard' : ln <= 4 ? 'night 3 or 4 is often harder than night 1' : 'the plan can take a few weeks to work')

// The chart under Today's list: minutes to fall asleep, one bar a night, grouped by place. Under
// it the app coaches. `head` reads last night against night 1 and the night before, `say` is what
// the parent did and how the night went, and `note` is one line of what is known about sleep
// training. On a move day `stay` is the link that keeps the parent where they are one more night;
// at bedtime that link is on the card, so the chart leaves it out. Where to sit tonight is on the
// note at the top of Today, and the bars carry the minutes, so neither is said again here.
// 11 October 2026: the lines under the chart were a flat list, and a parent could stay longer in a
// place only at bedtime.
export type Chart = {
  groups: { label: string; bars: ({ min: number; last: boolean } | null)[] }[]; max: number
  head: string; say: string[]; note: string
  stay: { line: string; link: string } | null
}
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
  let head = '', note = ''
  // The settling just gone, against night 1 and the night before.
  if (now - last.asleep < 20 * HOUR) {
    const same = last.night === t.key, ms = last.asleep - last.inCot, ln = nightOf(c, last.night)
    const first = byNight.get(plan[0].key), before = byNight.get(keyOf(c, ln - 1)), was = plan[ln - 1]
    const gain = first && first !== last ? first.asleep - first.inCot - ms : 0
    // Slower than night 1, or no faster: the heading steadies, and what the HSE says of that night follows.
    const tough = !same && ln > 1 && ms >= MIN && gain < 2 * MIN
    // Faster than night 1 and slower than the night before, as the first night in a new place can be.
    const dip = !!before && before !== last && ms - (before.asleep - before.inCot) >= 2 * MIN
    const moved = !!was && was.move && was.place > 0 && !c.held.includes(was.key)
    if (same) {
      head = `That's night ${ln} done. Well done!`
      say.push(ms < MIN ? `${N} was asleep in under a minute.` : `${N} fell asleep in ${dur(ms)}.`)
      if (gain >= 2 * MIN) say.push(`That's ${dur(gain)} faster than on night 1.`)
    } else if (ms < MIN) head = `${PRAISE[ln % PRAISE.length]} ${N} was asleep in under a minute.`
    else if (ln === 1) head = `${N} fell asleep in ${dur(ms)} on night 1. That's the one to beat!`
    else if (tough) head = `${N} took ${dur(ms)} to fall asleep last night. Hang in there!`
    else if (dip) head = moved ? `${dur(ms)} on the first night ${PLACES[was.place]}. That's still ${dur(gain)} faster than night 1!` : `${N} fell asleep in ${dur(ms)}. That's still ${dur(gain)} faster than on night 1!`
    else head = `${PRAISE[ln % PRAISE.length]} ${N} fell asleep ${dur(gain)} faster than on night 1.`
    // What the parent did. A count of trips is said when it is none, or fewer than the night before.
    const cry = last.cry
    if (last.trips === 0 && !last.picks) say.push(`You stayed in your chair the whole time${cry === 'none' ? ', and there was no crying at all' : cry === 'some' ? ', even through some crying' : cry === 'lot' ? ', even through a lot of crying' : ''}!`)
    else {
      if (last.trips && before?.trips != null && before.trips > last.trips) say.push(`You went over ${times(last.trips)}, down from ${before.trips} the night before.`)
      // From 14 October 2026 the coach says the next thing to try: staying in the chair more once
      // it has moved, and waiting a little before a pick-up.
      else if ((last.trips ?? 0) >= 5 && !!was && was.place > 0) say.push(`You stuck with it until ${N} was asleep. Tonight, try to stay in your chair more than you're out of it.`)
      if (last.picks) say.push(last.picks >= 2 ? `You picked ${N} up when ${N} needed you. If ${N} goes quiet the moment you do, wait a little longer next time.` : `You picked ${N} up ${times(last.picks)}.`)
      if (cry === 'none') say.push('There was no crying at all!')
      if (cry === 'some') say.push(`There was some crying, and you stayed right there with ${N}.`)
      if (cry === 'lot') say.push(`There was a lot of crying, and you stayed right there with ${N}.`)
    }
    if (tough || cry === 'lot') say.push(`The HSE says ${hseSays(ln)}${tough ? '' : ', so keep going'}.`)
    // The card under the lines. A morning whose lines carry the HSE gets the figure, so the HSE is said once.
    if (!same) {
      note = ln <= NOTES.length ? NOTES[ln - 1] : tough ? KNOWN.most : ''
      if (note === KNOWN.week && (tough || cry === 'lot')) note = KNOWN.most
    }
  }
  // The night, from the log: the wakings and how long the baby took to go back to sleep.
  const ln = E.lastNight()
  if (ln && ln.logged) {
    const gaps = ln.segs.slice(1).map((x, k) => x.s - ln.segs[k].e!)
    if (!gaps.length) say.push(`${N} slept through the night!`)
    else {
      const avg = gaps.reduce((a, x) => a + x, 0) / gaps.length
      say.push(gaps.length === 1 ? `${N} woke once in the night and was back asleep in ${dur(avg)}.` : `${N} woke ${times(gaps.length)} in the night and was back asleep in about ${dur(avg)} each time.`)
    }
  }
  // A move day, before bedtime: one more night in the same place, or the move after all.
  let stay: Chart['stay'] = null
  const ph = E.phase()
  if (t.key !== last.night && t.move && !t.settled && (ph === 'day' || ph === 'nap') && !chairCard(E, c, now)) {
    const at = Math.max(0, t.held ? t.place : t.place - 1), here = STAY[at]
    // The 3 to 4 nights the HSE gives covers a fourth night at a place inside the room, and no more.
    const fourth = at < 3 && plan.filter((x) => x.n < t.n && x.place === at).length === NIGHTS_AT
    stay = t.held
      ? { line: `You're taking one more night ${here}.`, link: 'Move your chair tonight' }
      : { line: `You can take one more night ${here}.${fourth ? ' The HSE says to move every 3 to 4 nights.' : ''}`, link: `Stay ${here} one more night` }
  }
  return { groups, max, head, say, note, stay }
}

// What Settings says while the plan runs.
export const chairLine = (c: Chair, now: number) => { const t = tonight(c, now); return `Night ${t.n}, ${PLACES[t.place]}` }
