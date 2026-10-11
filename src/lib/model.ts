// What each part of the Today screen says, worked out from the engine. The screens only draw
// these, so the wording is tested here once, in plain strings.
import { DAY, HOUR, MIN, ageText, ageWeeks, atMins, band, bandFor, dayAt, engine, isMark, napHours, round5, targetFor, type Baby, type Engine, type Out, type Route, type Sleep, type Window } from './engine.ts'
import { isLocked, lockedHero, offerHero, trialNote, type Gate } from './shop.ts'
import { bigDur, bigTime, dur, fmt, hours, range, runParts, tallyDur, times, type Part } from './words.ts'

const NONE: Gate = { kind: 'none' }

export type Hero = {
  eyebrow: string
  // The question the screen asks in place of a nap time, when the morning is unknown.
  ask: string
  hot: boolean
  big: Part[]
  sub: string
  note: string
  cta: string
  upForDay: boolean
  glow: number
  // When the sleep that is running started. The timer counts from it every second.
  run: number | null
  // The line under the timer, saying what a tap on it does.
  caption: string
  // Below the timer: the link that plans the day around going out.
  outLink: string
  // Once the free week is up: the heading in place of the nap time, and the button that pays. On an
  // iPhone whose parent said Not now, the same place offers the free week.
  heading: string
  buy: string
  // The free week's last two days.
  shop: string
  // While a nap runs late in the day: the time to wake the baby, so the naps end when the parent
  // set them to. `now` once that time has come.
  wake: { at: number; now: boolean; left: string } | null
  // After a short nap with one nap left in the day: the two ways to make it up, the one the parent
  // picked last time first, and earlier bedtime first while the chair method runs.
  ways: Ways | null
  // When the log shows one nap fewer than the age on most days: today planned both ways.
  fewer: Fewer | null
}
export type Ways = { say: string; day: number; by: number; opts: { id: Route; title: string; line: string; on: boolean }[] }

function ways (E: Engine): Ways | null {
  const s = E.shortNap()
  if (!s) return null
  const more = (n: number) => (n ? `, then ${n === 1 ? 'one more' : `${n} more`}` : '')
  const line = (w: { c: number | null; more: number; bed: number }) => `${w.c == null ? 'No more naps' : `Nap at ${fmt(w.c)}${more(w.more)}`}. Bedtime ${fmt(w.bed)}.`
  const on = s.pick ?? 'sooner'
  const opts: Ways['opts'] = [
    { id: 'sooner', title: 'Nap sooner', line: line(s.sooner), on: on === 'sooner' },
    { id: 'bed', title: 'Earlier bedtime', line: line(s.bed), on: on === 'bed' },
  ]
  const today = E.baby.route && E.baby.route.day === s.day ? E.baby.route : null
  const first: Route = E.baby.chair ? 'bed' : today?.first ?? E.baby.routeLikes ?? 'sooner'
  if (first === 'bed') opts.reverse()
  return { say: 'That nap was short. Here are two ways to make it up.', day: s.day, by: s.by, opts }
}

// The naps still to come and tonight's bedtime, as one line, with anything to add between them.
function dayLine (plan: Window[], also = '') {
  const naps = plan.filter((w) => !w.bed).map((w) => fmt(w.c)), bed = plan.find((w) => w.bed)
  const list = naps.length > 1 ? `${naps.slice(0, -1).join(', ')} and ${naps[naps.length - 1]}` : naps[0]
  return `${naps.length ? `Nap${naps.length > 1 ? 's' : ''} at ${list}` : 'No more naps'}.${also ? ` ${also}` : ''}${bed ? ` Bedtime ${fmt(bed.c)}.` : ''}`
}

/* One nap fewer, offered on Today when the log shows it on 3 of the last 5 days. Each choice shows
   the rest of today planned that way. Null once neither plan has a nap left. */
export type Fewer = { say: string; n: number; opts: { id: 'fewer' | 'keep'; title: string; line: string }[] }
export function fewerNaps (E: Engine): Fewer | null {
  const f = E.fewer()
  if (!f) return null
  const now = E.plan(), then = engine({ ...E.baby, naps: f.n }, E.sleeps, E.now, E.out).plan()
  if (!now.some((w) => !w.bed) && !then.some((w) => !w.bed)) return null
  const naps = (n: number) => (n === 1 ? '1 nap' : `${n} naps`)
  // Long naps can leave the day no room for the last one, and the line says so.
  const done = E.napsSince(E.dayStart().t).filter((x) => x.e != null).length, held = done + now.filter((w) => !w.bed).length
  const room = held <= f.n ? `No room for a ${['first', 'second', 'third', 'fourth', 'fifth'][f.n]} today.` : ''
  return {
    say: `${E.baby.name} had ${naps(f.n)} on ${f.days === f.of ? 'each' : f.days} of the last ${f.of} days.`, n: f.n,
    opts: [
      { id: 'fewer', title: `${naps(f.n)} a day`, line: dayLine(then) },
      { id: 'keep', title: `Keep ${naps(f.n + 1)}`, line: dayLine(now, room) },
    ],
  }
}

