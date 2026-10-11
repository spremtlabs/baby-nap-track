import test from 'node:test'
import assert from 'node:assert/strict'
import { NO_RATE, napOn, rateDue } from '../src/lib/rate.ts'

test('the rating card is due on the third day a nap starts from the timer', () => {
  let r = napOn(NO_RATE, '2026-10-12')
  assert.equal(rateDue(r), false)
  r = napOn(r, '2026-10-13')
  assert.equal(rateDue(r), false)
  r = napOn(r, '2026-10-15')
  assert.deepEqual(r, { days: 3, last: '2026-10-15', asked: false })
  assert.equal(rateDue(r), true)
})

test('three naps on one day count as one day', () => {
  let r = NO_RATE
  for (let i = 0; i < 3; i++) r = napOn(r, '2026-10-12')
  assert.equal(r.days, 1)
  assert.equal(rateDue(r), false)
})

test('a phone the card was asked for is never due again', () => {
  const r = { days: 3, last: '2026-10-15', asked: true }
  assert.equal(napOn(r, '2026-10-16'), r)
  assert.equal(rateDue(r), false)
})

test('a day the store could not be asked leaves the card due at the next nap', () => {
  const r = napOn({ days: 3, last: '2026-10-15', asked: false }, '2026-10-16')
  assert.equal(rateDue(r), true)
})
