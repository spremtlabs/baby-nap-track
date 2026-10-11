/// <reference types="node" />
// The plan keeping up with the baby, from 1.0.23: a third nap that no longer fits stays in as a
// short one, the day sleep aim follows the last week of nights, Today offers one nap fewer when the
// log shows it, and a wake window the parent sets stays where they put it.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DAY, MIN, aimOf, engine, readLog, round5, type Baby, type Sleep } from '../src/lib/engine.ts'
import { aimNote, hero, windowsNote } from '../src/lib/model.ts'
import { T0, at, sleep } from './sample.ts'

const ymd = (t: number) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
// Six months old, three naps a day, up at 7 and down at 7, with no aim set.
const baby = (days: number, more: Partial<Baby> = {}): Baby => ({ name: 'Oisín', born: ymd(T0 - days * DAY), due: '', wake: 420, bed: 1140, target: 180, ...more })
const night = (d: number, down: [number, number], up: [number, number]) => sleep(at(d - 1, ...down), at(d, ...up), 'night', true)

test('at 26 weeks a third nap too late to fit is a short nap over by 5pm, not five hours awake', () => {
  const E = engine(baby(183), [night(0, [19, 0], [7, 0])], at(0, 7, 1))
  const naps = E.plan().filter((w) => !w.bed)
  assert.deepEqual(naps.map((w) => w.c), [at(0, 9, 10), at(0, 12, 40), at(0, 16, 20)])
  assert.equal(naps[2].cat, true)
  assert.ok(naps[2].c + 30 * MIN <= at(0, 17, 0))
  assert.equal(E.plan().at(-1)?.c, at(0, 19, 0))
})

test('the aim follows the last week of nights, by up to half an hour either way', () => {
  const nights = (down: [number, number], up: [number, number], n = 4) => Array.from({ length: n }, (_, i) => night(-i, down, up))
  const aim = (log: Sleep[], b = baby(190)) => aimOf(b, readLog(b, log), at(0, 9, 0))
  // Most babies at six months sleep 3 hours in the day and 11 at night.
  assert.deepEqual(aim(nights([20, 0], [7, 0])), { min: 180, set: false, night: 660 })
  assert.deepEqual(aim(nights([20, 0], [6, 0])), { min: 210, set: false, night: 600 })
  assert.deepEqual(aim(nights([19, 0], [6, 30])), { min: 150, set: false, night: 690 })
  // A waking in the night counts against it.
  const waking = [0, -1, -2].flatMap((d) => [sleep(at(d - 1, 19, 30), at(d, 1, 0), 'night'), sleep(at(d, 2, 0), at(d, 6, 30), 'night', true)])
  assert.equal(aim(waking).night, 600)
  // Under three nights, it is the age's. Set by the parent, it is theirs.
  assert.deepEqual(aim(nights([20, 0], [6, 0], 2)), { min: 180, set: false, night: null })
  assert.deepEqual(aim(nights([20, 0], [6, 0]), baby(190, { aimSet: true, target: 240 })), { min: 240, set: true, night: null })
  // A morning typed in without its night, and a night logged from 4am, are left out.
  assert.equal(aim([...nights([20, 0], [6, 0], 2), sleep(at(-3, 7, 0), at(-3, 7, 0), 'night', true), sleep(at(-4, 4, 0), at(-4, 6, 0), 'night', true)]).night, null)
})

test('Settings says where the aim came from', () => {
  const log = [0, -1, -2].map((d) => night(d, [20, 0], [6, 0]))
  assert.equal(aimNote(engine(baby(190), log, at(0, 9, 0))), "Oisín slept 10 h a night this week, so the aim is 3 h 30 min. It moves with Oisín's nights until you change it.")
  assert.equal(aimNote(engine(baby(190), log.slice(0, 2), at(0, 9, 0))), "Most babies at 6 months sleep about 3 hours in the day. Once 3 nights are logged, the aim moves with Oisín's nights.")
  assert.equal(aimNote(engine(baby(190, { aimSet: true }), log, at(0, 9, 0))), 'You set this. Most babies at 6 months sleep about 3 hours in the day.')
  // The day's sleep on Today counts against the same aim.
  assert.equal(engine(baby(190), log, at(0, 9, 0)).budget().target, 210 * MIN)
})

