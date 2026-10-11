/// <reference types="node" />
// What Today says, run against the real engine since 4 October 2026. A screen that says
// something else fails here before it reaches a phone.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { afterAt, asLogged, dayFloor, engine, HOUR, kindFor, lastAt, MIN, morningAt, moveStart, newSleep, pickEnd, pickStart, withNoNap, type Sleep } from '../src/lib/engine.ts'
import { chairTap } from '../src/lib/chair.ts'
import { daySleep, gapDraft, hero, mainAction, nightAddWake, nightDraft, nightPick, nightProblem, nightSave, nightSum, outView, reminder, savedLine, sleepNotice, todayRows, week as weekOf } from '../src/lib/model.ts'
import { NO_SHOP, TRIAL_NAME, TRIAL_SKU, gate, isLocked, outcomeLine, setupLine, shopGroup, trialEnd, trialNote, weekLine, weekScreen, type Paid } from '../src/lib/shop.ts'
import { dur, fmt, plain, runParts } from '../src/lib/words.ts'
import { AT_FIVE_MONTHS, CIAN, OISIN, at, sleep, week } from './sample.ts'

const screen = (log: Sleep[], now: number, baby = OISIN) => {
  const E = engine(baby, log, now)
  const h = hero(E), d = daySleep(E)
  return { E, eyebrow: h.eyebrow, big: plain(h.big), sub: h.sub, say: d.say }
}

test('the morning: the next window, its time and the day so far', () => {
  const s = screen(week(), at(0, 11, 35))
  assert.equal(s.eyebrow, 'Nap window in 35 min')
  assert.equal(s.big, '12:20 pm')
  assert.equal(s.sub, 'Put Oisín down between 12:10 and 12:30pm.')
  assert.equal(s.say, '1 h 57 min to go, across 2 more naps.')
})

test('a missed window says now, and the car or the buggy, while naps are still to come', () => {
  for (const [h, m] of [[12, 35], [14, 5]]) {
    const s = screen(week(), at(0, h, m))
    assert.equal(s.eyebrow, 'Nap time')
    assert.equal(s.big, 'Now')
    assert.equal(s.sub, 'The window closed at 12:30pm. Put Oisín down as soon as you can. A nap in the car or the buggy counts.')
  }
  const late = screen(week(), at(0, 16, 35))
  assert.equal(late.eyebrow, 'Nap needed now')
  assert.equal(late.big, '1 h 57 min')
})

test('at 4pm after a short day: the whole amount he still needs, now', () => {
  const s = screen(week(true), at(0, 16, 0))
  assert.equal(s.eyebrow, 'Nap needed now')
  assert.equal(s.big, '1 h 5 min')
  assert.equal(s.sub, 'Get Oisín to sleep now. A nap in the car or the buggy counts.')
  assert.equal(s.say, 'Oisín needs 1 h 5 min more to make 3 hours.')
})

test('a nap after 4pm gets a time to wake Oisín at the end of the naps, 5pm for a 7pm bedtime', () => {
  const log = [...week(true), sleep(at(0, 16, 0), null, 'nap')]
  const E = engine(OISIN, log, at(0, 16, 15))
  const h = hero(E)
  assert.equal(h.eyebrow, 'Napping')
  assert.equal(h.sub, 'Fell asleep at 4pm.')
  assert.deepEqual(h.wake, { at: at(0, 17, 0), now: false, left: 'in 45 min' })
  assert.equal(daySleep(E).say, "Oisín's day sleep comes to 2 h 55 min with a wake-up at 5pm.")
  assert.ok(todayRows(E).rows.some((r) => r.title === 'Optional wake' && r.right === '5pm'))
  assert.deepEqual(reminder(E, 15), { at: at(0, 17, 0), title: 'Optional wake', body: 'Some parents wake at this point to leave enough of a gap before bedtime. Oisín has slept 1 h and bedtime is 7pm.' })
  assert.equal(sleepNotice(E)?.body, 'Fell asleep at 4pm. Optional wake at 5pm.')
  const at5 = engine(OISIN, log, at(0, 17, 5))
  assert.deepEqual(hero(at5).wake, { at: at(0, 17, 0), now: true, left: 'Bedtime is 7pm' })
  assert.equal(todayRows(at5).rows.find((r) => r.title === 'Optional wake')?.right, 'now')
})

test('a parent who sets no naps after 5:15pm gets 5:15pm, and a morning nap gets no wake time', () => {
  const baby = { ...OISIN, napsEnd: 17 * 60 + 15 }
  const log = [...week(true), sleep(at(0, 15, 30), null, 'nap')]
  assert.equal(hero(engine(baby, log, at(0, 16, 0))).wake?.at, at(0, 17, 15))
  const morning = [...week(true).filter((x) => x.s < at(0, 9, 0)), sleep(at(0, 9, 0), null, 'nap')]
  assert.equal(hero(engine(OISIN, morning, at(0, 9, 30))).wake, null)
  assert.equal(engine(OISIN, morning, at(0, 9, 30)).wakeAt(), null)
})

test('too late for a nap: an early bedtime, then now, then the window closed', () => {
  const s = screen(week(true), at(0, 17, 0))
  assert.equal(s.eyebrow, 'Early bedtime')
  assert.equal(s.big, '6:30 pm')
  assert.equal(s.say, 'Oisín is 1 h 5 min short of 3 hours today.')
  const s2 = screen(week(true), at(0, 18, 15))
  assert.equal(s2.big, 'Now')
  assert.equal(s2.sub, 'Put Oisín down before 6:45pm.')
  const s3 = screen(week(true), at(0, 19, 0))
  assert.equal(s3.eyebrow, 'Bedtime')
  assert.equal(s3.sub, 'The window closed at 6:45pm. Put Oisín down as soon as you can.')
})

test('an 11-week-old keeps his short naps inside his wake window', () => {
  const log = [
    sleep(at(-1, 20, 0), at(0, 7, 0), 'night', true),
    sleep(at(0, 8, 0), at(0, 9, 0), 'nap'), sleep(at(0, 10, 20), at(0, 11, 20), 'nap'),
    sleep(at(0, 12, 40), at(0, 13, 10), 'nap'), sleep(at(0, 13, 45), at(0, 14, 15), 'nap'),
  ]
  const E = engine(CIAN, log, at(0, 14, 16))
  assert.equal(E.plan().map((w) => `${w.bed ? 'bed' : w.cat ? 'short nap' : 'nap'} ${fmt(w.c)}`).join(', '), 'short nap 3:45pm, short nap 5:45pm, bed 8pm')
})

test('the night: the current stretch, and the morning question', () => {
  const log = [...week(), sleep(at(0, 10, 1) + 140 * MIN, at(0, 13, 30), 'nap'), sleep(at(0, 15, 50), at(0, 16, 40), 'nap'),
    sleep(at(0, 19, 0), at(0, 23, 30), 'night'), sleep(at(0, 23, 46), null, 'night')]
  const s = screen(log, at(1, 2, 10))
  assert.equal(s.eyebrow, 'Asleep')
  assert.equal(s.sub, 'Since 11:46pm. Down for the night at 7pm and woke once.')
  const E = engine(OISIN, log, at(1, 6, 50))
  assert.equal(mainAction(E).kind, 'ask')
  assert.equal(todayRows(E).heading, 'Yesterday and tonight')
})

