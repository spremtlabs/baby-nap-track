// The help icon in the corner of the Today screen and the chat it opens. A person answers in the
// same box. While the chat is open it looks for an answer every few seconds, and otherwise once a
// minute while the app is open, with a dot on the icon when one has come in. A note from us sits
// above the icon once, and a tap on it opens the chat with the note as its first line.
import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState, Pressable, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Path } from 'react-native-svg'
import { NO_CHAT, loadChat, poll, saveChat, send, sendEmail, type ChatState, type Line } from '../lib/chat.ts'
import { NOTE, firstDayFor, noteDue, opening } from '../lib/note.ts'
import { dayKey } from '../lib/track.ts'
import { Pill, Sheet, T, useTheme } from '../ui/kit.tsx'

const OPEN_POLL = 5000
const SHUT_POLL = 60000

// `ready` is the log loaded from the phone, and `hasBaby` is setup done.
export function useChat (ready: boolean, hasBaby: boolean) {
  const [c, setC] = useState<ChatState>(NO_CHAT)
  const [loaded, setLoaded] = useState(false)
  const [open, setOpen] = useState(false)
  const ref = useRef(c)
  ref.current = c
  useEffect(() => { loadChat().then((x) => { setC(x); setLoaded(true) }) }, [])
  const put = useCallback((fn: (c: ChatState) => ChatState) => setC((prev) => { const next = fn(prev); saveChat(next); return next }), [])
  const today = dayKey(Date.now())
  useEffect(() => { if (loaded && ready && c.firstDay == null) put((cur) => ({ ...cur, firstDay: firstDayFor(hasBaby, today) })) }, [loaded, ready, c.firstDay, hasBaby, today, put])
  const note = loaded && ready && noteDue(c, hasBaby, today)

  const check = useCallback(async () => {
    const { token, lastId } = ref.current
    if (!token) return
    try {
      const r = await poll(token, lastId)
      const list = r.messages ?? []
      if (!list.length) return
      put((cur) => {
        const answers: Line[] = list.filter((m) => m.sender !== 'visitor').map((m) => ({ from: 'us', body: m.body }))
        return { ...cur, lastId: Math.max(cur.lastId, ...list.map((m) => m.id)), lines: [...cur.lines, ...answers], unread: cur.unread || (answers.length > 0 && !open) }
      })
    } catch {}
  }, [put, open])

  useEffect(() => {
    if (!c.token) return
    check()
    const id = setInterval(() => { if (AppState.currentState === 'active') check() }, open ? OPEN_POLL : SHUT_POLL)
    return () => clearInterval(id)
  }, [c.token, open, check])

  // Opening the chat counts as seeing the note. Closing the note leaves the dot on the icon.
  const show = () => { setOpen(true); put((cur) => ({ ...cur, unread: false, noted: cur.noted || noteDue(cur, hasBaby, today) })) }
  const dismiss = () => put((cur) => ({ ...cur, noted: true, unread: true }))
  return { c, put, open, show, hide: () => setOpen(false), note, dismiss }
}

export function ChatNote ({ onPress, onClose }: { onPress: () => void; onClose: () => void }) {
  const t = useTheme(), insets = useSafeAreaInsets()
  return (
    <View style={{ position: 'absolute', right: 18, bottom: 82 + insets.bottom, maxWidth: 306, flexDirection: 'row', backgroundColor: t.btn, borderRadius: 18, borderBottomRightRadius: 5, shadowColor: '#0E1222', shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 6 }}>
      <Pressable testID="chat-note" accessibilityRole="button" onPress={onPress} style={({ pressed }) => ({ flex: 1, paddingVertical: 15, paddingLeft: 18, paddingRight: 6, opacity: pressed ? 0.8 : 1 })}>
        <T size={15.5} color={t.btnInk} style={{ lineHeight: 22 }}>{NOTE}</T>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Close the note" onPress={onClose} hitSlop={10} style={{ paddingTop: 13, paddingRight: 13, paddingLeft: 6 }}>
        <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={t.btnInk} strokeWidth={2.4} strokeLinecap="round">
          <Path d="M5 5l14 14M19 5L5 19" />
        </Svg>
      </Pressable>
    </View>
  )
}

