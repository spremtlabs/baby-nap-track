// The one-off payment that keeps the nap times: when the free week runs, what it opens and what
// each screen says about it. From 4 October 2026: 7 days free, then one payment, and logging
// stays free. Nothing here locks until Google Play has a price to show, so a phone never meets a
// paywall it cannot pay at.
import { DAY } from './engine.ts'

export const SKU = 'snug_lifetime'
export const FREE_DAYS = 7

// The free week on an iPhone. The App Store takes a free trial from an app without a subscription
// only as a free non-consumable named for its length, which the person taps to start. In App
// Store Connect this item is called `7-day Trial`. Android's free week starts on its own, as before.
export const TRIAL_SKU = 'snug_trial'
export const TRIAL_NAME = '7-day Trial'

// What this phone knows about paying. `price` is the store's own price for this country, kept so the
// screens can say it offline. `trialFrom` is when the free week started: on Android the first time
// the phone saw that price, on an iPhone the moment the App Store confirmed the `7-day Trial` item.
// `freeWeek` says the App Store offers that item, so it stays false on Android.
export type Paid = { price: string | null; trialFrom: number | null; owned: boolean; sharedPaid: boolean; freeWeek: boolean }
export const NO_SHOP: Paid = { price: null, trialFrom: null, owned: false, sharedPaid: false, freeWeek: false }

// `offer` is an iPhone whose parent has not started the free week yet. The nap times wait, as they do
// once the week is up, and every screen that mentions them offers the week instead.
export type Gate =
  | { kind: 'none' }
  | { kind: 'offer'; price: string }
  | { kind: 'trial'; until: number; price: string }
  | { kind: 'locked'; price: string }
  | { kind: 'owned'; shared: boolean }

const midnight = (t: number) => new Date(t).setHours(0, 0, 0, 0)

// The free week runs to the end of the seventh day after the first one. The three hours keep the
// sum on the right day across a clock change.
export const trialEnd = (from: number) => new Date(midnight(from) + (FREE_DAYS + 1) * DAY + 3 * 3600000).setHours(0, 0, 0, 0)

export function gate (p: Paid, now: number): Gate {
  if (p.owned) return { kind: 'owned', shared: false }
  if (p.sharedPaid) return { kind: 'owned', shared: true }
  if (!p.price) return { kind: 'none' }
  // An iPhone whose App Store has the price but not the free week item locks nothing.
  if (p.trialFrom == null) return p.freeWeek ? { kind: 'offer', price: p.price } : { kind: 'none' }
  const until = trialEnd(p.trialFrom)
  return now < until ? { kind: 'trial', until, price: p.price } : { kind: 'locked', price: p.price }
}

export const isLocked = (g: Gate) => g.kind === 'locked' || g.kind === 'offer'

// The last day of the free week, the way a person would say it.
function lastDay (until: number, now: number) {
  const last = until - DAY
  if (midnight(now) === midnight(last)) return 'today'
  if (midnight(now) + DAY === midnight(last)) return 'tomorrow'
  return new Date(last).toLocaleDateString('en-IE', { weekday: 'long', day: 'numeric', month: 'long' })
}

// The day written `Wednesday 14 October`. Each part is asked for on its own, because some
// phones put a comma after the day's name when they are asked for all three at once.
const spokenDay = (t: number) => {
  const d = new Date(t)
  return `${d.toLocaleDateString('en-IE', { weekday: 'long' })} ${d.getDate()} ${d.toLocaleDateString('en-IE', { month: 'long' })}`
}

// The line on the Today screen for the last two days of the free week.
export function trialNote (g: Gate, now: number) {
  if (g.kind !== 'trial' || g.until - now > 2 * DAY) return ''
  return `Nap times are free to the end of ${lastDay(g.until, now)}. Then they're ${g.price}, once.`
}

// The line in setup, when Play has a price. A phone set up again after its week started is told
// when the week ends. An iPhone hears about the free week on the last setup screen instead.
export function setupLine (g: Gate, now: number) {
  if (g.kind === 'locked') return `The nap times are ${g.price}, once. Logging stays free.`
  if (g.kind !== 'trial') return ''
  if (g.until - now > FREE_DAYS * DAY) return `Baby Nap Track is free for ${FREE_DAYS} days. Then the nap times are ${g.price}, once.`
  return `Nap times are free to the end of ${lastDay(g.until, now)}. Then they're ${g.price}, once.`
}