test('no em dash on any screen through the day', () => {
  for (const shortDay of [false, true]) {
    for (let m = 6 * 60 + 55; m < 20 * 60; m += 15) {
      const now = at(0, Math.floor(m / 60), m % 60)
      for (const log of [week(shortDay), [...week(shortDay), sleep(now - 20 * MIN, null, 'nap')]]) {
        const E = engine(OISIN, log, now)
        const r = reminder(E, 15)
        const words = [hero(E).sub, hero(E).eyebrow, hero(E).ask, daySleep(E).say, ...todayRows(E).rows.flatMap((x) => [x.title, x.sub ?? '', x.right]), r?.title ?? '', r?.body ?? '']
        for (const w of words) assert.doesNotMatch(w, /—/, `at ${fmt(now)}: ${w}`)
      }
    }
  }
})

test('the day graph labels the naps ahead with their times and never overlaps them', () => {
  const d = daySleep(engine(OISIN, week(), at(0, 11, 35)))
  assert.deepEqual(d.labels.filter((l) => l.plan).map((l) => l.text), ['12:20pm', '4:20pm'])
  const xs = d.labels.map((l) => l.at).sort((a, b) => a - b)
  for (let i = 1; i < xs.length; i++) assert.ok(xs[i] - xs[i - 1] > 8)
})

// 4 October 2026: an app set up at midday said a nap was needed now, because setup only asked
// when the baby last woke and counted no naps since the morning. The morning's nap could not be
// added so it counted. The morning is now part of setup and of the log.
const mark = (t: number) => sleep(t, t, 'night', true)
const yesterdayOnly = () => [...week(), sleep(at(0, 12, 20), at(0, 13, 35), 'nap'), sleep(at(0, 16, 15), at(0, 16, 55), 'nap')]

test('set up at 1pm with the morning entered: the morning nap counts and the nap time comes from it', () => {
  const s = screen([mark(at(0, 6, 50)), sleep(at(0, 9, 15), at(0, 10, 20), 'nap')], at(0, 13, 0))
  assert.equal(s.eyebrow, 'Nap window open')
  assert.equal(s.sub, 'Put Oisín down before 1:05pm.')
  // Up to 1.0.22 the next nap was the last, and Oisín was awake from about 2pm until bed. From 1.0.23
  // a short nap goes in after it.
  assert.equal(s.say, '1 h 55 min to go, across 2 more naps.')
  assert.equal(plain(daySleep(s.E).so), '1 h 5 min')
  assert.deepEqual(todayRows(s.E).rows.slice(0, 3).map((r) => `${r.title} ${r.right}`), ['Last night Add', 'Woke up 6:50am', 'Nap 1 h 5 min'])
})

test('a day with nothing logged since last night asks about the morning before it gives a nap time', () => {
  for (const [h, m] of [[6, 0], [8, 30], [13, 0], [17, 30]]) {
    const E = engine(OISIN, yesterdayOnly(), at(1, h, m)), x = hero(E)
    assert.equal(x.ask, 'When did Oisín wake up this morning?')
    assert.equal(x.eyebrow, 'Today')
    assert.equal(x.cta, 'Save')
    assert.equal(E.unknownMorning(), true)
    assert.equal(E.makeUp(), null)
    assert.equal(reminder(E, 15), null)
  }
  // Before the morning starts, it is still last night, and nothing asks.
  assert.equal(hero(engine(OISIN, yesterdayOnly(), at(1, 1, 0))).ask, '')
})

test('the morning answered: the day starts at that wake-up and a nap logged after it counts', () => {
  const s = screen([...yesterdayOnly(), mark(at(1, 6, 40)), sleep(at(1, 7, 45), at(1, 8, 30), 'nap')], at(1, 8, 30))
  assert.equal(s.eyebrow, 'Nap window in 2 h 10 min')
  assert.equal(s.big, '10:50 am')
  assert.equal(s.say, '2 h 15 min to go, across 2 more naps.')
  assert.equal(todayRows(s.E).rows.find((r) => r.wake)?.title, 'Woke up')
})

test('the wake-up row after a logged night says up for the day, and a tap on it changes the time', () => {
  const r = todayRows(engine(OISIN, week(), at(0, 11, 35))).rows.find((x) => x.wake)
  assert.equal(r?.title, 'Up for the day')
})

test('a time picked on the clock lands on the right day', () => {
  assert.equal(lastAt(at(0, 13, 0), 9, 15), at(0, 9, 15))
  assert.equal(lastAt(at(0, 8, 0), 19, 0), at(-1, 19, 0))
  assert.equal(afterAt(at(-1, 19, 0), 6, 30), at(0, 6, 30))
  assert.equal(afterAt(at(0, 9, 15), 10, 20), at(0, 10, 20))
  assert.equal(morningAt(OISIN, at(0, 13, 0), 6, 50), at(0, 6, 50))
  assert.equal(morningAt(OISIN, at(1, 1, 0), 6, 50), at(0, 6, 50))
  assert.equal(morningAt(OISIN, at(0, 6, 30), 7, 0), at(0, 7, 0))
})

// 11 October 2026: a nap added with a quick tap on the timer at 8:24, changed to 6:10 to 7:28am,
// read 25 h 18 min asleep and Save stayed grey. The wake-up was picked first, so it went on
// tomorrow, and the new start left it there.
test('a sleep added with a tap on the timer takes its two times in either order', () => {
  const now = at(0, 8, 25), tap: Sleep = { id: 'n', s: at(0, 8, 24), e: at(0, 8, 24) + 40e3, kind: 'nap', updatedAt: 0 }
  const woke = pickEnd(tap, now, 7, 28)
  assert.deepEqual([woke.s, woke.e], [at(0, 7, 28) - 40e3, at(0, 7, 28)])
  const both = pickStart(woke, now, 6, 10)
  assert.deepEqual([both.s, both.e], [at(0, 6, 10), at(0, 7, 28)])
  assert.equal(dur(both.e! - both.s), '1 h 18 min')
  const other = pickEnd(pickStart(tap, now, 6, 10), now, 7, 28)
  assert.deepEqual([other.s, other.e], [at(0, 6, 10), at(0, 7, 28)])
  // A tap at 12:29am, then the afternoon's nap.
  const late = at(1, 0, 30), t2: Sleep = { ...tap, s: at(1, 0, 29), e: at(1, 0, 29) + 40e3 }
  const nap = pickStart(pickEnd(t2, late, 17, 0), late, 16, 0)
  assert.deepEqual([nap.s, nap.e], [at(0, 16, 0), at(0, 17, 0)])
})

test('a sleep changed on the clock never runs past a day, and a real sleep keeps its times', () => {
  // As 1.0.18 left it: a start of 7:40 today and a wake-up of 7:28 tomorrow.
  const now = at(0, 8, 25), x: Sleep = { id: 'n', s: at(0, 7, 40), e: at(1, 7, 28), kind: 'nap', updatedAt: 0 }
  assert.equal(pickStart(x, now, 6, 10).e, at(0, 7, 28))
  let y = x
  while (y.s > at(0, 6, 10)) y = moveStart(y, -15)
  assert.deepEqual([y.s, y.e], [at(0, 6, 10), at(0, 7, 28)])
  // A start after the end keeps the length, a wake-up still to come waits for Save, and a night
  // keeps its morning.
  const nap: Sleep = { id: 'm', s: at(0, 7, 40), e: at(0, 8, 15), kind: 'nap', updatedAt: 0 }
  assert.equal(pickStart(nap, now, 8, 20).e, at(0, 8, 55))
  assert.deepEqual([pickEnd(nap, now, 8, 40).s, pickEnd(nap, now, 8, 40).e], [nap.s, at(0, 8, 40)])
  const night: Sleep = { id: 'g', s: at(-1, 19, 30), e: at(0, 6, 10), kind: 'night', updatedAt: 0 }
  assert.equal(pickStart(night, now, 20, 0).e, at(0, 6, 10))
  assert.equal(moveStart(night, -15).e, at(0, 6, 10))
  assert.deepEqual([pickEnd(night, now, 9, 0).s, pickEnd(night, now, 9, 0).e], [night.s, at(0, 9, 0)])
})

