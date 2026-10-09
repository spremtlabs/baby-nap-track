// Paying through Google Play on Android and the App Store on an iPhone. On a phone this is the
// store's own purchase sheet. The web build has no store, so it reads a pretend one from the page's
// storage, which the gate sets to walk the free week, the lock and a purchase.
import { ErrorCode, fetchProducts, finishTransaction, getAvailablePurchases, initConnection, purchaseErrorListener, purchaseUpdatedListener, requestPurchase, restorePurchases, type Purchase } from 'expo-iap'
import { Platform } from 'react-native'
import { FAKE_PLAY_KEY, IPHONE, readFake } from './phone.ts'
import { SKU, TRIAL_SKU } from './shop.ts'

export type Outcome = 'owned' | 'pending' | 'cancelled' | 'failed'
// What the store's answer was about: the nap times, or the free week on an iPhone.
export type Item = 'naps' | 'week'

type Play = {
  // Play's price for this country, or null when Play has nothing to sell.
  price: () => Promise<string | null>
  // Whether this Google account or Apple Account has paid. Null when the store could not be asked.
  // `restore` is the parent's own tap, and on an iPhone it asks the App Store to sync first.
  owned: (restore?: boolean) => Promise<boolean | null>
  // On an iPhone, whether the App Store offers the `7-day Trial` item, and when this Apple Account
  // started it, so a phone set up again never starts a second week. Android answers no without
  // asking Play. Null when the App Store could not be asked.
  week: () => Promise<{ offered: boolean; from: number | null } | null>
  buy: () => Promise<void>
  // Opens Apple's sheet on the free `7-day Trial` item. iPhone only.
  startWeek: () => Promise<void>
  // `at` is when the App Store says the free week started, for a week this account already had.
  listen: (cb: (o: Outcome, item: Item | null, at?: number) => void) => () => void
}

let ready: Promise<boolean> | null = null
const connect = () => (ready ??= initConnection().then(() => true).catch(() => { ready = null; return false }))

// Google keeps the money unless a purchase is acknowledged within three days.
const finish = (p: Purchase) => {
  if ((p as { isAcknowledgedAndroid?: boolean | null }).isAcknowledgedAndroid) return Promise.resolve()
  return finishTransaction({ purchase: p, isConsumable: false }).then(() => {})
}

// The first time this Apple Account took the free week. A second tap on the item hands back the
// first transaction, so the week runs from the first tap.
const weekStart = (p: Purchase) => {
  const t = (p as { originalTransactionDateIOS?: number | null }).originalTransactionDateIOS ?? p.transactionDate
  return typeof t === 'number' && t > 0 && t <= Date.now() + 60000 ? t : undefined
}

const store: Play = {
  async price () {
    if (!(await connect())) return null
    try {
      const list = (await fetchProducts({ skus: [SKU], type: 'in-app' })) as { id: string; displayPrice: string }[] | null
      return list?.find((x) => x.id === SKU)?.displayPrice ?? null
    } catch { return null }
  },
  async owned (restore = false) {
    if (!(await connect())) return null
    try {
      if (restore && Platform.OS === 'ios') await restorePurchases()
      const mine = (await getAvailablePurchases()).filter((x) => x.productId === SKU && x.purchaseState === 'purchased')
      await Promise.all(mine.map((x) => finish(x).catch(() => {})))
      return mine.length > 0
    } catch { return null }
  },
  async week () {
    if (!IPHONE) return { offered: false, from: null }
    if (!(await connect())) return null
    try {
      const [list, mine] = await Promise.all([
        fetchProducts({ skus: [TRIAL_SKU], type: 'in-app' }) as Promise<{ id: string }[] | null>,
        getAvailablePurchases(),
      ])
      const took = mine.filter((x) => x.productId === TRIAL_SKU && x.purchaseState === 'purchased')
      await Promise.all(took.map((x) => finish(x).catch(() => {})))
      const had = took.map(weekStart).filter((t): t is number => t != null)
      return { offered: !!list?.some((x) => x.id === TRIAL_SKU), from: had.length ? Math.min(...had) : null }
    } catch { return null }
  },
  async buy () {
    if (!(await connect())) throw new Error('the store is not reachable')
    await requestPurchase({ request: { apple: { sku: SKU }, google: { skus: [SKU] } }, type: 'in-app' })
  },
  async startWeek () {
    if (!IPHONE) throw new Error('the free week starts by itself on Android')
    if (!(await connect())) throw new Error('the store is not reachable')
    await requestPurchase({ request: { apple: { sku: TRIAL_SKU } }, type: 'in-app' })
  },
  listen (cb) {
    const a = purchaseUpdatedListener((x) => {
      const item: Item | null = x.productId === SKU ? 'naps' : x.productId === TRIAL_SKU ? 'week' : null
      if (!item) return
      if (x.purchaseState === 'purchased') finish(x).catch(() => {}).then(() => cb('owned', item, item === 'week' ? weekStart(x) : undefined))
      else if (x.purchaseState === 'pending') cb('pending', item)
    })
    const b = purchaseErrorListener((e) => cb(
      e.code === ErrorCode.UserCancelled ? 'cancelled' : e.code === ErrorCode.AlreadyOwned ? 'owned' : 'failed',
      e.productId === TRIAL_SKU ? 'week' : e.productId === SKU ? 'naps' : null,
    ))
    return () => { a.remove(); b.remove() }
  },
}

// The pretend store, described in phone.ts.
type Heard = (o: Outcome, item: Item | null, at?: number) => void
const fakeListeners = new Set<Heard>()
const tell = (o: Outcome, item: Item, at?: number) => setTimeout(() => fakeListeners.forEach((cb) => cb(o, item, at)), 200)
const pretend: Play = {
  price: async () => readFake().price ?? null,
  owned: async () => !!readFake().owned,
  week: async () => {
    const f = readFake()
    return IPHONE ? { offered: !!f.week, from: f.weekFrom ?? null } : { offered: false, from: null }
  },
  async buy () {
    const f = readFake()
    if (!f.price) throw new Error('nothing to sell')
    if (!f.pending) globalThis.localStorage?.setItem(FAKE_PLAY_KEY, JSON.stringify({ ...f, owned: true }))
    tell(f.pending ? 'pending' : 'owned', 'naps')
  },
  async startWeek () {
    const f = readFake()
    if (!IPHONE || !f.week) throw new Error('no free week to start')
    if (f.weekCancel) { tell('cancelled', 'week'); return }
    const at = f.weekFrom ?? Date.now()
    globalThis.localStorage?.setItem(FAKE_PLAY_KEY, JSON.stringify({ ...f, weekFrom: at }))
    tell('owned', 'week', at)
  },
  listen (cb) { fakeListeners.add(cb); return () => { fakeListeners.delete(cb) } },
}

export const play: Play = Platform.OS === 'web' ? pretend : store
