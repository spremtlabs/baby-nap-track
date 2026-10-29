// The words Today, Night and the Menu add from 1.0.41, 28 October 2026: how many days of
// naps the times have learnt from, why the next nap is when it is, what changes when the age moves
// on to the next wake windows, and the typical naps setup shows for the age.
import { BANDS, DAY, MIN, ageText, band, targetFor, type Baby, type Band, type Engine, type Sleep, type Style } from './engine.ts'
import { dur, fmt, fmtMins, hours } from './words.ts'

const midnight = (t: number) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime() }

// Days before today with a finished nap in the log. The times come mostly from the baby's own naps
// once there are 3, the same count Settings has always given.
export function learntDays (sleeps: Sleep[], now: number): number {
  const today = midnight(now), days = new Set<number>()
  for (const x of sleeps) if (x.kind === 'nap' && x.e != null && x.s < today && x.s > today - 14 * DAY) days.add(midnight(x.s))
  return days.size
}
export const LEARN_DAYS = 3

// The line Today shows while the times still come from the age.
export const learnLine = (name: string, n: number) => (n >= LEARN_DAYS ? null : `Learning ${name}'s naps, day ${n + 1} of ${LEARN_DAYS}`)

// Why the next nap is when it is, from the Menu.
export type Why = { title: string; lines: string[] }
export function whyNap (E: Engine): Why {
  const N = E.baby.name, b = E.band(), age = ageText(E.baby, E.now)
  const next = E.unknownMorning() ? undefined : E.plan().find((w) => !w.bed)
  const ended = E.sleeps.filter((x) => x.e != null && x.e <= E.now).map((x) => x.e!)
  const woke = ended.length ? Math.max(...ended) : null
  const lines: string[] = []
  const title = next ? `Why ${fmt(next.c)}?` : 'How the nap times are worked out'
  if (E.style === 'clock') {
    return { title, lines: [`${N}'s naps are at the same times every day.`, 'A short or missed nap leaves the next one where it is.', `Settings changes the times, under ${N}'s naps.`] }
  }
  if (next && woke != null) lines.push(`${N} woke up at ${fmt(woke)}.`)
  lines.push(`At ${age} most babies can stay awake for ${dur(b.min * MIN)} to ${dur(b.max * MIN)}.`)
  lines.push('The wait gets a bit longer for each nap as the day goes on.')
  if (E.style === 'night') lines.push(`A nap that hasn't started an hour after its window opens can happen in the car, the buggy or on you. The day's sleep counts more than the time.`)
  return { title, lines }
}

// The three ways the day's naps can run, from 1.0.43, as setup and Settings offer them.
export type StyleText = { id: Style; title: string; line: string; short: string }
export function styleTexts (name: string): StyleText[] {
  return [
    { id: 'wake', title: `From when ${name} wakes`, line: 'Each nap counts from the last wake-up. A short nap brings the next one sooner.', short: 'Each nap counts from the last wake-up.' },
    { id: 'clock', title: 'Same times every day', line: 'Naps at the times you set, whatever the morning brings. Good for a creche or a set routine.', short: 'Naps at the times below.' },
    { id: 'night', title: 'Whatever gets the night right', line: "Get the day's sleep in any way you can. A nap that won't start is rescued in the car, the buggy or on you, and a short day brings bedtime earlier.", short: 'Any nap counts, and a short day brings bedtime earlier. While the chair method runs, naps go this way.' },
  ]
}

// The card when the age moves on to the next wake windows. `seen` is the band this phone last
// showed. Null when nothing has changed since.
export type AgeChange = { title: string; lines: string[]; was: Band; now: Band }
const monthsOf = (w: number) => Math.max(1, Math.round(w / 4.345))
export function ageChange (baby: Baby, weeks: number, seen: number | null): AgeChange | null {
  const now = band(weeks)
  if (seen == null || now.w === seen) return null
  const was = BANDS.find((x) => x.w === seen)
  if (!was || was.w > now.w) return null
  const N = baby.name, m = monthsOf(was.w)
  const first = now.naps < was.naps
    ? `${N} can stay awake for longer between naps now, so the day has ${now.naps} ${now.naps === 1 ? 'nap' : 'naps'} instead of ${was.naps}.`
    : `${N} can stay awake for longer between naps now.`
  return {
    title: `Happy ${m} months, ${N}!`,
    lines: [first, `The gap between naps was ${dur(was.min * MIN)} to ${dur(was.max * MIN)}. From today it's ${dur(now.min * MIN)} to ${dur(now.max * MIN)}.`],
    was, now,
  }
}

// The morning the next band starts, at the usual wake-up, for the notice. Null past the last band.
export function nextBandAt (baby: Baby, weeks: number, now: number): { at: number; months: number } | null {
  const b = band(weeks)
  if (b.w >= 9999) return null
  const at = midnight(now + (b.w - weeks) * 7 * DAY) + baby.wake * MIN
  return { at: at <= now ? at + DAY : at, months: monthsOf(b.w) }
}

// The naps setup shows for the age: one row a nap with a typical start, and the day sleep they add
// up to. The parent sets none of it.
export function typicalNaps (weeks: number, wake: number, bed: number): { rows: { label: string; at: string }[]; total: string } {
  const b = band(weeks), target = targetFor(weeks), len = target / b.naps
  const rows: { label: string; at: string }[] = []
  let t = wake
  for (let k = 0; k < b.naps; k++) {
    t += b.min + (b.max - b.min) * (0.2 + 0.8 * k / b.naps)
    if (t > bed - b.min) break
    const at = Math.round(t / 15) * 15
    rows.push({ label: b.naps >= 4 ? `Nap ${k + 1}` : at < 660 ? 'Morning nap' : at < 840 ? 'Lunchtime nap' : at < 960 ? 'Afternoon nap' : 'Late afternoon nap', at: fmtMins(at) })
    t += k === b.naps - 1 && b.naps > 2 ? Math.min(len, 45) : len
  }
  return { rows, total: hours(target * MIN) }
}