// 4 October 2026: the timer looked stopped after the tap. The count was
// in whole minutes and said 1 min for over a minute after the tap. It counts the seconds.
test('a running sleep counts the seconds from 0 min 00 sec, on one line', () => {
  assert.equal(plain(runParts(0).parts), '0 min 00 sec')
  assert.equal(plain(runParts(4 * MIN + 7000).parts), '4 min 07 sec')
  assert.equal(runParts(59 * MIN).size, 86)
  const hr = runParts(75 * MIN + 4000)
  assert.equal(plain(hr.parts), '1 h 15 min 04 sec')
  assert.equal(hr.size, 70)
  assert.equal(runParts(11 * HOUR + 23 * MIN + 55000).size, 62)
  const log = [...week(), sleep(at(0, 11, 35), null, 'nap')]
  const h = hero(engine(OISIN, log, at(0, 11, 35)))
  assert.equal(h.run, at(0, 11, 35))
  assert.equal(plain(h.big), '0 min 00 sec')
})

test('the tap starts the sleep at that second, whatever the screen clock last read', () => {
  const now = at(0, 11, 35) + 17000
  const a = mainAction(engine(OISIN, week(), now))
  assert.equal(a.kind === 'add' && a.sleep.s, now)
})

test('the lock screen notice says when the sleep the timer counts started', () => {
  assert.equal(sleepNotice(engine(OISIN, week(), at(0, 11, 35))), null)
  assert.deepEqual(sleepNotice(engine(OISIN, [...week(), sleep(at(0, 11, 35), null, 'nap')], at(0, 12, 0))), { title: 'Oisín is napping', body: 'Fell asleep at 11:35am.' })
  const day = [...week(), sleep(at(0, 10, 1) + 140 * MIN, at(0, 13, 30), 'nap'), sleep(at(0, 15, 50), at(0, 16, 40), 'nap')]
  assert.deepEqual(sleepNotice(engine(OISIN, [...day, sleep(at(0, 19, 0), null, 'night')], at(0, 21, 0))), { title: 'Oisín is asleep', body: 'Down for the night at 7pm.' })
  const woke = [...day, sleep(at(0, 19, 0), at(0, 23, 30), 'night'), sleep(at(0, 23, 46), null, 'night')]
  assert.deepEqual(sleepNotice(engine(OISIN, woke, at(1, 2, 10))), { title: 'Oisín is asleep', body: 'Back down at 11:46pm.' })
  assert.equal(sleepNotice(engine(OISIN, [...day, sleep(at(0, 19, 0), at(0, 23, 30), 'night')], at(0, 23, 40))), null)
})

// From 4 October 2026: 7 days free, then one payment for the
// nap times, and logging stays free. The price comes from Play, so the tests use Play's own string.
const PRICE = '€9.99'
const shop = (p: Partial<Paid>): Paid => ({ ...NO_SHOP, ...p })

test('nothing locks and nothing mentions paying until Play has a price', () => {
  const g = gate(NO_SHOP, at(30, 12, 0))
  assert.equal(g.kind, 'none')
  assert.equal(setupLine(g, at(0, 12, 0)), '')
  assert.equal(shopGroup(g, 'Oisín', at(0, 12, 0)), null)
  const h = hero(engine(OISIN, week(), at(0, 11, 35)), g)
  assert.equal(h.eyebrow, 'Nap window in 35 min')
  assert.equal(h.shop, '')
})

test('the free week runs to the end of the seventh day after the price first showed', () => {
  const from = at(0, 19, 0)
  assert.equal(trialEnd(from), at(8, 0, 0))
  assert.equal(gate(shop({ price: PRICE, trialFrom: from }), at(7, 23, 59)).kind, 'trial')
  assert.equal(gate(shop({ price: PRICE, trialFrom: from }), at(8, 0, 1)).kind, 'locked')
  assert.equal(setupLine(gate(shop({ price: PRICE, trialFrom: from }), from), from), 'Baby Nap Track is free for 7 days. Then the nap times are €9.99, once.')
  assert.equal(setupLine(gate(shop({ price: PRICE, trialFrom: from }), at(3, 9, 0)), at(3, 9, 0)), "Nap times are free to the end of " + new Date(at(7, 12, 0)).toLocaleDateString('en-IE', { weekday: 'long', day: 'numeric', month: 'long' }) + ". Then they're €9.99, once.")
  assert.equal(setupLine(gate(shop({ price: PRICE, trialFrom: from }), at(9, 9, 0)), at(9, 9, 0)), 'The nap times are €9.99, once. Logging stays free.')
})

test('the Today screen says when the free week ends in its last two days, and not before', () => {
  const p = shop({ price: PRICE, trialFrom: at(-6, 9, 0) })
  assert.equal(trialNote(gate(p, at(0, 10, 0)), at(0, 10, 0)), 'Nap times are free to the end of tomorrow. Then they\'re €9.99, once.')
  assert.equal(trialNote(gate(p, at(1, 10, 0)), at(1, 10, 0)), 'Nap times are free to the end of today. Then they\'re €9.99, once.')
  assert.equal(trialNote(gate(p, at(-4, 10, 0)), at(-4, 10, 0)), '')
  const h = hero(engine(OISIN, week(), at(0, 11, 35)), gate(p, at(0, 11, 35)))
  assert.equal(h.eyebrow, 'Nap window in 35 min')
  assert.equal(h.shop, 'Nap times are free to the end of tomorrow. Then they\'re €9.99, once.')
})

test('once the free week is up, the nap time asks for the payment and logging stays where it was', () => {
  const g = gate(shop({ price: PRICE, trialFrom: at(-9, 9, 0) }), at(0, 11, 35))
  assert.equal(g.kind, 'locked')
  const E = engine(OISIN, week(), at(0, 11, 35))
  const h = hero(E, g)
  assert.equal(h.heading, 'Your free week of nap times is up')
  assert.equal(h.sub, "Get them for €9.99, once, and they're yours to keep. Logging stays free.")
  assert.equal(h.buy, 'Get the nap times for €9.99')
  assert.equal(h.cta, 'Oisín fell asleep')
  assert.deepEqual(h.big, [])
  assert.match(h.eyebrow, /^Awake \d/)
  const d = daySleep(E, g)
  assert.equal(d.planned, false)
  assert.match(d.say, /^Oisín has had .+ of naps today\.$/)
  const rows = todayRows(E, g).rows
  assert.ok(rows.every((r) => r.mark !== 'plan' && r.mark !== 'next'))
  assert.equal(rows[rows.length - 1].title, 'Bedtime')
  assert.equal(savedLine(E, g), 'Saved.')
  // The tap still logs, and a running sleep still counts.
  assert.equal(mainAction(E).kind, 'add')
  const nap = hero(engine(OISIN, [...week(), sleep(at(0, 11, 35), null, 'nap')], at(0, 11, 40)), g)
  assert.equal(nap.eyebrow, 'Napping')
  assert.equal(nap.heading, '')
})

