/// <reference types="node" />
// Type what happened, from 11 October 2026, run against the real engine with the sample baby on a
// morning with last night not logged, at 8:25am.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { engine, type Sleep } from '../src/lib/engine.ts'
import { daySleep, hero, savedLine, todayRows } from '../src/lib/model.ts'
import { plain as plain2 } from '../src/lib/words.ts'
import { applyTyped, readTyped, typed, type TypedEnd, type TypedRow } from '../src/lib/typed.ts'
import { AT_FIVE_MONTHS, OISIN, at, sleep, week } from './sample.ts'

const log = (): Sleep[] => [...week(), sleep(at(0, 12, 20), at(0, 13, 35), 'nap'), sleep(at(0, 16, 15), at(0, 16, 55), 'nap')]
const now = at(1, 8, 25)
const plain = (rows: (TypedRow | TypedEnd)[]) => rows.map((x) => (x.k === 'wake' ? ['woke', x.t] : x.k === 'end' ? ['end', x.s, x.t] : [x.s, x.e]))
const said = (text: string, t = now) => plain(readTyped(text, OISIN, t).rows)
let n = 0
const id = () => `t${++n}`

test('a morning with the night not logged: a wake-up, a feed and a nap, then Today from them', () => {
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
  // From 1.0.28 the sleep from 6:10 starts before the usual wake-up of 7, so it carries the night
  // on: the baby was awake from 5:40 to 6:10 and is up for the day at 7:28.
  const E = engine(OISIN, applyTyped(OISIN, w, morning, fixed, id, false).sleeps, morning)
  assert.equal(E.dayStart().t, at(0, 7, 28))
  assert.deepEqual([E.napsSince(E.dayStart().t).length, E.lastNight()?.wakes], [0, 3])
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
  // The five minutes from 6:55 are before the usual wake-up, so they are the night too.
  const E = engine(OISIN, applyTyped(OISIN, l, t, r, id, false).sleeps, t)
  assert.deepEqual([E.dayStart().t, E.phase()], [at(0, 7, 0), 'day'])
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
  // 11 October 2026, 1.0.28: awake at 5 and asleep again from 6 is a waking in the night, with the
  // usual wake-up at 7. Up to 1.0.27 the day started at 5am and the sleep from 6 was its first nap.
  assert.deepEqual(r.rows.map((x) => (x.k === 'sleep' ? [x.kind, x.up] : [])), [[], ['night', true], ['nap', false]])
  const E = engine(OISIN, applyTyped(OISIN, l, t, r, id, false).sleeps, t)
  assert.equal(E.dayStart().t, at(1, 7, 30))
  assert.deepEqual(E.napsSince(E.dayStart().t).map((x) => [x.s, x.e]), [[at(1, 7, 45), at(1, 8, 30)]])
  assert.deepEqual(todayRows(E).rows.slice(0, 2).map((x) => [x.title, x.sub ?? '', x.right]), [['Last night', '7:53pm to 7:30am, woke once', '10 h 37 min'], ['Up for the day', '', '7:30am']])
  // With the night not logged there is no night to carry on, so the sleep from 6 stays a nap.
  const bare = typed(text, OISIN, log(), t)
  assert.deepEqual(bare.rows.map((x) => (x.k === 'sleep' ? x.kind : 'woke')), ['woke', 'nap', 'nap'])
  assert.deepEqual(said('slept until 7:30', t), [['woke', at(1, 7, 30)]])
  assert.deepEqual(said('down at 6, slept till half 7', t), [[at(1, 6, 0), at(1, 7, 30)]])
  assert.deepEqual(said('awake 5 to 6, nap 6:10 to 7:28', t), [['woke', at(1, 5, 0)], [at(1, 6, 10), at(1, 7, 28)]])
  assert.deepEqual(said('up at 5 until 6', at(1, 6, 30)), [['woke', at(1, 5, 0)], [at(1, 6, 0), null]])
})

// 11 October 2026, typed at 6:06pm: the night went to 6am, the sleep from 6 to 7:30 and the nap at
// 2:50 were lost, and Today said 2 h 33 min to go before bed at 7pm. 1.0.24 threw the night out for
// its word night, read `awake until 6` as a wake-up at 6, and read only the first two of the four
// times in `10:35 to 11:11am (36 min) and 2:50 to 3:15pm (25 min)`.
const EVENING = 'Oisín slept from 7:53pm last night until 5:00am, then was awake until 6:00am and slept again until 7:30am. He napped from 7:45 to 8:30am (45 min), 10:35 to 11:11am (36 min) and 2:50 to 3:15pm (25 min). He just fell asleep at 6pm'
const evening = () => [...log(), sleep(at(0, 19, 53), at(1, 5, 38), 'night', true), sleep(at(1, 7, 45), at(1, 8, 30), 'nap'), sleep(at(1, 10, 35), at(1, 11, 11), 'nap'), sleep(at(1, 18, 0), null, 'nap')]

