// The saved state for one scenario, the way the app keeps it on the phone. The gate and the store
// screenshots load it into the web build's storage before the page opens.
import { MIN } from '../src/lib/engine.ts'
import { eveningOf } from '../src/lib/chair.ts'
import { AT_FIVE_MONTHS, CIAN, OISIN, at, sleep, week } from '../test/sample.ts'

export const STORE_KEY = 'snug.state.v1'

export function seed (scenario: 'morning' | 'short' | 'night' | 'tomorrow' | 'v1' | 'evening' | 'gap' | 'chair' | 'chair-morning' | 'short-nap' | 'short-last' | 'young' | 'fewer' | 'typed-evening' | 'early-bed' | 'back-asleep' | 'chair-eve' | 'chair-move'): { state: string; now: number } {
  // 11 October 2026 at 6pm, at five months: a night with a waking from 5 to 6am, three short naps,
  // and the screen giving an early bedtime of 6:30pm. From 1.0.28 a tap on the timer then is the
  // night. Up to 1.0.27 it was read against the short nap the plan held for 4:45pm.
  if (scenario === 'early-bed') {
    const sleeps = [sleep(at(-1, 19, 53), at(0, 5, 0), 'night'), sleep(at(0, 6, 0), at(0, 7, 30), 'night', true),
      sleep(at(0, 7, 45), at(0, 8, 30), 'nap'), sleep(at(0, 10, 35), at(0, 11, 11), 'nap'), sleep(at(0, 14, 50), at(0, 15, 15), 'nap')]
    return { state: JSON.stringify({ baby: AT_FIVE_MONTHS, sleeps, alerts: true, lead: 15, share: null, babyAt: 1, unsent: [], babyUnsent: false }), now: at(0, 18, 0) }
  }
  // 6am with the night logged to 5am and the usual wake-up at 7: a tap on the timer is the baby
  // back asleep, from 1.0.28.
  if (scenario === 'back-asleep') {
    const sleeps = [...week().filter((x) => x.s < at(-1, 18, 0)), sleep(at(-1, 19, 53), at(0, 5, 0), 'night', true)]
    return { state: JSON.stringify({ baby: OISIN, sleeps, alerts: true, lead: 15, share: null, babyAt: 1, unsent: [], babyUnsent: false }), now: at(0, 6, 0) }
  }
  // 11 October 2026 at 6:06pm: down at 7:53pm, up at 5:38am, two naps and a nap since 6pm, before
  // the whole day was typed in.
  if (scenario === 'typed-evening') {
    const sleeps = [...week().filter((x) => x.s < at(-1, 18, 0)), sleep(at(-1, 19, 53), at(0, 5, 38), 'night', true),
      sleep(at(0, 7, 45), at(0, 8, 30), 'nap'), sleep(at(0, 10, 35), at(0, 11, 11), 'nap'), sleep(at(0, 18, 0), null, 'nap')]
    return { state: JSON.stringify({ baby: OISIN, sleeps, alerts: true, lead: 15, share: null, babyAt: 1, unsent: [], babyUnsent: false }), now: at(0, 18, 6) }
  }
  // Two naps of an hour and a half on 3 of the last 5 days, three of an hour on the others, and up at
  // 7 today: Today offers the day with 2 naps, from 1.0.23.
  if (scenario === 'fewer') {
    const sleeps = []
    ;[3, 2, 3, 2, 2].forEach((n, i) => {
      const d = i - 5
      sleeps.push(sleep(at(d - 1, 19, 0), at(d, 7, 0), 'night', true))
      for (const [h, m] of n === 2 ? [[9, 30], [14, 0]] : [[9, 0], [12, 30], [16, 0]]) sleeps.push(sleep(at(d, h, m), at(d, h, m) + (n === 2 ? 90 : 60) * MIN, 'nap'))
    })
    sleeps.push(sleep(at(-1, 19, 0), at(0, 7, 0), 'night', true))
    return { state: JSON.stringify({ baby: OISIN, sleeps, alerts: true, lead: 15, share: null, babyAt: 1, unsent: [], babyUnsent: false }), now: at(0, 7, 30) }
  }
  // A baby of ten weeks, for the chair method in Settings before six months, from 1.0.18.
  if (scenario === 'young') {
    return { state: JSON.stringify({ baby: CIAN, sleeps: week(), alerts: true, lead: 15, share: null, babyAt: 1, unsent: [], babyUnsent: false }), now: at(0, 11, 35) }
  }
  // A second nap of 30 minutes with one nap left, at 1pm: the two ways to make it up, from 1.0.22.
  if (scenario === 'short-last') {
    const sleeps = [...week(), sleep(at(0, 12, 15), at(0, 12, 45), 'nap')]
    return { state: JSON.stringify({ baby: OISIN, sleeps, alerts: true, lead: 15, share: null, babyAt: 1, unsent: [], babyUnsent: false }), now: at(0, 13, 0) }
  }
  // A morning nap of 27 minutes, at 9:40am. From 1.0.22 the next nap comes sooner and nothing is asked.
  if (scenario === 'short-nap') {
    const sleeps = [...week().slice(0, -1), sleep(at(0, 8, 58), at(0, 9, 25), 'nap')]
    return { state: JSON.stringify({ baby: OISIN, sleeps, alerts: true, lead: 15, share: null, babyAt: 1, unsent: [], babyUnsent: false }), now: at(0, 9, 40) }
  }
  // 6:50pm with bedtime at 7 and two naps had, before the chair method is started.
  if (scenario === 'chair-eve') {
    const sleeps = [...week(), sleep(at(0, 12, 20), at(0, 13, 30), 'nap'), sleep(at(0, 15, 50), at(0, 16, 40), 'nap')]
    return { state: JSON.stringify({ baby: OISIN, sleeps, alerts: true, lead: 15, share: null, babyAt: 1, unsent: [], babyUnsent: false }), now: at(0, 18, 50) }
  }
  // The chair method. Night 4 at 6:50pm with bedtime at 7, three nights
  // settled beside the cot; or the morning after night 4, with four nights settled.
  // `chair-move` is the morning of night 4, a move day, with three nights settled.
  if (scenario === 'chair' || scenario === 'chair-morning' || scenario === 'chair-move') {
    const ago = scenario === 'chair-morning' ? 4 : 3, mins = [46, 38, 24, 31].slice(0, ago)
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