test('a phone that paid, or shares a log with one that did, gets the nap times', () => {
  for (const p of [shop({ price: PRICE, trialFrom: at(-30, 9, 0), owned: true }), shop({ price: PRICE, trialFrom: at(-30, 9, 0), sharedPaid: true })]) {
    const g = gate(p, at(0, 11, 35))
    assert.equal(g.kind, 'owned')
    assert.equal(hero(engine(OISIN, week(), at(0, 11, 35)), g).eyebrow, 'Nap window in 35 min')
  }
  assert.equal(shopGroup(gate(shop({ owned: true }), 0), 'Oisín', 0)?.note, 'Yours to keep. Thank you!')
  assert.equal(shopGroup(gate(shop({ sharedPaid: true }), 0), 'Oisín', 0)?.note, "Paid for on another phone that shares Oisín's log.")
  assert.equal(outcomeLine('owned'), 'The nap times are yours. Thank you!')
  assert.equal(outcomeLine('cancelled'), '')
})

test('on an iPhone the payment lines name the App Store and an Apple Account, and Android keeps Google Play', () => {
  assert.equal(outcomeLine('pending', 'apple'), 'The App Store is finishing the payment. The nap times open when it goes through.')
  assert.equal(outcomeLine('none', 'apple'), "This Apple Account hasn't paid for Baby Nap Track yet.")
  assert.equal(outcomeLine('unreachable', 'apple'), "The App Store didn't answer. Check the phone is online and try again.")
  assert.equal(outcomeLine('pending'), 'Google Play is finishing the payment. The nap times open when it goes through.')
  assert.equal(outcomeLine('none'), "This Google account hasn't paid for Baby Nap Track yet.")
  assert.equal(outcomeLine('unreachable'), "Google Play didn't answer. Check the phone is online and try again.")
  for (const o of ['owned', 'pending', 'cancelled', 'failed', 'restored', 'none', 'unreachable'] as const) assert.doesNotMatch(outcomeLine(o, 'apple'), /Google|Play/)
})

// On an iPhone the free week is the free `7-day Trial` item, started by the
// parent's tap. Until the tap the nap times wait, as they do once the
// week is up, and Android's week still starts by itself.
test('on an iPhone the free week waits for the tap on the 7-day Trial item', () => {
  assert.equal(TRIAL_SKU, 'snug_trial')
  assert.equal(TRIAL_NAME, '7-day Trial')
  const offer = gate(shop({ price: PRICE, freeWeek: true }), at(0, 11, 35))
  assert.deepEqual(offer, { kind: 'offer', price: PRICE })
  assert.ok(isLocked(offer))
  // No free week item from the App Store, so nothing locks.
  assert.equal(gate(shop({ price: PRICE, freeWeek: false }), at(0, 11, 35)).kind, 'none')
  // Once the week has started it runs and ends as Android's does.
  assert.equal(gate(shop({ price: PRICE, freeWeek: true, trialFrom: at(-2, 9, 0) }), at(0, 11, 35)).kind, 'trial')
  assert.equal(gate(shop({ price: PRICE, freeWeek: true, trialFrom: at(-9, 9, 0) }), at(0, 11, 35)).kind, 'locked')
  assert.equal(setupLine(offer, at(0, 11, 35)), '')
})

test('a parent who said Not now logs as before, and Today offers the free week where the nap time was', () => {
  const g = gate(shop({ price: PRICE, freeWeek: true }), at(0, 11, 35))
  const E = engine(OISIN, week(), at(0, 11, 35))
  const h = hero(E, g)
  assert.equal(h.heading, 'Nap times are free for 7\u00a0days')
  assert.equal(h.sub, "You get each nap time and the plan for the rest of the day. After that, they're €9.99, once. Logging stays free.")
  assert.equal(h.buy, 'Start my free week')
  assert.deepEqual(h.big, [])
  assert.equal(h.outLink, '')
  assert.equal(mainAction(E).kind, 'add')
  assert.ok(todayRows(E, g).rows.every((r) => r.mark !== 'plan' && r.mark !== 'next'))
  assert.equal(daySleep(E, g).planned, false)
  const box = shopGroup(g, 'Oisín', at(0, 11, 35))
  assert.equal(box?.note, "Free for 7 days from the day you start. Then they're €9.99, once. Logging, the week and sharing stay free.")
  assert.equal(box?.week, 'Start my free week')
  assert.equal(box?.buy, 'Get them now for €9.99')
  assert.equal(box?.restore, true)
})

test('the last setup screen on an iPhone says how long the week runs, with the last free day', () => {
  // On Wednesday 7 October 2026 the week runs to the end of the 14th.
  const now = new Date(2026, 9, 7, 8, 41).getTime()
  const w = weekScreen(PRICE, now)
  assert.equal(w.eyebrow, 'Nap times free for')
  assert.deepEqual(w.big, [{ n: '7' }, { u: 'days' }])
  assert.equal(w.gives, "That's to the end of Wednesday 14 October. You get each nap time and the plan for the rest of the day. Baby Nap Track reminds you before each nap and bedtime too.")
  assert.equal(w.after, 'After that, the nap times, the plan and the reminders stop until you pay €9.99, once. Logging sleep, the timer and sharing stay free.')
  assert.equal(w.line, 'The App Store will ask you to confirm the free week.')
  assert.equal(w.start, 'Start my free week')
  assert.equal(w.later, 'Not now')
  assert.equal(weekLine('cancelled'), '')
  assert.equal(weekLine('owned'), '')
  assert.doesNotMatch(weekLine('failed') + weekLine('pending'), /Google|Play/)
})

// 5 October 2026 at 7:39pm: a day with over 3 hours of naps showed three naps adding to
// 1 h 35 min. Version 1.0.4 saved a sleep added after bedtime as a night whatever
// its times, so the morning nap added that evening counted nowhere.
const eveningDay = () => [
  sleep(at(-1, 19, 10), at(0, 7, 0), 'night', true),
  sleep(at(0, 8, 30), at(0, 10, 0), 'night'),
  sleep(at(0, 11, 5), at(0, 11, 45), 'nap'), sleep(at(0, 13, 50), at(0, 14, 25), 'nap'), sleep(at(0, 16, 10), at(0, 16, 30), 'nap'),
]

test('a morning nap saved as a night by 1.0.4 counts as the nap it was', () => {
  const E = engine(OISIN, [...eveningDay(), sleep(at(0, 19, 39), null, 'night')], at(0, 19, 45))
  assert.equal(plain(daySleep(E).so), '3 h 5 min')
  assert.equal(daySleep(E).say, "Today's naps came to 3 h 5 min.")
  const day = engine(OISIN, eveningDay(), at(0, 17, 0))
  assert.equal(plain(daySleep(day).so), '3 h 5 min')
  assert.ok(todayRows(day).rows.some((r) => r.title === 'Nap' && r.sub === '8:30 to 10am'))
})

test('a sleep added by hand is a nap or a night by when it started, not when it is typed in', () => {
  assert.equal(kindFor(OISIN, at(0, 8, 30)), 'nap')
  assert.equal(kindFor(OISIN, at(0, 18, 15)), 'nap')
  assert.equal(kindFor(OISIN, at(0, 19, 5)), 'night')
  assert.equal(kindFor(OISIN, at(0, 3, 10)), 'night')
})