test('a whole day typed in the evening, the night first, goes in as typed', () => {
  const l = evening(), t = at(1, 18, 6), r = typed(EVENING, OISIN, l, t)
  assert.deepEqual(plain(r.rows), [['woke', at(1, 5, 0)], [at(1, 6, 0), at(1, 7, 30)], [at(1, 7, 45), at(1, 8, 30)], [at(1, 10, 35), at(1, 11, 11)], [at(1, 14, 50), at(1, 15, 15)], [at(1, 18, 0), null]])
  assert.equal((r.rows[0] as TypedRow & { k: 'wake' }).from, at(0, 19, 53))
  assert.deepEqual([r.left, r.drop.length], [[], 3])
  // 1.0.28: the sleep from 6 to 7:30 carries the night on, so the day starts at 7:30 with three
  // naps. The day's naps fell short, the screen gave an early bedtime of 6:30, and the sleep from
  // 6pm is the night. Up to 1.0.27 the day started at 5am and the list said napping since 6pm.
  assert.deepEqual(r.rows.map((x) => (x.k === 'sleep' ? x.kind : 'woke')), ['woke', 'night', 'nap', 'nap', 'nap', 'night'])
  const before = engine(OISIN, applyTyped(OISIN, l, t, { ...r, rows: r.rows.slice(0, 5) }, id, false).sleeps.filter((x) => x.e != null), at(1, 17, 55))
  assert.deepEqual([hero(before).eyebrow, plain2(hero(before).big)], ['Early bedtime', '6:30 pm'])
  const E = engine(OISIN, applyTyped(OISIN, l, t, r, id, false).sleeps, t)
  assert.equal(E.phase(), 'night')
  assert.equal(hero(E).sub, 'Down for the night at 6pm.')
  assert.equal(E.nightDay().t0, at(1, 7, 30))
  assert.deepEqual(E.nightDay().naps.map((x) => [x.s, x.e]), [[at(1, 7, 45), at(1, 8, 30)], [at(1, 10, 35), at(1, 11, 11)], [at(1, 14, 50), at(1, 15, 15)]])
  assert.deepEqual(todayRows(E).rows.map((x) => [x.title, x.right]), [['Up for the day', '7:30am'], ['Nap', '45 min'], ['Nap', '36 min'], ['Nap', '25 min'], ['Down for the night', '6pm']])
  // At five months the plan still held a short nap from earlier in the afternoon, and the sleep
  // from 6pm is the night all the same.
  const young = typed(EVENING, AT_FIVE_MONTHS, l, t).rows.at(-1)
  assert.equal(young?.k === 'sleep' && young.kind, 'night')
})

test('a nap running with less time before bed than the day sleep still to go says how short the day is', () => {
  const t = at(1, 18, 6), E = engine(OISIN, evening(), t)
  assert.equal(daySleep(E).say, 'Oisín is 1 h 33 min short of 3 hours today.')
  // With a nap from 2 to 2:50 logged, the 43 minutes left fit before bed.
  assert.equal(daySleep(engine(OISIN, [...evening(), sleep(at(1, 14, 0), at(1, 14, 50), 'nap')], t)).say, '43 min to go before bed at 7pm.')
})

test('times with no am or pm follow the one before, a length is no time, and four times are two naps', () => {
  const t = at(1, 18, 6)
  assert.deepEqual(said('Up at 5am until 6 then sleep until 7.30 then sleep from 7.45 to 8.30', t), [['woke', at(1, 5, 0)], [at(1, 6, 0), at(1, 7, 30)], [at(1, 7, 45), at(1, 8, 30)]])
  assert.deepEqual(said('napped at 2 (20 min)', t), [[at(1, 14, 0), at(1, 14, 20)]])
  assert.deepEqual(said('naps 10:35 to 11:11 & 2:50 to 3:15', t), [[at(1, 10, 35), at(1, 11, 11)], [at(1, 14, 50), at(1, 15, 15)]])
  assert.deepEqual(readTyped('naps 10:35 to 11:11 & 2:50', OISIN, t).left, ['naps 10:35 to 11:11 & 2:50'])
  // A single update still goes on the latest time it could be.
  assert.deepEqual(said('just went down at 6', t), [[at(1, 18, 0), null]])
})

