// The help chat. A parent types a question, it reaches Spremt Labs through the Supabase project
// that holds the shared logs, and the answer comes back here. The thread is known by a
// token the server writes on the first message; the phone keeps it and nothing else identifies it.
import AsyncStorage from '@react-native-async-storage/async-storage'
import Constants from 'expo-constants'

const ENDPOINT = 'https://eynuujdjarqnwkjofrpw.supabase.co/functions/v1/'
const KEY = 'sb_publishable_u1X1QV-qny9l9YvnVvGvog_xQ8dw1Tm'
const STORE_KEY = 'snug.chat.v1'
// The two server functions that take a message and give back the answers. The open source copy has
// neither, so its chat sends nothing.
const SEND = '', POLL = ''

// The page the chat's alert names, so the question is known to come from the app and which version.
export const PAGE = `Baby Nap Track app ${Constants.expoConfig?.version ?? ''}`.trim()

export type Line = { from: 'me' | 'us' | 'note'; body: string }
// `firstDay` and `noted` belong to the note above the help icon, in note.ts.
export type ChatState = { token: string | null; lastId: number; emailAsked: boolean; lines: Line[]; unread: boolean; firstDay: string | null; noted: boolean }
export const NO_CHAT: ChatState = { token: null, lastId: 0, emailAsked: false, lines: [], unread: false, firstDay: null, noted: false }

export async function loadChat (): Promise<ChatState> {
  try { const raw = await AsyncStorage.getItem(STORE_KEY); if (raw) return { ...NO_CHAT, ...JSON.parse(raw) } } catch {}
  return NO_CHAT
}
export const saveChat = (c: ChatState) => AsyncStorage.setItem(STORE_KEY, JSON.stringify({ ...c, lines: c.lines.slice(-200) })).catch(() => {})

async function post<T> (fn: string, body: object): Promise<T> {
  if (!fn) throw new Error('no chat')
  const res = await fetch(ENDPOINT + fn, { method: 'POST', headers: { apikey: KEY, 'content-type': 'application/json' }, body: JSON.stringify(body) })
  return (await res.json().catch(() => ({}))) as T
}

export const send = (token: string | null, message: string) =>
  post<{ ok?: boolean; token?: string; error?: string }>(SEND, { token, message, page: PAGE, company: '' })

export const sendEmail = (token: string | null, email: string) =>
  post<{ ok?: boolean; token?: string; error?: string }>(SEND, { token, email, page: PAGE, company: '' })

// Everything after the last message the phone has. The parent's own lines are on screen already,
// so only the answers are kept.
export const poll = (token: string, after: number) =>
  post<{ messages?: { id: number; sender: string; body: string }[] }>(POLL, { token, after })