test('real nights stay nights, and a nap started just before bed that ended by bedtime is a nap', () => {
  for (const x of week()) assert.equal(asLogged(OISIN, x).kind, x.kind)
  assert.equal(asLogged(OISIN, sleep(at(0, 18, 40), at(0, 23, 0), 'night')).kind, 'night')
  const cat = [...week(true), sleep(at(0, 17, 50), at(0, 18, 20), 'night')]
  const E = engine(OISIN, cat, at(0, 18, 25))
  assert.equal(E.phase(), 'day')
  assert.equal(hero(E).caption, 'Tap when Oisín falls asleep.')
})

test('the day stays on the list after bedtime, so a nap can still be seen and fixed', () => {
  const E = engine(OISIN, [...eveningDay(), sleep(at(0, 19, 39), null, 'night')], at(0, 19, 45))
  const r = todayRows(E)
  assert.equal(r.heading, 'Today')
  assert.deepEqual(r.rows.map((x) => x.title), ['Up for the day', 'Nap', 'Nap', 'Nap', 'Nap', 'Down for the night'])
  assert.ok(r.rows.filter((x) => x.title === 'Nap').every((x) => x.edit))
})

// 6 October 2026: the week waited for two whole
// days, and today never counted. It shows from the first day now.
test('the week shows from the first day, today included, and the averages wait for three days', () => {
  const first = weekOf(engine(OISIN, [sleep(at(0, 7, 0), at(0, 7, 0), 'night', true), sleep(at(0, 9, 0), at(0, 10, 0), 'nap')], at(0, 11, 0)))
  assert.equal(first.empty, false)
  assert.deepEqual(first.empty ? [] : first.rows.map((r) => `${r.label} ${r.text}`), ['Today 1 h'])
  assert.equal(!first.empty && first.avg, null)
  const two = weekOf(engine(OISIN, [...eveningDay(), sleep(at(0, 19, 39), at(1, 6, 50), 'night', true), sleep(at(1, 9, 0), at(1, 9, 45), 'nap')], at(1, 11, 0)))
  assert.deepEqual(two.empty ? [] : two.rows.map((r) => r.text), ['45 min', '3 h 5 min'])
  // At night the day just gone is the top row, once.
  const night = weekOf(engine(OISIN, [...eveningDay(), sleep(at(0, 19, 39), null, 'night')], at(0, 21, 0)))
  assert.deepEqual(night.empty ? [] : night.rows.map((r) => `${r.label} ${r.text}`), ['Today 3 h 5 min'])
  const full = weekOf(engine(OISIN, week(), at(0, 11, 35)))
  assert.ok(!full.empty && full.avg && full.rows.length === 7)
  assert.equal(weekOf(engine(OISIN, [sleep(at(0, 7, 0), at(0, 7, 0), 'night', true)], at(0, 8, 0))).empty, true)
})

test('a stretch an hour past the longest wake window with no nap logged is marked, and a tap adds the nap', () => {
  const log = [sleep(at(-1, 19, 10), at(0, 7, 0), 'night', true), sleep(at(0, 11, 5), at(0, 11, 45), 'nap')]
  const E = engine(OISIN, log, at(0, 12, 30))
  const gap = todayRows(E).rows.find((r) => r.mark === 'gap')
  assert.equal(gap?.title, 'Nothing logged 7 to 11:05am')
  assert.equal(gap?.sub, 'Did Oisín nap in there?')
  assert.ok(daySleep(E).gaps)
  const d = gapDraft(E, gap!.gap![0], gap!.gap![1])
  assert.ok(d.s > at(0, 7, 0) && d.e <= at(0, 10, 50) && d.e > d.s)
  assert.equal(todayRows(engine(OISIN, week(), at(0, 11, 35))).rows.some((r) => r.mark === 'gap'), false)
})

test('going out with a nap in the car: the naps before move to fit, and the plan shows on Today', () => {
  const o = { leave: at(0, 15, 0), home: at(0, 16, 30), mode: 'car' as const }
  const E = engine(OISIN, week(), at(0, 11, 35), o)
  assert.equal(E.activeOut(), true)
  const car = E.plan().find((w) => w.car)
  assert.equal(car?.c, at(0, 15, 5))
  const titles = todayRows(E).rows.map((r) => r.title)
  for (const t of ['Nap in the car', 'Leave', 'Home']) assert.ok(titles.includes(t), t)
  assert.match(daySleep(E).say, /^The plan for going out gives Oisín .+ of day sleep\.$/)
  assert.equal(hero(E).outLink, 'Going out at 3pm. Change the plan')
  const v = outView(E, { ...o, mode: 'awake' })
  assert.ok(v.rows.some((r) => r.title === 'Leave') && v.total.endsWith('The aim is 3 hours.'))
  assert.equal(hero(engine(OISIN, week(), at(0, 11, 35))).outLink, 'Going out later? Plan the naps around it')
  // Once home, the day goes back to the usual plan.
  assert.equal(engine(OISIN, week(), at(0, 16, 45), o).activeOut(), false)
})

// 6 October 2026: the timer is one round button that
// says Start, then counts and says Stop, with a line under it saying when to tap.
test('the timer says when to tap it', () => {
  assert.equal(hero(engine(OISIN, week(), at(0, 11, 35))).caption, 'Tap when Oisín falls asleep.')
  const nap = hero(engine(OISIN, [...week(), sleep(at(0, 11, 35), null, 'nap')], at(0, 11, 40)))
  assert.equal(nap.caption, 'Tap when Oisín wakes up.')
  assert.equal(nap.run, at(0, 11, 35))
  const waking = [...week(), sleep(at(0, 10, 1) + 140 * MIN, at(0, 13, 30), 'nap'), sleep(at(0, 19, 0), at(0, 23, 30), 'night')]
  assert.equal(hero(engine(OISIN, waking, at(0, 23, 40))).caption, 'Tap when Oisín is back asleep.')
  assert.equal(hero(engine(OISIN, yesterdayOnly(), at(1, 8, 30))).caption, '')
})

// 7 October 2026: last night can be changed all day. Up to
// 1.0.5 the night left the screen once the baby was up for the day, so nothing could reach it.
let made = 0
const ids = () => `t${++made}`
const saved = (log: Sleep[], E: ReturnType<typeof engine>, d: NonNullable<ReturnType<typeof nightDraft>>) => {
  const { save, gone } = nightSave(E.lastNight()!, d, ids), mine = new Set(save.map((x) => x.id))
  return [...log.filter((x) => !mine.has(x.id) && !gone.includes(x.id)), ...save]
}

test('last night sits above the morning: when the baby went down, the wakings and the time asleep', () => {
  const E = engine(OISIN, week(), at(0, 11, 35)), ln = E.lastNight()!
  assert.equal(ln.segs.length, 3)
  const down = ln.segs[0].s, asleep = at(-1, 23, 41) - down + at(0, 3, 56) - at(-1, 23, 58) + at(0, 6, 55) - at(0, 4, 12)
  assert.equal(ln.asleep, asleep)
  const rows = todayRows(E).rows
  assert.deepEqual(rows.slice(0, 2).map((r) => r.title), ['Last night', 'Up for the day'])
  assert.equal(rows[0].sub, `${fmt(down)} to 6:55am, woke twice`)
  assert.equal(rows[0].right, dur(asleep))
  assert.equal(rows[0].night, true)
  // The sheet opens on the same night, every waking with its time back asleep.
  const d = nightDraft(E)!
  assert.deepEqual(d, { down, wakes: [{ w: at(-1, 23, 41), b: at(-1, 23, 58) }, { w: at(0, 3, 56), b: at(0, 4, 12) }], up: at(0, 6, 55) })
  assert.equal(nightSum(d), `${dur(asleep)} asleep, woke twice`)
  // A nap running keeps it there. At night it is tonight's list that shows, so last night goes.
  assert.ok(engine(OISIN, [...week(), sleep(at(0, 11, 35), null, 'nap')], at(0, 11, 50)).lastNight())
  assert.equal(engine(OISIN, [...week(), sleep(at(0, 19, 0), null, 'night')], at(0, 21, 0)).lastNight(), null)
})