// Tonight's bedtime, while the baby is up: the plan's own, or brought forward when the day's naps
// ran short. Today's list and the chair method both say this one. With the nap times locked it is
// the usual bedtime.
export function bedTonight (E: Engine, lock = false): { at: number; early: boolean } {
  const mk = lock ? null : E.makeUp(), pb = lock ? undefined : E.plan().find((w) => w.bed)
  return { at: mk && mk.kind === 'late' ? mk.early : pb ? pb.c : E.budget().bedT, early: (!!mk && mk.kind === 'late') || !!pb?.early }
}

export function hero (E: Engine, g: Gate = NONE): Hero {
  const N = E.baby.name, ph = E.phase(), c = E.cur(), now = E.now
  const h: Hero = { eyebrow: '', ask: '', hot: false, big: [], sub: '', note: '', cta: '', upForDay: false, glow: 0, run: null, caption: '', outLink: '', heading: '', buy: '', shop: trialNote(g, now), wake: null, ways: null, fewer: null }
  if (ph === 'day' && E.dayStart().unknown) {
    Object.assign(h, { eyebrow: 'Today', ask: `When did ${N} wake up this morning?`, sub: isLocked(g) ? '' : 'Baby Nap Track works out the next nap from there.', cta: 'Save' })
  } else if (ph === 'day' && (g.kind === 'locked' || g.kind === 'offer')) {
    // Logging stays free: the button that starts a sleep is where it always is.
    const lw = E.lastWake(), L = g.kind === 'offer' ? offerHero(g.price) : lockedHero(g.price)
    Object.assign(h, { eyebrow: now - lw < MIN ? 'Just woke' : `Awake ${dur(now - lw)}`, heading: L.heading, sub: L.sub, buy: L.buy, cta: `${N} fell asleep` })
  } else if (ph === 'day') {
    const mk = E.makeUp(), w = E.plan()[0], lw = E.lastWake()
    h.cta = `${N} fell asleep`
    if (mk && mk.kind === 'by') {
      Object.assign(h, { eyebrow: 'Nap needed today', hot: true, big: bigDur(mk.need), glow: 0.7, sub: `Get ${N} down by ${fmt(mk.by)}. A nap in the car or the buggy counts.` })
    } else if (mk && mk.kind === 'now') {
      Object.assign(h, { eyebrow: 'Nap needed now', hot: true, big: bigDur(mk.need), glow: 1, sub: `Get ${N} to sleep now. A nap in the car or the buggy counts.` })
    } else if (mk && mk.kind === 'late') {
      const close = mk.early + 15 * MIN
      if (now < mk.early - 15 * MIN) Object.assign(h, { eyebrow: 'Early bedtime', big: bigTime(mk.early), sub: `${N} had ${dur(mk.B.so)} of naps today. Bed half an hour early helps make up the rest.` })
      else if (now <= close) Object.assign(h, { eyebrow: 'Early bedtime', hot: true, big: [{ n: 'Now' }], sub: `Put ${N} down before ${fmt(close)}.`, glow: 1 })
      else Object.assign(h, { eyebrow: 'Bedtime', hot: true, big: [{ n: 'Now' }], sub: `The window closed at ${fmt(close)}. Put ${N} down as soon as you can.`, glow: 0.6 })
    } else if (w && w.car && E.out) {
      const o = E.out
      if (now < w.s) Object.assign(h, { eyebrow: `Leave in ${dur(o.leave - now)}`, big: bigTime(o.leave), sub: `${N} will be ready for a nap in the car.`, glow: Math.max(0, 1 - (w.s - now) / (75 * MIN)) })
      else if (now <= w.e) Object.assign(h, { eyebrow: 'Time to go', hot: true, big: [{ n: 'Now' }], sub: now < o.leave ? `Get in the car by ${fmt(o.leave)}. ${N} can sleep on the way.` : `Leave now. ${N} can sleep on the way.`, glow: 1 })
      else Object.assign(h, { eyebrow: 'Nap in the car', hot: true, big: [{ n: 'Now' }], sub: `The window closed at ${fmt(w.e)}. ${N} can still sleep on the way.`, glow: 0.6 })
      h.note = now - lw < MIN ? 'Just woke' : `Awake ${dur(now - lw)}`
    } else if (w) {
      const nm = w.bed ? 'Bedtime' : w.cat ? 'Short nap' : 'Nap window'
      if (now < w.s) Object.assign(h, { eyebrow: `${nm} in ${dur(w.s - now)}`, big: bigTime(w.c), sub: `Put ${N} down between ${range(w.s, w.e)}.`, glow: Math.max(0, 1 - (w.s - now) / (75 * MIN)) })
      else if (now <= w.e) Object.assign(h, { eyebrow: w.bed ? 'Bedtime window open' : 'Nap window open', hot: true, big: [{ n: 'Now' }], sub: `Put ${N} down before ${fmt(w.e)}.`, glow: 1 })
      else Object.assign(h, {
        eyebrow: w.bed ? 'Bedtime' : 'Nap time', hot: true, big: [{ n: 'Now' }], glow: 0.6,
        sub: w.bed ? `The window closed at ${fmt(w.e)}. Put ${N} down as soon as you can.` : `The window closed at ${fmt(w.e)}. Put ${N} down as soon as you can. A nap in the car or the buggy counts.`,
      })
      h.note = now - lw < MIN ? 'Just woke' : `Awake ${dur(now - lw)}`
      h.ways = ways(E)
      if (!h.ways) h.fewer = fewerNaps(E)
    }
  } else if (ph === 'nap' && c) {
    Object.assign(h, { eyebrow: 'Napping', big: runParts(now - c.s).parts, run: c.s, cta: `${N} woke up`, sub: `Fell asleep at ${fmt(c.s)}.` })
    const wa = isLocked(g) ? null : E.wakeAt()
    if (wa != null) h.wake = { at: wa, now: now >= wa, left: now >= wa ? `Bedtime is ${fmt(E.budget().bedT)}` : `in ${dur(wa - now)}` }
  } else if (ph === 'night' && c) {
    const segs = E.nightSegs(), wakes = segs.length - 1
    Object.assign(h, {
      eyebrow: 'Asleep', big: runParts(now - c.s).parts, run: c.s, cta: `${N} woke up`,
      sub: wakes ? `Since ${fmt(c.s)}. Down for the night at ${fmt(segs[0].s)} and woke ${times(wakes)}.` : `Down for the night at ${fmt(segs[0].s)}.`,
    })
  } else {
    const l = E.sleeps[E.sleeps.length - 1]
    Object.assign(h, { eyebrow: 'Awake in the night', big: bigTime(l.e!), sub: now - l.e! < MIN ? 'Woke just now.' : `Awake ${dur(now - l.e!)}.`, cta: 'Back asleep', upForDay: E.morning() })
  }
  if (!h.ask) h.caption = h.run != null ? `Tap when ${N} wakes up.` : ph === 'waking' && !napHours(E.baby, now) ? `Tap when ${N} is back asleep.` : `Tap when ${N} falls asleep.`
  if (((ph === 'day' && !E.dayStart().unknown && !isLocked(g)) || ph === 'nap') && E.bedOf(E.dayStart().t) - now > 2 * HOUR) {
    h.outLink = E.activeOut() ? `Going out at ${fmt(E.out!.leave)}. Change the plan` : 'Going out later? Plan the naps around it'
  }
  if (h.glow < 0.15) h.glow = 0
  return h
}

