/// <reference types="node" />
// The chair method, run against the real engine: which night it is,
// where the parent sits, the night held back, the bedtime taps, the card, the chart and the sheet that starts it.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MIN, engine } from '../src/lib/engine.ts'
import { answer, askAbout, asleepToast, chairCard, chairChart, chairDay, chairEarly, chairGuide, chairHero, chairIntro, chairLine, chairTap, eveningOf, fellAsleep, hold, newChair, putInCot, ranges, tonight, tripsSoFar, wentOver, type Chair } from '../src/lib/chair.ts'
import { chairScene } from '../src/lib/chairArt.ts'
import { hero } from '../src/lib/model.ts'
import { CIAN, OISIN, at, sleep, week } from './sample.ts'

// A plan that started `ago` evenings back, with settling logged on the nights given.
const plan = (ago: number, settled: [number, number][] = [], held: number[] = []): Chair => ({
  from: eveningOf(at(-ago, 19, 0)),
  held: held.map((d) => eveningOf(at(d, 19, 0))),
  settles: settled.map(([d, min]) => ({ night: eveningOf(at(d, 19, 0)), inCot: at(d, 19, 0), asleep: at(d, 19, 0) + min * MIN })),
  inCot: null,
})
const withChair = (c: Chair | null) => ({ ...OISIN, chair: c })

test('a night after midnight belongs to the evening before, and the morning to the evening ahead', () => {
  assert.equal(eveningOf(at(1, 2, 10)), eveningOf(at(0, 19, 0)))
  assert.equal(eveningOf(at(1, 7, 0)), eveningOf(at(1, 19, 0)))
})

test('three nights at each place, then out of the room on night 13', () => {
  const c = plan(0)
  const where = (d: number) => tonight(c, at(d, 19, 0))
  assert.deepEqual([0, 1, 2].map((d) => where(d).place), [0, 0, 0])
  assert.equal(where(3).n, 4)
  assert.equal(where(3).place, 1)
  assert.equal(where(3).move, true)
  assert.equal(where(4).move, false)
  assert.equal(where(9).place, 3)
  assert.equal(where(12).place, 4)
  assert.equal(where(20).place, 4)
  assert.deepEqual(ranges(c, 1), ['1–3', '4–6', '7–9', '10–12'])
})

test('a night held back keeps the parent where they sat and moves every later night along', () => {
  const c = plan(3, [], [0])
  const t = tonight(c, at(0, 19, 0))
  assert.equal(t.n, 4)
  assert.equal(t.place, 0)
  assert.equal(t.held, true)
  assert.equal(tonight(c, at(1, 19, 0)).place, 1)
  assert.deepEqual(t.ranges, ['1–4', '5–7', '8–10', '11–13'])
  assert.deepEqual(hold(c, t.key, false).held, [])
})

test('Settings knows a baby under six months and says which night is next', () => {
  assert.equal(chairEarly(OISIN, at(0, 12)), false)
  assert.equal(chairEarly(CIAN, at(0, 12)), true)
  assert.equal(chairLine(plan(3), at(0, 12)), 'Night 4, halfway to the door')
  assert.equal(chairLine(plan(12), at(0, 12)), 'Night 13, out of the room')
})

// From 1.0.18 the plan runs at any age. Ten weeks old, 7:50pm, with bedtime at 8pm.
test('at ten weeks the bedtime tap is the baby going into the cot, with the picture for night 1', () => {
  const c = plan(0), now = at(0, 19, 50)
  const day = [sleep(at(-1, 20, 0), at(0, 7, 0), 'night', true), sleep(at(0, 17, 30), at(0, 18, 15), 'nap')]
  const E = engine({ ...CIAN, chair: c }, day, now)
  assert.deepEqual(chairTap(E, c, now), { kind: 'cot' })
  assert.equal(chairHero(E, c, hero(E), now).caption, 'Tap when Cian is in the cot.')
  assert.equal(chairCard(E, c, now)!.eyebrow, 'Chair method, night 1 of 13')
  assert.equal(chairCard(E, c, now)!.line, 'Sit right beside the cot tonight.')
})

// The evening of a day from the sample week, at 6:50pm with bedtime at 7pm.
const evening = () => [...week(), sleep(at(0, 12, 20), at(0, 13, 30), 'nap'), sleep(at(0, 15, 50), at(0, 16, 40), 'nap')]

