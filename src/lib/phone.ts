// Whether Baby Nap Track is on an iPhone. The web build has no phone and no store, so it reads a pretend store
// from the page's storage, which the gate sets. With `"os": "ios"` in it the web build answers as an
// iPhone, and the walk goes through the screens only an iPhone shows: the free week started from the
// `7-day Trial` item and the question about usage counts.
import { Platform } from 'react-native'

// The pretend store: `{ "price": "€9.99", "owned": false, "pending": false }` under this key. On an
// iPhone it also carries `os`, `week` when the App Store offers the free week, `weekFrom` when this
// Apple Account started it, and `weekCancel` to close Apple's sheet without starting it.
export const FAKE_PLAY_KEY = 'snug.fakeplay'
export type Fake = { price?: string | null; owned?: boolean; pending?: boolean; os?: string; week?: boolean; weekFrom?: number; weekCancel?: boolean }
export const readFake = (): Fake => {
  try { return JSON.parse(globalThis.localStorage?.getItem(FAKE_PLAY_KEY) || '{}') } catch { return {} }
}

export const IPHONE = Platform.OS === 'ios' || (Platform.OS === 'web' && readFake().os === 'ios')
