// Sharing one baby's log between phones. The log lives on each phone; when it is shared, every
// change goes up to a Supabase project and the other phones read it back. The four
// functions are in supabase/sharing.sql. The address and key here are the public ones.
import type { Baby, Sleep } from './engine.ts'

const URL = 'https://eynuujdjarqnwkjofrpw.supabase.co/rest/v1/rpc/'
const KEY = 'sb_publishable_u1X1QV-qny9l9YvnVvGvog_xQ8dw1Tm'

export const JOIN_PAGE = 'https://babynaptrack.com/join/'

type Wire = { id: string; s: number; e: number | null; kind: 'nap' | 'night'; up: boolean; deleted: boolean; updated_at: number }

export const toWire = (x: Sleep): Wire => ({ id: x.id, s: x.s, e: x.e, kind: x.kind, up: !!x.up, deleted: !!x.deleted, updated_at: x.updatedAt })
export const fromWire = (r: Wire): Sleep => ({ id: r.id, s: Number(r.s), e: r.e == null ? null : Number(r.e), kind: r.kind, up: r.up, deleted: r.deleted, updatedAt: Number(r.updated_at) })

export class NoSuchLog extends Error {}

async function call<T> (fn: string, body: object): Promise<T> {
  const res = await fetch(URL + fn, {
    method: 'POST',
    headers: { apikey: KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await res.json()
  if (!res.ok) {
    if (json && json.code === 'P0002') throw new NoSuchLog('no such log')
    throw new Error(json?.message || `sync ${fn} answered ${res.status}`)
  }
  return json as T
}

export const createLog = (key: string, baby: Baby, babyAt: number, rows: Sleep[]) =>
  call<{ now: string }>('sleep_create', { p_key: key, p_baby: baby, p_baby_at: babyAt, p_rows: rows.map(toWire) })

export const pushLog = (key: string, baby: Baby | null, babyAt: number, rows: Sleep[]) =>
  call<{ now: string }>('sleep_push', { p_key: key, p_baby: baby, p_baby_at: babyAt, p_rows: rows.map(toWire) })

// `paid` is true once any phone in the log has paid for the nap times, so a log shared by two
// parents is paid for once.
export const pullLog = (key: string, since: string | null) =>
  call<{ now: string; baby: Baby; baby_at: number; rows: Wire[]; paid?: boolean }>('sleep_pull', { p_key: key, p_since: since })

export const markPaid = (key: string) => call<{ ok: boolean }>('sleep_paid', { p_key: key })

export const forgetLog = (key: string) => call<{ ok: boolean }>('sleep_forget', { p_key: key })

export const linkFor = (key: string) => `${JOIN_PAGE}#${key}`

// A pasted link or a bare key, either way.
export function keyFrom (text: string) {
  const m = text.trim().match(/([A-Za-z0-9_-]{32,})\s*$/)
  return m ? m[1] : null
}

// Merges what came back from the server into the phone's log: whichever copy of a sleep was
// changed last wins, and anything this phone changed but has not sent yet is kept.
export function merge (local: Sleep[], incoming: Sleep[], unsent: Set<string>) {
  const byId = new Map(local.map((x) => [x.id, x]))
  for (const r of incoming) {
    const mine = byId.get(r.id)
    if (mine && unsent.has(r.id) && mine.updatedAt >= r.updatedAt) continue
    if (!mine || r.updatedAt > mine.updatedAt) byId.set(r.id, r)
  }
  return [...byId.values()].sort((a, b) => a.s - b.s)
}
