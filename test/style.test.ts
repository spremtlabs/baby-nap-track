/// <reference types="node" />
// The three ways the day's naps run, from 1.0.43: from the last wake-up, at the same times every day,
// or whatever gets the night right. The first is the app as it was, and model.test.ts holds it.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ageWeeks, clockDay, engine, styleOf, type Baby, type Sleep } from '../src/lib/engine.ts'
import type { Chair } from '../src/lib/chair.ts'
import { styleTexts, typicalNaps, whyNap } from '../src/lib/guide.ts'
import { hero, todayRows } from '../src/lib/model.ts'
import { fmtMins, plain } from '../src/lib/words.ts'
import { OISIN, at, sleep, week } from './sample.ts'

const CLOCK: Baby = { ...OISIN, style: 'clock', clock: [540, 735, 945] }
const NIGHT: Baby = { ...OISIN, style: 'night' }
const screen = (baby: Baby, log: Sleep[], now: number) => {
  const E = engine(baby, log, now), h = hero(E)
  return { E, eyebrow: h.eyebrow, big: plain(h.big), sub: h.sub, note: h.note }
}
// The sample week with today's one long nap swapped for a 30 minute one at 8:40.
const shortMorning = () => [...week().filter((x) => !(x.kind === 'nap' && x.s >= at(0, 0, 0))), sleep(at(0, 8, 40), at(0, 9, 10), 'nap')]

test('a chair method in progress runs the naps the night way, until the parent picks another', () => {
  const chair = { from: '2026-10-01', held: [], settles: [], inCot: null, checked: true } as Chair
  assert.equal(styleOf(OISIN), 'wake')
  assert.equal(styleOf({ ...OISIN, chair }), 'night')
  assert.equal(styleOf({ ...OISIN, chair, style: 'wake' }), 'wake')
  assert.equal(styleOf({ ...OISIN, style: 'clock' }), 'clock')
})

test('the same times every day start from the typical naps setup shows for the age', () => {
  const wks = ageWeeks(OISIN, at(0, 9))
  assert.deepEqual(clockDay(OISIN, wks).map(fmtMins), typicalNaps(wks, OISIN.wake, OISIN.bed).rows.map((r) => r.at))
  // A time the parent set stays, and an empty place keeps the typical one.
  const own = clockDay({ ...OISIN, clock: [540, null, 945] }, wks)
  assert.deepEqual([own[0], own[2]], [540, 945])
  assert.equal(own[1], clockDay(OISIN, wks)[1])
})

test('the same times every day: the next nap is at its set time', () => {
  const s = screen(CLOCK, week(), at(0, 11, 0))
  assert.equal(s.big, '12:15 pm')
  assert.equal(s.sub, 'Put Oisín down between 12 and 12:30pm.')
  const rows = todayRows(s.E).rows.filter((r) => r.mark === 'next' || r.mark === 'plan').map((r) => r.title)
  assert.deepEqual(rows, ['Lunchtime nap', 'Afternoon nap'])
})

test('the same times every day: a short nap leaves the next one where it is', () => {
  const clock = screen(CLOCK, shortMorning(), at(0, 10, 0))
  assert.equal(clock.big, '12:15 pm')
  // From the last wake-up the short nap brings the next one sooner.
  const wake = screen(OISIN, shortMorning(), at(0, 10, 0))
  assert.notEqual(wake.big, '12:15 pm')
})

test('the same times every day: a time missed with no nap gives way to the next one', () => {
  const s = screen(CLOCK, week(), at(0, 12, 50))
  assert.equal(s.big, '3:45 pm')
  assert.ok(!s.eyebrow.startsWith('Nap needed'), s.eyebrow)
  const why = whyNap(s.E)
  assert.equal(why.lines[0], "Oisín's naps are at the same times every day.")
})

test('whatever gets the night right: a missed nap is rescued an hour after its window opened, and not before', () => {
  const soon = screen(NIGHT, week(), at(0, 12, 35))
  assert.equal(soon.sub, 'The window closed at 12:30pm. Put Oisín down as soon as you can.')
  const hour = screen(NIGHT, week(), at(0, 13, 15))
  assert.equal(hour.eyebrow, 'Nap time')
  assert.equal(hour.sub, 'The window opened at 12:10pm. The car, the buggy or a nap on you all count.')
  const late = screen(NIGHT, week(), at(0, 16, 35))
  assert.equal(late.eyebrow, 'Nap needed now')
  assert.equal(late.sub, 'Get Oisín to sleep now. The car, the buggy or a nap on you all count.')
  // From the last wake-up the screen says none of it.
  assert.equal(screen(OISIN, week(), at(0, 16, 35)).sub, 'Get Oisín to sleep now.')
  assert.equal(screen(OISIN, week(), at(0, 13, 15)).sub, 'The window closed at 12:30pm. Put Oisín down as soon as you can.')
})

test('whatever gets the night right: a nap under 45 minutes gets one try to settle back', () => {
  assert.equal(screen(NIGHT, shortMorning(), at(0, 9, 15)).note, 'Woke after 30 min. Try once to settle Oisín back to sleep.')
  assert.equal(screen(NIGHT, shortMorning(), at(0, 9, 35)).note, 'Awake 25 min')
  assert.equal(screen(OISIN, shortMorning(), at(0, 9, 15)).note, 'Awake 5 min')
})

test('setup and Settings name the three ways with the baby in the first', () => {
  const t = styleTexts('Oisín')
  assert.deepEqual(t.map((x) => x.id), ['wake', 'clock', 'night'])
  assert.equal(t[0].title, 'From when Oisín wakes')
  assert.equal(t[2].title, 'Whatever gets the night right')
})
