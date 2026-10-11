import { Figtree_300Light } from '@expo-google-fonts/figtree/300Light'
import { Figtree_400Regular } from '@expo-google-fonts/figtree/400Regular'
import { Figtree_500Medium } from '@expo-google-fonts/figtree/500Medium'
import { Figtree_600SemiBold } from '@expo-google-fonts/figtree/600SemiBold'
import { Figtree_700Bold } from '@expo-google-fonts/figtree/700Bold'
import { useFonts } from 'expo-font'
import * as Linking from 'expo-linking'
import { StatusBar } from 'expo-status-bar'
import * as SystemUI from 'expo-system-ui'
import { useEffect, useRef, useState } from 'react'
import { AppState, View } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { answer, asleepToast, chairGuide, chairIntro, chairTap, fellAsleep, hold, newChair, putInCot, tonight, wentOver } from './src/lib/chair.ts'
import { engine, kindFor, withNoNap, type Sleep } from './src/lib/engine.ts'
import { gapDraft, mainAction, savedLine } from './src/lib/model.ts'
import { fmt } from './src/lib/words.ts'
import { askToRemind } from './src/lib/notify.ts'
import { offerUpdate } from './src/lib/update.ts'
import { IPHONE } from './src/lib/phone.ts'
import { ASK_COUNTS } from './src/lib/posthog.ts'
import { isLocked, outcomeLine, setupLine, weekLine, type Store } from './src/lib/shop.ts'
import { StoreProvider, useStore } from './src/lib/store.tsx'
import { keyFrom } from './src/lib/sync.ts'
import { ChatButton, ChatNote, ChatSheet, useChat } from './src/screens/Chat.tsx'
import { ChairSheet } from './src/screens/Chair.tsx'
import { Setup } from './src/screens/Setup.tsx'
import { AskSheet, DeleteSheet, EditSheet, JoinSheet, MorningSheet, NightSheet, OutSheet, SettingsSheet, TypedSheet } from './src/screens/Sheets.tsx'
import { Today } from './src/screens/Today.tsx'
import { DAY_THEME, NIGHT_THEME } from './src/theme.ts'
import { ThemeCtx, Toast } from './src/ui/kit.tsx'

// The store that takes the payment on this phone.
const STORE: Store = IPHONE ? 'apple' : 'google'

export default function App () {
  const [fonts] = useFonts({ Figtree_300Light, Figtree_400Regular, Figtree_500Medium, Figtree_600SemiBold, Figtree_700Bold })
  return (
    <SafeAreaProvider>
      <StoreProvider>
        {fonts ? <Main /> : <View style={{ flex: 1, backgroundColor: DAY_THEME.bg }} />}
      </StoreProvider>
    </SafeAreaProvider>
  )
}

// `chair` is the sheet that explains the chair method, and `chair-on` the same sheet once it has started.
type Open = null | 'settings' | 'edit' | 'ask' | 'join' | 'delete' | 'wake' | 'naps' | 'out' | 'night' | 'chair' | 'chair-on' | 'typed'

