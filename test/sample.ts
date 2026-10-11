// A sample baby and a week of his sleep, for the tests and the store screenshots. The app never
// imports this file; the gate fails if it does.
import { DAY, MIN, type Baby, type Sleep } from '../src/lib/engine.ts'

export const T0 = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime() })()
export const at = (d: number, h: number, m = 0) => { const x = new Date(T0); x.setDate(x.getDate() + d); x.setHours(h, m, 0, 0); return x.getTime() }

const ymd = (t: number) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

// Born so that he is six months old, three naps a day, whatever day the tests run. Both parents set
// the day sleep aim, so it stays at 3 hours for the tests.
export const OISIN: Baby = { name: 'Oisín', born: ymd(T0 - 188 * DAY), due: '', wake: 420, bed: 1140, target: 180, aimSet: true }
export const CIAN: Baby = { name: 'Cian', born: ymd(T0 - 76 * DAY), due: '', wake: 420, bed: 1200, target: 300, aimSet: true }
// Oisín at five months: three naps a day with shorter wake windows, and 4 hours of day sleep.
export const AT_FIVE_MONTHS: Baby = { ...OISIN, born: ymd(T0 - 154 * DAY), target: 240 }

function rng (seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

let n = 0
const mk = (s: number, e: number | null, kind: 'nap' | 'night', up = false): Sleep => ({ id: `s${++n}`, s, e, kind, up, updatedAt: 1 })

// A week of sleep. A short day has three short naps and ends at 4pm.
export function week (shortDay = false): Sleep[] {
  const r = rng(5), j = (a: number) => Math.round((r() * 2 - 1) * a)
  const out: Sleep[] = []
  let bed = at(-8, 19, 0) + j(8) * MIN
  for (let d = -7; d <= 0; d++) {
    const wake = d === 0 ? at(0, 6, 55) : at(d, 6, 58) + j(14) * MIN
    let wk: [number, number][]
    if (d === 0) wk = [[at(-1, 23, 41), at(-1, 23, 58)], [at(0, 3, 56), at(0, 4, 12)]]
    else {
      wk = []
      const a = at(d - 1, 23, 20) + j(40) * MIN
      wk.push([a, a + (13 + j(5)) * MIN])
      if (r() > 0.5) { const b = at(d, 3, 50) + j(35) * MIN; wk.push([b, b + (15 + j(6)) * MIN]) }
    }
    let s = bed
    for (const [a, b] of wk) { out.push(mk(s, a, 'night')); s = b }
    out.push(mk(s, wake, 'night', true))
    if (d === 0) {
      if (shortDay) out.push(mk(at(0, 8, 58), at(0, 9, 40), 'nap'), mk(at(0, 12, 15), at(0, 12, 50), 'nap'), mk(at(0, 15, 22), at(0, 16, 0), 'nap'))
      else out.push(mk(at(0, 8, 58), at(0, 10, 1), 'nap'))
      break
    }
    let t = wake
    const W = [120, 140, 150], L = [65, 80, 40]
    for (let k = 0; k < 3; k++) { const ns = t + (W[k] + j(10)) * MIN, ne = ns + (L[k] + j(14)) * MIN; out.push(mk(ns, ne, 'nap')); t = ne }
    bed = at(d, 19, 0) + j(10) * MIN
  }
  return out
}

export { mk as sleep }
