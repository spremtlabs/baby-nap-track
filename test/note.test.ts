import test from 'node:test'
import assert from 'node:assert/strict'
import { HELLO, NOTE, firstDayFor, noteDue, opening } from '../src/lib/note.ts'

test('a new phone sees no note on its first day and sees it the day after', () => {
  const c = { firstDay: firstDayFor(false, '2026-10-12'), noted: false }
  assert.equal(noteDue(c, true, '2026-10-12'), false)
  assert.equal(noteDue(c, true, '2026-10-13'), true)
})

test('a phone that already had a baby sees the note at its next open', () => {
  const c = { firstDay: firstDayFor(true, '2026-10-12'), noted: false }
  assert.equal(noteDue(c, true, '2026-10-12'), true)
})

test('the note shows once, and never before setup', () => {
  assert.equal(noteDue({ firstDay: 'before', noted: true }, true, '2026-10-13'), false)
  assert.equal(noteDue({ firstDay: 'before', noted: false }, false, '2026-10-13'), false)
  assert.equal(noteDue({ firstDay: null, noted: false }, true, '2026-10-13'), false)
})

test('the chat opens on the note once it has been seen', () => {
  assert.equal(opening({ firstDay: 'before', noted: false }), HELLO)
  assert.equal(opening({ firstDay: 'before', noted: true }), NOTE)
})