// A bar on the day's graph: a sleep, the one running, a nap planned, the time out, or a stretch
// with no nap logged in it.
export type Block = { s: number; e: number; run?: boolean; plan?: boolean; out?: boolean; gap?: boolean; inOut?: boolean }
export type Ribbon = { blocks: Block[]; labels: { at: number; text: string; plan?: boolean; out?: boolean; edge?: 'l' | 'r' }[]; planned: boolean; outs: boolean; gaps: boolean }
export type DaySleep = Ribbon & { so: Part[]; of: string; t0: number; t1: number; say: string }

// Roughly how wide a time label is, as a share of the graph's width on a phone.
const labelWidth = (t: string) => t.length * 2.1 + 2

export function daySleep (E: Engine, g: Gate = NONE): DaySleep {
  const N = E.baby.name, ph = E.phase(), target = E.aim().min * MIN, now = E.now, out = E.out
  let so: number, t0: number, t1: number, blocks: Block[], say: string
  if (ph === 'night' || ph === 'waking') {
    // The day's naps stay on the graph after bedtime, with any stretch that has none logged.
    const nd = E.nightDay()
    so = nd.so; t0 = nd.t0; t1 = nd.ns
    blocks = nd.naps.map((x) => ({ s: x.s, e: x.e! }))
    for (const [a, z] of E.gapsIn(nd.t0, nd.ns, nd.naps)) blocks.push({ s: a, e: z, gap: true })
    if (out && out.leave >= t0 && out.leave < nd.ns) blocks.unshift({ s: out.leave, e: out.home, out: true })
    say = `${nd.today ? "Today's" : "Yesterday's"} naps came to ${dur(so)}.`
  } else {
    const lock = isLocked(g)
    const B = E.budget(), mk = lock ? null : E.makeUp(), ds = E.dayStart(), pl = lock ? [] : E.planNaps(), naps = E.napsSince(ds.t)
    const outBlock: Block | null = out && out.leave >= ds.t ? { s: out.leave, e: out.home, out: true } : null
    so = B.so
    if (lock) say = so ? `${N} has had ${dur(so)} of naps today.` : `No naps logged yet today.`
    else if (E.activeOut()) say = `The plan for going out gives ${N} ${dur(E.outPlan().total)} of day sleep.`
    else if (B.rem < 5 * MIN) say = `${N} has had ${hours(B.target)} of day sleep today.`
    else if (mk && mk.kind === 'late') say = `${N} is ${dur(B.rem)} short of ${hours(B.target)} today.`
    else if (mk) say = `${N} needs ${dur(B.rem)} more to make ${hours(B.target)}.`
    else if (E.wakeAt() != null && E.wakeAt()! > now) say = `${N}'s day sleep comes to ${dur(so + E.wakeAt()! - now)} with a wake-up at ${fmt(E.wakeAt()!)}.`
    // 11 October 2026: a nap at 6pm read `2 h 33 min to go before bed at 7pm`, more than the hour left.
    else if (E.cur() && B.rem > B.bedT - now) say = `${N} is ${dur(B.rem)} short of ${hours(B.target)} today.`
    else if (E.cur()) say = `${dur(B.rem)} to go before bed at ${fmt(B.bedT)}.`
    else if (pl.length > 1) say = `${dur(B.rem)} to go, across ${pl.length} more naps.`
    else if (pl.length === 1) say = `${dur(B.rem)} to go. Aim for that in the next nap.`
    else say = `${dur(B.rem)} to go before bed at ${fmt(B.bedT)}.`
    blocks = naps.map((x) => ({ s: x.s, e: x.e ?? now, run: x.e == null }))
    const wa = lock ? null : E.wakeAt()
    if (wa != null && wa > now) blocks.push({ s: now, e: wa, plan: true })
    for (const [a, z] of E.gapsIn(ds.t, null, naps.filter((x) => x.e != null))) blocks.push({ s: a, e: z, gap: true })
    if (outBlock) blocks.unshift(outBlock)
    for (const p of pl) {
      const st = p.mk ? (p.mk.kind === 'by' ? Math.max(now, p.mk.by - 30 * MIN) : now) : p.w!.c
      blocks.push({ s: st, e: st + p.aim, plan: true, inOut: !!outBlock && st >= outBlock.s && st < outBlock.e })
    }
    t0 = ds.t
    const pbw = lock ? undefined : E.plan().find((w) => w.bed)
    const bed = mk && mk.kind === 'late' ? mk.early : pbw && pbw.early ? pbw.c : B.bedT
    t1 = Math.max(bed, ...blocks.map((x) => x.e))
  }
  return { so: tallyDur(so), of: `of ${hours(target)}`, t0, t1, ...ribbon(t0, t1, blocks), say }
}

