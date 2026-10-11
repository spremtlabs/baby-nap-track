// The parent's email, asked in setup and kept in Settings, so we can send sleep tips. It goes
// to a Supabase project through sleep_signup in supabase/signups.sql, which can only add
// an address, never read one back. Added 9 October 2026.
const URL = 'https://eynuujdjarqnwkjofrpw.supabase.co/rest/v1/rpc/sleep_signup'
const KEY = 'sb_publishable_u1X1QV-qny9l9YvnVvGvog_xQ8dw1Tm'

export const looksLikeEmail = (s: string) => { const v = s.trim(); return v.length <= 254 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v) }

export type SignUp = 'ok' | 'bad' | 'offline'
export async function signUp (email: string, source: 'setup' | 'settings', version = ''): Promise<SignUp> {
  if (!looksLikeEmail(email)) return 'bad'
  try {
    const r = await fetch(URL, {
      method: 'POST',
      headers: { apikey: KEY, 'content-type': 'application/json' },
      body: JSON.stringify({ p_email: email.trim(), p_source: source, p_version: version }),
    })
    return r.ok ? 'ok' : r.status === 400 ? 'bad' : 'offline'
  } catch { return 'offline' }
}

export const signUpProblem = (r: SignUp) => (r === 'bad' ? "That doesn't look like an email address. Check it and try again." : r === 'offline' ? 'No internet connection. Try again when you are online.' : '')