test('at bedtime the button is the baby going into the cot, then the baby asleep', () => {
  const c = plan(3, [[-3, 46], [-2, 38], [-1, 24]])
  const now = at(0, 18, 50), E = engine(withChair(c), evening(), now)
  assert.deepEqual(chairTap(E, c, now), { kind: 'cot' })
  assert.equal(chairHero(E, c, hero(E), now).caption, 'Tap when Oisín is in the cot.')

  const inCot = putInCot(c, at(0, 19, 16)), later = at(0, 19, 28), E2 = engine(withChair(inCot), evening(), later)
  const h = chairHero(E2, inCot, hero(E2), later)
  assert.equal(h.eyebrow, 'Settling')
  assert.equal(h.sub, 'In the cot at 7:16pm.')
  assert.equal(h.run, at(0, 19, 16))
  assert.equal(h.caption, 'Tap when Oisín is asleep.')
  assert.equal(h.settling, true)
  assert.deepEqual(chairTap(E2, inCot, later), { kind: 'asleep', inCot: at(0, 19, 16) })

  const after = fellAsleep(inCot, at(0, 19, 16), later)
  assert.equal(after.inCot, null)
  assert.equal(after.settles.length, 4)
  assert.equal(asleepToast('Oisín', at(0, 19, 16), later), 'Down for the night at 7:28pm. Oisín took 12 min to fall asleep. You stayed in your chair the whole time.')
  assert.equal(asleepToast('Oisín', later - 20000, later), 'Down for the night at 7:28pm. Oisín was asleep in under a minute. You stayed in your chair the whole time.')
  // Settled tonight, so a second bedtime tap is the usual one.
  assert.equal(chairTap(engine(withChair(after), evening(), later), after, later), null)
})

test('settling left running for three hours stops counting', () => {
  const c = putInCot(plan(3), at(0, 19, 0)), now = at(0, 22, 5)
  const E = engine(withChair(c), evening(), now)
  assert.equal(chairHero(E, c, hero(E), now).settling, undefined)
})

test('in the day nothing changes, and a nap still starts with the usual tap', () => {
  const c = plan(3), now = at(0, 11, 35), E = engine(withChair(c), week(), now)
  assert.equal(chairTap(E, c, now), null)
  assert.equal(chairCard(E, c, now), null)
  assert.equal(chairHero(E, c, hero(E), now).caption, 'Tap when Oisín falls asleep.')
})

test('the card at bedtime shows the night, its place and the link that holds it', () => {
  const c = plan(3), now = at(0, 18, 50), card = chairCard(engine(withChair(c), evening(), now), c, now)!
  assert.equal(card.eyebrow, 'Chair method, night 4 of 13')
  assert.equal(card.place, 1)
  assert.equal(card.line, "That's 3 nights done! Sit halfway to the door tonight.")
  assert.equal(card.hold, 'Stay by the cot one more night')
  const held = hold(c, card.key, true), card2 = chairCard(engine(withChair(held), evening(), now), held, now)!
  assert.equal(card2.place, 0)
  assert.equal(card2.eyebrow, 'Chair method, night 4 of 14')
  assert.equal(card2.line, 'Sit beside the cot again tonight.')
  assert.equal(card2.hold, 'Move your chair tonight')
  // On night 5 nothing moves, so there is nothing to hold.
  const c5 = plan(4), card5 = chairCard(engine(withChair(c5), evening(), now), c5, now)!
  assert.equal(card5.hold, '')
  assert.equal(card5.line, 'Sit halfway to the door again tonight.')
  // Night 2 is beside the cot again, and night 13 is the one out of the room.
  const c2 = plan(1), c13 = plan(12)
  assert.equal(chairCard(engine(withChair(c2), evening(), now), c2, now)!.line, 'Sit beside the cot again tonight.')
  assert.equal(chairCard(engine(withChair(c13), evening(), now), c13, now)!.line, "You've done 12 nights in the chair! Say goodnight and leave the room tonight.")
  assert.equal(chairCard(engine(withChair(c13), evening(), now), c13, now)!.eyebrow, 'Chair method, night 13')
})

test('while the baby settles the card says what the parent can do from where they sit', () => {
  const now = at(0, 19, 10)
  const by = putInCot(plan(1), at(0, 19, 0)), far = putInCot(plan(3), at(0, 19, 0))
  assert.equal(chairCard(engine(withChair(by), evening(), now), by, now)!.line, 'You can shush, or rest a hand on Oisín. Lift your hand before Oisín nods off.')
  assert.equal(chairCard(engine(withChair(far), evening(), now), far, now)!.line, 'If Oisín gets upset, go over to pat or shush, then sit back down.')
})

