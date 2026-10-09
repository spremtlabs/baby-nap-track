/// <reference types="node" />
// Share links. The pages moved from tracy.spremtlabs.com/snug/ to /baby-nap-track/ on 9 October 2026.
// A new link names the new address, and a link sent before the move still joins the same log.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { JOIN_PAGE, keyFrom, linkFor } from '../src/lib/sync.ts'

const KEY = 'aB3_dE6-gH9iJ2kL5mN8oP1qR4sT7uV0wX'

test('a new share link names the /baby-nap-track/ join page', () => {
  assert.equal(JOIN_PAGE, 'https://tracy.spremtlabs.com/baby-nap-track/join/')
  assert.equal(linkFor(KEY), `https://tracy.spremtlabs.com/baby-nap-track/join/#${KEY}`)
})

test('a link sent before the move, a new link and a bare key all give the same key', () => {
  assert.equal(keyFrom(`https://tracy.spremtlabs.com/snug/join/#${KEY}`), KEY)
  assert.equal(keyFrom(`Log Cian's sleep with me in Baby Nap Track: https://tracy.spremtlabs.com/baby-nap-track/join/#${KEY}`), KEY)
  assert.equal(keyFrom(`  ${KEY}  `), KEY)
})
