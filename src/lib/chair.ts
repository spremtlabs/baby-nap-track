// The chair method, a gradual retreat: the parent sits by the cot until the baby is
// asleep, and every three nights sits closer to the door. The plan rides on the baby's details, so a shared log
// carries it to every phone. Nothing in here draws or stores anything.
// 11 October 2026: every line is said to the parent, who does the sitting and the moving. The chair
// is never the subject of a sentence, and the gate reads the source for it.
import { DAY, HOUR, MIN, ageWeeks, type Baby, type Engine } from './engine.ts'
import { bedTonight, mainAction, type Hero } from './model.ts'
import { dur, fmt, fmtMins, times } from './words.ts'

// One night's settling: when the baby went into the cot and fell asleep, how many times the
// parent went over to pat or shush, how much crying there was, and anything that made it harder.
export type Cry = 'none' | 'some' | 'lot'
export type Why = 'unwell' | 'teething' | 'away'
export type Settle = { night: string; inCot: number; asleep: number; trips?: number; cry?: Cry; why?: Why[] }

// `from` is the evening of night 1. `held` holds the evenings the parent stayed where they were
// for one more night. `inCot` and `trips` are set while the baby is settling.
export type Chair = { from: string; held: string[]; settles: Settle[]; inCot: number | null; trips?: number }

export const CRY: { value: Cry; label: string }[] = [{ value: 'none', label: 'None' }, { value: 'some', label: 'Some' }, { value: 'lot', label: 'A lot' }]
export const WHY: { value: Why; label: string }[] = [{ value: 'unwell', label: 'Unwell' }, { value: 'teething', label: 'Teething' }, { value: 'away', label: 'Away from home' }]

// Where the parent sits, in order. The fifth is the night the parent says goodnight and leaves.
export const PLACES = ['beside the cot', 'halfway to the door', 'by the door', 'in the hall', 'out of the room']
const STAY = ['by the cot', 'halfway to the door', 'by the door', 'in the hall']
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
const startsTonight = (c: Chair, now: number) => dayNo(c.from) <= dayNo(ymd(new Date(now)))

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

// Settling counts while no sleep has started since the tap, for up to three hours.
export const settling = (E: Engine, c: Chair | null | undefined, now: number): c is Chair & { inCot: number } =>
  !!c && c.inCot != null && E.phase() === 'day' && now - c.inCot >= 0 && now - c.inCot < 3 * HOUR

// The bedtime tap is the baby going into the cot, while tonight has no settling logged.
export function cotTap (E: Engine, c: Chair | null | undefined, now: number) {
  if (!c || !begun(c, now) || settling(E, c, now) || E.unknownMorning()) return false
  const a = mainAction(E)
  return a.kind === 'add' && a.sleep.kind === 'night' && !a.back && !tonight(c, now).settled
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
const tripLine = (n: number) => (n ? `You went over ${times(n)}.` : 'You stayed in your chair the whole time.')
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
      `If ${N} wakes in the night, sit in your chair until ${N}'s back asleep.`,
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
    after: "We'll tell you where to sit each night.",
    cta: 'Got it',
  }
}

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

// The note on Today through the day while the plan runs: which night it is, of how many, where
// to sit tonight and when bedtime is. It gives way to the picture at bedtime.
export type DayNote = { head: string; line: string }
export function chairDay (E: Engine, c: Chair | null | undefined, now: number, lock = false): DayNote | null {
  const ph = E.phase()
  if (!c || (ph !== 'day' && ph !== 'nap') || E.unknownMorning() || chairCard(E, c, now)) return null
  const t = tonight(c, now), last = leaveNight(c, t.n), bed = `Bedtime is ${fmt(bedTonight(E, lock).at)}.`
  if (t.place === 4) return { head: `Chair method, night ${t.n}`, line: `Say goodnight and leave the room tonight. ${bed}` }
  return { head: `Chair method, night ${t.n}${last ? ` of ${last}` : ''}`, line: `Sit ${PLACES[t.place]} tonight. ${bed}` }
}

// What the card says at bedtime, before the baby goes into the cot: where to sit, and well done
// on the nights that finish a place.
function sitLine (t: Tonight) {
  if (t.n === 1) return 'Sit right beside the cot tonight.'
  if (t.move && !t.held) return `That's ${t.n - 1} nights done! Sit ${PLACES[t.place]} tonight.`
  return `Sit ${PLACES[t.place]} again tonight.`
}
// And while the baby settles: what the parent can do from where they sit.
const settleLine = (t: Tonight, N: string) =>
  (t.place === 0 ? `You can shush, or rest a hand on ${N}. Lift your hand before ${N} nods off.` : `If ${N} gets upset, go over to pat or shush, then sit back down.`)

// The picture on Today: at bedtime, while settling, and when the baby wakes in the night.
export type Card = { eyebrow: string; place: number; done: number; ranges: string[]; hold: string; held: boolean; line: string; key: string }
export function chairCard (E: Engine, c: Chair | null | undefined, now: number): Card | null {
  if (!c || !begun(c, now)) return null
  const ph = E.phase(), live = settling(E, c, now), at = cotTap(E, c, now)
  if (!live && !at && ph !== 'waking') return null
  const t = tonight(c, now), N = E.baby.name, last = leaveNight(c, t.n)
  const canHold = t.move && !t.settled && !live && ph === 'day'
  const prev = Math.max(0, t.held ? t.place : t.place - 1)
  // A hard night before a move night: the parent can stay put, and the link is right below.
  const easy = canHold && !t.held && hard(latest(c)) ? ` Last night was hard. You can stay ${STAY[prev]} one more night if you'd like.` : ''
  const leave = at && t.move ? `You've done ${t.n - 1} nights in the chair! Say goodnight and leave the room tonight.` : 'Say goodnight and leave the room.'
  return {
    eyebrow: `Chair method, night ${t.n}${last && t.place < 4 ? ` of ${last}` : ''}`,
    place: t.place, done: t.place, ranges: t.ranges, key: t.key, held: t.held,
    hold: canHold ? (t.held ? 'Move your chair tonight' : `Stay ${STAY[prev]} one more night`) : '',
    line: t.place === 4 ? leave : ph === 'waking' ? `Sit in your chair until ${N}'s back asleep.` : live ? settleLine(t, N) : sitLine(t) + easy,
  }
}

// What is known about sleep training, each line with whose finding it is. 11 October 2026: the
// figure is a count of studies, since the share of children who improved came from a few of them.
// Each line says sleep training, since no trial tests this plan by itself.
const KNOWN = {
  most: 'Sleep training brought easier bedtimes and fewer night wakings in 49 of 52 studies. Over 2,500 babies and toddlers took part.',
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
    if (last.trips === 0) say.push(`You stayed in your chair the whole time${cry === 'none' ? ', and there was no crying at all' : cry === 'some' ? ', even through some crying' : cry === 'lot' ? ', even through a lot of crying' : ''}!`)
    else {
      if (last.trips != null && before?.trips != null && before.trips > last.trips) say.push(`You went over ${times(last.trips)}, down from ${before.trips} the night before.`)
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
