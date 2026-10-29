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
import { AppState, Modal, Share as ShareSheet, View } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { answer, asleepToast, chairDay, chairGuide, chairIntro, chairTap, eveningOf, fellAsleep, hold, napInCot, napOver, napToast, newChair, newChairTomorrow, nightOf, nightPlan, pickedUp, putInCot, startsTonight, tonight, wentOver } from './src/lib/chair.ts'
import { band, engine, kindFor, withNoNap, type Sleep } from './src/lib/engine.ts'
import { ageChange, learnLine, learntDays, LEARN_DAYS } from './src/lib/guide.ts'
import { dayKey } from './src/lib/track.ts'
import { gapDraft, hero, mainAction, savedLine } from './src/lib/model.ts'
import { fmt } from './src/lib/words.ts'
import { askToRemind } from './src/lib/notify.ts'
import { offerUpdate } from './src/lib/update.ts'
import { IPHONE } from './src/lib/phone.ts'
import { ASK_COUNTS } from './src/lib/posthog.ts'
import { isLocked, outcomeLine, setupLine, weekLine, type Store } from './src/lib/shop.ts'
import { StoreProvider, useStore } from './src/lib/store.tsx'
import { keyFrom, linkFor } from './src/lib/sync.ts'
import { ChatButton, ChatNote, ChatSheet, useChat } from './src/screens/Chat.tsx'
import { ChairSheet, TonightSheet } from './src/screens/Chair.tsx'
import { Setup, type SetupExtras } from './src/screens/Setup.tsx'
import { ChairFlow } from './src/screens/ChairFlow.tsx'
import { FirstNap } from './src/screens/FirstNap.tsx'
import { Menu } from './src/screens/Menu.tsx'
import { Night } from './src/screens/Night.tsx'
import { TAB_H, Tabs, type Tab } from './src/screens/Tabs.tsx'
import { AskSheet, BedtimeSheet, DeleteSheet, EditSheet, JoinSheet, MorningSheet, NightSheet, OutSheet, SettingsSheet, TypedSheet } from './src/screens/Sheets.tsx'
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
// `tonight` is tonight's plan while it runs, from 14 October 2026.
type Open = null | 'settings' | 'edit' | 'ask' | 'join' | 'delete' | 'wake' | 'naps' | 'out' | 'night' | 'bedtime' | 'chair' | 'chair-on' | 'tonight' | 'typed'

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
  // From 1.0.41: the tab on show, the chair method's way in, and the first nap time after setup.
  const [tab, setTab] = useState<Tab>('today')
  const [flow, setFlow] = useState(false)
  const [first, setFirst] = useState(false)
  // What setup asked for once the baby is saved: the chair method, and a link to send.
  const [after, setAfter] = useState<SetupExtras | null>(null)

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

  // The wake windows band this phone last showed. A phone that has never shown one takes today's
  // quietly, so the card waits for the next real change.
  const weeks = E ? E.age() : 0, bandNow = E ? band(weeks).w : null
  useEffect(() => { if (bandNow != null && st.state.bandSeen == null) st.setLocal({ bandSeen: bandNow }) }, [bandNow, st.state.bandSeen])
  // Once there are 3 days of naps, one line says the times follow the baby now.
  const learnt = E ? learntDays(st.state.sleeps, st.now) : 0
  useEffect(() => {
    // It waits for any line already on screen, such as joining a shared log, to go first.
    if (!E || st.state.learnt || learnt < LEARN_DAYS || toast) return
    st.setLocal({ learnt: true })
    say(`3 days logged, well done! The nap times now follow ${E.baby.name}.`)
  }, [learnt, st.state.learnt, !!E, !!toast])

  useEffect(() => {
    if (!E || !after) return
    const x = after
    setAfter(null)
    if (x.chair) {
      const now = Date.now(), live = engine(E.baby, st.state.sleeps, now, st.state.out)
      st.setChair(() => (x.chair === 'tomorrow' ? newChairTomorrow(live, now) : newChair(live, now)))
      setOpen('chair-on')
    }
    if (x.share) setTimeout(() => sendLinkNow(E.baby.name), 400)
  }, [!!E, after])

  if (!st.loaded) return <View style={{ flex: 1, backgroundColor: theme.bg }} />

  const age = E ? ageChange(E.baby, weeks, st.state.bandSeen ?? null) : null
  // The chair line closed on Today stays closed for the rest of that day, until the bedtime card.
  const hideChair = st.state.hideChair === dayKey(st.now)
  const startChair = (tomorrow: boolean) => {
    if (!E) return
    const now = Date.now(), live = engine(E.baby, st.state.sleeps, now, st.state.out)
    st.setChair(() => (tomorrow ? newChairTomorrow(live, now) : newChair(live, now)))
    setFlow(false); setOpen('chair-on')
  }
  async function sendLinkNow (name: string) {
    let key: string | null = null
    try { key = await st.startShare() } catch { say('No internet connection, so the link was not made. You can send it from Settings later.') }
    if (!key) return
    try { await ShareSheet.share({ message: `Log ${name}'s sleep with me in Baby Nap Track: ${linkFor(key)}` }) } catch {}
  }

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
    if (ct?.kind === 'cot') { st.setChair((c) => (c ? putInCot(c, now) : c)); say(`Settling started at ${fmt(now)}.`); st.refreshNow(); return }
    if (ct?.kind === 'asleep') {
      const id = st.addSleep({ s: now, e: null, kind: 'night', up: false })
      st.setChair((c) => (c ? fellAsleep(c, ct.inCot, now) : c))
      say(asleepToast(E.baby.name, ct.inCot, now, E.baby.chair?.trips ?? 0, E.baby.chair?.picks ?? 0, E.baby.chair ? nightOf(E.baby.chair, eveningOf(ct.inCot)) : 0), id); st.refreshNow(); return
    }
    const a = mainAction(live)
    // A nap settling in the cot ends at the tap that starts the nap, and the toast says how long it took.
    if (ct?.kind === 'nap') st.setChair((c) => (c ? napOver(c) : c))
    if (a.kind === 'add') { const id = st.addSleep(a.sleep); say(ct?.kind === 'nap' ? napToast(a.toast, ct.napCot, now) : a.toast, id); if (a.sleep.kind === 'nap') st.napStarted() }
    else if (a.kind === 'end') { st.endSleep(a.id, a.up); say(a.toast, a.id) }
    else { setAskId(a.id); setOpen('ask') }
    st.refreshNow()
  }

  return (
    <ThemeCtx.Provider value={theme}>
      <StatusBar style={theme.name === 'night' ? 'light' : 'dark'} />
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        {st.state.baby && E
          ? tab === 'night' ? <Night E={E} g={st.gate} chair={E.baby.chair} onFlow={() => setFlow(true)} onStop={() => { st.setChair(() => null); say('Chair method stopped.') }} onNight={() => setOpen('night')} onBedtime={() => setOpen('bedtime')}
              onHold={() => { const c = E.baby.chair; if (!c) return; const t = tonight(c, Date.now()); st.setChair((x) => (x ? hold(x, t.key, !t.held) : x)) }}
              onCry={(night, cry) => { st.setChair((c) => (c ? answer(c, night, { cry }) : c)); say('Saved.') }}
              onWhy={(night, w) => st.setChair((c) => { const s = c?.settles.find((x) => x.night === night); return c && s ? answer(c, night, { why: s.why?.includes(w) ? s.why.filter((x) => x !== w) : [...(s.why ?? []), w] }) : c })} />
          : tab === 'menu' ? <Menu E={E} onSettings={() => setOpen('settings')} onWindows={() => setOpen('settings')} onAsk={() => chat.show()} />
          : <Today E={E} g={st.gate} onBuy={buy} onWeek={startWeek} onMain={main} onEdit={openEdit} onNight={() => setOpen('night')} onBedtime={() => setOpen('bedtime')} onAdd={addMissed} onMorning={morning} onWake={() => setOpen('wake')} onGap={addGap} onNoNap={noNap} onOut={() => setOpen('out')} onType={() => setOpen('typed')}
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
              onCot={() => {
                // The same tap the timer makes at bedtime, from the note once the day's naps are done.
                const now = Date.now()
                st.setChair((c) => (c ? putInCot(c, now) : c)); say(`Settling started at ${fmt(now)}.`); st.refreshNow()
              }}
              onTrip={() => st.setChair((c) => (c ? wentOver(c) : c))}
              onPick={() => st.setChair((c) => (c ? pickedUp(c) : c))}
              onNapCot={() => {
                const now = Date.now()
                st.setChair((c) => (c ? napInCot(c, now) : c)); say(`Settling started at ${fmt(now)}.`); st.refreshNow()
              }}
              onNapStop={() => { st.setChair((c) => (c ? napOver(c) : c)); say('Settling stopped.'); st.refreshNow() }}
              onPlan={() => setTab('night')}
              hideChair={hideChair} onHideChair={() => st.setLocal({ hideChair: dayKey(Date.now()) })}
              learn={learnLine(E.baby.name, learnt)} age={age}
              onAgeOk={() => { st.setLocal({ bandSeen: bandNow }); st.setBaby({ keepBand: null }) }}
              onAgeKeep={() => { if (age) { st.setBaby({ keepBand: { w: age.was.w, to: weeks + 1 } }); st.setLocal({ bandSeen: bandNow }); say(`${E.baby.name} keeps the old nap times for a week.`) } }}
              onCry={(night, cry) => { st.setChair((c) => (c ? answer(c, night, { cry }) : c)); say('Saved.') }}
              onWhy={(night, w) => st.setChair((c) => {
                const s = c?.settles.find((x) => x.night === night)
                return c && s ? answer(c, night, { why: s.why?.includes(w) ? s.why.filter((x) => x !== w) : [...(s.why ?? []), w] }) : c
              })}
              onUpForDay={() => { const l = E.sleeps[E.sleeps.length - 1]; if (l) { st.endSleep(l.id, true, l.e ?? Date.now()); st.refreshNow(); say(`Up for the day at ${fmt(l.e ?? Date.now())}.`, undefined, true) } }} />
          : <Setup shopLine={setupLine(st.gate, st.now)} onJoin={() => { setJoinText(''); setOpen('join') }} onDone={async (baby, woke, naps, email, x: SetupExtras) => {
                st.setup(baby, woke, naps); if (email.trim()) st.signUp(email, 'setup'); setTab('today'); setFirst(true)
                if (x.chair || x.share) setAfter(x)
                if (st.state.alerts) await askToRemind()
              }}
              askCounts={ASK_COUNTS && st.state.counts == null} onCounts={st.setCounts} offer={st.gate.kind === 'offer' ? st.gate.price : null} onWeek={startWeek} />}
        {st.state.baby && E ? <Tabs tab={tab} onTab={setTab} /> : null}
        {st.state.baby && E && chat.note ? <ChatNote onPress={chat.show} onClose={chat.dismiss} /> : null}
        {st.state.baby && E ? <ChatButton unread={chat.c.unread || chat.note} onPress={chat.show} /> : null}
        {first && E ? <FirstNap E={E} g={st.gate} onDone={() => setFirst(false)} /> : null}
        <Toast lift={st.state.baby ? TAB_H : 0} visible={!!toast} text={toast?.text ?? ''} action={toast?.edit || toast?.night ? 'Change' : undefined}
          onAction={() => { const id = toast?.edit, night = toast?.night; setToast(null); if (night) setOpen('night'); else if (id) openEdit(id) }} />
      </View>

      <SettingsSheet open={open === 'settings'} onClose={() => setOpen(null)} onToast={say} onChair={() => { if (E?.baby.chair) setOpen('chair'); else { setOpen(null); setFlow(true) } }}
        onJoin={() => { setJoinText(''); setOpen('join') }} onDelete={() => setOpen('delete')} onBuy={buy} onWeek={startWeek} onRestore={restore} />
      {/* 11 October 2026: Start closed the sheet onto Today with a toast and nothing to do next. It
          now stays open on what to do tonight and when. */}
      <ChairSheet open={open === 'chair' || open === 'chair-on'} intro={E ? chairIntro(E, E.now) : null} running={!!E?.baby.chair}
        guide={open === 'chair-on' && E?.baby.chair ? chairGuide(E, E.baby.chair, E.now, isLocked(st.gate)) : null}
        onClose={() => setOpen('settings')} onDone={() => { setOpen(null); if (E?.baby.chair) setTab('night') }}
        onStart={() => { if (!E) return; const now = Date.now(); st.setChair(() => newChair(engine(E.baby, st.state.sleeps, now, st.state.out), now)); setOpen('chair-on') }} />
      <Modal visible={flow && !!E} animationType="slide" onRequestClose={() => setFlow(false)}>
        <ThemeCtx.Provider value={theme}>
          {E ? <ChairFlow name={E.baby.name} young={weeks < 26} canTonight={startsTonight(newChair(E, Date.now()), Date.now())} onBack={() => setFlow(false)} onLater={() => setFlow(false)} onStart={startChair} /> : null}
        </ThemeCtx.Provider>
      </Modal>
      <TonightSheet open={open === 'tonight'} plan={E?.baby.chair ? nightPlan(E, E.baby.chair, E.now) : null} onClose={() => setOpen(null)} />
      <EditSheet open={open === 'edit'} sleep={editing} onClose={() => setOpen(null)} onToast={say} />
      <NightSheet open={open === 'night'} onClose={() => setOpen(null)} onToast={say} />
      <BedtimeSheet open={open === 'bedtime'} onClose={() => setOpen(null)} onToast={say} />
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
