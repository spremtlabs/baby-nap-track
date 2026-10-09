// Times and lengths as the app writes them: 7pm, 12:30pm, 1 h 5 min.
import { MIN } from './engine.ts'

const pad = (n: number) => String(n).padStart(2, '0')

export const hm = (t: number) => {
  const d = new Date(t), h = d.getHours()
  return { t: `${h % 12 || 12}:${pad(d.getMinutes())}`, ap: h < 12 ? 'am' : 'pm' }
}
const short = (x: { t: string }) => x.t.replace(/:00$/, '')

export const fmt = (t: number) => { const x = hm(t); return short(x) + x.ap }

export const range = (a: number, b: number, joiner = ' and ') => {
  const A = hm(a), B = hm(b)
  return A.ap === B.ap ? `${short(A)}${joiner}${short(B)}${B.ap}` : `${short(A)}${A.ap}${joiner}${short(B)}${B.ap}`
}

export const fmtMins = (m: number) => {
  const h = Math.floor(m / 60) % 24
  return `${h % 12 || 12}${m % 60 ? ':' + pad(m % 60) : ''}${h < 12 ? 'am' : 'pm'}`
}

export function dur (ms: number) {
  const m = Math.max(0, Math.round(ms / MIN))
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60), r = m % 60
  return r ? `${h} h ${r} min` : `${h} h`
}

export function span (a: number, b: number) {
  return a % 60 || b % 60 ? `${dur(a * MIN)} to ${dur(b * MIN)}` : `${a / 60} to ${b / 60} hours`
}

export function hours (ms: number) {
  const m = Math.round(ms / MIN)
  if (m % 60) return dur(ms)
  const h = m / 60
  return h === 1 ? '1 hour' : `${h} hours`
}

export const times = (n: number) => (n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`)

// A big number on screen is drawn as parts: the figures large, the units small, and the seconds
// of a running sleep as small figures.
export type Part = { n?: string; u?: string; s?: string }

export const bigTime = (t: number): Part[] => { const x = hm(t); return [{ n: short(x) }, { u: x.ap }] }

export function bigDur (ms: number): Part[] {
  const m = Math.max(0, Math.floor(ms / MIN))
  if (m < 1) return [{ n: 'Now' }]
  if (m < 60) return [{ n: String(m) }, { u: 'min' }]
  if (m % 60) return [{ n: String(Math.floor(m / 60)) }, { u: 'h' }, { n: String(m % 60) }, { u: 'min' }]
  return [{ n: String(m / 60) }, { u: m === 60 ? 'hour' : 'hours' }]
}

// A sleep that is running, counted to the second from the tap. Past an hour, and again past ten,
// the figures get smaller so the count keeps to one line on a 360 wide phone.
export function runParts (ms: number): { parts: Part[]; size: number } {
  const t = Math.max(0, Math.floor(ms / 1000)), h = Math.floor(t / 3600), m = Math.floor(t / 60) % 60
  const parts: Part[] = [...(h ? [{ n: String(h) }, { u: 'h' }] : []), { n: String(m) }, { u: 'min' }, { s: String(t % 60).padStart(2, '0') }, { u: 'sec' }]
  return { parts, size: h >= 10 ? 62 : h >= 1 ? 70 : 86 }
}

export function tallyDur (ms: number): Part[] {
  const m = Math.max(0, Math.round(ms / MIN))
  if (m < 60) return [{ n: String(m) }, { u: 'min' }]
  if (m % 60) return [{ n: String(Math.floor(m / 60)) }, { u: 'h' }, { n: String(m % 60) }, { u: 'min' }]
  return [{ n: String(m / 60) }, { u: m === 60 ? 'hour' : 'hours' }]
}

export const timeParts = (mins: number): Part[] => { const s = fmtMins(mins); return [{ n: s.slice(0, -2) }, { u: s.slice(-2) }] }

export const lenParts = (mins: number): Part[] =>
  mins % 60 ? [{ n: String(Math.floor(mins / 60)) }, { u: 'h' }, { n: String(mins % 60) }, { u: 'min' }] : [{ n: String(mins / 60) }, { u: mins === 60 ? 'hour' : 'hours' }]

export const plain = (parts: Part[]) => parts.map((p) => p.n ?? p.s ?? p.u).join(' ')