test('awake in the night, the card says to sit in the chair again', () => {
  const c = plan(3), log = [...evening(), sleep(at(0, 19, 5), at(0, 23, 30), 'night')], now = at(0, 23, 40)
  const card = chairCard(engine(withChair(c), log, now), c, now)!
  assert.equal(card.line, "Sit in your chair until Oisín's back asleep.")
  assert.equal(card.hold, '')
})

test('the chart has a bar for each night settled, last night in honey, and says how it went', () => {
  const c = plan(4, [[-4, 46], [-3, 38], [-2, 24], [-1, 31]]), now = at(0, 11, 35), ch = chairChart(engine(withChair(c), week(), now), c, now)!
  assert.deepEqual(ch.groups.map((g) => g.label), ['1–3', '4–6', '7–9', '10–12'])
  assert.deepEqual(ch.groups[0].bars.map((b) => b?.min), [46, 38, 24])
  assert.deepEqual(ch.groups[1].bars.map((b) => b?.min ?? null), [31, null, null])
  assert.equal(ch.groups[1].bars[0]!.last, true)
  // 11 October 2026: the lines under the chart coach. Night 4 was the first night halfway to the
  // door and slower than night 3, so the heading says so and keeps the gain on night 1.
  assert.equal(ch.head, "31 min on the first night halfway to the door. That's still 15 min faster than night 1!")
  assert.match(ch.say[0], /^Oisín woke twice in the night and was back asleep in about \d+ min each time\.$/)
  assert.equal(ch.note, 'Sleep training brought easier bedtimes and fewer night wakings in 49 of 52 studies. Over 2,500 babies and toddlers took part.')
  // Where to sit tonight is on the note at the top of Today and the minutes are on the bars, so the lines say neither.
  assert.equal(ch.say.length, 1)
  assert.equal(ch.stay, null)
  const of = (ago: number) => { const x = plan(ago, [[-1, 20]]); return chairChart(engine(withChair(x), week(), now), x, now)! }
  for (const ago of [5, 6, 12, 13]) assert.ok(![of(ago).head, ...of(ago).say].some((x) => /^Tonight you|nights done|down from \d+ min/.test(x)))
  // What is known changes each morning for six mornings. After that the figure comes back after a slower night.
  const good = (ago: number) => { const x = plan(ago, ago > 1 ? [[-ago, 46], [-1, 20]] : [[-1, 20]]); return chairChart(engine(withChair(x), week(), now), x, now)! }
  assert.deepEqual([1, 2, 3, 4, 5, 6, 8].map((ago) => good(ago).note.slice(0, 24)), ["The HSE says you'll star", 'Sleep training brought e', 'Sleep training with a pa', 'Sleep training brought e', "The HSE says you'll star", 'Sleep training with a pa', ''])
  assert.equal(of(8).note, 'Sleep training brought easier bedtimes and fewer night wakings in 49 of 52 studies. Over 2,500 babies and toddlers took part.')
  assert.equal(good(3).head, 'Brilliant! Oisín fell asleep 26 min faster than on night 1.')
  assert.equal(chairChart(engine(withChair(plan(3)), week(), now), plan(3), now), null)
})

test('going over while settling is counted, and the toast and the morning say so', () => {
  let c = putInCot(plan(3), at(0, 19, 0))
  c = wentOver(wentOver(c))
  assert.equal(tripsSoFar(0), 'Not yet')
  assert.equal(tripsSoFar(1), 'Once so far')
  assert.equal(tripsSoFar(c.trips!), 'Twice so far')
  const done = fellAsleep(c, at(0, 19, 0), at(0, 19, 20))
  assert.equal(done.settles.at(-1)!.trips, 2)
  assert.equal(done.trips, 0)
  assert.equal(asleepToast('Oisín', at(0, 19, 0), at(0, 19, 20), 2), 'Down for the night at 7:20pm. Oisín took 20 min to fall asleep. You went over twice.')
  assert.equal(asleepToast('Oisín', at(0, 19, 0), at(0, 19, 20), 0), 'Down for the night at 7:20pm. Oisín took 20 min to fall asleep. You stayed in your chair the whole time.')
})