export function ChatButton ({ unread, onPress }: { unread: boolean; onPress: () => void }) {
  const t = useTheme(), insets = useSafeAreaInsets()
  return (
    <Pressable testID="help" accessibilityRole="button" accessibilityLabel="Help" onPress={onPress}
      style={({ pressed }) => ({ position: 'absolute', right: 18, bottom: 18 + insets.bottom, width: 52, height: 52, borderRadius: 26, backgroundColor: t.btn, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.8 : 1, shadowColor: '#0E1222', shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 6 })}>
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={t.btnInk} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.9 8.9 0 0 1-4-.9L3 21l1.9-4.6A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z" />
      </Svg>
      {unread ? <View style={{ position: 'absolute', top: 2, right: 2, width: 14, height: 14, borderRadius: 7, backgroundColor: t.honey, borderWidth: 2, borderColor: t.bg }} /> : null}
    </Pressable>
  )
}

export function ChatSheet ({ chat }: { chat: ReturnType<typeof useChat> }) {
  const t = useTheme(), { c, put } = chat
  const [text, setText] = useState('')
  const [email, setEmail] = useState('')
  const [askEmail, setAskEmail] = useState(false)
  const note = (body: string) => put((cur) => ({ ...cur, lines: [...cur.lines, { from: 'note', body }] }))

  const submit = async () => {
    const body = text.trim()
    if (!body) return
    setText('')
    const first = !c.lines.some((l) => l.from === 'me')
    put((cur) => ({ ...cur, lines: [...cur.lines, { from: 'me', body }] }))
    try {
      const r = await send(c.token, body)
      if (r.error) { note(r.error); return }
      if (r.token) put((cur) => ({ ...cur, token: r.token! }))
      if (first) { note("Sent. We'll answer here."); if (!c.emailAsked) setAskEmail(true) }
    } catch { note("That didn't send. Check the phone is online and try again.") }
  }
  const saveEmail = () => {
    const v = email.trim()
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) return
    setAskEmail(false)
    put((cur) => ({ ...cur, emailAsked: true }))
    note(`We'll send the answer to ${v} as well.`)
    sendEmail(c.token, v).catch(() => {})
  }
  const box = { fontFamily: 'Figtree_400Regular', fontSize: 16, color: t.ink, backgroundColor: t.soft, borderRadius: 22, paddingVertical: 11, paddingHorizontal: 16 }

  return (
    <Sheet open={chat.open} onClose={chat.hide} tall end>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <T w="bold" size={22}>Help</T>
        <Pressable accessibilityRole="button" onPress={chat.hide} hitSlop={12}><T w="bold" size={16}>Close</T></Pressable>
      </View>
      <T size={14.5} color={t.muted} style={{ marginBottom: 16 }}>A person reads every message.</T>
      <View style={{ gap: 10, marginBottom: 16 }}>
        <Bubble line={{ from: 'us', body: opening(c) }} />
        {c.lines.map((l, i) => <Bubble key={i} line={l} />)}
      </View>
      {askEmail ? (
        <View style={{ backgroundColor: t.soft, borderRadius: 16, padding: 14, marginBottom: 14, gap: 8 }}>
          <T size={14.5}>Leave your email and we'll send the answer there too.</T>
          <TextInput value={email} onChangeText={setEmail} placeholder="you@example.com" placeholderTextColor={t.muted} keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
            style={{ ...box, backgroundColor: t.bg, borderRadius: 12 }} />
          <Pill label="Save" onPress={saveEmail} />
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <TextInput testID="chat-entry" value={text} onChangeText={setText} placeholder="Type your question" placeholderTextColor={t.muted} multiline
          accessibilityLabel="Your message" style={{ ...box, flex: 1, maxHeight: 120 }} />
        <Pressable accessibilityRole="button" accessibilityLabel="Send" onPress={submit} disabled={!text.trim()}
          style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: t.btn, alignItems: 'center', justifyContent: 'center', opacity: text.trim() ? 1 : 0.35 }}>
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={t.btnInk} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M22 2 11 13" /><Path d="M22 2 15 22l-4-9-9-4 20-7z" />
          </Svg>
        </Pressable>
      </View>
    </Sheet>
  )
}

function Bubble ({ line }: { line: Line }) {
  const t = useTheme()
  if (line.from === 'note') return <T size={13} color={t.muted} style={{ alignSelf: 'center', textAlign: 'center' }}>{line.body}</T>
  const me = line.from === 'me'
  return (
    <View style={{ alignSelf: me ? 'flex-end' : 'flex-start', maxWidth: '84%', backgroundColor: me ? t.btn : t.soft, borderRadius: 16, borderBottomRightRadius: me ? 5 : 16, borderBottomLeftRadius: me ? 16 : 5, paddingVertical: 9, paddingHorizontal: 13 }}>
      <T size={15.5} color={me ? t.btnInk : t.ink} style={{ lineHeight: 22 }}>{line.body}</T>
    </View>
  )
}
