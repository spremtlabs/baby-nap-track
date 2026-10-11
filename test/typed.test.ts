/// <reference types="node" />
// Type what happened, from mock type-what-happened v1 of 11 October 2026, run against the real
// engine with the sample baby on the morning the mock drew: last night not logged, 8:25am.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { engine, type Sleep } from '../src/lib/engine.ts'
import { savedLine, todayRows } from '../src/lib/model.ts'
import { applyTyped, readTyped, typed, type TypedEnd, type TypedRow } from '../src/lib/typed.ts'
import { OISIN, at, sleep, week } from './sample.ts'

const log = (): Sleep[] => [...week(), sleep(at(0, 12, 20), at(0, 13, 35), 'nap'), sleep(at(0, 16, 15), at(0, 16, 55), 'nap')]
const now = at(1, 8, 25)
const plain = (rows: (TypedRow | TypedEnd)[]) => rows.map((x) => (x.k === 'wake' ? ['woke', x.t] : x.k === 'end' ? ['end', x.s, x.t] : [x.s, x.e]))
const said = (text: string, t = now) => plain(readTyped(text, OISIN, t).rows)
let n = 0
const id = () => `t${++n}`

test('the morning the mock drew: a wake-up, a feed and a nap, then Today from them', () => {
  const r = typed('Up at 5:40, fed at 6, napped 6:10 to 7:28', OISIN, log(), now)
  assert.deepEqual(plain(r.rows), [['woke', at(1, 5, 40)], [at(1, 6, 10), at(1, 7, 28)]])
  assert.deepEqual(r.left, ['fed at 6'])
  const E = engine(OISIN, applyTyped(OISIN, log(), now, r, id, false).sleeps, now)
  assert.equal(savedLine(E), 'Saved. Next nap 9:45am.')
  const rows = todayRows(E).rows.map((x) => [x.title, x.sub ?? '', x.right])
  assert.deepEqual(rows.slice(0, 3), [['Last night', 'Not logged', 'Add'], ['Woke up', '', '5:40am'], ['Nap', '6:10 to 7:28am', '1 h 18 min']])
})

test('times typed or said the way people say them', () => {
  const nap = [at(1, 6, 10), at(1, 7, 28)], woke = ['woke', at(1, 5, 40)]
  assert.deepEqual(said('Slept from ten past six till 7:28'), [nap])
  assert.deepEqual(said('nap 6:10-7:28'), [nap])
  assert.deepEqual(said('woke 5.40am, asleep 6.10, woke 7.28'), [woke, nap])
  assert.deepEqual(said('woke at 5:40 and went back down at 6:10, up at 7:28'), [woke, nap])
  assert.deepEqual(said('up at twenty to six, nap quarter past 6 to 7:28'), [woke, [at(1, 6, 15), at(1, 7, 28)]])
  assert.deepEqual(said('up half 5, nap half 6 to 7'), [['woke', at(1, 5, 30)], [at(1, 6, 30), at(1, 7, 0)]])
  assert.deepEqual(said('napped 6:10 for an hour'), [[at(1, 6, 10), at(1, 7, 10)]])
})

test('a time still to come, the night and a piece with no time are not added', () => {
  const r = readTyped('up at 9, down for the night at 7, napped for a while', OISIN, now)
  assert.deepEqual(r.rows, [])
  assert.deepEqual(r.left, ['up at 9', 'down for the night at 7', 'napped for a while'])
})

test('a sleep with no end is still going, and an afternoon nap typed after midnight is the day before', () => {
  assert.deepEqual(said('up 5:40 then down 7:50'), [['woke', at(1, 5, 40)], [at(1, 7, 50), null]])
  assert.deepEqual(said('nap 1 to 2:30', at(1, 0, 30)), [[at(0, 13, 0), at(0, 14, 30)]])
})

test('a typed nap takes the place of a nap in the log, and a sleep over the night is not added', () => {
  const l = [...log(), sleep(at(1, 5, 40), at(1, 5, 40), 'night', true), sleep(at(1, 6, 20), at(1, 7, 0), 'nap')]
  const r = typed('napped 6:10 to 7:28', OISIN, l, now)
  assert.equal(r.drop.length, 1)
  const naps = applyTyped(OISIN, l, now, r, id, false).sleeps.filter((x) => x.kind === 'nap' && x.s >= at(1, 0, 0))
  assert.deepEqual(naps.map((x) => [x.s, x.e]), [[at(1, 6, 10), at(1, 7, 28)]])
  // A shared log keeps the replaced nap, marked deleted, so the other phones drop it too.
  const shared = applyTyped(OISIN, l, now, r, id, true)
  assert.equal(shared.sleeps.find((x) => x.id === r.drop[0])?.deleted, true)
  assert.ok(shared.ids.includes(r.drop[0]))
  // Last night in the sample ran to 6:55am, so a nap from 6:10 is over the night until the
  // wake-up typed before it ends the night at 5:40.
  const morning = at(0, 8, 25), w = week().filter((x) => x.s < at(0, 8, 0))
  assert.deepEqual(typed('napped 6:10 to 7:28', OISIN, w, morning).left, ['napped 6:10 to 7:28'])
  const fixed = typed('up at 5:40, napped 6:10 to 7:28', OISIN, w, morning)
  assert.deepEqual([fixed.rows.length, fixed.left], [2, []])
  const E = engine(OISIN, applyTyped(OISIN, w, morning, fixed, id, false).sleeps, morning)
  assert.equal(E.dayStart().t, at(0, 5, 40))
})

