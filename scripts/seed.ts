// The saved state for one scenario, the way the app keeps it on the phone. The gate and the store
// screenshots load it into the web build's storage before the page opens.
import { MIN } from '../src/lib/engine.ts'
import { eveningOf } from '../src/lib/chair.ts'
import { CIAN, OISIN, at, sleep, week } from '../test/sample.ts'

export const STORE_KEY = 'snug.state.v1'

export function seed (scenario: 'morning' | 'short' | 'night' | 'tomorrow' | 'v1' | 'evening' | 'gap' | 'chair' | 'chair-morning' | 'short-nap' | 'young'): { state: string; now: number } {
  // A baby of ten weeks, for the chair method in Settings before six months, from 1.0.18.
  if (scenario === 'young') {
    return { state: JSON.stringify({ baby: CIAN, sleeps: week(), alerts: true, lead: 15, share: null, babyAt: 1, unsent: [], babyUnsent: false }), now: at(0, 11, 35) }
  }
  // A morning nap of 27 minutes, at 9:40am: the two ways to make it up, from 1.0.17.
  if (scenario === 'short-nap') {
    const sleeps = [...week().slice(0, -1), sleep(at(0, 8, 58), at(0, 9, 25), 'nap')]
    return { state: JSON.stringify({ baby: OISIN, sleeps, alerts: true, lead: 15, share: null, babyAt: 1, unsent: [], babyUnsent: false }), now: at(0, 9, 40) }
  }
  // The chair method from mock chair-method v4. Night 4 at 6:50pm with bedtime at 7, three nights
  // settled beside the cot; or the morning after night 4, with four nights settled.
  if (scenario === 'chair' || scenario === 'chair-morning') {
    const ago = scenario === 'chair' ? 3 : 4, mins = [46, 38, 24, 31].slice(0, ago)
    const settles = mins.map((m, i) => ({ night: eveningOf(at(i - ago, 19, 0)), inCot: at(i - ago, 19, 0), asleep: at(i - ago, 19, 0) + m * MIN, trips: 2, cry: 'some' }))
    const baby = { ...OISIN, chair: { from: eveningOf(at(-ago, 19, 0)), held: [], settles, inCot: null } }
    const sleeps = week()
    if (scenario === 'chair') sleeps.push(sleep(at(0, 12, 20), at(0, 13, 30), 'nap'), sleep(at(0, 15, 50), at(0, 16, 40), 'nap'))
    const state = { baby, sleeps, alerts: true, lead: 15, share: null, babyAt: 1, unsent: [], babyUnsent: false }
    return { state: JSON.stringify(state), now: scenario === 'chair' ? at(0, 18, 50) : at(0, 11, 35) }
  }
  // 5 October 2026: up at 7, the morning nap added that evening and saved by 1.0.4 as a night,
  // three naps after it, and down for the night at 7:39pm.
  if (scenario === 'evening' || scenario === 'gap') {
    const day = [sleep(at(-1, 19, 10), at(0, 7, 0), 'night', true), ...(scenario === 'evening' ? [sleep(at(0, 8, 30), at(0, 10, 0), 'night')] : []),
      sleep(at(0, 11, 5), at(0, 11, 45), 'nap'), sleep(at(0, 13, 50), at(0, 14, 25), 'nap'), sleep(at(0, 16, 10), at(0, 16, 30), 'nap')]
    if (scenario === 'evening') day.push(sleep(at(0, 19, 39), null, 'night'))
    const state = { baby: OISIN, sleeps: day, alerts: true, lead: 15, share: null, babyAt: 1, unsent: [], babyUnsent: false }
    return { state: JSON.stringify(state), now: scenario === 'evening' ? at(0, 19, 45) : at(0, 17, 0) }
  }
  if (scenario === 'v1') {
    // A phone set up on version 1.0.0 at 1pm, told the baby last woke an hour before.
    const state = { baby: OISIN, sleeps: [], anchor: { t: at(0, 12, 0), k: 1 }, alerts: true, lead: 15, share: null, babyAt: 1, unsent: [], babyUnsent: false }
    return { state: JSON.stringify(state), now: at(0, 13, 0) }
  }
  const sleeps = week(scenario === 'short')
  // The next morning, with yesterday's afternoon naps logged and the night not.
  if (scenario === 'tomorrow') {
    sleeps.push(sleep(at(0, 12, 20), at(0, 13, 35), 'nap'), sleep(at(0, 16, 15), at(0, 16, 55), 'nap'))
    const state = { baby: OISIN, sleeps, alerts: true, lead: 15, share: null, babyAt: 1, unsent: [], babyUnsent: false }
    return { state: JSON.stringify(state), now: at(1, 8, 30) }
  }
  if (scenario === 'night') sleeps.push(sleep(at(0, 10, 1) + 140 * MIN, at(0, 13, 30), 'nap'), sleep(at(0, 15, 50), at(0, 16, 40), 'nap'), sleep(at(0, 19, 0), at(0, 23, 30), 'night'), sleep(at(0, 23, 46), null, 'night'))
  const state = { baby: OISIN, sleeps, alerts: true, lead: 15, share: null, babyAt: 1, unsent: [], babyUnsent: false }
  return { state: JSON.stringify(state), now: scenario === 'short' ? at(0, 16, 0) : scenario === 'night' ? at(1, 2, 10) : at(0, 11, 35) }
}