// Five days before today, each up at 7 and down at 7, with the naps given. Then up at 7 today.
function days (counts: number[]): Sleep[] {
  const out: Sleep[] = []
  counts.forEach((n, i) => {
    const d = i - counts.length
    out.push(night(d, [19, 0], [7, 0]))
    const starts: [number, number][] = n === 2 ? [[9, 30], [14, 0]] : [[9, 0], [12, 30], [16, 0]]
    for (const s of starts) out.push(sleep(at(d, ...s), at(d, ...s) + (n === 2 ? 90 : 60) * MIN, 'nap'))
  })
  out.push(night(0, [19, 0], [7, 0]))
  return out
}

test('two naps on 3 of the last 5 days: Today offers the day with 2 naps beside the day with 3', () => {
  const log = days([3, 2, 3, 2, 2]), now = at(0, 7, 30)
  const f = hero(engine(baby(195), log, now)).fewer
  assert.ok(f)
  assert.equal(f.say, 'Oisín had 2 naps on 3 of the last 5 days.')
  assert.deepEqual(f.opts.map((o) => o.title), ['2 naps a day', 'Keep 3 naps'])
  // Oisín's naps run an hour and a half, so the 3-nap day has no room for the third today.
  assert.equal(f.opts[0].line, 'Naps at 9:35am and 2:10pm. Bedtime 7pm.')
  assert.equal(f.opts[1].line, 'Naps at 9:20am and 1:35pm. No room for a third today. Bedtime 7pm.')
  // Not on 2 of 5, not within a week of asking, and not once the parent has moved.
  assert.equal(hero(engine(baby(195), days([3, 3, 3, 2, 2]), now)).fewer, null)
  assert.equal(hero(engine(baby(195, { napsAsked: now - 6 * DAY }), log, now)).fewer, null)
  assert.ok(hero(engine(baby(195, { napsAsked: now - 8 * DAY }), log, now)).fewer)
  const two = engine(baby(195, { naps: 2 }), log, now)
  assert.equal(hero(two).fewer, null)
  // On 2 naps the day runs on the windows of the first age that takes two, 2 h 30 min to 3 h 30 min.
  assert.deepEqual([two.band().naps, two.band().min, two.band().max], [2, 150, 210])
  assert.equal(two.plan().filter((w) => !w.bed).length, 2)
})

test('a wake window the parent sets stays where they put it, and a short nap still brings the next one sooner', () => {
  const up = [night(0, [19, 0], [7, 0])]
  const set = engine(baby(195, { windows: [150] }), up, at(0, 7, 1))
  assert.equal(set.plan()[0].c, at(0, 9, 30))
  assert.deepEqual(set.windowOf(0), { len: 150, set: true })
  assert.equal(set.windowOf(1).set, false)
  assert.equal(windowsNote(set), "You set the window before nap 1. The others move with Oisín's naps. After a nap under 40 minutes, the next nap still comes sooner.")
  assert.equal(windowsNote(engine(baby(195, { windows: [150, 165, 180] }), up, at(0, 7, 1))), 'You set the windows before nap 1, nap 2 and nap 3. After a nap under 40 minutes, the next nap still comes sooner.')
  assert.equal(windowsNote(engine(baby(195), up, at(0, 7, 1))), "Baby Nap Track works these out from Oisín's age and the naps that went well this week. Change one and it stays where you put it.")
  const short = engine(baby(195, { windows: [150, 150] }), [...up, sleep(at(0, 9, 30), at(0, 9, 55), 'nap')], at(0, 10, 0))
  assert.equal(short.plan()[0].c, round5(at(0, 9, 55) + 150 * 0.85 * MIN))
})