test('changing last night: bedtime moved, a waking taken out, one added, and the day starts at the new up time', () => {
  const log = week(), E = engine(OISIN, log, at(0, 11, 35)), segs = E.lastNight()!.segs
  let d = nightDraft(E)!
  d = { ...d, down: nightPick(d.down, 19, 30), wakes: d.wakes.slice(1) }
  const { save, gone } = nightSave(E.lastNight()!, d, ids)
  // The stretches keep their ids, so a shared log changes the same rows, and the one left over goes.
  assert.deepEqual(save.map((x) => x.id), [segs[0].id, segs[1].id])
  assert.deepEqual(gone, [segs[2].id])
  assert.deepEqual(save.map((x) => [x.s, x.e, x.up]), [[at(-1, 19, 30), at(0, 3, 56), false], [at(0, 4, 12), at(0, 6, 55), true]])
  const after = engine(OISIN, saved(log, E, d), at(0, 11, 35))
  assert.equal(todayRows(after).rows[0].sub, '7:30pm to 6:55am, woke once')
  // A waking goes in the middle of the longest stretch, a quarter of an hour long.
  assert.deepEqual(nightAddWake(d).wakes[0], { w: at(-1, 23, 45), b: at(0, 0, 0) })
  // Up for the day moved to 6:30 moves the start of today with it.
  const early = engine(OISIN, saved(log, E, { ...nightDraft(E)!, up: nightPick(at(0, 6, 55), 6, 30) }), at(0, 11, 35))
  assert.equal(early.dayStart().t, at(0, 6, 30))
  assert.equal(todayRows(early).rows.find((r) => r.wake)?.right, '6:30am')
})

test('a night that was not logged says so, and saving it turns the morning into a whole night', () => {
  const log = [...yesterdayOnly(), mark(at(1, 6, 40))], E = engine(OISIN, log, at(1, 8, 30))
  const r = todayRows(E).rows[0]
  assert.deepEqual([r.title, r.sub, r.right, r.night], ['Last night', 'Not logged', 'Add', true])
  const d = nightDraft(E)!
  assert.deepEqual(d, { down: at(0, 19, 0), wakes: [], up: at(1, 6, 40) })
  const { save, gone } = nightSave(E.lastNight()!, d, ids)
  assert.equal(save.length, 1)
  assert.equal(save[0].id, log[log.length - 1].id)
  assert.deepEqual(gone, [])
  const after = engine(OISIN, saved(log, E, d), at(1, 8, 30))
  assert.equal(after.lastNight()!.logged, true)
  assert.deepEqual([todayRows(after).rows[0].sub, todayRows(after).rows[0].right], ['7pm to 6:40am', '11 h 40 min'])
  assert.equal(after.dayStart().t, at(1, 6, 40))
})

test('a time picked for the night lands on the side of midnight nearest the time it replaces', () => {
  assert.equal(nightPick(at(-1, 23, 40), 0, 10), at(0, 0, 10))
  assert.equal(nightPick(at(0, 0, 10), 23, 50), at(-1, 23, 50))
  assert.equal(nightPick(at(-1, 19, 5), 20, 0), at(-1, 20, 0))
  assert.equal(nightPick(at(0, 6, 55), 6, 30), at(0, 6, 30))
  assert.equal(nightPick(at(-1, 23, 58), 1, 0), at(0, 1, 0))
})

test('the night saves only in order, before now, after the last nap and before the first nap today', () => {
  const E = engine(OISIN, week(), at(0, 11, 35)), ln = E.lastNight()!, d = nightDraft(E)!, now = at(0, 11, 35)
  assert.equal(nightProblem(ln, d, now), '')
  assert.equal(nightProblem(ln, { ...d, wakes: [{ w: at(0, 4, 0), b: at(0, 3, 50) }] }, now), 'Each time has to come after the one above it.')
  assert.equal(nightProblem(ln, { ...d, down: at(-1, 23, 50) }, now), 'Each time has to come after the one above it.')
  assert.equal(nightProblem(ln, { ...d, up: now + 10 * MIN }, now), 'Up for the day has to be before now.')
  assert.equal(nightProblem(ln, { ...d, down: ln.before! - 10 * MIN }, now), `The last nap ended at ${fmt(ln.before!)}. Down for the night has to come after that.`)
  assert.equal(nightProblem(ln, { ...d, up: at(0, 9, 10) }, now), 'The first nap today started at 8:58am. Up for the day has to come before that.')
})

// 8 October 2026: a Tuesday was missing from the week. That morning ended as a waking
// and was never marked up for the day, so the week had no day to put its naps in.
test('a morning left as a waking still starts its day, on the week and in the averages', () => {
  const day = (d: number, up: boolean) => [sleep(at(d - 1, 19, 0), at(d, 6, 30), 'night', up), sleep(at(d, 8, 30), at(d, 9, 15), 'nap'), sleep(at(d, 12, 0), at(d, 12, 40), 'nap')]
  const log = [...day(-4, true), ...day(-3, true), ...day(-2, false), ...day(-1, true), sleep(at(-1, 19, 0), at(0, 6, 30), 'night', true)]
  const w = weekOf(engine(OISIN, log, at(0, 8, 0)))
  assert.equal(w.empty, false)
  if (w.empty) return
  const tue = new Date(at(-2, 12))
  assert.deepEqual(w.rows.map((r) => r.text), ['0 min', '1 h 25 min', '1 h 25 min', '1 h 25 min', '1 h 25 min'])
  assert.equal(w.rows[2].label, `${tue.toLocaleDateString('en-IE', { weekday: 'short' })} ${tue.getDate()}`)
})

test('Start in the day after a waking starts a nap, and the waking becomes up for the day', () => {
  const log = [sleep(at(-1, 19, 0), at(0, 6, 30), 'night')]
  const early = engine(OISIN, log, at(0, 7, 45))
  assert.equal(hero(early).caption, 'Tap when Oisín is back asleep.')
  const back = mainAction(early)
  assert.equal(back.kind === 'add' && back.sleep.kind, 'night')
  const E = engine(OISIN, log, at(0, 8, 20)), a = mainAction(E)
  assert.equal(hero(E).caption, 'Tap when Oisín falls asleep.')
  assert.equal(a.kind, 'add')
  if (a.kind !== 'add') return
  assert.equal(a.sleep.kind, 'nap')
  assert.equal(a.toast, 'Nap started at 8:20am.')
  const after = engine(OISIN, [...log, sleep(a.sleep.s, null, 'nap')], at(0, 8, 38))
  assert.equal(after.phase(), 'nap')
  assert.equal(after.dayStart().t, at(0, 6, 30))
})

