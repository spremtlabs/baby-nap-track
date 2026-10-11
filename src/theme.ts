// The two palettes. Honey marks the window to put the baby down, the time out on a plan for going
// out and a stretch with no nap logged, sleep is indigo, the button is ink. Night runs from the bedtime window until he is up.
export type Theme = {
  name: 'day' | 'night'
  bg: string; ink: string; muted: string; line: string; soft: string
  sleep: string; sleepPlan: string; sleepRun: string
  honey: string; honeyText: string; honeySoft: string; glow: string
  btn: string; btnInk: string; scrim: string; sheet: string
}

export const DAY_THEME: Theme = {
  name: 'day',
  bg: '#F3F4F7', ink: '#151A2C', muted: '#6C7186', line: '#DDE0E8', soft: '#E7E9EF',
  sleep: '#4252A8', sleepPlan: 'rgba(66,82,168,0.10)', sleepRun: '#8A94C8',
  honey: '#E29A39', honeyText: '#9C5E10', honeySoft: 'rgba(226,154,57,0.30)', glow: '#E8A040',
  btn: '#151A2C', btnInk: '#F3F4F7', scrim: 'rgba(14,18,34,0.42)', sheet: '#F3F4F7',
}

export const NIGHT_THEME: Theme = {
  name: 'night',
  bg: '#0E1222', ink: '#ECE6D9', muted: '#8D92A9', line: '#242A45', soft: '#191E35',
  sleep: '#8494EA', sleepPlan: 'rgba(132,148,234,0.12)', sleepRun: '#5A6398',
  honey: '#F2B868', honeyText: '#F2B868', honeySoft: 'rgba(242,184,104,0.30)', glow: '#F2B868',
  btn: '#252B47', btnInk: '#ECE6D9', scrim: 'rgba(0,0,0,0.55)', sheet: '#12172A',
}

export const F = {
  light: 'Figtree_300Light',
  regular: 'Figtree_400Regular',
  medium: 'Figtree_500Medium',
  semibold: 'Figtree_600SemiBold',
  bold: 'Figtree_700Bold',
}