test('a nap still going takes the place of the one the timer is running', () => {
  const l = [...log(), sleep(at(1, 5, 40), at(1, 5, 40), 'night', true), sleep(at(1, 8, 0), null, 'nap')]
  const r = typed('down at 7:50', OISIN, l, now)
  assert.deepEqual([r.left, r.drop.length], [[], 1])
  const naps = applyTyped(OISIN, l, now, r, id, false).sleeps.filter((x) => x.kind === 'nap' && x.s >= at(1, 0, 0))
  assert.deepEqual(naps.map((x) => [x.s, x.e]), [[at(1, 7, 50), null]])
})

test('a row the parent changed or took out replaces what was read, until the words change', () => {
  const text = 'Up at 5:40, napped 6:10 to 7:28'
  const fixed = typed(text, OISIN, log(), now, { 1: { k: 'sleep', s: at(1, 6, 5), e: at(1, 7, 30), p: 'napped 6:10 to 7:28' } })
  assert.deepEqual(plain(fixed.rows), [['woke', at(1, 5, 40)], [at(1, 6, 5), at(1, 7, 30)]])
  assert.deepEqual(plain(typed(text, OISIN, log(), now, { 0: null }).rows), [[at(1, 6, 10), at(1, 7, 28)]])
})

// 11 October 2026: sleep updates typed through the day. A wake-up on its own at midday was read as
// the morning and would have moved the day's start to 1:15pm.
test('a wake-up typed later in the day ends the running nap, and is not added with nothing running', () => {
  const day = week(), t = at(0, 13, 20)
  const midday = typed('woke at 1:15', OISIN, day, t)
  assert.deepEqual([midday.rows, midday.left], [[], ['woke at 1:15']])
  const running = [...day, sleep(at(0, 12, 30), null, 'nap')], id0 = running[running.length - 1].id
  const r = typed('woke at 1:15', OISIN, running, t)
  assert.deepEqual(plain(r.rows), [['end', at(0, 12, 30), at(0, 13, 15)]])
  const x = applyTyped(OISIN, running, t, r, id, false), nap = x.sleeps.find((y) => y.id === id0)
  assert.deepEqual([nap?.s, nap?.e, x.ids], [at(0, 12, 30), at(0, 13, 15), [id0]])
  assert.equal(engine(OISIN, x.sleeps, t).dayStart().t, at(0, 6, 55))
  // The morning logged at 6:55 can still be put right before the first nap.
  assert.deepEqual(plain(typed('up at 6:40', OISIN, day, t).rows), [['woke', at(0, 6, 40)]])
})

test('a wake-up typed while the night is still running ends the night, up for the day', () => {
  const l = [...week().filter((x) => x.s < at(0, 4, 0)), sleep(at(0, 4, 12), null, 'night')], t = at(0, 7, 5)
  const r = typed('up at 6:50, down 6:55 to 7', OISIN, l, t)
  assert.deepEqual(plain(r.rows), [['end', at(0, 4, 12), at(0, 6, 50)], [at(0, 6, 55), at(0, 7, 0)]])
  const E = engine(OISIN, applyTyped(OISIN, l, t, r, id, false).sleeps, t)
  assert.deepEqual([E.dayStart().t, E.phase()], [at(0, 6, 50), 'day'])
})

// 11 October 2026: `Up at 5am until 6 then sleep until 7.30 then sleep from 7.45 to 8.30` saved only
// the 7:45 nap. The first piece was read as a sleep from 5 to 6, which sat over the night, and the
// second as a nap starting at 7:30.
test('awake from one time to the next, then a sleep until a time, is a wake-up and a sleep', () => {
  const l = [...log(), sleep(at(0, 19, 53), at(1, 5, 38), 'night', true)], t = at(1, 9, 0)
  const text = 'Up at 5am until 6 then sleep until 7.30 then sleep from 7.45 to 8.30'
  const r = typed(text, OISIN, l, t)
  assert.deepEqual(plain(r.rows), [['woke', at(1, 5, 0)], [at(1, 6, 0), at(1, 7, 30)], [at(1, 7, 45), at(1, 8, 30)]])
  assert.deepEqual(r.left, [])
  const E = engine(OISIN, applyTyped(OISIN, l, t, r, id, false).sleeps, t)
  assert.equal(E.dayStart().t, at(1, 5, 0))
  assert.deepEqual(E.napsSince(E.dayStart().t).map((x) => [x.s, x.e]), [[at(1, 6, 0), at(1, 7, 30)], [at(1, 7, 45), at(1, 8, 30)]])
  assert.deepEqual(said('slept until 7:30', t), [['woke', at(1, 7, 30)]])
  assert.deepEqual(said('down at 6, slept till half 7', t), [[at(1, 6, 0), at(1, 7, 30)]])
  assert.deepEqual(said('awake 5 to 6, nap 6:10 to 7:28', t), [['woke', at(1, 5, 0)], [at(1, 6, 10), at(1, 7, 28)]])
  assert.deepEqual(said('up at 5 until 6', at(1, 6, 30)), [['woke', at(1, 5, 0)], [at(1, 6, 0), null]])
})