// The graph's bars as shares of its width, with the times of the naps ahead and the time out
// written under them where they fit, and the ends of the day when nothing is planned.
export function ribbon (t0: number, t1: number, blocks: Block[]) {
  const pc = (t: number) => Math.max(0, Math.min(100, ((t - t0) / (t1 - t0)) * 100))
  const kept: { a0: number; a1: number }[] = []
  const fits = (a0: number, a1: number) => kept.every((k) => a1 <= k.a0 || a0 >= k.a1)
  const labels: DaySleep['labels'] = []
  for (const k of blocks) {
    if (!((k.plan && !k.inOut) || k.out)) continue
    const text = k.out ? 'Out' : fmt(k.s), x = pc(k.s), w = labelWidth(text)
    if (x + w <= 100 && fits(x, x + w)) { kept.push({ a0: x, a1: x + w }); labels.push({ at: x, text, plan: k.plan, out: k.out }) }
  }
  const lt = fmt(t0), rt = fmt(t1), ends = !blocks.some((x) => x.plan && !x.inOut)
  if (ends && fits(0, labelWidth(lt))) { kept.push({ a0: 0, a1: labelWidth(lt) }); labels.push({ at: 0, text: lt, edge: 'l' }) }
  if (ends && fits(100 - labelWidth(rt), 100)) labels.push({ at: 100, text: rt, edge: 'r' })
  return {
    blocks: blocks.map((b) => ({ ...b, s: pc(b.s), e: pc(b.e) })),
    labels, planned: blocks.some((x) => x.plan), outs: blocks.some((x) => x.out), gaps: blocks.some((x) => x.gap),
  }
}

export type Row = { mark: 'edge' | 'done' | 'plan' | 'next' | 'gap' | 'out'; title: string; sub?: string; right: string; edit?: string; wake?: boolean; gap?: [number, number]; out?: boolean; night?: boolean; at: number }

