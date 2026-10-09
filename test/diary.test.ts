/// <reference types="node" />
// The sleep diary a parent sends a sleep consultant, from 7 October 2026.
// Each line runs from 6pm to 6pm, as a sleep clinic's log does.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MIN, type Sleep } from '../src/lib/engine.ts'
import { diary, full } from '../src/lib/diary.ts'
import { base64 } from '../src/lib/send.ts'
import { dur } from '../src/lib/words.ts'
import { OISIN, at, sleep, week } from './sample.ts'

test('a week of lines, each from 6pm, with the night, its wakings, up for the day and the naps after', () => {
  const now = at(0, 11, 35), d = diary(OISIN, week(), now, 7)
  assert.equal(d.nights.length, 7)
  assert.equal(d.nights[0].six, at(-7, 18, 0))
  const last = d.nights[6]
  assert.equal(last.six, at(-1, 18, 0))
  assert.equal(last.partial, true)
  assert.deepEqual(last.wakes, [{ w: at(-1, 23, 41), b: at(-1, 23, 58) }, { w: at(0, 3, 56), b: at(0, 4, 12) }])
  assert.equal(last.up, at(0, 6, 55))
  assert.deepEqual(last.naps, [{ s: at(0, 8, 58), e: at(0, 10, 1) }])
  assert.equal(last.night, last.stretches.reduce((a, x) => a + x.e - x.s, 0))
  // Every whole line has its night up to the morning and three naps the next day.
  for (const n of d.nights.slice(0, 6)) { assert.ok(n.bed != null && n.up != null); assert.equal(n.naps.length, 3); assert.equal(n.partial, false) }
  assert.equal(d.base, `Oisín sleep diary ${new Date(at(-7, 18, 0)).toLocaleDateString('en-IE', { day: 'numeric', month: 'short' })} to ${new Date(now).toLocaleDateString('en-IE', { day: 'numeric', month: 'short' })} ${new Date(now).getFullYear()}`)
})

test('the averages leave out what is not finished: the day still going and a night not logged', () => {
  const d = diary(OISIN, week(), at(0, 11, 35), 7)
  const whole = d.nights.slice(0, 6), nights = d.nights
  assert.equal(d.avgDay, whole.reduce((a, n) => a + n.day, 0) / 6)
  assert.equal(d.avgNight, nights.reduce((a, n) => a + n.night, 0) / 7)
  assert.equal(d.wakings, nights.reduce((a, n) => a + n.wakes.length, 0) / 7)
  assert.ok(d.bedtime! >= at(-7, 18, 40) && d.bedtime! <= at(-7, 19, 20))
})

test('a morning typed in without its night says the night was not logged', () => {
  const log = [...week(), sleep(at(0, 12, 20), at(0, 13, 35), 'nap'), sleep(at(1, 6, 40), at(1, 6, 40), 'night', true)]
  const d = diary(OISIN, log, at(1, 8, 30), 3), n = d.nights[2]
  assert.equal(n.six, at(0, 18, 0))
  assert.equal(n.bed, null)
  assert.equal(n.night, 0)
  assert.match(d.html, /Not logged/)
  // Not logged is left out of the averages.
  assert.equal(d.avgNight, (d.nights[0].night + d.nights[1].night) / 2)
})

test('a night still going is counted so far, and the line marks when the diary was sent', () => {
  const log = [...week(), sleep(at(0, 19, 5), at(0, 23, 30), 'night'), sleep(at(0, 23, 46), null, 'night')]
  const d = diary(OISIN, log, at(1, 2, 10), 3), n = d.nights[2]
  assert.equal(n.six, at(0, 18, 0))
  assert.equal(n.up, null)
  assert.equal(n.night, at(1, 2, 10) - at(0, 23, 46) + at(0, 23, 30) - at(0, 19, 5))
  assert.match(d.html, new RegExp(`${dur(n.night)} so far`))
  assert.match(d.html, /When the diary was sent/)
})

test('the spreadsheet has one row for each sleep, both times with their date', () => {
  const d = diary(OISIN, week(), at(0, 11, 35), 3)
  const lines = d.csv.trim().split('\r\n')
  assert.equal(lines[0], 'Sleep,Fell asleep,Woke,Minutes')
  const n = d.nights.reduce((a, x) => a + x.stretches.length + x.naps.length, 0)
  assert.equal(lines.length, n + 1)
  const pad = (v: number) => String(v).padStart(2, '0')
  const iso = (t: number) => { const x = new Date(t); return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())} ${pad(x.getHours())}:${pad(x.getMinutes())}` }
  assert.ok(lines.includes(`Nap,${iso(at(0, 8, 58))},${iso(at(0, 10, 1))},63`))
  assert.ok(lines.includes(`Night,${iso(at(-1, 23, 58))},${iso(at(0, 3, 56))},${Math.round((at(0, 3, 56) - at(-1, 23, 58)) / MIN)}`))
})

test('the page reads as written: times with their minutes, the birth date, and nothing empty', () => {
  const d = diary(OISIN, week(), at(0, 11, 35), 7)
  assert.equal(full(at(0, 19, 0)), '7:00pm')
  for (const want of ['Oisín was born on', 'This diary runs from 6pm on', 'When the diary was sent', 'Night by night', '11:41pm, awake 17 min', 'Made with Baby Nap Track'])
    assert.ok(d.html.includes(want), want)
  for (const bad of ['undefined', 'NaN', 'null', 'Infinity']) assert.ok(!d.html.includes(bad), bad)
})

test('a diary across the new year names both years', () => {
  const s: Sleep[] = [sleep(new Date(2026, 11, 31, 19, 0).getTime(), new Date(2027, 0, 1, 7, 0).getTime(), 'night', true)]
  const d = diary(OISIN, s, new Date(2027, 0, 2, 9, 0).getTime(), 3)
  assert.equal(d.base, 'Oisín sleep diary 31 Dec 2026 to 2 Jan 2027')
})

test('the spreadsheet goes to the share panel as UTF-8 base64', () => {
  for (const t of ['Sleep,Fell asleep\r\n', 'Oisín', 'Siún 🌙', '']) assert.equal(base64(t), Buffer.from(t, 'utf8').toString('base64'))
})

test('two weeks asked of a log that holds eight nights starts at the first night, with nothing empty above it', () => {
  const d = diary(OISIN, week(), at(0, 11, 35), 14)
  assert.equal(d.nights[0].six, at(-8, 18, 0))
  assert.equal(d.nights.length, 8)
  assert.ok(d.nights.every((n) => !n.empty))
  assert.ok(d.base.startsWith(`Oisín sleep diary ${new Date(at(-8, 18, 0)).toLocaleDateString('en-IE', { day: 'numeric', month: 'short' })} to`))
  // A day with no nap logged stays out of the day sleep average.
  const gap = diary(OISIN, week().filter((x) => !(x.kind === 'nap' && x.s >= at(-3, 6, 0) && x.s < at(-3, 18, 0))), at(0, 11, 35), 7)
  const counted = gap.nights.filter((n) => !n.partial && n.naps.length)
  assert.equal(counted.length, 5)
  assert.equal(gap.avgDay, counted.reduce((a, n) => a + n.day, 0) / 5)
})
