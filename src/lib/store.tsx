// The log on this phone, saved on every change, the sharing that keeps it in step with the other
// carers' phones, and what Google Play says about paying for the nap times.
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Crypto from 'expo-crypto'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AppState } from 'react-native'
import { engine, withMorning, type Baby, type Out, type Sleep } from './engine.ts'
import { applyTyped, type Typed } from './typed.ts'
import type { Chair } from './chair.ts'
import { play, type Item, type Outcome } from './billing.ts'
import { reminder, sleepNotice } from './model.ts'
import { book, clearAll, showSleep } from './notify.ts'
import { IPHONE } from './phone.ts'
import { ASK_COUNTS, allowCounts, flush, installSource, track } from './posthog.ts'
import { NO_RATE, napOn, rateDue, type Rate } from './rate.ts'
import { askForRating } from './review.ts'
import { NO_SHOP, gate, isLocked, type Paid } from './shop.ts'
import { NOT_TOLD, dayKey, due, toldOnLoad, type Source, type Told } from './track.ts'
import { NoSuchLog, createLog, forgetLog, fromWire, markPaid, merge, pullLog, pushLog } from './sync.ts'
import { signUp as sendSignUp } from './signup.ts'
import Constants from 'expo-constants'

const STORE_KEY = 'snug.state.v1'

export type Share = { key: string; since: string | null; lastOk: number | null; failing: boolean }

// Version 1.0.0 also kept an `anchor`, the time setup was told the baby last woke. It never knew
// the morning's naps, so it is left unread and the screen asks about the morning again.
type Saved = {
  baby: Baby | null
  sleeps: Sleep[]
  alerts: boolean
  lead: number
  share: Share | null
  babyAt: number
  unsent: string[]
  babyUnsent: boolean
  // Paying for the nap times. It outlives a deleted log and a new setup, so the free week runs once.
  paid: Paid
  // The shared log this phone last told that it has paid.
  paidMarked: string | null
  // The steps PostHog has heard from this phone. Like `paid`, it outlives a deleted log.
  told: Told
  // The trip the parent planned the day around, on this phone only.
  out: Out | null
  // The answer to sending usage counts, asked on an iPhone. Null until the parent answers. Like
  // `paid`, it outlives a deleted log, so setup asks it once.
  counts: boolean | null
  // Whether this phone has given us an email, in setup or Settings. Like `paid`, it outlives a
  // deleted log. The phone keeps only that, never the address.
  signedUp: boolean
  // The days this phone started a nap from the timer, and whether the store's rating card has been
  // asked for. Like `paid`, it outlives a deleted log, so the card is asked for once.
  rate: Rate
}

const EMPTY: Saved = { baby: null, sleeps: [], alerts: true, lead: 15, share: null, babyAt: 0, unsent: [], babyUnsent: false, paid: NO_SHOP, paidMarked: null, told: NOT_TOLD, out: null, counts: null, signedUp: false, rate: NO_RATE }