export function todayRows (E: Engine, g: Gate = NONE): { heading: string; rows: Row[] } {
  const N = E.baby.name, ph = E.phase(), now = E.now, rows: Row[] = [], out = E.out
  // The row asks, and Yes and No under it answer, from 1.0.28. Up to 1.0.27 it could only be added to.
  const gapRow = ([a, z]: [number, number]): Row => ({ at: a + 1, mark: 'gap', title: `Nothing logged ${range(a, z, ' to ')}`, sub: `Did ${N} nap in there?`, right: '', gap: [a, z] })
  const outRows = (t0: number) => {
    if (!out || out.leave < t0) return
    if (E.activeOut()) {
      rows.push({ at: out.leave, mark: 'out', title: 'Leave', sub: `awake from ${fmt(E.outPlan().up)}`, right: fmt(out.leave), out: true })
      rows.push({ at: out.home, mark: 'out', title: 'Home', right: fmt(out.home), out: true })
    } else rows.push({ at: out.leave, mark: 'out', title: 'Out', sub: range(out.leave, out.home, ' to '), right: '' })
  }
  const sorted = () => rows.sort((a, b) => a.at - b.at)
  // A tap of the timer to add a nap, waiting for its times. A tap opens it.
  const tapRow = (x: Sleep): Row => ({ at: x.s, mark: 'edge', title: 'Nap, set the times', right: fmt(x.s), edit: x.id })
  if (ph === 'night' || ph === 'waking') {
    // The day stays on the list after bedtime, so a nap can still be seen and fixed.
    const segs = E.nightSegs(), nd = E.nightDay()
    if (nd.up) rows.push({ at: nd.t0, mark: 'edge', title: 'Up for the day', right: fmt(nd.t0), edit: isMark(nd.up) ? undefined : nd.up.id })
    for (const x of nd.naps) rows.push({ at: x.s, mark: 'done', title: 'Nap', sub: range(x.s, x.e!, ' to '), right: dur(x.e! - x.s), edit: x.id })
    for (const gp of E.gapsIn(nd.t0, nd.ns, nd.naps)) rows.push(gapRow(gp))
    for (const x of E.taps()) rows.push(tapRow(x))
    outRows(nd.t0)
    rows.push({ at: segs[0].s, mark: 'edge', title: 'Down for the night', right: fmt(segs[0].s), edit: segs[0].id })
    segs.forEach((x, j) => {
      if (x.e == null) return
      const nx = segs[j + 1]
      rows.push({ at: x.e, mark: 'edge', title: 'Woke', sub: nx ? `back down after ${dur(nx.s - x.e)}` : 'awake now', right: fmt(x.e), edit: x.id })
    })
    return { heading: nd.today ? 'Today' : 'Yesterday and tonight', rows: sorted() }
  }
  const lock = isLocked(g), ds = E.dayStart(), mk = lock ? null : E.makeUp(), B = E.budget(), naps = E.napsSince(ds.t)
  // Last night sits above the morning, and a tap on it opens the whole night to change.
  const ln = E.lastNight()
  if (ln) rows.push(ln.logged
    ? { at: ln.segs[0].s, mark: 'done', title: 'Last night', sub: `${range(ln.segs[0].s, ds.t, ' to ')}${ln.wakes ? `, woke ${times(ln.wakes)}` : ''}`, right: dur(ln.asleep), night: true }
    : { at: ds.t - 1, mark: 'edge', title: 'Last night', sub: 'Not logged', right: 'Add', night: true })
  rows.push({ at: ds.t, mark: 'edge', title: ds.up && !isMark(ds.up) ? 'Up for the day' : 'Woke up', right: fmt(ds.t), wake: true })
  for (const x of naps) {
    rows.push(x.e == null
      ? { at: x.s, mark: 'done', title: 'Napping', sub: `since ${fmt(x.s)}`, right: dur(now - x.s), edit: x.id }
      : { at: x.s, mark: 'done', title: 'Nap', sub: range(x.s, x.e, ' to '), right: dur(x.e - x.s), edit: x.id })
  }
  for (const x of E.taps()) rows.push(tapRow(x))
  const wa = lock ? null : E.wakeAt()
  if (wa != null) rows.push({ at: Math.max(wa, now), mark: 'next', title: 'Optional wake', sub: 'Some parents wake now to leave a gap before bedtime', right: now >= wa ? 'now' : fmt(wa) })
  for (const gp of E.gapsIn(ds.t, null, naps.filter((x) => x.e != null))) rows.push(gapRow(gp))
  ;(lock ? [] : E.planNaps()).forEach((p, j) => {
    if (p.mk) rows.push({ at: now, mark: 'next', title: 'Nap needed', sub: p.mk.kind === 'by' ? `down by ${fmt(p.mk.by)}` : 'now', right: dur(p.aim) })
    else {
      const w = p.w!
      if (w.car) rows.push({ at: w.c, mark: j === 0 ? 'next' : 'plan', title: 'Nap in the car', sub: `from about ${fmt(w.c)}`, right: `aim for ${dur(p.aim)}` })
      else rows.push({
        at: w.c,
        mark: j === 0 ? 'next' : 'plan',
        title: j === 0 ? (w.cat ? 'Short nap next' : 'Next nap') : w.cat ? 'Short nap' : 'Nap',
        sub: j === 0 ? range(w.s, w.e, ' to ') : `about ${fmt(w.c)}`,
        right: `aim for ${dur(p.aim)}`,
      })
    }
  })
  outRows(ds.t)
  const bed = bedTonight(E, lock)
  rows.push({ at: Math.max(bed.at, now), mark: 'edge', title: bed.early ? 'Early bedtime' : 'Bedtime', right: fmt(bed.at) })
  return { heading: 'Today', rows: sorted() }
}

// The week shows from the first day, today included. The averages wait for three whole days.
export type Week = { empty: true } | { empty: false; rows: { label: string; value: number; text: string; today?: boolean }[]; max: number; target: number; key: string; avg: { day: Part[]; night: Part[] } | null }

export function week (E: Engine): Week {
  const days = E.pastDays(), ph = E.phase(), night = ph === 'night' || ph === 'waking'
  const nd = night ? E.nightDay() : null
  const todayValue = nd ? nd.so : E.budget().so
  if (!days.length && !todayValue) return { empty: true }
  const target = E.aim().min * MIN
  // At night the day just gone is the top row, and the list below it starts the day before.
  const topT = nd ? nd.t0 : E.dayStart().t
  const list = [{ label: new Date(topT).getDate() === new Date(E.now).getDate() ? 'Today' : 'Yesterday', value: todayValue, today: true }]
  for (const d of [...days].reverse()) {
    if (nd && d.wake === nd.t0) continue
    const dt = new Date(d.wake)
    list.push({ label: `${dt.toLocaleDateString('en-IE', { weekday: 'short' })} ${dt.getDate()}`, value: d.day, today: false })
  }
  const rows = list.slice(0, 7).map((r) => ({ ...r, text: dur(r.value) }))
  const max = Math.max(target * 1.25, ...rows.map((r) => r.value))
  const key = `The line marks ${hours(target)} of day sleep.`
  if (days.length < 3) return { empty: false, rows, max, target, key, avg: null }
  const dayAvg = days.reduce((a, d) => a + d.day, 0) / days.length
  // A morning typed in without its night has nothing to add, so it stays out of the average.
  const nights = days.map((d) => E.sleeps.filter((x) => x.kind === 'night' && x.e != null && x.e <= d.wake && x.s >= d.wake - 14 * HOUR).reduce((a, x) => a + x.e! - x.s, 0)).filter((x) => x > 0)
  const nightAvg = nights.length ? nights.reduce((a, x) => a + x, 0) / nights.length : 0
  return { empty: false, rows, max, target, key, avg: { day: tallyDur(dayAvg), night: tallyDur(nightAvg) } }
}

