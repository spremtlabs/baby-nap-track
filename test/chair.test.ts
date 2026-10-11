/// <reference types="node" />
// The chair method, run against the real engine: which night it is,
// where the chair goes, the night held back, the bedtime taps, the card and the chart.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MIN, engine } from '../src/lib/engine.ts'
import { answer, askAbout, asleepToast, chairCard, chairChart, chairDay, chairEarly, chairHero, chairLine, chairTap, eveningOf, fellAsleep, hold, newChair, putInCot, ranges, tonight, tripsSoFar, wentOver, type Chair } from '../src/lib/chair.ts'
import { chairScene } from '../src/lib/chairArt.ts'
import { hero } from '../src/lib/model.ts'
import { CIAN, OISIN, at, sleep, week } from './sample.ts'

// A plan that started `ago` evenings back, with settling logged on the nights given.
const plan = (ago: number, settled: [number, number][] = [], held: number[] = []): Chair => ({
  from: eveningOf(at(-ago, 19, 0)),
  held: held.map((d) => eveningOf(at(d, 19, 0))),
  settles: settled.map(([d, min]) => ({ night: eveningOf(at(d, 19, 0)), inCot: at(d, 19, 0), asleep: at(d, 19, 0) + min * MIN })),
  inCot: null,
})
const withChair = (c: Chair | null) => ({ ...OISIN, chair: c })

test('a night after midnight belongs to the evening before, and the morning to the evening ahead', () => {
  assert.equal(eveningOf(at(1, 2, 10)), eveningOf(at(0, 19, 0)))
  assert.equal(eveningOf(at(1, 7, 0)), eveningOf(at(1, 19, 0)))
})

test('three nights at each place, then out of the room on night 13', () => {
  const c = plan(0)
  const where = (d: number) => tonight(c, at(d, 19, 0))
  assert.deepEqual([0, 1, 2].map((d) => where(d).place), [0, 0, 0])
  assert.equal(where(3).n, 4)
  assert.equal(where(3).place, 1)
  assert.equal(where(3).move, true)
  assert.equal(where(4).move, false)
  assert.equal(where(9).place, 3)
  assert.equal(where(12).place, 4)
  assert.equal(where(20).place, 4)
  assert.deepEqual(ranges(c, 1), ['1–3', '4–6', '7–9', '10–12'])
})

test('a night held back keeps the chair where it was and moves every later night along', () => {
  const c = plan(3, [], [0])
  const t = tonight(c, at(0, 19, 0))
  assert.equal(t.n, 4)
  assert.equal(t.place, 0)
  assert.equal(t.held, true)
  assert.equal(tonight(c, at(1, 19, 0)).place, 1)
  assert.deepEqual(t.ranges, ['1–4', '5–7', '8–10', '11–13'])
  assert.deepEqual(hold(c, t.key, false).held, [])
})

test('Settings knows a baby under six months and says which night is next', () => {
  assert.equal(chairEarly(OISIN, at(0, 12)), false)
  assert.equal(chairEarly(CIAN, at(0, 12)), true)
  assert.equal(chairLine(plan(3), at(0, 12)), 'Night 4, halfway to the door')
  assert.equal(chairLine(plan(12), at(0, 12)), 'Night 13, out of the room')
})

// From 1.0.18 the plan runs at any age. Ten weeks old, 7:50pm, with bedtime at 8pm.
test('at ten weeks the bedtime tap is the baby going into the cot, with the picture for night 1', () => {
  const c = plan(0), now = at(0, 19, 50)
  const day = [sleep(at(-1, 20, 0), at(0, 7, 0), 'night', true), sleep(at(0, 17, 30), at(0, 18, 15), 'nap')]
  const E = engine({ ...CIAN, chair: c }, day, now)
  assert.deepEqual(chairTap(E, c, now), { kind: 'cot' })
  assert.equal(chairHero(E, c, hero(E), now).caption, 'Tap when Cian is in the cot.')
  assert.equal(chairCard(E, c, now)!.eyebrow, 'Chair method, night 1')
})

// The evening of a day from the sample week, at 6:50pm with bedtime at 7pm.
const evening = () => [...week(), sleep(at(0, 12, 20), at(0, 13, 30), 'nap'), sleep(at(0, 15, 50), at(0, 16, 40), 'nap')]