test('a wake-up typed in during the night does not make a second day on the week', () => {
  // 9 October 2026: Mon 5 showed twice on This week, one of them 0 min.
  const log = [...week(), sleep(at(-3, 0, 5), at(-3, 0, 5), 'night', true)]
  const w = weekOf(engine(OISIN, log, at(0, 11, 35)))
  if (w.empty) throw new Error('the week is empty')
  const labels = w.rows.map((r) => r.label)
  assert.equal(new Set(labels).size, labels.length)
  assert.ok(!w.rows.some((r) => !r.today && r.value === 0))
  assert.equal(w.rows.length, 7)
})

// After a short nap the parent picks how to make it up, from 1.0.17. From 11 October 2026 the
// choice comes only with one nap left in the day, where waking the baby is the other option.
test('a short morning nap brings the next nap sooner and asks nothing', () => {
  const log = [...week().slice(0, -1), sleep(at(0, 8, 58), at(0, 9, 25), 'nap')], h = hero(engine(OISIN, log, at(0, 9, 40)))
  assert.equal(plain(h.big), '11:25 am')
  assert.equal(h.ways, null)
})

test('a short nap with one nap left gives two ways to make it up, and the day follows the one picked', () => {
  const log = [...week(), sleep(at(0, 12, 15), at(0, 12, 45), 'nap')], now = at(0, 13, 0)
  const h = hero(engine(OISIN, log, now))
  assert.equal(plain(h.big), '2:55 pm')
  assert.equal(h.ways?.say, 'That nap was short. Here are two ways to make it up.')
  assert.deepEqual(h.ways?.opts, [
    { id: 'sooner', title: 'Nap sooner', line: 'Nap at 2:55pm. Bedtime 7pm.', on: true },
    { id: 'bed', title: 'Earlier bedtime', line: 'Nap at 3:15pm. Bedtime 6pm.', on: false },
  ])
  const picked = { ...OISIN, route: { day: dayFloor(OISIN, now), pick: 'bed' as const, by: h.ways!.by }, routeLikes: 'bed' as const }
  const E = engine(picked, log, now), b = hero(E)
  // Earlier bedtime keeps the last nap at its time, and the day's sleep sum asks for no more.
  assert.equal(plain(b.big), '3:15 pm')
  assert.equal(b.sub, 'Put Oisín down between 3:05 and 3:25pm.')
  assert.equal(fmt(E.budget().bedT), '6pm')
  assert.deepEqual(b.ways?.opts.map((o) => [o.id, o.on]), [['bed', true], ['sooner', false]])
  // The two stay where they were at the tap for the rest of the day.
  assert.deepEqual(hero(engine({ ...picked, route: { ...picked.route, first: 'sooner' } }, log, now)).ways?.opts.map((o) => [o.id, o.on]), [['sooner', false], ['bed', true]])
  // The pick is for the day it was made on. The next day starts as usual.
  assert.equal(fmt(engine({ ...picked, route: { ...picked.route, day: picked.route.day - 864e5 } }, log, now).budget().bedT), '7pm')
})

test('a nap of 40 minutes or more gives no choice, and the chair method puts earlier bedtime first', () => {
  assert.equal(hero(engine(OISIN, week(), at(0, 11, 35))).ways, null)
  const log = [...week(), sleep(at(0, 12, 15), at(0, 12, 45), 'nap')]
  const chair = { from: '2020-01-01', held: [], settles: [], inCot: null }
  assert.deepEqual(hero(engine({ ...OISIN, chair }, log, at(0, 13, 0))).ways?.opts.map((o) => o.id), ['bed', 'sooner'])
})

// 11 October 2026: a tap of the timer to add a nap was read as a nap of no minutes. It brought up
// the two ways and set the next nap from the time of the tap.
test('a tap of the timer waits in the list for its times, and the plan and the two ways leave it out', () => {
  const t = [...week(), sleep(at(0, 11, 30), at(0, 11, 30) + 40e3, 'nap')], n = at(0, 11, 35), E = engine(OISIN, t, n), W = engine(OISIN, week(), n)
  assert.equal(plain(hero(E).big), plain(hero(W).big))
  assert.equal(hero(E).ways, null)
  assert.equal(daySleep(E).say, daySleep(W).say)
  const row = todayRows(E).rows.find((r) => r.title === 'Nap, set the times')
  assert.deepEqual([row?.right, row?.edit], ['11:30am', t[t.length - 1].id])
})

// 11 October 2026: the day's naps fell short, the screen gave an early bedtime of 6:30pm, and the
// baby put down at 6pm was logged as napping, with bedtime still on the list for 7pm.
const shortDay = () => [sleep(at(-1, 19, 53), at(0, 5, 0), 'night'), sleep(at(0, 6, 0), at(0, 7, 30), 'night', true),
  sleep(at(0, 7, 45), at(0, 8, 30), 'nap'), sleep(at(0, 10, 35), at(0, 11, 11), 'nap'), sleep(at(0, 14, 50), at(0, 15, 15), 'nap')]

// At five months the plan still held a short nap for 4:45pm, long gone by 6, so the tap was read
// against that nap and never against the bedtime on the screen.
test('a baby put down for the early bedtime the screen gave is down for the night', () => {
  for (const baby of [AT_FIVE_MONTHS, OISIN]) {
    const E = engine(baby, shortDay(), at(0, 18, 0)), a = mainAction(E)
    assert.deepEqual([hero(E).eyebrow, plain(hero(E).big)], ['Early bedtime', '6:30 pm'])
    assert.deepEqual(a.kind === 'add' && [a.sleep.kind, a.toast], ['night', 'Down for the night at 6pm.'])
    const down = engine(baby, [...shortDay(), sleep(at(0, 18, 0), null, 'night')], at(0, 19, 26))
    assert.equal(down.phase(), 'night')
    assert.equal(hero(down).sub, 'Down for the night at 6pm.')
    assert.ok(todayRows(down).rows.some((r) => r.title === 'Down for the night' && r.right === '6pm'))
    assert.ok(!todayRows(down).rows.some((r) => r.title === 'Napping' || r.title === 'Bedtime'))
  }
  assert.equal(fmt(engine(AT_FIVE_MONTHS, shortDay(), at(0, 18, 0)).plan()[0].c), '4:45pm')
  // The list after bedtime still asks about the afternoon with no nap in it.
  const down = engine(AT_FIVE_MONTHS, [...shortDay(), sleep(at(0, 18, 0), null, 'night')], at(0, 19, 26))
  assert.equal(todayRows(down).rows.find((r) => r.mark === 'gap')?.title, 'Nothing logged 11:11am to 2:50pm')
  // While a nap can still be asked for, a tap is a nap.
  const four = mainAction(engine(AT_FIVE_MONTHS, shortDay(), at(0, 16, 40)))
  assert.equal(four.kind === 'add' && four.sleep.kind, 'nap')
})

test('with earlier bedtime picked and the last nap missed, a tap from half an hour before that bedtime is the night', () => {
  const log = [...week(), sleep(at(0, 12, 15), at(0, 12, 45), 'nap')]
  const picked = { ...OISIN, route: { day: dayFloor(OISIN, at(0, 13, 0)), pick: 'bed' as const, by: 60 } }
  assert.equal(fmt(engine(picked, log, at(0, 17, 35)).budget().bedT), '6pm')
  const a = mainAction(engine(picked, log, at(0, 17, 35))), early = mainAction(engine(picked, log, at(0, 16, 30)))
  assert.deepEqual(a.kind === 'add' && [a.sleep.kind, a.toast], ['night', 'Down for the night at 5:35pm.'])
  assert.equal(early.kind === 'add' && early.sleep.kind, 'nap')
})