test('after the baby is asleep it asks about crying until it is answered, and a hard night can wait one more', () => {
  const c = fellAsleep(putInCot(plan(3), at(0, 19, 0)), at(0, 19, 0), at(0, 19, 20))
  const log = [...evening(), sleep(at(0, 19, 20), null, 'night')], later = at(0, 19, 25)
  const ask = askAbout(engine(withChair(c), log, later), c, later)!
  assert.equal(ask.question, 'How much did Oisín cry while settling?')
  const cried = answer(answer(c, ask.night, { cry: 'lot' }), ask.night, { why: ['teething'] })
  assert.equal(askAbout(engine(withChair(cried), log, later), cried, later), null)
  // The next evening is night 5, so nothing moves; on the evening of a move night the card offers to hold.
  const hardBefore = answer(plan(3, [[-3, 46], [-2, 38], [-1, 24]]), eveningOf(at(-1, 19, 0)), { cry: 'lot' })
  const now = at(0, 18, 50), card = chairCard(engine(withChair(hardBefore), evening(), now), hardBefore, now)!
  assert.equal(card.line, "That's 3 nights done! Sit halfway to the door tonight. Last night was hard. You can stay by the cot one more night if you'd like.")
  const morning = chairChart(engine(withChair(hardBefore), week(), at(0, 11, 35)), hardBefore, at(0, 11, 35))!
  assert.ok(morning.say.includes('There was a lot of crying, and you stayed right there with Oisín.'))
  assert.ok(morning.say.includes('The HSE says night 3 or 4 is often harder than night 1, so keep going.'))
  assert.deepEqual(morning.stay, { line: 'You can take one more night by the cot. The HSE says to move every 3 to 4 nights.', link: 'Stay by the cot one more night' })
  // What the HSE says goes by the night: the first two, the third and fourth, and after that.
  const lot = (ago: number) => { const x = answer(plan(ago, [[-1, 20]]), eveningOf(at(-1, 19, 0)), { cry: 'lot' }); return chairChart(engine(withChair(x), week(), at(0, 11, 35)), x, at(0, 11, 35))!.say }
  // Each of these is the only night settled, so it reads as a slower night and the heading says hang in there.
  assert.ok(lot(1).includes('The HSE says the first few nights are hard, so keep going.'))
  assert.ok(lot(4).includes('The HSE says night 3 or 4 is often harder than night 1.'))
  assert.ok(lot(8).includes('The HSE says the plan can take a few weeks to work.'))
})

test('the evening night 1 is settled, the chart says well done', () => {
  const c = fellAsleep(putInCot(plan(0), at(0, 19, 0)), at(0, 19, 0), at(0, 19, 40))
  const log = [...evening(), sleep(at(0, 19, 40), null, 'night')], later = at(0, 19, 45)
  const ch = chairChart(engine(withChair(c), log, later), c, later)!
  assert.equal(ch.head, "That's night 1 done. Well done!")
  assert.equal(ch.say[0], 'Oisín fell asleep in 40 min.')
  assert.equal(ch.note, '')
  assert.equal(ch.stay, null)
})