test('at bedtime the button is the baby going into the cot, then the baby asleep', () => {
  const c = plan(3, [[-3, 46], [-2, 38], [-1, 24]])
  const now = at(0, 18, 50), E = engine(withChair(c), evening(), now)
  assert.deepEqual(chairTap(E, c, now), { kind: 'cot' })
  assert.equal(chairHero(E, c, hero(E), now).caption, 'Tap when Oisín is in the cot.')

  const inCot = putInCot(c, at(0, 19, 16)), later = at(0, 19, 28), E2 = engine(withChair(inCot), evening(), later)
  const h = chairHero(E2, inCot, hero(E2), later)
  assert.equal(h.eyebrow, 'Settling')
  assert.equal(h.sub, 'In the cot at 7:16pm.')
  assert.equal(h.run, at(0, 19, 16))
  assert.equal(h.caption, 'Tap when Oisín is asleep.')
  assert.equal(h.settling, true)
  assert.deepEqual(chairTap(E2, inCot, later), { kind: 'asleep', inCot: at(0, 19, 16) })

  const after = fellAsleep(inCot, at(0, 19, 16), later)
  assert.equal(after.inCot, null)
  assert.equal(after.settles.length, 4)
  assert.equal(asleepToast('Oisín', at(0, 19, 16), later), 'Down for the night at 7:28pm. Oisín took 12 min to fall asleep. You stayed in the chair the whole time.')
  assert.equal(asleepToast('Oisín', later - 20000, later), 'Down for the night at 7:28pm. Oisín was asleep in under a minute. You stayed in the chair the whole time.')
  // Settled tonight, so a second bedtime tap is the usual one.
  assert.equal(chairTap(engine(withChair(after), evening(), later), after, later), null)
})

test('settling left running for three hours stops counting', () => {
  const c = putInCot(plan(3), at(0, 19, 0)), now = at(0, 22, 5)
  const E = engine(withChair(c), evening(), now)
  assert.equal(chairHero(E, c, hero(E), now).settling, undefined)
})

test('in the day nothing changes, and a nap still starts with the usual tap', () => {
  const c = plan(3), now = at(0, 11, 35), E = engine(withChair(c), week(), now)
  assert.equal(chairTap(E, c, now), null)
  assert.equal(chairCard(E, c, now), null)
  assert.equal(chairHero(E, c, hero(E), now).caption, 'Tap when Oisín falls asleep.')
})

test('the card at bedtime shows the night, its place and the link that holds it', () => {
  const c = plan(3), now = at(0, 18, 50), card = chairCard(engine(withChair(c), evening(), now), c, now)!
  assert.equal(card.eyebrow, 'Chair method, night 4')
  assert.equal(card.place, 1)
  assert.equal(card.hold, 'Stay by the cot one more night')
  const held = hold(c, card.key, true), card2 = chairCard(engine(withChair(held), evening(), now), held, now)!
  assert.equal(card2.place, 0)
  assert.equal(card2.hold, 'Move the chair tonight')
  // On night 5 nothing moves, so there is nothing to hold.
  const c5 = plan(4), card5 = chairCard(engine(withChair(c5), evening(), now), c5, now)!
  assert.equal(card5.hold, '')
})

test('awake in the night, the card says to go back to the chair', () => {
  const c = plan(3), log = [...evening(), sleep(at(0, 19, 5), at(0, 23, 30), 'night')], now = at(0, 23, 40)
  const card = chairCard(engine(withChair(c), log, now), c, now)!
  assert.equal(card.line, 'Go back to the chair until Oisín is back asleep.')
  assert.equal(card.hold, '')
})

test('the chart has a bar for each night settled, last night in honey, and says how it went', () => {
  const c = plan(4, [[-4, 46], [-3, 38], [-2, 24], [-1, 31]]), now = at(0, 11, 35), ch = chairChart(engine(withChair(c), week(), now), c, now)!
  assert.deepEqual(ch.groups.map((g) => g.label), ['1–3', '4–6', '7–9', '10–12'])
  assert.deepEqual(ch.groups[0].bars.map((b) => b?.min), [46, 38, 24])
  assert.deepEqual(ch.groups[1].bars.map((b) => b?.min ?? null), [31, null, null])
  assert.equal(ch.groups[1].bars[0]!.last, true)
  assert.equal(ch.say[0], 'Last night Oisín fell asleep in 31 min.')
  assert.equal(ch.say[1], "That's 15 min faster than night 1.")
  assert.match(ch.say[2], /^Oisín woke twice and was back asleep in \d+ min on average\.$/)
  assert.equal(ch.say[3], 'Tonight the chair stays halfway to the door.')
  const say = (ago: number, extra: Partial<Chair> = {}) => { const x = { ...plan(ago, [[-1, 20]]), ...extra }; return chairChart(engine(withChair(x), week(), now), x, now)!.say }
  assert.equal(say(5).at(-1), 'Tonight the chair stays halfway to the door.')
  assert.equal(say(6).at(-1), 'Tonight the chair moves to the door.')
  assert.equal(chairChart(engine(withChair(plan(3)), week(), now), plan(3), now), null)
})