/* The plan for going out, as the sheet shows it before it is saved. */
export type OutView = { answer: { eyebrow: string; big: Part[] } | null; rib: Ribbon; rows: Row[]; long: string; total: string }

export function outView (E: Engine, o: Out): OutView {
  const N = E.baby.name, now = E.now, P = E.outPlan(o), ds = E.dayStart(), rows: Row[] = []
  const bw = P.wins.find((w) => w.bed) ?? { c: E.bedOf(ds.t), early: false }
  rows.push({ at: ds.t, mark: 'edge', title: ds.up && !isMark(ds.up) ? 'Up for the day' : 'Woke up', right: fmt(ds.t) })
  for (const x of E.napsSince(ds.t)) rows.push({ at: x.s, mark: 'done', title: x.e == null ? 'Napping' : 'Nap', sub: x.e == null ? `since ${fmt(x.s)}` : range(x.s, x.e, ' to '), right: dur((x.e ?? now) - x.s) })
  for (const w of P.wins) {
    if (w.bed) continue
    const moved = !w.car && w.c < o.leave && w.diff && Math.abs(w.diff) >= 10 ? `, ${dur(Math.abs(w.diff) * MIN)} ${w.diff < 0 ? 'earlier' : 'later'} than usual` : ''
    rows.push({ at: w.c, mark: 'plan', title: w.car ? 'Nap in the car' : w.cat ? 'Short nap' : 'Nap', sub: `about ${dur(w.len! * MIN)}${moved}`, right: fmt(w.c) })
  }
  rows.push({ at: o.leave, mark: 'out', title: 'Leave', sub: `awake from ${fmt(P.up)}`, right: fmt(o.leave) })
  rows.push({ at: o.home, mark: 'out', title: 'Home', right: fmt(o.home) })
  rows.push({ at: bw.c, mark: 'edge', title: bw.early ? 'Early bedtime' : 'Bedtime', right: fmt(bw.c) })
  rows.sort((a, b) => a.at - b.at)
  const blocks: Block[] = [{ s: o.leave, e: o.home, out: true }]
  for (const x of E.napsSince(ds.t)) blocks.push({ s: x.s, e: x.e ?? now, run: x.e == null })
  for (const w of P.wins) if (!w.bed) blocks.push({ s: w.c, e: w.c + w.len! * MIN, plan: true, inOut: w.c >= o.leave && w.c < o.home })
  const nx = P.wins.find((w) => !w.bed && w.c + 10 * MIN >= now)
  let answer: OutView['answer'] = null
  if (nx) {
    const t = nx.car ? o.leave : nx.c, left = t - now
    answer = { eyebrow: nx.car ? (left > MIN ? `Leave in ${dur(left)}` : 'Leave now') : left > MIN ? `Next nap in ${dur(left)}` : 'Next nap now', big: bigTime(t) }
  }
  return {
    answer, rib: ribbon(ds.t, bw.c, blocks), rows,
    long: P.long ? `${N} will be awake ${dur(P.long)} by the time you're home. A nap in the car would help.` : '',
    total: `${dur(P.total)} of day sleep on this plan. The aim is ${hours(E.aim().min * MIN)}.`,
  }
}

// A first plan for going out: 3pm, or an hour from now if that is later, home an hour and a half
// after, the nap in the car.
const ceil15 = (t: number) => Math.ceil(t / (15 * MIN)) * 15 * MIN
export function clampOut (E: Engine, o: Out): Out {
  const bedT = E.bedOf(E.dayStart().t)
  const leave = Math.min(Math.max(o.leave, ceil15(E.now + 15 * MIN)), bedT - 90 * MIN)
  return { ...o, leave, home: Math.min(Math.max(o.home, leave + 15 * MIN), bedT - 15 * MIN) }
}
export function outDraft (E: Engine): Out {
  if (E.out && E.activeOut()) return clampOut(E, E.out)
  let l = dayAt(E.now, 15, 0)
  if (l < ceil15(E.now + HOUR)) l = ceil15(E.now + HOUR)
  return clampOut(E, { leave: l, home: l + 90 * MIN, mode: 'car' })
}

export const ageLine = (E: Engine) => `${ageText(E.baby, E.now)} old`

// What a tap on the main button does. Returns the change to the log and the toast.
export type Action =
  // `back` is the baby asleep again before the usual wake-up, which is no bedtime.
  | { kind: 'add'; sleep: Omit<Sleep, 'id' | 'updatedAt'>; toast: string; back?: boolean }
  | { kind: 'end'; id: string; up: boolean; toast: string }
  | { kind: 'ask'; id: string }

