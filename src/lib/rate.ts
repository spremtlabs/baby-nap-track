// When the store's own rating card is asked for: Google Play's on Android, the App Store's on an
// iPhone. Once per phone, on the third day the parent starts a nap from the timer, with the baby
// down and the phone in hand. Google's test phones open a build on one day only, so they never
// reach it. The app puts no question of its own in front of the card.
export const RATE_DAYS = 3

// `days` counts the days this phone started a nap from the timer, and `last` is the latest of them.
export type Rate = { days: number; last: string | null; asked: boolean }
export const NO_RATE: Rate = { days: 0, last: null, asked: false }

// A nap started from the timer. A second nap on the same day counts nothing more.
export const napOn = (r: Rate, today: string): Rate => (r.asked || r.last === today ? r : { ...r, days: r.days + 1, last: today })

export const rateDue = (r: Rate) => !r.asked && r.days >= RATE_DAYS