// 11 October 2026: the lines under the chart were a flat list, and one more night in a place could
// only be picked at bedtime.
test('the morning coaches: a slower night, fewer trips, and one more night on a move day', () => {
  const now = at(0, 11, 35), chart = (c: Chair) => chairChart(engine(withChair(c), week(), now), c, now)!
  // Night 2 took longer than night 1. The HSE is said once, and the card holds the figure.
  const slow = chart(plan(2, [[-2, 30], [-1, 44]]))
  assert.equal(slow.head, 'Oisín took 44 min to fall asleep last night. Hang in there!')
  assert.equal(slow.say[0], 'The HSE says the first few nights are hard.')
  assert.equal(slow.say.filter((x) => x.includes('The HSE')).length, 1)
  assert.equal(slow.note, 'Sleep training brought easier bedtimes and fewer night wakings in 49 of 52 studies. Over 2,500 babies and toddlers took part.')
  // Night 1 has nothing to be faster than.
  const one = chart(plan(1, [[-1, 46]]))
  assert.equal(one.head, "Oisín fell asleep in 46 min on night 1. That's the one to beat!")
  assert.equal(one.note, "The HSE says you'll start to see a change within a week or so.")
  // Slower than the night before with no move, and still faster than night 1.
  assert.equal(chart(plan(3, [[-3, 46], [-2, 20], [-1, 30]])).head, "Oisín fell asleep in 30 min. That's still 16 min faster than on night 1!")
  // Trips are said when there were none, or fewer than the night before. Crying is said with what the parent did.
  const trips = (a: number, b: number, cry: 'none' | 'some' | 'lot'): Chair => { const c = plan(2, [[-2, 40], [-1, 30]]); return { ...c, settles: c.settles.map((x, i) => ({ ...x, trips: i ? b : a, cry })) } }
  assert.deepEqual(chart(trips(4, 2, 'some')).say.slice(0, 2), ['You went over twice, down from 4 the night before.', 'There was some crying, and you stayed right there with Oisín.'])
  assert.ok(!chart(trips(2, 3, 'none')).say.some((x) => x.startsWith('You went over')))
  assert.equal(chart(trips(2, 0, 'none')).say[0], 'You stayed in your chair the whole time, and there was no crying at all!')
  assert.equal(chart(trips(2, 0, 'some')).say[0], 'You stayed in your chair the whole time, even through some crying!')
  assert.deepEqual(chart(trips(2, 0, 'lot')).say.slice(0, 2), ['You stayed in your chair the whole time, even through a lot of crying!', 'The HSE says the first few nights are hard, so keep going.'])
  // The morning of night 4 is a move day: one more night by the cot, or the move after all.
  const due = plan(3, [[-3, 46], [-2, 38], [-1, 24]])
  assert.deepEqual(chart(due).stay, { line: 'You can take one more night by the cot. The HSE says to move every 3 to 4 nights.', link: 'Stay by the cot one more night' })
  const held = hold(due, eveningOf(at(0, 19, 0)), true)
  assert.deepEqual(chart(held).stay, { line: "You're taking one more night by the cot.", link: 'Move your chair tonight' })
  assert.deepEqual(chairDay(engine(withChair(held), week(), now), held, now), { head: 'Chair method, night 4 of 14', line: 'Sit beside the cot tonight. Bedtime is 7pm.' })
  // A fifth night by the cot is the parent's to take, and the 3 to 4 nights the HSE gives is not said for it.
  const again = plan(4, [[-4, 46], [-3, 38], [-2, 24], [-1, 22]], [-1])
  assert.deepEqual(chart(again).stay, { line: 'You can take one more night by the cot.', link: 'Stay by the cot one more night' })
  // The day before the last one, the place to stay is the hall, which is past the count the HSE gives.
  assert.deepEqual(chart(plan(12, [[-1, 10]])).stay, { line: 'You can take one more night in the hall.', link: 'Stay in the hall one more night' })
  // At bedtime the link is on the card, so the chart has none.
  const eve = at(0, 18, 50)
  assert.equal(chairChart(engine(withChair(due), evening(), eve), due, eve)!.stay, null)
  assert.equal(chairCard(engine(withChair(due), evening(), eve), due, eve)!.hold, 'Stay by the cot one more night')
})

test('a new plan starts tonight, and the picture draws every place', () => {
  const c = newChair(engine(OISIN, week(), at(0, 14, 0)), at(0, 14, 0))
  assert.equal(tonight(c, at(0, 19, 0)).n, 1)
  for (let p = 0; p <= 4; p++) {
    const svg = chairScene(p)
    assert.match(svg, /^<svg viewBox="0 28 380 172">/)
    assert.doesNotMatch(svg, /NaN|undefined/)
  }
})

// The line on Today through the day, from 1.0.17.
test('through the day Today says which night it is, where to sit tonight and when bedtime is', () => {
  const c = plan(3), E = engine(withChair(c), week(), at(0, 11, 35))
  assert.deepEqual(chairDay(E, c, at(0, 11, 35)), { head: 'Chair method, night 4 of 13', line: 'Sit halfway to the door tonight. Bedtime is 7pm.' })
  // A night held back makes the plan one night longer.
  const held = plan(3, [], [0])
  assert.deepEqual(chairDay(engine(withChair(held), week(), at(0, 11, 35)), held, at(0, 11, 35)), { head: 'Chair method, night 4 of 14', line: 'Sit beside the cot tonight. Bedtime is 7pm.' })
  const last = plan(12)
  assert.deepEqual(chairDay(engine(withChair(last), week(), at(0, 11, 35)), last, at(0, 11, 35)), { head: 'Chair method, night 13', line: 'Say goodnight and leave the room tonight. Bedtime is 7pm.' })
  assert.equal(chairDay(E, null, at(0, 11, 35)), null)
})

