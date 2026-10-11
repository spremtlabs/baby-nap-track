// The note above the help icon. A parent sees it once, from the day after the app first opened on
// the phone. A phone that already had a baby when this version arrived sees it at its next open.
// Google's test phones open a build on one day only, so they never see it.
export const NOTE = "Hey, I'm building new features right now. I'd love to know if we could do anything to help you!"
export const HELLO = "Hi! Ask us anything about Baby Nap Track and we'll answer here."

export type Noted = { firstDay: string | null; noted: boolean }

// What the phone keeps as its first day, written the first time this version runs.
export const firstDayFor = (hasBaby: boolean, today: string) => (hasBaby ? 'before' : today)

export const noteDue = (c: Noted, hasBaby: boolean, today: string) => hasBaby && !c.noted && c.firstDay != null && c.firstDay !== today

// The chat opens on the note once the parent has seen it, and on the hello until then.
export const opening = (c: Noted) => (c.noted ? NOTE : HELLO)