// The Settings group. `week` is the button that starts the free week on an iPhone.
export function shopGroup (g: Gate, name: string, now: number): { title: string; note: string; buy: string; restore: boolean; week?: string } | null {
  if (g.kind === 'none') return null
  if (g.kind === 'offer') return { title: 'Nap times', note: `Free for ${FREE_DAYS} days from the day you start. Then they're ${g.price}, once. Logging, the week and sharing stay free.`, week: 'Start my free week', buy: `Get them now for ${g.price}`, restore: true }
  if (g.kind === 'owned') return { title: 'Nap times', note: g.shared ? `Paid for on another phone that shares ${name}'s log.` : 'Yours to keep. Thank you!', buy: '', restore: false }
  if (g.kind === 'trial') return { title: 'Nap times', note: `Free to the end of ${lastDay(g.until, now)}. Then they're ${g.price}, once. Logging, the week and sharing stay free.`, buy: `Get them now for ${g.price}`, restore: true }
  return { title: 'Nap times', note: `Your free week is up. The nap times are ${g.price}, once. Logging, the week and sharing stay free.`, buy: `Get the nap times for ${g.price}`, restore: true }
}

// What the Today screen says in place of the nap time once the free week is up.
export function lockedHero (price: string) {
  return { heading: 'Your free week of nap times is up', sub: `Get them for ${price}, once, and they're yours to keep. Logging stays free.`, buy: `Get the nap times for ${price}` }
}

// What the Today screen says in place of the nap time on an iPhone whose parent said Not now. The
// number and `days` stay on one line.
export function offerHero (price: string) {
  return { heading: `Nap times are free for ${FREE_DAYS}\u00a0days`, sub: `You get each nap time and the plan for the rest of the day. After that, they're ${price}, once. Logging stays free.`, buy: 'Start my free week' }
}

// The last setup screen on an iPhone. It says how long the free
// week runs, what stops after it and what it costs, before the parent taps.
export function weekScreen (price: string, now: number) {
  return {
    eyebrow: 'Nap times free for',
    big: [{ n: String(FREE_DAYS) }, { u: 'days' }],
    gives: `That's to the end of ${spokenDay(trialEnd(now) - DAY)}. You get each nap time and the plan for the rest of the day. Baby Nap Track reminds you before each nap and bedtime too.`,
    after: `After that, the nap times, the plan and the reminders stop until you pay ${price}, once. Logging sleep, the timer and sharing stay free.`,
    line: 'The App Store will ask you to confirm the free week.',
    start: 'Start my free week',
    later: 'Not now',
  }
}

// The toast after Apple's sheet closes on the free week. A tap that closes the sheet says nothing.
export function weekLine (o: 'owned' | 'pending' | 'cancelled' | 'failed') {
  if (o === 'pending') return 'The App Store is checking the free week. The nap times open when it goes through.'
  if (o === 'failed') return "The free week didn't start. Try again in a minute."
  return ''
}

// The store that takes the payment: Google Play on Android, the App Store on an iPhone.
export type Store = 'google' | 'apple'
const STORE_NAME: Record<Store, string> = { google: 'Google Play', apple: 'The App Store' }
const ACCOUNT: Record<Store, string> = { google: 'Google account', apple: 'Apple Account' }

// The toast after the store answers. `unreachable` is a restore the store never answered.
export function outcomeLine (o: 'owned' | 'pending' | 'cancelled' | 'failed' | 'restored' | 'none' | 'unreachable', store: Store = 'google') {
  switch (o) {
    case 'owned': return 'The nap times are yours. Thank you!'
    case 'restored': return 'Found it. The nap times are yours.'
    case 'pending': return `${STORE_NAME[store]} is finishing the payment. The nap times open when it goes through.`
    case 'failed': return "The payment didn't go through. Try again in a minute."
    case 'none': return `This ${ACCOUNT[store]} hasn't paid for Baby Nap Track yet.`
    case 'unreachable': return `${STORE_NAME[store]} didn't answer. Check the phone is online and try again.`
    default: return ''
  }
}