export function mainAction (E: Engine): Action {
  const N = E.baby.name, ph = E.phase(), now = E.now
  if (ph === 'day') {
    const k = E.startKind()
    return { kind: 'add', sleep: { s: now, e: null, kind: k.kind, up: false }, back: k.back, toast: k.kind === 'nap' ? `Nap started at ${fmt(now)}.` : k.back ? `Back asleep at ${fmt(now)}.` : `Down for the night at ${fmt(now)}.` }
  }
  // In the day a tap starts a nap, and the waking before it becomes up for the day.
  if (ph === 'waking' && napHours(E.baby, now)) return { kind: 'add', sleep: { s: now, e: null, kind: 'nap', up: false }, toast: `Nap started at ${fmt(now)}.` }
  if (ph === 'waking') return { kind: 'add', sleep: { s: now, e: null, kind: 'night', up: false }, toast: `Back asleep at ${fmt(now)}.` }
  const c = E.cur()!
  if (c.kind === 'nap') return { kind: 'end', id: c.id, up: false, toast: `Nap ended. ${N} slept ${dur(now - c.s)}.` }
  if (E.morning()) return { kind: 'ask', id: c.id }
  return { kind: 'end', id: c.id, up: false, toast: `${N} woke at ${fmt(now)}.` }
}

// The notice on the lock screen while a sleep runs. It says when the sleep started, and the Today
// screen has the count.
export function sleepNotice (E: Engine): { title: string; body: string } | null {
  const N = E.baby.name, ph = E.phase(), c = E.cur()
  if (!c) return null
  const wa = E.wakeAt()
  if (ph === 'nap') return { title: `${N} is napping`, body: wa != null ? `Fell asleep at ${fmt(c.s)}. Optional wake at ${fmt(wa)}.` : `Fell asleep at ${fmt(c.s)}.` }
  return { title: `${N} is asleep`, body: E.nightSegs().length > 1 ? `Back down at ${fmt(c.s)}.` : `Down for the night at ${fmt(c.s)}.` }
}

// The reminder to schedule: the next window, less the lead time, or the time to wake the baby
// from a nap running late. Nothing overnight.
export function reminder (E: Engine, leadMin: number): { at: number; title: string; body: string } | null {
  const wa = E.wakeAt(), c = E.cur()
  if (wa != null && c) return { at: wa, title: 'Optional wake', body: `Some parents wake at this point to leave enough of a gap before bedtime. ${E.baby.name} has slept ${dur(wa - c.s)} and bedtime is ${fmt(E.budget().bedT)}.` }
  if (E.phase() !== 'day' || E.dayStart().unknown) return null
  const N = E.baby.name, mk = E.makeUp(), p = E.plan()[0]
  if (mk && mk.kind === 'by') return { at: mk.by - leadMin * MIN, title: `${N} needs a nap`, body: `Get ${N} down by ${fmt(mk.by)} for ${dur(mk.need)}. A nap in the car or the buggy counts.` }
  if (mk && mk.kind === 'late') return { at: mk.early - leadMin * MIN, title: 'Early bedtime', body: `Bed at ${fmt(mk.early)} tonight helps make up the day's naps.` }
  if (mk) return null
  if (!p) return null
  return p.bed
    ? { at: p.s - leadMin * MIN, title: `Bedtime at ${fmt(p.c)}`, body: `Put ${N} down between ${range(p.s, p.e)}.` }
    : { at: p.s - leadMin * MIN, title: `Nap window opens at ${fmt(p.s)}`, body: `Put ${N} down between ${range(p.s, p.e)}.` }
}

export const isWindow = (w: Window) => !w.bed
export { DAY }

// The times an added nap starts with: one wake window after the last thing logged, an hour long,
// and over by now.
export function napDraft (baby: Baby, from: number, now: number) {
  const b = bandFor(baby, ageWeeks(baby, now)), top = Math.floor(now / (5 * MIN)) * 5 * MIN
  let s = round5(from + b.min * MIN), e = s + 60 * MIN
  if (e > top) { e = top; s = Math.max(from, Math.min(s, e - 45 * MIN)) }
  return { s, e }
}

// The nap a gap row opens: inside the stretch, one wake window in, as long as the baby's usual
// first nap, and over a quarter of an hour before the stretch ends.
export function gapDraft (E: Engine, a: number, z: number) {
  const b = bandFor(E.baby, ageWeeks(E.baby, a)), len = Math.max(20, Math.min(E.napLen(0), (z - a) / MIN - b.min - 15))
  const s = round5(a + b.min * MIN), e = Math.min(s + len * MIN, z - 15 * MIN)
  return { s, e }
}

// The toast after the morning is saved: the next time to put the baby down, from the new log.
export function savedLine (E: Engine | null, g: Gate = NONE) {
  const nx = E && !isLocked(g) && E.phase() === 'day' && !E.dayStart().unknown ? E.plan()[0] : null
  return nx ? `Saved. ${nx.bed ? 'Bedtime' : 'Next nap'} ${fmt(nx.c)}.` : 'Saved.'
}

/* Last night, as the sheet that changes it holds it: when the baby went down, each time the baby
   woke and went back down, and up for the day. A night that was not logged starts at the usual
   bedtime. */
export type NightDraft = { down: number; wakes: { w: number; b: number }[]; up: number }
type LastNight = NonNullable<ReturnType<Engine['lastNight']>>

