/// <reference types="node" />
// What Baby Nap Track sends to PostHog. The free week ending is sent once, on the day the nap times lock, and no event
// carries the baby's name or a sleep time.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DAY, isMark } from '../src/lib/engine.ts'
import { NO_SHOP, gate, type Paid } from '../src/lib/shop.ts'
import { NOT_TOLD, NO_SOURCE, dayKey, due, freeDay, parseReferrer, toldOnLoad, type Told } from '../src/lib/track.ts'
import { OISIN, at, week } from './sample.ts'

const phone = (paid: Partial<Paid> = {}, told: Partial<Told> = {}) =>
  ({ baby: OISIN, sleeps: week(), share: null, paid: { ...NO_SHOP, ...paid }, told: { ...NOT_TOLD, first: true, ...told } })
const N = week().filter((x) => !isMark(x)).length
const keys = (s: ReturnType<typeof phone>, now: number) => due(s, gate(s.paid, now), now).map((x) => x.key)

test('a new phone sends its first open and the day, once each', () => {
  const now = at(0, 10, 0)
  const s = { ...phone(), told: NOT_TOLD }
  assert.deepEqual(keys(s, now), ['first', 'day'])
  assert.deepEqual(keys(phone({}, { day: dayKey(now) }), now), [])
})

test('the free week starts the first time Play has a price', () => {
  const now = at(0, 10, 0)
  assert.deepEqual(keys(phone({ price: '€9.99', trialFrom: now }, { day: dayKey(now) }), now), ['started'])
  assert.deepEqual(keys(phone({ price: '€9.99', trialFrom: now }, { day: dayKey(now), started: true }), now), [])
})

test('day 7 is the last free day, and the free week ends on day 8, sent once', () => {
  const from = at(0, 10, 0)
  for (let d = 0; d <= 7; d++) {
    const now = from + d * DAY + 2 * 3600000
    const s = phone({ price: '€9.99', trialFrom: from }, { started: true })
    const out = due(s, gate(s.paid, now), now)
    assert.equal(gate(s.paid, now).kind, 'trial', `day ${d}`)
    assert.deepEqual(out.map((x) => x.key), ['day'], `day ${d}`)
    assert.deepEqual(out[0].ev, { event: 'snug_day', day: d, gate: 'trial', sleeps: N, shared: false })
  }
  const day8 = from + 8 * DAY - 9 * 3600000
  const s = phone({ price: '€9.99', trialFrom: from }, { started: true, day: dayKey(day8) })
  assert.equal(freeDay(from, day8), 8)
  assert.deepEqual(due(s, gate(s.paid, day8), day8).map((x) => x.ev), [{ event: 'snug_free_week_ended', sleeps: N, shared: false }])
  assert.deepEqual(keys({ ...s, told: { ...s.told, ended: true } }, day8), [])
})

test('a phone that paid during the free week never sends the free week ending', () => {
  const from = at(0, 10, 0), now = from + 12 * DAY
  assert.deepEqual(keys(phone({ price: '€9.99', trialFrom: from, owned: true }, { started: true, day: dayKey(now) }), now), [])
})

test('a clock change keeps the day count whole', () => {
  const from = new Date(2026, 9, 21, 9).getTime(), now = new Date(2026, 9, 28, 21).getTime()
  assert.equal(freeDay(from, now), 7)
})

test('a phone from before this version is not counted as a new open', () => {
  assert.deepEqual(toldOnLoad(null), NOT_TOLD)
  assert.deepEqual(toldOnLoad({ paid: { trialFrom: null } }), { ...NOT_TOLD, first: true, started: false })
  assert.deepEqual(toldOnLoad({ paid: { trialFrom: 1 } }), { ...NOT_TOLD, first: true, started: true })
  assert.deepEqual(toldOnLoad({ told: { first: true, ended: true } }), { ...NOT_TOLD, first: true, ended: true })
})

test('no event carries the name or a sleep time', () => {
  const from = at(0, 10, 0), now = from + 9 * DAY
  const s = { ...phone({ price: '€9.99', trialFrom: from }), told: NOT_TOLD }
  const sent = JSON.stringify(due(s, gate(s.paid, now), now))
  assert.ok(!sent.includes(OISIN.name))
  for (const x of week()) assert.ok(!sent.includes(String(x.s)))
})

test('the first open says where Play installed the app from', () => {
  assert.deepEqual(parseReferrer('utm_source=google-play&utm_medium=organic'), { source: 'google-play', medium: 'organic', campaign: null, ad: false })
  assert.deepEqual(parseReferrer('utm_source=google&utm_medium=cpc&utm_campaign=spring-naps'), { source: 'google', medium: 'cpc', campaign: 'spring-naps', ad: false })
  assert.deepEqual(parseReferrer('utm_source%3Dgoogle%26utm_medium%3Dcpc%26utm_campaign%3Dspring-naps'), { source: 'google', medium: 'cpc', campaign: 'spring-naps', ad: false })
  assert.deepEqual(parseReferrer(''), NO_SOURCE)
  assert.deepEqual(parseReferrer(null), NO_SOURCE)
  assert.deepEqual(parseReferrer('utm_campaign=Snug Page!<b>'), { source: null, medium: null, campaign: 'snugpageb', ad: false })
  const now = at(0, 10, 0), s = { ...phone(), told: NOT_TOLD }
  const from = parseReferrer('utm_source=google&utm_campaign=spring-naps')
  assert.deepEqual(due(s, gate(s.paid, now), now, from)[0].ev, { event: 'snug_first_open', ...from })
})

test('a Google Ads click is counted as an ad, and its id is never sent', () => {
  const raw = 'gclid=Cj0KCQjw-secret-click-id&utm_source=google'
  const from = parseReferrer(raw)
  assert.equal(from.ad, true)
  assert.equal(from.source, 'google')
  assert.ok(!JSON.stringify(from).includes('secret'))
  assert.equal(parseReferrer('gbraid=0AAAAA').ad, true)
})