function Main () {
  const st = useStore()
  const E = st.E
  const theme = E && E.theme() === 'night' ? NIGHT_THEME : DAY_THEME
  const [open, setOpen] = useState<Open>(null)
  const [editing, setEditing] = useState<Sleep | null>(null)
  const [askId, setAskId] = useState<string | null>(null)
  const [joinText, setJoinText] = useState('')
  // A toast can offer to change what it just saved: one sleep, or the whole of last night.
  const [toast, setToast] = useState<{ text: string; edit?: string; night?: boolean } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const chat = useChat(st.loaded, !!st.state.baby)

  const say = (text: string, edit?: string, night = false) => {
    setToast({ text, edit, night })
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setToast(null), 5000)
  }

  useEffect(() => { SystemUI.setBackgroundColorAsync(theme.bg).catch(() => {}) }, [theme.bg])

  // A newer version on Play is offered when the app opens, and again each time it comes back.
  useEffect(() => {
    offerUpdate()
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') setTimeout(offerUpdate, 500) })
    return () => sub.remove()
  }, [])

  // A payment that went through after the app was closed or left.
  useEffect(() => { if (st.late) say(outcomeLine(st.late.o, STORE)) }, [st.late?.at])

  // A tapped share link opens the join panel with the link already in it.
  useEffect(() => {
    const take = (url: string | null) => { if (url && /join/.test(url) && keyFrom(url)) { setJoinText(url); setOpen('join') } }
    Linking.getInitialURL().then(take)
    const sub = Linking.addEventListener('url', (e) => take(e.url))
    return () => sub.remove()
  }, [])

  if (!st.loaded) return <View style={{ flex: 1, backgroundColor: theme.bg }} />

  const openEdit = (id: string) => { const x = st.state.sleeps.find((y) => y.id === id); if (x) { setEditing(x); setOpen('edit') } }
  // A sleep added by hand is a nap or a night by when it started, whatever the time it is added.
  const addMissed = () => {
    const now = Date.now(), s = now - 75 * 60000
    setEditing({ id: `new-${now}`, s, e: now - 20 * 60000, kind: kindFor(st.state.baby!, s, st.state.sleeps), updatedAt: now })
    setOpen('edit')
  }
  // A stretch the list says has no nap in it opens that nap, ready to save.
  const addGap = (a: number, z: number) => {
    if (!E) return
    const now = Date.now(), d = gapDraft(E, a, z)
    setEditing({ id: `new-${now}`, s: d.s, e: d.e, kind: 'nap', updatedAt: now })
    setOpen('edit')
  }

  // No to a stretch the list asked about: the answer is kept, and the list stops asking.
  const noNap = (a: number, z: number) => {
    if (!E) return
    st.setBaby({ noNap: withNoNap(E.baby, a, z, Date.now()) })
    say('Saved.')
  }

  // The morning the screen asked for. Past half an hour awake, it asks about the naps since.
  const morning = (t: number) => {
    const next = st.setMorning(t)
    if (Date.now() - t >= 30 * 60000) setOpen('naps')
    else say(savedLine(next, st.gate))
  }

  // The store's own sheet takes the payment. The toast says what the store answered.
  const buy = async () => {
    const o = await st.buy()
    const line = outcomeLine(o, STORE)
    if (line) say(line)
    if (o === 'owned') setOpen(null)
  }
  // The free week on an iPhone, from setup, Today or Settings. Apple's sheet takes the tap, and the
  // toast says what the App Store answered when it did not start the week.
  const startWeek = async () => {
    const o = await st.startWeek()
    const line = weekLine(o)
    if (line) say(line)
    if (o === 'owned') setOpen(null)
    return o === 'owned' || o === 'pending'
  }
  const restore = async () => {
    const o = await st.restore()
    say(outcomeLine(o === 'failed' ? 'unreachable' : o, STORE))
  }

  // The tap is worked out at the second it happens. The screen's own clock moves every 20
  // seconds, and a sleep started from it would count from up to 20 seconds before the tap.
  const main = () => {
    if (!E) return
    // With the chair method on, the bedtime tap is the baby going into the cot, and the next one is
    // the baby asleep, which starts the night and keeps how long settling took.
    const now = Date.now(), live = engine(E.baby, st.state.sleeps, now, st.state.out), ct = chairTap(live, E.baby.chair, now)
    if (ct?.kind === 'cot') { st.setChair((c) => (c ? putInCot(c, now) : c)); say(`In the cot at ${fmt(now)}.`); st.refreshNow(); return }
    if (ct?.kind === 'asleep') {
      const id = st.addSleep({ s: now, e: null, kind: 'night', up: false })
      st.setChair((c) => (c ? fellAsleep(c, ct.inCot, now) : c))
      say(asleepToast(E.baby.name, ct.inCot, now, E.baby.chair?.trips ?? 0), id); st.refreshNow(); return
    }
    const a = mainAction(live)
    if (a.kind === 'add') { const id = st.addSleep(a.sleep); say(a.toast, id); if (a.sleep.kind === 'nap') st.napStarted() }
    else if (a.kind === 'end') { st.endSleep(a.id, a.up); say(a.toast, a.id) }
    else { setAskId(a.id); setOpen('ask') }
    st.refreshNow()
  }

  return (
    <ThemeCtx.Provider value={theme}>
      <StatusBar style={theme.name === 'night' ? 'light' : 'dark'} />
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        {st.state.baby && E
          ? <Today E={E} g={st.gate} onBuy={buy} onWeek={startWeek} onMain={main} onSettings={() => setOpen('settings')} onEdit={openEdit} onNight={() => setOpen('night')} onAdd={addMissed} onMorning={morning} onWake={() => setOpen('wake')} onGap={addGap} onNoNap={noNap} onOut={() => setOpen('out')} onType={() => setOpen('typed')}
              onWay={(day, pick, by, first) => st.setBaby({ route: { day, pick, by, first }, routeLikes: pick })}
              onFewer={(n) => {
                st.setBaby(n == null ? { napsAsked: Date.now() } : { naps: n, napsAsked: Date.now() })
                const k = E.band().naps
                say(n == null ? `Baby Nap Track keeps ${k} naps a day for ${E.baby.name}.` : `Baby Nap Track plans ${n === 1 ? '1 nap' : `${n} naps`} a day for ${E.baby.name} now. You can change it in Settings.`)
              }}
              chair={E.baby.chair} onHold={() => {
                const c = E.baby.chair
                if (!c) return
                const t = tonight(c, Date.now())
                // The card changes under the tap: the picture, the line and the link.
                st.setChair((x) => (x ? hold(x, t.key, !t.held) : x))
              }}
              onTrip={() => st.setChair((c) => (c ? wentOver(c) : c))}
              onCry={(night, cry) => { st.setChair((c) => (c ? answer(c, night, { cry }) : c)); say('Saved.') }}
              onWhy={(night, w) => st.setChair((c) => {
                const s = c?.settles.find((x) => x.night === night)
                return c && s ? answer(c, night, { why: s.why?.includes(w) ? s.why.filter((x) => x !== w) : [...(s.why ?? []), w] }) : c
              })}
              onUpForDay={() => { const l = E.sleeps[E.sleeps.length - 1]; if (l) { st.endSleep(l.id, true, l.e ?? Date.now()); st.refreshNow(); say(`Up for the day at ${fmt(l.e ?? Date.now())}.`, undefined, true) } }} />
          : <Setup shopLine={setupLine(st.gate, st.now)} onJoin={() => { setJoinText(''); setOpen('join') }} onDone={async (baby, woke, naps, email) => { st.setup(baby, woke, naps); if (email.trim()) st.signUp(email, 'setup'); if (st.state.alerts) await askToRemind() }}
              askCounts={ASK_COUNTS && st.state.counts == null} onCounts={st.setCounts} offer={st.gate.kind === 'offer' ? st.gate.price : null} onWeek={startWeek} />}
        {st.state.baby && E && chat.note ? <ChatNote onPress={chat.show} onClose={chat.dismiss} /> : null}
        {st.state.baby && E ? <ChatButton unread={chat.c.unread || chat.note} onPress={chat.show} /> : null}
        <Toast visible={!!toast} text={toast?.text ?? ''} action={toast?.edit || toast?.night ? 'Change' : undefined}
          onAction={() => { const id = toast?.edit, night = toast?.night; setToast(null); if (night) setOpen('night'); else if (id) openEdit(id) }} />
      </View>

      <SettingsSheet open={open === 'settings'} onClose={() => setOpen(null)} onToast={say} onChair={() => setOpen('chair')}
        onJoin={() => { setJoinText(''); setOpen('join') }} onDelete={() => setOpen('delete')} onBuy={buy} onWeek={startWeek} onRestore={restore} />
      {/* 11 October 2026: Start closed the sheet onto Today with a toast and nothing to do next. It
          now stays open on what to do tonight and when. */}
      <ChairSheet open={open === 'chair' || open === 'chair-on'} intro={E ? chairIntro(E, E.now) : null} running={!!E?.baby.chair}
        guide={open === 'chair-on' && E?.baby.chair ? chairGuide(E, E.baby.chair, E.now, isLocked(st.gate)) : null}
        onClose={() => setOpen('settings')} onDone={() => setOpen(null)}
        onStart={() => { if (!E) return; const now = Date.now(); st.setChair(() => newChair(engine(E.baby, st.state.sleeps, now, st.state.out), now)); setOpen('chair-on') }} />
      <EditSheet open={open === 'edit'} sleep={editing} onClose={() => setOpen(null)} onToast={say} />
      <NightSheet open={open === 'night'} onClose={() => setOpen(null)} onToast={say} />
      <ChatSheet chat={chat} />
      <OutSheet open={open === 'out'} onClose={() => setOpen(null)} onToast={say} />
      <TypedSheet open={open === 'typed'} onClose={() => setOpen(null)} onToast={say} />
      <MorningSheet open={open === 'wake' || open === 'naps'} mode={open === 'naps' ? 'naps' : 'wake'} onClose={() => setOpen(null)} onToast={say} />
      <AskSheet open={open === 'ask'} name={st.state.baby?.name ?? ''} onClose={() => setOpen(null)}
        onUp={() => { if (askId) st.endSleep(askId, true); st.refreshNow(); setOpen(null); say('Up for the day.', undefined, true) }}
        onBack={() => { if (askId) st.endSleep(askId, false); st.refreshNow(); setOpen(null); say(`${st.state.baby?.name} woke at ${fmt(Date.now())}.`) }} />
      <JoinSheet open={open === 'join'} initial={joinText} onClose={() => setOpen(null)}
        onJoined={(name) => { setOpen(null); say(`You're logging ${name}'s sleep with everyone who has the link.`) }} />
      <DeleteSheet open={open === 'delete'} onClose={() => setOpen(null)} onDone={() => { setOpen(null); say('Deleted.') }} />
    </ThemeCtx.Provider>
  )
}