export function nightDraft (E: Engine): NightDraft | null {
  const ln = E.lastNight()
  if (!ln) return null
  const up = ln.segs[ln.segs.length - 1].e!
  if (!ln.logged) {
    let down = atMins(up - 12 * HOUR, E.baby.bed)
    if (ln.before != null && down <= ln.before) down = round5(ln.before + 30 * MIN)
    return { down, wakes: [], up }
  }
  return { down: ln.segs[0].s, wakes: ln.segs.slice(1).map((x, k) => ({ w: ln.segs[k].e!, b: x.s })), up }
}

// Every time in the night, in order from going down to up for the day.
const nightTimes = (d: NightDraft) => [d.down, ...d.wakes.flatMap((x) => [x.w, x.b]), d.up]

// A time picked on the clock goes on whichever day puts it nearest the time it replaces, so a
// waking moved from 11:40pm to 12:10am crosses midnight and a bedtime moved to 8pm stays the
// evening before.
export function nightPick (cur: number, h: number, m: number) {
  return [-DAY, 0, DAY].map((k) => dayAt(cur + k, h, m)).reduce((a, b) => (Math.abs(b - cur) < Math.abs(a - cur) ? b : a))
}

// A waking goes in the middle of the longest stretch of sleep, a quarter of an hour long.
export function nightAddWake (d: NightDraft): NightDraft {
  const t = nightTimes(d)
  let k = 0
  for (let i = 0; i < t.length - 1; i += 2) if (t[i + 1] - t[i] > t[k + 1] - t[k]) k = i
  const a = t[k], z = t[k + 1], toMin = (x: number) => Math.round(x / MIN) * MIN
  const w = z - a >= 45 * MIN ? round5(a + (z - a) / 2) : toMin(a + (z - a) / 3), b = z - a >= 45 * MIN ? w + 15 * MIN : toMin(a + (2 * (z - a)) / 3)
  return { ...d, wakes: [...d.wakes, { w, b }].sort((x, y) => x.w - y.w) }
}

export const nightAsleep = (d: NightDraft) => { const t = nightTimes(d); let a = 0; for (let i = 0; i < t.length - 1; i += 2) a += t[i + 1] - t[i]; return a }

export const nightSum = (d: NightDraft) => `${dur(nightAsleep(d))} asleep${d.wakes.length ? `, woke ${times(d.wakes.length)}` : ''}`

// What stops the night being saved, said so the parent knows which time to move. Empty when it
// can be saved.
export function nightProblem (ln: LastNight, d: NightDraft, now: number) {
  const t = nightTimes(d)
  for (let i = 1; i < t.length; i++) if (t[i] <= t[i - 1]) return 'Each time has to come after the one above it.'
  if (d.up > now + MIN) return 'Up for the day has to be before now.'
  if (ln.before != null && d.down < ln.before) return `The last nap ended at ${fmt(ln.before)}. Down for the night has to come after that.`
  if (ln.after != null && d.up > ln.after) return `The first nap today started at ${fmt(ln.after)}. Up for the day has to come before that.`
  return ''
}

// The night as stretches of sleep, ready to save. Each stretch keeps the id of the one it replaces,
// so a shared log changes the same rows, and a stretch the night no longer has is deleted.
export function nightSave (ln: LastNight, d: NightDraft, newId: () => string): { save: Sleep[]; gone: string[] } {
  const starts = [d.down, ...d.wakes.map((x) => x.b)], ends = [...d.wakes.map((x) => x.w), d.up], at = Date.now()
  const save = starts.map((s, k): Sleep => ({ ...ln.segs[k], id: ln.segs[k]?.id ?? newId(), s, e: ends[k], kind: 'night', up: k === starts.length - 1, updatedAt: at }))
  return { save, gone: ln.segs.slice(starts.length).map((x) => x.id) }
}

/* Settings: the day sleep aim, and where it comes from. */
export function aimNote (E: Engine): string {
  const N = E.baby.name, a = E.aim(), most = `Most babies at ${ageText(E.baby, E.now)} sleep about ${hours(targetFor(E.age()) * MIN)} in the day.`
  if (a.set) return `You set this. ${most}`
  if (a.night == null) return `${most} Once 3 nights are logged, the aim moves with ${N}'s nights.`
  return `${N} slept ${dur(a.night * MIN)} a night this week, so the aim is ${hours(a.min * MIN)}. It moves with ${N}'s nights until you change it.`
}

/* Settings: the wake window before each nap, and which ones the parent set. */
export function windowsNote (E: Engine): string {
  const N = E.baby.name, n = E.band().naps, set = Array.from({ length: n }, (_, k) => k).filter((k) => E.windowOf(k).set)
  if (!set.length) return `Baby Nap Track works these out from ${N}'s age and the naps that went well this week. Change one and it stays where you put it.`
  const which = set.map((k) => `nap ${k + 1}`), list = which.length > 1 ? `${which.slice(0, -1).join(', ')} and ${which[which.length - 1]}` : which[0]
  const rest = set.length < n ? ` The others move with ${N}'s naps.` : ''
  return `You set the window${set.length > 1 ? 's' : ''} before ${list}.${rest} After a nap under 40 minutes, the next nap still comes sooner.`
}
