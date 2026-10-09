/// <reference types="node" />
// The parent's email, from 9 October 2026: which addresses go, and what the parent is told.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { looksLikeEmail, signUp, signUpProblem } from '../src/lib/signup.ts'

test('an address needs a name, an at and a domain with a dot', () => {
  for (const ok of ['parent@example.com', ' second.parent@example.co.uk ']) assert.equal(looksLikeEmail(ok), true)
  for (const bad of ['', 'nope', 'parent@', '@example.com', 'parent@example', 'two words@example.com']) assert.equal(looksLikeEmail(bad), false)
})

test('a bad address is turned back on the phone, before anything is sent', async () => {
  assert.equal(await signUp('nope', 'setup'), 'bad')
  assert.equal(signUpProblem('bad'), "That doesn't look like an email address. Check it and try again.")
  assert.equal(signUpProblem('offline'), 'No internet connection. Try again when you are online.')
  assert.equal(signUpProblem('ok'), '')
})
