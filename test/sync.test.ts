/// <reference types="node" />
// Share links. The join page moved twice, the second time to babynaptrack.com on 10 October 2026. A new link names the new address, and a link sent before
// either move still joins the same log.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { JOIN_PAGE, keyFrom, linkFor } from '../src/lib/sync.ts'

const KEY = 'aB3_dE6-gH9iJ2kL5mN8oP1qR4sT7uV0wX'

test('a new share link names the babynaptrack.com join page', () => {
  assert.equal(JOIN_PAGE, 'https://babynaptrack.com/join/')
  assert.equal(linkFor(KEY), `https://babynaptrack.com/join/#${KEY}`)
})

test('a link sent before either move, a new link and a bare key all give the same key', () => {
  assert.equal(keyFrom(`https://example.com/snug/join/#${KEY}`), KEY)
  assert.equal(keyFrom(`https://example.com/baby-nap-track/join/#${KEY}`), KEY)
  assert.equal(keyFrom(`Log Cian's sleep with me in Baby Nap Track: https://babynaptrack.com/join/#${KEY}`), KEY)
  assert.equal(keyFrom(`  ${KEY}  `), KEY)
})