test('the night typed with its start fills a night not logged, and moves the first stretch of one logged', () => {
  const r = typed('slept 7:10pm to 6:40 last night', OISIN, log(), now)
  assert.deepEqual([plain(r.rows), r.left], [[['woke', at(1, 6, 40)]], []])
  const E = engine(OISIN, applyTyped(OISIN, log(), now, r, id, false).sleeps, now)
  assert.deepEqual(todayRows(E).rows[0].sub, '7:10pm to 6:40am')
  const woken = [...log(), sleep(at(0, 20, 0), at(1, 1, 0), 'night'), sleep(at(1, 1, 20), at(1, 6, 50), 'night', true)]
  const x = applyTyped(OISIN, woken, now, typed('slept from 7:40pm last night till 6:30', OISIN, woken, now), id, false)
  const night = x.sleeps.filter((y) => y.kind === 'night' && y.s >= at(0, 19, 0))
  assert.deepEqual(night.map((y) => [y.s, y.e]), [[at(0, 19, 40), at(1, 1, 0)], [at(1, 1, 20), at(1, 6, 30)]])
  assert.equal(x.ids.length, 2)
  // Bedtime and a waking in the night are not added.
  assert.deepEqual(readTyped('woke in the night at 2, down for the night at 7', OISIN, now).left, ['woke in the night at 2', 'down for the night at 7'])
})

// 11 October 2026, read off the parser after the evening above: the other ways a day gets typed.
test('the night typed without the word night, bedtime typed in the evening, and a waking in the night', () => {
  const night = (text: string, t: number) => readTyped(text, OISIN, t).rows.map((x) => (x.k === 'wake' ? ['woke', x.t, x.from] : x.k === 'sleep' ? [x.s, x.e] : []))
  for (const t of [now, at(1, 18, 6)]) {
    assert.deepEqual(night('Down 7.10, up 6.40', t), [['woke', at(1, 6, 40), at(0, 19, 10)]])
    assert.deepEqual(night('slept 7pm-6:30am', t), [['woke', at(1, 6, 30), at(0, 19, 0)]])
    assert.deepEqual(night('went to bed at 7:10 and woke at 6:40', t), [['woke', at(1, 6, 40), at(0, 19, 10)]])
  }
  assert.deepEqual(said('bed at 7:05pm', at(1, 19, 40)), [[at(1, 19, 5), null]])
  assert.deepEqual(said('nap 4:30 to 5, down for the night at 7:05', at(1, 19, 40)), [[at(1, 16, 30), at(1, 17, 0)], [at(1, 19, 5), null]])
  const r = readTyped('woke at 2am for a feed, back down at 2:30, up for the day at 6:45', OISIN, at(1, 18, 6))
  assert.deepEqual([plain(r.rows), r.left], [[['woke', at(1, 6, 45)]], ['woke at 2am for a feed', 'back down at 2:30']])
  // A nap that has not ended yet is not the night.
  assert.deepEqual(readTyped('nap 4:30 to 5', OISIN, at(1, 16, 45)).rows, [])
})

test('a day typed in the evening with no am or pm, numbered naps, 6ish and an hour and ten', () => {
  const t = at(1, 18, 6)
  assert.deepEqual(said('Woke 5:30, fed, nap 9 to 10', t), [['woke', at(1, 5, 30)], [at(1, 9, 0), at(1, 10, 0)]])
  assert.deepEqual(said('woke at 5:30', t), [['woke', at(1, 17, 30)]])
  assert.deepEqual(said('nap 5 to 5:40, down at 6', t), [[at(1, 17, 0), at(1, 17, 40)], [at(1, 18, 0), null]])
  assert.deepEqual(said('Nap 1 9:10-10:20, nap 2: 1:15-2:40', t), [[at(1, 9, 10), at(1, 10, 20)], [at(1, 13, 15), at(1, 14, 40)]])
  assert.deepEqual(said('woke at 6ish, nap 9:30ish to 10:15', t), [['woke', at(1, 6, 0)], [at(1, 9, 30), at(1, 10, 15)]])
  assert.deepEqual(said('nap 9:30 for 1hr 10', t), [[at(1, 9, 30), at(1, 10, 40)]])
})
