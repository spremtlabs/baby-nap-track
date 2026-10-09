// Sending the sleep diary from the web build, which has no share panel. It keeps the diary in the
// page's storage for the gate to read and print, and downloads both files. A phone uses
// send.native.ts, which hands them to the phone's own share panel.
import type { Diary } from './diary.ts'

export const DIARY_KEY = 'snug.diary'

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

// Text to base64 by way of UTF-8, the same on a phone and in a browser.
export function base64 (text: string) {
  const bytes: number[] = []
  for (const ch of text) {
    const c = ch.codePointAt(0)!
    if (c < 0x80) bytes.push(c)
    else if (c < 0x800) bytes.push(0xc0 | (c >> 6), 0x80 | (c & 63))
    else if (c < 0x10000) bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63))
    else bytes.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63))
  }
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const [a, b = 0, c = 0] = [bytes[i], bytes[i + 1], bytes[i + 2]], n = (a << 16) | (b << 8) | c
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (i + 1 < bytes.length ? B64[(n >> 6) & 63] : '=') + (i + 2 < bytes.length ? B64[n & 63] : '=')
  }
  return out
}

const download = (name: string, type: string, body: string) => {
  const url = URL.createObjectURL(new Blob([body], { type }))
  const a = document.createElement('a')
  a.href = url; a.download = name
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function sendDiary (d: Diary): Promise<'sent' | 'failed'> {
  try {
    localStorage.setItem(DIARY_KEY, JSON.stringify({ base: d.base, html: d.html, csv: d.csv }))
    download(`${d.base}.html`, 'text/html', d.html)
    download(`${d.base}.csv`, 'text/csv', d.csv)
    return 'sent'
  } catch {
    return 'failed'
  }
}