// 11 October 2026: Start closed the sheet onto Today with a toast and nothing to do next.
test('the sheet says how it goes, and once started says well done, when bedtime is and tonight step by step', () => {
  const now = at(0, 11, 35), E = engine(OISIN, week(), now), intro = chairIntro(E, now)
  assert.equal(intro.cta, 'Start tonight')
  assert.equal(intro.steps[0], "Put Oisín in the cot awake. Sit in a chair right beside the cot until Oisín's asleep.")
  assert.equal(intro.steps.at(-1), 'On night 13 you say goodnight and leave the room.')
  assert.deepEqual(intro.goes, [
    'Sleep training brought easier bedtimes and fewer night wakings in 49 of 52 studies. Over 2,500 babies and toddlers took part.',
    'Four of those studies had a parent stay in the room, and it worked in all four.',
    "The HSE says the first few nights are hard, and you'll start to see a change within a week or so.",
  ])
  const c = newChair(E, now), g = chairGuide(engine(withChair(c), week(), now), c, now)
  assert.equal(g.title, 'Well done for starting!')
  assert.equal(g.when, 'Tonight is night 1 of 13. Bedtime is 7pm.')
  assert.deepEqual(g.steps, ['Put a chair right beside the cot.', 'Put Oisín in the cot awake at bedtime and tap Start.', "Sit in your chair, and tap again when Oisín's asleep."])
  assert.equal(g.cta, 'Got it')
})

test('started at bedtime, the sheet says it is bedtime now', () => {
  const now = at(0, 18, 50), E = engine(OISIN, evening(), now), c = newChair(E, now), g = chairGuide(E, c, now)
  assert.equal(g.when, "Tonight is night 1 of 13. It's bedtime now.")
  assert.equal(g.steps[1], 'Put Oisín in the cot awake and tap Start.')
})

test('after a day of short naps the sheet gives the early bedtime', () => {
  // Up at 7 and one nap of 25 minutes by 5pm: the day cannot reach its aim, so bed is half an hour early.
  const log = [...week().slice(0, -1), sleep(at(0, 9, 0), at(0, 9, 25), 'nap')], now = at(0, 17, 0), E = engine(OISIN, log, now)
  const c = newChair(E, now), g = chairGuide(E, c, now)
  assert.equal(g.when, 'Tonight is night 1 of 13. Bedtime is early, so aim for 6:30pm.')
  assert.equal(g.steps[1], 'Put Oisín in the cot awake at bedtime and tap Start.')
  // With the nap times locked the list gives the usual bedtime, and so does the sheet.
  assert.equal(chairGuide(E, c, now, true).when, 'Tonight is night 1 of 13. Bedtime is 7pm.')
})

test('started once the baby is down for the night, night 1 is the next bedtime', () => {
  const log = [...evening(), sleep(at(0, 19, 5), null, 'night')]
  // At 9pm that is tomorrow, and nothing shows at a waking tonight.
  const late = at(0, 21, 0), E = engine(OISIN, log, late), c = newChair(E, late)
  assert.equal(chairIntro(E, late).cta, 'Start tomorrow night')
  assert.equal(c.from, eveningOf(at(1, 19, 0)))
  assert.equal(chairGuide(E, c, late).when, 'Tomorrow is night 1 of 13. Bedtime is 7pm.')
  const woke = [...evening(), sleep(at(0, 19, 5), at(0, 23, 30), 'night')], w = at(0, 23, 40)
  assert.equal(chairCard(engine(withChair(c), woke, w), c, w), null)
  // At 2am the next bedtime is this evening, so the button says tonight.
  const small = at(1, 2, 0), E2 = engine(OISIN, log, small), c2 = newChair(E2, small)
  assert.equal(chairIntro(E2, small).cta, 'Start tonight')
  assert.equal(c2.from, eveningOf(at(1, 19, 0)))
  assert.equal(chairGuide(E2, c2, small).when, 'Tonight is night 1 of 13. Bedtime is 7pm.')
  // The next evening the plan is on night 1 with its card.
  const next = at(1, 18, 50), day = [...evening(), sleep(at(0, 19, 5), at(1, 7, 0), 'night', true), sleep(at(1, 12, 20), at(1, 13, 30), 'nap'), sleep(at(1, 15, 50), at(1, 16, 40), 'nap')]
  assert.equal(chairCard(engine(withChair(c), day, next), c, next)!.eyebrow, 'Chair method, night 1 of 13')
})

test('started before 6am with the baby up for the day, night 1 is this evening', () => {
  const log = [...week().slice(0, -1), sleep(at(-1, 19, 0), at(0, 5, 10), 'night', true)], now = at(0, 5, 30), E = engine(OISIN, log, now)
  assert.equal(newChair(E, now).from, eveningOf(at(0, 19, 0)))
})