const newId = () => Crypto.randomUUID()
const newKey = () => {
  const bytes = Crypto.getRandomBytes(24)
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function useStoreValue () {
  const [state, setState] = useState<Saved | null>(null)
  const [now, setNow] = useState(Date.now())
  const ref = useRef<Saved | null>(null)
  ref.current = state

  useEffect(() => {
    AsyncStorage.getItem(STORE_KEY).then((raw) => {
      let s = EMPTY
      try { if (raw) { const r = JSON.parse(raw); s = { ...EMPTY, ...r, paid: { ...NO_SHOP, ...r.paid }, told: toldOnLoad(r), rate: { ...NO_RATE, ...r.rate } } } } catch {}
      setState(s)
    })
  }, [])

  // The clock the screens read. It moves on every 20 seconds and whenever the app comes back.
  // Events still waiting go to PostHog as the app is left.
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 20000)
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') setNow(Date.now()); else flush() })
    return () => { clearInterval(tick); sub.remove() }
  }, [])

  const update = useCallback((fn: (s: Saved) => Saved) => {
    setState((prev) => {
      if (!prev) return prev
      const next = fn(prev)
      AsyncStorage.setItem(STORE_KEY, JSON.stringify(next)).catch(() => {})
      return next
    })
  }, [])

  /* Sharing */
  const syncing = useRef(false)
  const sync = useCallback(async () => {
    const s = ref.current
    if (!s || !s.share || syncing.current) return
    syncing.current = true
    const sent = new Set(s.unsent)
    try {
      const rows = s.sleeps.filter((x) => sent.has(x.id))
      if (rows.length || s.babyUnsent) await pushLog(s.share.key, s.babyUnsent ? s.baby : null, s.babyAt, rows)
      const since = s.share.since ? new Date(new Date(s.share.since).getTime() - 10000).toISOString() : null
      const res = await pullLog(s.share.key, since)
      update((cur) => {
        if (!cur.share || cur.share.key !== s.share!.key) return cur
        const stillUnsent = new Set(cur.unsent.filter((id) => {
          if (!sent.has(id)) return true
          const before = s.sleeps.find((x) => x.id === id), now = cur.sleeps.find((x) => x.id === id)
          return !before || !now || now.updatedAt !== before.updatedAt
        }))
        const sleeps = merge(cur.sleeps, res.rows.map(fromWire), stillUnsent)
        const takeBaby = Number(res.baby_at) > cur.babyAt && res.baby && (res.baby as Baby).name
        return {
          ...cur, sleeps, unsent: [...stillUnsent],
          babyUnsent: cur.babyUnsent && cur.babyAt !== s.babyAt ? true : false,
          baby: takeBaby ? { ...cur.baby!, ...(res.baby as Baby) } : cur.baby,
          babyAt: takeBaby ? Number(res.baby_at) : cur.babyAt,
          paid: { ...cur.paid, sharedPaid: !!res.paid },
          share: { ...cur.share, since: res.now, lastOk: Date.now(), failing: false },
        }
      })
    } catch (e) {
      update((cur) => (cur.share ? { ...cur, share: { ...cur.share, failing: true } } : cur))
      if (e instanceof NoSuchLog) update((cur) => ({ ...cur, share: null }))
    } finally {
      syncing.current = false
    }
  }, [update])

  // Send a change a moment after it is made, read the others every minute, and on every return.
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!state?.share) return
    if (state.unsent.length || state.babyUnsent) {
      if (pending.current) clearTimeout(pending.current)
      pending.current = setTimeout(sync, 1500)
    }
  }, [state?.unsent.length, state?.babyUnsent, state?.share, sync])
  useEffect(() => {
    if (!state?.share) return
    sync()
    const t = setInterval(sync, 60000)
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') sync() })
    return () => { clearInterval(t); sub.remove() }
  }, [state?.share?.key, sync])

  // The reminder follows the screen. Once the free week is up, the nap times and their reminders
  // wait for the payment.
  const locked = state ? isLocked(gate(state.paid, now)) : false
  useEffect(() => {
    if (!state?.baby) return
    if (!state.alerts) { clearAll(); return }
    if (locked) { book(null).catch(() => {}); return }
    const E = engine(state.baby, state.sleeps, Date.now(), state.out)
    book(reminder(E, state.lead)).catch(() => {})
  }, [state?.sleeps, state?.baby, state?.alerts, state?.lead, state?.out, locked])

  /* Analytics */
  // On an iPhone nothing goes to PostHog until the parent has said yes. Android sends as before.
  const counting = !!state && (!ASK_COUNTS || state.counts === true)
  useEffect(() => { if (state) allowCounts(counting) }, [!!state, counting])
  const setCounts = useCallback((yes: boolean) => { allowCounts(yes); update((s) => ({ ...s, counts: yes })) }, [update])

  // The first open, the free week starting and ending, and each day the app is opened. They wait
  // for Play's first answer, or five seconds, so the day carries the free week, and for the tags
  // Play kept for the install, which go with the first open. A step is marked on the phone once
  // PostHog has it, and `sending` stops a second copy going while the first is on its way.
  const sending = useRef(new Set<string>())
  const [heard, setHeard] = useState(false)
  const [from, setFrom] = useState<Source | null>(null)
  useEffect(() => { const t = setTimeout(() => setHeard(true), 5000); return () => clearTimeout(t) }, [])
  useEffect(() => { installSource().then(setFrom) }, [])
  useEffect(() => {
    if (!state || !heard || !from || !counting) return
    for (const { key, ev } of due(state, gate(state.paid, now), now, from)) {
      const day = dayKey(now), id = key === 'day' ? `day ${day}` : key
      if (sending.current.has(id)) continue
      sending.current.add(id)
      track(ev).then((ok) => {
        sending.current.delete(id)
        if (ok) update((s) => ({ ...s, told: { ...s.told, ...(key === 'day' ? { day } : { [key]: true }) } }))
      })
    }
  }, [state, now, heard, from, counting, update])

  /* Paying */
  // Play is asked on every start and every return. On Android the free week starts the first time
  // Play has a price, so a phone that met the app before the price existed still gets its full week.
  // On an iPhone it starts only from the parent's tap on the `7-day Trial` item, and an Apple Account
  // that took it before keeps the week it had.
  const ask = useCallback(async (restore = false) => {
    const [price, owned, wk] = await Promise.all([play.price(), play.owned(restore), play.week()])
    update((s) => {
      const p = { ...s.paid }
      if (price) { p.price = price; if (p.trialFrom == null && !IPHONE) p.trialFrom = Date.now() }
      if (owned != null) p.owned = owned
      if (wk) { p.freeWeek = wk.offered; if (wk.from != null && p.trialFrom == null) p.trialFrom = wk.from }
      return { ...s, paid: p }
    })
    setHeard(true)
    return owned
  }, [update])
  useEffect(() => {
    if (!state) return
    ask()
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') ask() })
    return () => sub.remove()
  }, [!!state, ask])

  // Play answers a purchase through a listener. A purchase that goes through later, after a
  // pending payment, still opens the nap times, and `late` carries it to the screen. On an iPhone
  // the same listener hears the free week start, from the date the App Store gives for it.
  const waiting = useRef<{ item: Item; done: (o: Outcome) => void } | null>(null)
  const [late, setLate] = useState<{ o: Outcome; at: number } | null>(null)
  useEffect(() => play.listen((o, said, at) => {
    const item = said ?? waiting.current?.item ?? 'naps'
    if (o === 'owned' && item === 'naps') update((s) => ({ ...s, paid: { ...s.paid, owned: true } }))
    if (o === 'owned' && item === 'week') {
      if (at != null) update((s) => ({ ...s, paid: { ...s.paid, trialFrom: s.paid.trialFrom ?? at } }))
      else ask()
    }
    const w = waiting.current
    if (w && w.item === item) { waiting.current = null; w.done(o) }
    else if (o === 'owned' && item === 'naps') { setLate({ o, at: Date.now() }); track({ event: 'snug_purchase', outcome: o, late: true }) }
  }), [update, ask])

  const buy = useCallback(() => {
    track({ event: 'snug_buy_tapped', gate: gate(ref.current?.paid ?? NO_SHOP, Date.now()).kind })
    return new Promise<Outcome>((done) => {
      const w = { item: 'naps' as const, done }
      waiting.current = w
      play.buy().catch(() => { if (waiting.current === w) { waiting.current = null; done('failed') } })
    }).then((o) => { track({ event: 'snug_purchase', outcome: o, late: false }); return o })
  }, [])

  // The parent's tap on Start my free week, on an iPhone. Apple's sheet takes it from there, and the
  // week runs from the moment the App Store confirms the free `7-day Trial` item.
  const startWeek = useCallback(() => new Promise<Outcome>((done) => {
    const w = { item: 'week' as const, done }
    waiting.current = w
    play.startWeek().catch(() => { if (waiting.current === w) { waiting.current = null; done('failed') } })
  }), [])

  // Play is asked again. Null means Play could not be reached, which is a different answer from no.
  const restore = useCallback(async (): Promise<'restored' | 'none' | 'failed'> => {
    const o = await ask(true)
    const r = o === true ? 'restored' : o === false ? 'none' : 'failed'
    track({ event: 'snug_restore', outcome: r })
    return r
  }, [ask])

  // A shared log is told once that this phone has paid, so every phone in it gets the nap times.
  useEffect(() => {
    const key = state?.share?.key
    if (!key || !state?.paid.owned || state.paidMarked === key) return
    markPaid(key).then(() => update((s) => ({ ...s, paidMarked: key }))).catch(() => {})
  }, [state?.share?.key, state?.paid.owned, state?.paidMarked, update])

  // While a sleep runs, the lock screen says so. It goes when the sleep ends or the log is deleted.
  useEffect(() => {
    if (!state) return
    showSleep(state.baby ? sleepNotice(engine(state.baby, state.sleeps, Date.now())) : null).catch(() => {})
  }, [state?.sleeps, state?.baby])

  /* Changes to the log */
  const touch = (s: Saved, ids: string[]) => (s.share ? [...new Set([...s.unsent, ...ids])] : s.unsent)

  const addSleep = useCallback((x: Omit<Sleep, 'id' | 'updatedAt'>) => {
    const id = newId()
    update((s) => ({ ...s, sleeps: [...s.sleeps, { ...x, id, updatedAt: Date.now() }].sort((a, b) => a.s - b.s), unsent: touch(s, [id]) }))
    return id
  }, [update])

  // A nap started from the timer. On the third day of them the store's rating card is asked for,
  // a moment after the tap so the timer is seen first, and only with the app still on screen.
  const napStarted = useCallback(() => {
    const was = ref.current?.rate ?? NO_RATE, next = napOn(was, dayKey(Date.now()))
    if (next !== was) update((s) => ({ ...s, rate: next }))
    if (!rateDue(next)) return
    setTimeout(async () => {
      if (AppState.currentState !== 'active' || !(await askForRating())) return
      update((s) => ({ ...s, rate: { ...s.rate, asked: true } }))
    }, 1200)
  }, [update])

  const endSleep = useCallback((id: string, up: boolean, at = Date.now()) => {
    update((s) => ({
      ...s,
      sleeps: s.sleeps.map((x) => (x.id === id ? { ...x, e: x.e ?? at, up, updatedAt: Date.now() } : x)),
      unsent: touch(s, [id]),
    }))
  }, [update])

  const saveSleep = useCallback((x: Sleep) => {
    update((s) => {
      const has = s.sleeps.some((y) => y.id === x.id)
      const row = { ...x, updatedAt: Date.now() }
      const sleeps = (has ? s.sleeps.map((y) => (y.id === x.id ? row : y)) : [...s.sleeps, row]).sort((a, b) => a.s - b.s)
      return { ...s, sleeps, unsent: touch(s, [x.id]) }
    })
  }, [update])

  const deleteSleep = useCallback((id: string) => {
    update((s) => ({
      ...s,
      sleeps: s.share ? s.sleeps.map((x) => (x.id === id ? { ...x, deleted: true, updatedAt: Date.now() } : x)) : s.sleeps.filter((x) => x.id !== id),
      unsent: touch(s, [id]),
    }))
  }, [update])

  const setBaby = useCallback((patch: Partial<Baby>) => {
    update((s) => (s.baby ? { ...s, baby: { ...s.baby, ...patch }, babyAt: Date.now(), babyUnsent: !!s.share } : s))
  }, [update])

  // The chair method, changed from what it is at the moment of the change.
  const setChair = useCallback((fn: (c: Chair | null) => Chair | null) => {
    update((s) => (s.baby ? { ...s, baby: { ...s.baby, chair: fn(s.baby.chair ?? null) }, babyAt: Date.now(), babyUnsent: !!s.share } : s))
  }, [update])

  // Setup keeps this morning's wake-up and any naps since, so the first nap time comes from them.
  const setup = useCallback((baby: Baby, woke: number, naps: { s: number; e: number }[]) => {
    const at = Date.now()
    const sleeps: Sleep[] = [
      { id: newId(), s: woke, e: woke, kind: 'night' as const, up: true, updatedAt: at },
      ...naps.map((x) => ({ id: newId(), s: x.s, e: x.e, kind: 'nap' as const, up: false, updatedAt: at })),
    ].sort((a, b) => a.s - b.s)
    update((s) => ({ ...EMPTY, alerts: s.alerts, lead: s.lead, paid: { ...s.paid, sharedPaid: false }, told: s.told, counts: s.counts, signedUp: s.signedUp, baby, babyAt: at, sleeps }))
    track({ event: 'snug_setup_done', naps: naps.length })
  }, [update])

  // This morning's wake-up. It moves the end of the night that ended it, or goes in as a wake-up
  // of its own when the night was not logged. Returns the engine as it will be, for the toast.
  const setMorning = useCallback((t: number) => {
    const id = newId(), at = Date.now()
    const apply = (s: Saved): Saved => {
      if (!s.baby) return s
      const m = withMorning(s.baby, s.sleeps, at, t, id)
      return { ...s, sleeps: m.sleeps, unsent: touch(s, [m.id]) }
    }
    const next = ref.current ? apply(ref.current) : null
    update(apply)
    return next?.baby ? engine(next.baby, next.sleeps, at) : null
  }, [update])

  // What the parent typed, put in the log in one go: the morning, the naps it replaces and each sleep.
  const saveTyped = useCallback((r: Typed) => {
    const at = Date.now(), pool = Array.from({ length: r.rows.length + 1 }, () => newId())
    const apply = (s: Saved): Saved => {
      if (!s.baby) return s
      let i = 0
      const x = applyTyped(s.baby, s.sleeps, at, r, () => pool[i++] ?? newId(), !!s.share)
      return { ...s, sleeps: x.sleeps, unsent: touch(s, x.ids) }
    }
    const next = ref.current ? apply(ref.current) : null
    update(apply)
    return next?.baby ? engine(next.baby, next.sleeps, at) : null
  }, [update])

  // Last night, put back in one go: each stretch of it saved, and any stretch it no longer has
  // deleted. Returns the engine as it will be, for the toast.
  const saveNight = useCallback((rows: Sleep[], gone: string[]) => {
    const at = Date.now()
    const apply = (s: Saved): Saved => {
      const mine = new Set(rows.map((x) => x.id)), drop = new Set(gone)
      const kept = s.sleeps.filter((x) => !mine.has(x.id))
      const left = s.share ? kept.map((x) => (drop.has(x.id) ? { ...x, deleted: true, updatedAt: at } : x)) : kept.filter((x) => !drop.has(x.id))
      const sleeps = [...left, ...rows.map((x) => ({ ...x, updatedAt: at }))].sort((a, b) => a.s - b.s)
      return { ...s, sleeps, unsent: touch(s, [...mine, ...gone]) }
    }
    const next = ref.current ? apply(ref.current) : null
    update(apply)
    return next?.baby ? engine(next.baby, next.sleeps, at, next.out) : null
  }, [update])

  const setOut = useCallback((o: Out | null) => update((s) => ({ ...s, out: o })), [update])

  // The parent's email, for sleep tips. The phone keeps only that it was given, never the address.
  const signUp = useCallback(async (email: string, source: 'setup' | 'settings') => {
    const r = await sendSignUp(email, source, Constants.expoConfig?.version ?? '')
    if (r === 'ok') update((s) => ({ ...s, signedUp: true }))
    return r
  }, [update])

  const setAlerts = useCallback((on: boolean) => update((s) => ({ ...s, alerts: on })), [update])
  const setLead = useCallback((m: number) => update((s) => ({ ...s, lead: m })), [update])

  // The first phone to share sends the whole log and gets the link.
  const startShare = useCallback(async () => {
    const s = ref.current
    if (!s?.baby) return null
    if (s.share) return s.share.key
    const key = newKey()
    const res = await createLog(key, s.baby, s.babyAt || Date.now(), s.sleeps)
    update((cur) => ({ ...cur, share: { key, since: res.now, lastOk: Date.now(), failing: false }, unsent: [], babyUnsent: false }))
    track({ event: 'snug_share_started' })
    return key
  }, [update])

  // Joining replaces this phone's log with the shared one.
  const joinShare = useCallback(async (key: string) => {
    const res = await pullLog(key, null)
    update((s) => ({
      ...s, baby: res.baby, babyAt: Number(res.baby_at), sleeps: res.rows.map(fromWire).sort((a, b) => a.s - b.s),
      paid: { ...s.paid, sharedPaid: !!res.paid },
      share: { key, since: res.now, lastOk: Date.now(), failing: false }, unsent: [], babyUnsent: false,
    }))
    track({ event: 'snug_share_joined' })
    return res.baby
  }, [update])

  const stopShare = useCallback(() => update((s) => ({ ...s, share: null, unsent: [], babyUnsent: false, paid: { ...s.paid, sharedPaid: false } })), [update])

  const deleteAll = useCallback(async () => {
    const s = ref.current
    if (s?.share) await forgetLog(s.share.key)
    await clearAll()
    update((s) => ({ ...EMPTY, paid: { ...s.paid, sharedPaid: false }, told: s.told, counts: s.counts, signedUp: s.signedUp, rate: s.rate }))
    track({ event: 'snug_log_deleted' })
  }, [update])

  const E = useMemo(() => (state?.baby ? engine(state.baby, state.sleeps, now, state.out) : null), [state, now])
  const g = useMemo(() => gate(state?.paid ?? NO_SHOP, now), [state?.paid, now])

  return {
    loaded: !!state, state: state ?? EMPTY, now, E, gate: g, late, refreshNow: () => setNow(Date.now()),
    addSleep, napStarted, endSleep, saveSleep, saveNight, saveTyped, deleteSleep, setBaby, setChair, setup, setMorning, setOut, setAlerts, setLead, startShare, joinShare, stopShare, deleteAll, sync,
    buy, restore, startWeek, setCounts, signUp,
  }
}

export type Store = ReturnType<typeof useStoreValue>
const Ctx = createContext<Store | null>(null)

export function StoreProvider ({ children }: { children: ReactNode }) {
  const v = useStoreValue()
  return <Ctx.Provider value={v}>{children}</Ctx.Provider>
}

export const useStore = () => {
  const v = useContext(Ctx)
  if (!v) throw new Error('useStore outside StoreProvider')
  return v
}