test('going over while settling is counted, and the toast and the morning say so', () => {
  let c = putInCot(plan(3), at(0, 19, 0))
  c = wentOver(wentOver(c))
  assert.equal(tripsSoFar(0), 'Not yet')
  assert.equal(tripsSoFar(1), 'Once so far')
  assert.equal(tripsSoFar(c.trips!), 'Twice so far')
  const done = fellAsleep(c, at(0, 19, 0), at(0, 19, 20))
  assert.equal(done.settles.at(-1)!.trips, 2)
  assert.equal(done.trips, 0)
  assert.equal(asleepToast('Oisín', at(0, 19, 0), at(0, 19, 20), 2), 'Down for the night at 7:20pm. Oisín took 20 min to fall asleep. You went over twice.')
  assert.equal(asleepToast('Oisín', at(0, 19, 0), at(0, 19, 20), 0), 'Down for the night at 7:20pm. Oisín took 20 min to fall asleep. You stayed in the chair the whole time.')
})

test('after the baby is asleep it asks about crying until it is answered, and a hard night can hold the chair', () => {
  const c = fellAsleep(putInCot(plan(3), at(0, 19, 0)), at(0, 19, 0), at(0, 19, 20))
  const log = [...evening(), sleep(at(0, 19, 20), null, 'night')], later = at(0, 19, 25)
  const ask = askAbout(engine(withChair(c), log, later), c, later)!
  assert.equal(ask.question, 'How much did Oisín cry while settling?')
  const cried = answer(answer(c, ask.night, { cry: 'lot' }), ask.night, { why: ['teething'] })
  assert.equal(askAbout(engine(withChair(cried), log, later), cried, later), null)
  // The next evening is night 5, so nothing moves; on the evening of a move night the card offers to hold.
  const hardBefore = answer(plan(3, [[-3, 46], [-2, 38], [-1, 24]]), eveningOf(at(-1, 19, 0)), { cry: 'lot' })
  const now = at(0, 18, 50), card = chairCard(engine(withChair(hardBefore), evening(), now), hardBefore, now)!
  assert.equal(card.line, 'Last night was hard, so you can keep the chair by the cot one more night.')
  const morning = chairChart(engine(withChair(hardBefore), week(), at(0, 11, 35)), hardBefore, at(0, 11, 35))!.say
  assert.ok(morning.includes('There was a lot of crying. The HSE says it can take a few weeks, so keep going.'))
  assert.equal(morning.at(-1), 'Last night was hard, so you can keep the chair by the cot one more night.')
})

test('a new plan starts tonight, and the picture draws every place', () => {
  const c = newChair(at(0, 14, 0))
  assert.equal(tonight(c, at(0, 19, 0)).n, 1)
  for (let p = 0; p <= 4; p++) {
    const svg = chairScene(p)
    assert.match(svg, /^<svg viewBox="0 28 380 172">/)
    assert.doesNotMatch(svg, /NaN|undefined/)
  }
})

// The line on Today through the day, from 1.0.17.
test('through the day Today says which night it is and where the chair goes tonight', () => {
  const c = plan(3), E = engine(withChair(c), week(), at(0, 11, 35))
  assert.equal(chairDay(E, c, at(0, 11, 35)), 'Chair method, night 4 of 13. The chair is halfway to the door tonight.')
  // A night held back makes the plan one night longer.
  const held = plan(3, [], [0])
  assert.equal(chairDay(engine(withChair(held), week(), at(0, 11, 35)), held, at(0, 11, 35)), 'Chair method, night 4 of 14. The chair is beside the cot tonight.')
  const last = plan(12)
  assert.equal(chairDay(engine(withChair(last), week(), at(0, 11, 35)), last, at(0, 11, 35)), 'Chair method, night 13. Say goodnight and leave the room tonight.')
  assert.equal(chairDay(E, null, at(0, 11, 35)), null)
})