// 11 October 2026: awake from 5 to 6am and asleep again until 7:30, with the usual wake-up at 7.
// The list said up for the day at 5am and a nap from 6.
test('a sleep that starts before the usual wake-up carries on the night logged before it', () => {
  const night = [sleep(at(-1, 19, 0), at(0, 5, 0), 'night', true)]
  const E = engine(OISIN, night, at(0, 6, 0)), a = mainAction(E)
  assert.equal(E.phase(), 'day')
  assert.deepEqual(a.kind === 'add' && [a.sleep.kind, a.back, a.toast], ['night', true, 'Back asleep at 6am.'])
  // The chair method reads it as back asleep too, and asks for no bedtime.
  const chair = { from: '2020-01-01', held: [], settles: [], inCot: null }
  assert.equal(chairTap(engine({ ...OISIN, chair }, night, at(0, 6, 0)), chair, at(0, 6, 0)), null)
  const asleep = engine(OISIN, [...night, sleep(at(0, 6, 0), null, 'night')], at(0, 6, 40))
  assert.equal(asleep.phase(), 'night')
  assert.equal(hero(asleep).sub, 'Since 6am. Down for the night at 7pm and woke once.')
  assert.equal(mainAction(engine(OISIN, [...night, sleep(at(0, 6, 0), null, 'night')], at(0, 7, 30))).kind, 'ask')
  const up = engine(OISIN, [...night, sleep(at(0, 6, 0), at(0, 7, 30), 'night', true)], at(0, 8, 0))
  assert.equal(up.dayStart().t, at(0, 7, 30))
  assert.deepEqual(todayRows(up).rows.slice(0, 2).map((r) => [r.title, r.sub ?? '', r.right]), [['Last night', '7pm to 7:30am, woke once', '11 h 30 min'], ['Up for the day', '', '7:30am']])
  // A sleep added by hand goes in the same way, and ends with the baby up for the day.
  assert.equal(kindFor(OISIN, at(0, 6, 0), night), 'night')
  assert.deepEqual(newSleep(OISIN, night, at(0, 6, 0), at(0, 7, 30)), { kind: 'night', up: true })
  // From the usual wake-up on it is a nap, and so is one after a morning typed in without its night.
  assert.equal(kindFor(OISIN, at(0, 7, 5), night), 'nap')
  const mark = [sleep(at(0, 5, 0), at(0, 5, 0), 'night', true)]
  assert.equal(kindFor(OISIN, at(0, 6, 0), mark), 'nap')
  const tap = mainAction(engine(OISIN, mark, at(0, 6, 0)))
  assert.equal(tap.kind === 'add' && tap.sleep.kind, 'nap')
  // A nap already logged since the wake-up leaves the next sleep a nap.
  assert.equal(kindFor(OISIN, at(0, 6, 50), [...night, sleep(at(0, 5, 40), at(0, 6, 20), 'nap')]), 'nap')
})

test('a stretch of night saved after up for the day reads as one night with a waking', () => {
  const log = [sleep(at(-1, 19, 53), at(0, 5, 0), 'night', true), sleep(at(0, 6, 0), at(0, 7, 30), 'night'), sleep(at(0, 7, 45), at(0, 8, 30), 'nap')]
  const E = engine(OISIN, log, at(0, 9, 0)), ln = E.lastNight()
  assert.equal(E.dayStart().t, at(0, 7, 30))
  assert.deepEqual([ln?.wakes, ln?.segs.length, dur(ln?.asleep ?? 0)], [1, 2, '10 h 37 min'])
  assert.deepEqual(E.napsSince(E.dayStart().t).map((x) => x.s), [at(0, 7, 45)])
  // That evening's night, twelve hours on, is a new night.
  const eve = engine(OISIN, [...log, sleep(at(0, 19, 0), null, 'night')], at(0, 20, 0))
  assert.equal(eve.nightSegs().length, 1)
  assert.equal(eve.nightDay().t0, at(0, 7, 30))
})

// 11 October 2026: the list asked `Did Oisín nap in there?` and gave only Add.
test('No to a stretch with no nap logged takes the question off the list and the graph', () => {
  const log = [sleep(at(-1, 19, 10), at(0, 7, 0), 'night', true), sleep(at(0, 11, 5), at(0, 11, 45), 'nap')], now = at(0, 12, 30)
  const gap = todayRows(engine(OISIN, log, now)).rows.find((r) => r.mark === 'gap')
  assert.deepEqual([gap?.title, gap?.sub, gap?.right], ['Nothing logged 7 to 11:05am', 'Did Oisín nap in there?', ''])
  const said = { ...OISIN, noNap: withNoNap(OISIN, gap!.gap![0], gap!.gap![1], now) }
  const E = engine(said, log, now)
  assert.equal(todayRows(E).rows.some((r) => r.mark === 'gap'), false)
  assert.equal(daySleep(E).gaps, false)
  // The nap moved to start earlier leaves a shorter stretch inside the one answered for.
  assert.equal(todayRows(engine(said, [log[0], sleep(at(0, 10, 50), at(0, 11, 45), 'nap')], now)).rows.some((r) => r.mark === 'gap'), false)
  // A later stretch is still asked about, after bedtime too.
  const later = [...log, sleep(at(0, 19, 5), null, 'night')]
  assert.equal(todayRows(engine(said, later, at(0, 19, 30))).rows.find((r) => r.mark === 'gap')?.title, 'Nothing logged 11:45am to 7:05pm')
  // Answers older than three days are dropped, and the same answer is kept once.
  const old = { ...OISIN, noNap: [[at(-5, 9, 0), at(-5, 13, 0)], [at(0, 7, 0), at(0, 11, 5)]] as [number, number][] }
  assert.deepEqual(withNoNap(old, at(0, 7, 0), at(0, 11, 5), now), [[at(0, 7, 0), at(0, 11, 5)]])
})

// 11 October 2026: the early bedtime at 6pm that 1.0.27 logged as a nap ran to the morning, and the
// week would have counted thirteen hours of day sleep.
test('a nap from the evening that ran three hours or more is read as the night', () => {
  const day = shortDay(), stuck = sleep(at(0, 18, 0), null, 'nap')
  assert.equal(engine(OISIN, [...day, stuck], at(0, 19, 26)).phase(), 'nap')
  const late = engine(OISIN, [...day, stuck], at(0, 21, 5))
  assert.equal(late.phase(), 'night')
  assert.equal(hero(late).sub, 'Down for the night at 6pm.')
  assert.equal(mainAction(engine(OISIN, [...day, stuck], at(1, 7, 0))).kind, 'ask')
  // Ended in the morning by the older version, it is still the night, and the day keeps its naps.
  const next = [...day, sleep(at(0, 18, 0), at(1, 7, 0), 'nap'), sleep(at(1, 7, 0), at(1, 7, 0), 'night', true), sleep(at(1, 9, 30), at(1, 10, 30), 'nap')]
  const w = weekOf(engine(OISIN, next, at(1, 11, 0)))
  assert.deepEqual(w.empty ? [] : w.rows.map((r) => r.text), ['1 h', '1 h 46 min'])
  // A long afternoon nap and a late nap that ended by bedtime stay naps.
  assert.equal(asLogged(OISIN, sleep(at(0, 13, 0), at(0, 16, 10), 'nap')).kind, 'nap')
  assert.equal(asLogged(OISIN, sleep(at(0, 17, 30), at(0, 18, 15), 'nap')).kind, 'nap')
})
