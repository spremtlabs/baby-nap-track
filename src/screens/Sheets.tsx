// The panels that rise from the bottom: Settings, editing a sleep, last night, the morning
// question, typing what happened, joining a shared log and deleting everything.
import * as Clipboard from 'expo-clipboard'
import * as Linking from 'expo-linking'
import { useEffect, useState } from 'react'
import { Pressable, Share as ShareSheet, TextInput, View } from 'react-native'
import { MIN, ageText, asLogged, band, bandFor, dayAt, engine, kindFor, morningAt, moveStart, newSleep, pickEnd, pickStart, type Out, type Sleep } from '../lib/engine.ts'
import { chairEarly, chairLine } from '../lib/chair.ts'
import { EmailSettings } from './Email.tsx'
import { aimNote, clampOut, napDraft, nightAddWake, nightDraft, nightPick, nightProblem, nightSave, nightSum, outDraft, outView, savedLine, windowsNote, type NightDraft, type Row } from '../lib/model.ts'
import { typed, type TypedRow } from '../lib/typed.ts'
import { IPHONE } from '../lib/phone.ts'
import { ASK_COUNTS } from '../lib/posthog.ts'
import { shopGroup } from '../lib/shop.ts'
import { useStore } from '../lib/store.tsx'
import { diary } from '../lib/diary.ts'
import { sendDiary } from '../lib/send'
import { keyFrom, linkFor } from '../lib/sync.ts'
import { dur, fmt, hours, lenParts, range, span, timeParts } from '../lib/words.ts'
import { DateField } from '../ui/DateField.tsx'
import { TimeField } from '../ui/TimeField.tsx'
import { Big, Button, Eyebrow, Link, Pill, Segmented, Sheet, StepButton, Stepper, T, Toggle, useTheme } from '../ui/kit.tsx'
import { Ribbon, Rows } from './Today.tsx'

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

function Group ({ title, children, first }: { title?: string; children: React.ReactNode; first?: boolean }) {
  const t = useTheme()
  return (
    <View style={{ paddingTop: 20, paddingBottom: 6, borderTopWidth: first ? 0 : 1, borderTopColor: t.line, marginTop: first ? 0 : 6 }}>
      {title ? <T w="bold" size={17} style={{ marginBottom: 4 }}>{title}</T> : null}
      {children}
    </View>
  )
}

function Note ({ children }: { children: React.ReactNode }) {
  const t = useTheme()
  return <T size={14.5} color={t.muted} style={{ lineHeight: 21, marginTop: 6, marginBottom: 10 }}>{children}</T>
}

export function SettingsSheet ({ open, onClose, onToast, onChair, onJoin, onDelete, onBuy, onWeek, onRestore }: { open: boolean; onClose: () => void; onToast: (s: string) => void; onChair: () => void; onJoin: () => void; onDelete: () => void; onBuy: () => void; onWeek: () => void; onRestore: () => void }) {
  const t = useTheme(), st = useStore()
  const { baby, share, alerts, lead } = st.state
  const [name, setName] = useState(baby?.name ?? '')
  const [dueOpen, setDueOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  // The sleep diary: how many days it holds, and whether it is being made.
  const [days, setDays] = useState(7)
  const [making, setMaking] = useState(false)
  useEffect(() => { if (open) { setName(baby?.name ?? ''); setDueOpen(false) } }, [open])
  if (!baby) return null
  const N = baby.name, now = st.now, shop = shopGroup(st.gate, N, now)
  const wk = (Date.now() - new Date(baby.due || baby.born).getTime()) / (7 * 864e5), b = bandFor(baby, wk), ageNaps = band(wk).naps
  // The end of the day's naps, as the parent set it or bedtime less the shortest wake window.
  const napsEnd = baby.napsEnd ?? baby.bed - b.min
  const moveEnd = (d: number) => st.setBaby({ napsEnd: clamp(napsEnd + d, baby.bed - 300, baby.bed - 30) })
  // The aim and the wake windows as the log has them now, from 1.0.23.
  const E = engine(baby, st.state.sleeps, now), aim = E.aim()
  const moveAim = (d: number) => st.setBaby({ target: clamp(aim.min + d, 30, 420), aimSet: true })
  const pin = (k: number, len: number) => {
    const w = Array.from({ length: Math.max(b.naps, baby.windows?.length ?? 0) }, (_, i) => baby.windows?.[i] ?? null)
    w[k] = clamp(len, 30, 360)
    st.setBaby({ windows: w })
  }
  const naps = (n: number) => (n === 1 ? '1 nap' : `${n} naps`)

  const sendLink = async () => {
    setBusy(true)
    let key: string | null = null
    try { key = await st.startShare() } catch {
      onToast('No internet connection, so the link was not made. Try again when you are online.')
    }
    setBusy(false)
    if (!key) return
    const url = linkFor(key)
    try { await ShareSheet.share({ message: `Log ${N}'s sleep with me in Baby Nap Track: ${url}` }) } catch {
      try { await Clipboard.setStringAsync(url); onToast('Link copied. Paste it into a message to whoever you are sharing with.') } catch { onToast(`Send this link: ${url}`) }
    }
  }
  const sendSleep = async () => {
    setMaking(true)
    const r = await sendDiary(diary(baby, st.state.sleeps, Date.now(), days))
    setMaking(false)
    if (r === 'failed') onToast("Baby Nap Track couldn't make the diary. Try again in a minute.")
  }
  const copyLink = async () => { if (share) { await Clipboard.setStringAsync(linkFor(share.key)); onToast('Link copied.') } }
  const lastSeen = share?.lastOk ? (now - share.lastOk < 2 * MIN ? 'just now' : `${dur(now - share.lastOk)} ago`) : null

  return (
    <Sheet open={open} onClose={onClose} tall>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <T w="bold" size={22}>Settings</T>
        <Pressable accessibilityRole="button" onPress={onClose} hitSlop={12}><T w="bold" size={16}>Done</T></Pressable>
      </View>

      <Group title={`${N}'s day`} first>
        <Stepper label="Usual wake-up" value={timeParts(baby.wake)} onLess={() => st.setBaby({ wake: clamp(baby.wake - 15, 300, 600) })} onMore={() => st.setBaby({ wake: clamp(baby.wake + 15, 300, 600) })} />
        <Stepper label="Bedtime" value={timeParts(baby.bed)} onLess={() => st.setBaby({ bed: clamp(baby.bed - 15, 1050, 1380) })} onMore={() => st.setBaby({ bed: clamp(baby.bed + 15, 1050, 1380) })} />
        <Stepper label="Day sleep to aim for" value={lenParts(aim.min)} onLess={() => moveAim(-15)} onMore={() => moveAim(15)} />
        <Note>{aimNote(E)}</Note>
        {aim.set ? <Link label={`Go by ${N}'s nights instead`} onPress={() => st.setBaby({ aimSet: false })} style={{ marginTop: -8 }} /> : null}
        <Stepper label="No naps after" value={timeParts(napsEnd)} onLess={() => moveEnd(-15)} onMore={() => moveEnd(15)} />
        <Note>Baby Nap Track gives you an optional time to wake {N} from a nap still going at {fmt(new Date(now).setHours(0, 0, 0, 0) + napsEnd * MIN)}. Some parents wake then to leave enough of a gap before bedtime.</Note>
      </Group>

      {/* Naps a day and the wake window before each, from 1.0.23. A window the parent sets stays put. */}
      <Group title={`${N}'s naps`}>
        {ageNaps >= 2 ? (
          <>
            <T size={14.5} color={t.muted} style={{ marginTop: 6, marginBottom: 6 }}>Naps a day</T>
            <Segmented options={[ageNaps, ageNaps - 1].map((n) => ({ value: n, label: naps(n) }))} value={b.naps}
              onChange={(n) => st.setBaby({ naps: n === ageNaps ? null : n, napsAsked: Date.now() })} />
          </>
        ) : null}
        {Array.from({ length: b.naps }, (_, k) => {
          const v = Math.round(E.windowOf(k).len / 5) * 5
          return <Stepper key={k} label={`Awake before nap ${k + 1}`} value={lenParts(v)} onLess={() => pin(k, v - 15)} onMore={() => pin(k, v + 15)} />
        })}
        <Note>{windowsNote(E)}</Note>
        {baby.windows?.some((x) => x != null) ? <Link label="Work them all out again" onPress={() => st.setBaby({ windows: null })} style={{ marginTop: -8 }} /> : null}
      </Group>

      {/* The chair method, offered at every age since 1.0.18. */}
      <Group title="Chair method">
        {baby.chair ? (
          <>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, paddingVertical: 8 }}>
              <T size={16}>Tonight</T>
              <T w="semibold" size={16} style={{ flexShrink: 1, textAlign: 'right' }}>{chairLine(baby.chair, now)}</T>
            </View>
            <Note>You move a bit closer to the door every three nights. If {N} wakes in the night, sit in your chair until {N}'s back asleep.</Note>
            <Link label="How it works" onPress={onChair} />
            <Link label="Stop the chair method" onPress={() => { st.setChair(() => null); onToast('Chair method stopped.') }} style={{ paddingTop: 0 }} />
          </>
        ) : (
          <>
            <Note>You sit by the cot while {N} falls asleep, and move a bit closer to the door every three nights.{chairEarly(baby, now) ? ' The HSE suggests it from six months.' : ''}</Note>
            <Pill label="Start the chair method" onPress={onChair} />
          </>
        )}
      </Group>

      <Group title="Baby">
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 }}>
          <T size={16}>Name</T>
          <TextInput value={name} onChangeText={setName} onEndEditing={() => name.trim() && st.setBaby({ name: name.trim() })} onBlur={() => name.trim() && st.setBaby({ name: name.trim() })}
            style={{ fontFamily: 'Figtree_400Regular', fontSize: 16, color: t.ink, backgroundColor: t.soft, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 12, width: 172, textAlign: 'right' }} />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 }}>
          <T size={16}>Born</T>
          <DateField value={baby.born} onChange={(v) => st.setBaby({ born: v })} placeholder="Pick a date" />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 }}>
          <T size={16}>Due date</T>
          {baby.due || dueOpen
            ? <DateField value={baby.due} onChange={(v) => st.setBaby({ due: v })} placeholder="Pick a date" />
            : <Pill label="Add a due date" onPress={() => setDueOpen(true)} />}
        </View>
        <Note>If {N} came early, add the due date and the nap times will go by it.</Note>
      </Group>

      <Group>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 16, paddingVertical: 8 }}>
          <T size={16} style={{ flex: 1 }}>Remind me before each nap and bedtime</T>
          <Toggle label="Reminders" value={alerts} onChange={st.setAlerts} />
        </View>
        <T size={14.5} color={t.muted} style={{ marginTop: 10, marginBottom: 6 }}>How long before</T>
        <Segmented options={[10, 15, 20].map((m) => ({ value: m, label: `${m} min` }))} value={lead} onChange={st.setLead} />
      </Group>

      <Group title={share ? `${N}'s sleep is shared` : `Share ${N}'s sleep`}>
        {share ? (
          <>
            <Note>Everyone with the link sees the same day and can log sleeps.{lastSeen ? ` Last in step ${lastSeen}.` : ''}{share.failing ? ' This phone is offline, so changes will go up when it is back online.' : ''}</Note>
            <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
              <Pill label="Send the link again" onPress={sendLink} />
              <Pill label="Copy the link" onPress={copyLink} />
            </View>
            <Link label="Stop sharing on this phone" onPress={() => { st.stopShare(); onToast(`This phone keeps its own copy of ${N}'s log now.`) }} />
          </>
        ) : (
          <>
            <Note>Send a link to anyone else who puts {N} down, like a partner, a granny or a childminder. Everyone with the link sees the same day and can log sleeps.</Note>
            <Pill label={busy ? 'Making the link…' : 'Send a link'} onPress={sendLink} />
            <Link label="Someone sent you a link? Join their log" onPress={onJoin} />
          </>
        )}
      </Group>

      <Group title="Your email">
        <EmailSettings name={N} signedUp={st.state.signedUp} onSignUp={async (email) => { const r = await st.signUp(email, 'settings'); if (r === 'ok') onToast('Saved.'); return r }} />
      </Group>

      <Group title={`Send ${N}'s sleep diary`}>
        <Note>Seeing a sleep consultant or your GP?</Note>
        <Segmented options={[{ value: 3, label: '3 days' }, { value: 7, label: '1 week' }, { value: 14, label: '2 weeks' }]} value={days} onChange={setDays} />
        <Pill label={making ? 'Making the diary…' : 'Send the sleep diary'} onPress={() => { if (!making) sendSleep() }} />
      </Group>

      {shop ? (
        <Group title={shop.title}>
          <Note>{shop.note}</Note>
          {shop.week ? <Pill label={shop.week} onPress={onWeek} /> : null}
          {shop.buy ? <Pill label={shop.buy} onPress={onBuy} /> : null}
          {shop.restore ? <Link label="Paid already? Restore it" onPress={onRestore} /> : null}
        </Group>
      ) : null}

      <Group title="How the times are worked out">
        <Note>{b.naps < ageNaps ? `On ${naps(b.naps)} a day` : `At ${ageText(baby, now)}`} most babies are ready for a nap after {span(b.min, b.max)} awake, and the time gets longer as the day goes on. Baby Nap Track starts with those times. Then it checks how long {N} was awake before each nap that went well this week and moves the times to fit. After a short nap, the next one comes sooner.</Note>
        <Note>Once 3 days are logged, the times come mostly from {N}'s own sleep.</Note>
        <Note>After {fmt(new Date(now).setHours(0, 0, 0, 0) + (napsEnd - 20) * MIN)}, Baby Nap Track suggests an earlier bedtime instead of another nap.</Note>
        {/* On an iPhone the app about health sends people to a doctor as well. */}
        {IPHONE ? <Note>If you're ever worried about {N}'s sleep, have a chat with your GP or public health nurse.</Note> : null}
      </Group>

      <Group>
        {/* The answer setup asked for on an iPhone, kept as a switch above the Privacy link. */}
        {ASK_COUNTS ? (
          <>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 16, paddingVertical: 8 }}>
              <T size={16} style={{ flex: 1 }}>Send counts of how Baby Nap Track is used</T>
              <Toggle label="Send counts of how Baby Nap Track is used" value={st.state.counts === true} onChange={st.setCounts} />
            </View>
            <Note>Baby Nap Track sends a count each day you open the app, and when you do things like finish setup or share a log. {N}'s name, birthday and sleep times are never in the counts.</Note>
          </>
        ) : null}
        <Link label="Privacy" onPress={() => Linking.openURL('https://babynaptrack.com/privacy/')} />
        <Link label="Delete everything" onPress={onDelete} />
      </Group>
    </Sheet>
  )
}

// The times of one sleep, each set with the phone's clock or moved a few minutes at a time.
export function SleepForm ({ ed, onChange, log }: { ed: Sleep; onChange: (x: Sleep) => void; log: boolean }) {
  const t = useTheme(), now = Date.now()
  const nudge = (f: 's' | 'e', m: number) => onChange(f === 's' ? moveStart(ed, m) : { ...ed, e: ed.e! + m * MIN })
  const steps = (f: 's' | 'e') => (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {[-15, -5, 5, 15].map((m) => <StepButton key={m} label={`${m < 0 ? '−' : '+'}${Math.abs(m)}`} a11y={`${Math.abs(m)} minutes ${m < 0 ? 'earlier' : 'later'}`} onPress={() => nudge(f, m)} />)}
    </View>
  )
  const pickS = (h: number, m: number) => onChange(pickStart(ed, now, h, m))
  const pickE = (h: number, m: number) => onChange(pickEnd(ed, now, h, m))
  return (
    <>
      {log ? <Segmented options={[{ value: 'nap', label: 'Nap' }, { value: 'night', label: 'Night' }]} value={ed.kind} onChange={(k) => onChange({ ...ed, kind: k as Sleep['kind'] })} /> : null}
      <View style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: t.line, gap: 8 }}>
        <T size={15} color={t.muted}>Fell asleep</T>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}><TimeField value={ed.s} onPick={pickS} label="Fell asleep" size={32} testID="fell-asleep" />{steps('s')}</View>
      </View>
      <View style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: t.line, gap: 8 }}>
        <T size={15} color={t.muted}>Woke up</T>
        {ed.e == null
          ? <T size={22} w="light">Still asleep</T>
          : <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}><TimeField value={ed.e} onPick={pickE} label="Woke up" size={32} testID="woke-up" />{steps('e')}</View>}
      </View>
      <T size={15} color={t.muted} style={{ marginTop: 14, marginBottom: 4 }}>{ed.e == null ? `Asleep ${dur(now - ed.s)} so far` : `${dur(ed.e - ed.s)} asleep`}</T>
    </>
  )
}

export const sleepOk = (ed: Sleep, now = Date.now()) => (ed.e == null || (ed.e > ed.s && ed.e <= now + MIN)) && ed.s <= now

export function EditSheet ({ open, sleep, onClose, onToast }: { open: boolean; sleep: Sleep | null; onClose: () => void; onToast: (s: string) => void }) {
  const st = useStore()
  const [ed, setEd] = useState<Sleep | null>(null)
  const [isNew, setIsNew] = useState(false)
  // A new sleep is a nap or a night by its start time until the parent picks one.
  const [auto, setAuto] = useState(false)
  useEffect(() => {
    if (!open || !sleep) return
    const fresh = !st.state.sleeps.some((x) => x.id === sleep.id), baby = st.state.baby
    setEd(baby ? (fresh ? { ...sleep, kind: kindFor(baby, sleep.s, st.state.sleeps) } : asLogged(baby, { ...sleep }, Date.now())) : { ...sleep })
    setIsNew(fresh); setAuto(fresh)
  }, [open, sleep])
  if (!ed) return null
  const change = (x: Sleep) => {
    if (x.kind !== ed.kind) { setAuto(false); setEd(x); return }
    setEd(auto && x.s !== ed.s && st.state.baby ? { ...x, kind: kindFor(st.state.baby, x.s, st.state.sleeps) } : x)
  }
  return (
    <Sheet open={open} onClose={onClose}>
      <T w="bold" size={22} style={{ marginBottom: 14 }}>{isNew ? 'Add a sleep' : 'Edit sleep'}</T>
      <SleepForm ed={ed} onChange={change} log />
      <Button label="Save" disabled={!sleepOk(ed)} style={{ marginTop: 18 }} onPress={() => {
        // A new stretch that carries the night on past a wake-up ends with the baby up for the day.
        const on = isNew && ed.kind === 'night' && !!st.state.baby && newSleep(st.state.baby, st.state.sleeps, ed.s, ed.e).up
        const row = { ...ed, up: ed.kind === 'night' ? on || ed.up : false }
        st.saveSleep(row); onClose()
        const E = st.E, ph = E?.phase(), nx = E && ph === 'day' && !E.dayStart().unknown ? E.plan()[0] : null
        if (isNew && row.kind === 'nap' && row.e != null && (ph === 'night' || ph === 'waking')) onToast(`Added the nap from ${range(row.s, row.e, ' to ')}.`)
        else onToast(isNew ? 'Added.' : nx ? `Saved. ${nx.bed ? 'Bedtime' : 'Next nap'} ${fmt(nx.c)}.` : 'Saved.')
      }} />
      {!isNew ? <Link center label="Delete this sleep" onPress={() => { st.deleteSleep(ed.id); onClose(); onToast('Deleted.') }} /> : null}
    </Sheet>
  )
}

// Last night: when the baby went down, each time the baby woke and went back down, and up for
// the day. Each time is set on the phone's clock, and Save puts the whole night back in one go.
export function NightSheet ({ open, onClose, onToast }: { open: boolean; onClose: () => void; onToast: (s: string) => void }) {
  const t = useTheme(), st = useStore(), E = st.E
  const [d, setD] = useState<NightDraft | null>(null)
  useEffect(() => { if (open && st.E) setD(nightDraft(st.E)) }, [open])
  const ln = E?.lastNight()
  if (!E || !d || !ln) return null
  const N = E.baby.name, problem = nightProblem(ln, d, Date.now())
  const wake = (k: number, f: 'w' | 'b', h: number, m: number) => setD({ ...d, wakes: d.wakes.map((x, j) => (j === k ? { ...x, [f]: nightPick(x[f], h, m) } : x)) })
  const line = (label: string, value: number, onPick: (h: number, m: number) => void, testID: string) => (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingVertical: 8 }}>
      <T size={16}>{label}</T>
      <TimeField value={value} onPick={onPick} label={label} size={28} testID={testID} />
    </View>
  )
  const block = { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: t.line }
  return (
    <Sheet open={open} onClose={onClose} tall>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <T w="bold" size={22}>Last night</T>
        <Pressable accessibilityRole="button" onPress={onClose} hitSlop={12}><T w="bold" size={16}>Close</T></Pressable>
      </View>
      <T size={15} color={t.muted} style={{ marginBottom: 8 }}>{ln.logged ? nightSum(d) : `Pop in when ${N} went down and woke in the night.`}</T>
      <View style={block}>{line('Down for the night', d.down, (h, m) => setD({ ...d, down: nightPick(d.down, h, m) }), 'night-down')}</View>
      {d.wakes.map((x, k) => (
        <View key={k} style={block}>
          {line('Woke', x.w, (h, m) => wake(k, 'w', h, m), `night-woke-${k + 1}`)}
          {line('Back asleep', x.b, (h, m) => wake(k, 'b', h, m), `night-back-${k + 1}`)}
          <Link label="Remove this waking" onPress={() => setD({ ...d, wakes: d.wakes.filter((_, j) => j !== k) })} style={{ alignSelf: 'flex-end', paddingVertical: 4 }} />
        </View>
      ))}
      <View style={block}>{line('Up for the day', d.up, (h, m) => setD({ ...d, up: nightPick(d.up, h, m) }), 'night-up')}</View>
      <View style={{ marginTop: 12 }}><Pill label={`Add a time ${N} woke`} onPress={() => setD(nightAddWake(d))} /></View>
      {problem ? <T size={15} color={t.honeyText} style={{ marginTop: 6, lineHeight: 21 }}>{problem}</T> : null}
      <Button label="Save" disabled={!!problem} style={{ marginTop: 16 }} onPress={() => {
        let n = 0
        const { save, gone } = nightSave(ln, d, () => `new-${Date.now()}-${++n}`)
        const next = st.saveNight(save, gone)
        onClose(); onToast(savedLine(next, st.gate))
      }} />
    </Sheet>
  )
}

// Going out: when you leave, when you're home and whether the baby naps in the car. The plan
// under it moves as the times change, and Use this plan puts it on the Today screen.
export function OutSheet ({ open, onClose, onToast }: { open: boolean; onClose: () => void; onToast: (s: string) => void }) {
  const t = useTheme(), st = useStore(), E = st.E
  const [od, setOd] = useState<Out | null>(null)
  useEffect(() => { if (open && st.E) setOd(outDraft(st.E)) }, [open])
  if (!E || !od) return null
  const N = E.baby.name, v = outView(E, od), set = (o: Out) => setOd(clampOut(E, o))
  const nudge = (f: 'leave' | 'home', m: number) => set(f === 'leave' ? { ...od, leave: od.leave + m * MIN, home: od.home + m * MIN } : { ...od, home: od.home + m * MIN })
  const steps = (f: 'leave' | 'home') => (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      <StepButton label="−15" a11y="15 minutes earlier" onPress={() => nudge(f, -15)} />
      <StepButton label="+15" a11y="15 minutes later" onPress={() => nudge(f, 15)} />
    </View>
  )
  return (
    <Sheet open={open} onClose={onClose} tall>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <T w="bold" size={22}>Going out</T>
        <Pressable accessibilityRole="button" onPress={onClose} hitSlop={12}><T w="bold" size={16}>Close</T></Pressable>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: t.line }}>
        <View style={{ gap: 6 }}>
          <T size={15} color={t.muted}>Leave at</T>
          <TimeField value={od.leave} label="Leave at" size={32} testID="leave-at" onPick={(h, m) => { const l = dayAt(E.now, h, m); set({ ...od, leave: l, home: od.home + l - od.leave }) }} />
        </View>
        {steps('leave')}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: t.line, marginBottom: 14 }}>
        <View style={{ gap: 6 }}>
          <T size={15} color={t.muted}>Home by</T>
          <TimeField value={od.home} label="Home by" size={32} testID="home-by" onPick={(h, m) => set({ ...od, home: dayAt(E.now, h, m) })} />
        </View>
        {steps('home')}
      </View>
      <T size={14.5} color={t.muted} style={{ marginBottom: 8 }}>While you're out, {N} will</T>
      <Segmented options={[{ value: 'car', label: 'Nap in the car' }, { value: 'awake', label: 'Stay awake' }]} value={od.mode} onChange={(m) => set({ ...od, mode: m as Out['mode'] })} />
      {v.answer ? (
        <View style={{ marginTop: 10 }}>
          <Eyebrow>{v.answer.eyebrow}</Eyebrow>
          <View style={{ marginTop: 6, marginBottom: 4 }}><Big parts={v.answer.big} size={56} /></View>
        </View>
      ) : null}
      <Ribbon r={v.rib} />
      <View style={{ marginTop: 8 }}><Rows rows={v.rows} /></View>
      {v.long ? <T size={16} style={{ marginTop: 12, lineHeight: 23 }}>{v.long}</T> : null}
      <T size={15} color={t.muted} style={{ marginTop: 14 }}>{v.total}</T>
      <Button label="Use this plan" style={{ marginTop: 18 }} onPress={() => { st.setOut(od); onClose(); onToast('Plan saved.') }} />
      {E.activeOut() ? <Link center label="Remove this plan" onPress={() => { st.setOut(null); onClose(); onToast('Plan removed.') }} /> : null}
    </Sheet>
  )
}

// One nap in a short list, tapped to change it.
export function NapRow ({ s, e, onPress }: { s: number; e: number; onPress: () => void }) {
  const t = useTheme()
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Nap ${range(s, e, ' to ')}`} onPress={onPress}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: t.line }}>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: t.sleep }} />
      <View style={{ flex: 1, gap: 2 }}>
        <T w="semibold" size={16}>Nap</T>
        <T size={14} color={t.muted}>{range(s, e, ' to ')}</T>
      </View>
      <T size={15} style={{ fontVariant: ['tabular-nums'] }}>{dur(e - s)}</T>
    </Pressable>
  )
}

// The nap a parent is adding or changing, over setup or the morning question.
export function NapForm ({ ed, isNew, onChange, onSave, onDelete }: { ed: Sleep; isNew: boolean; onChange: (x: Sleep) => void; onSave: () => void; onDelete: () => void }) {
  return (
    <>
      <T w="bold" size={22} style={{ marginBottom: 14 }}>{isNew ? 'Add a nap' : 'Edit nap'}</T>
      <SleepForm ed={ed} onChange={onChange} log={false} />
      <Button label="Save" disabled={!sleepOk(ed)} style={{ marginTop: 18 }} onPress={onSave} />
      {!isNew ? <Link center label="Delete this nap" onPress={onDelete} /> : null}
    </>
  )
}

// This morning: when the baby woke (from the Woke up row), or the naps since (after the screen
// asked when the baby woke).
export function MorningSheet ({ open, mode, onClose, onToast }: { open: boolean; mode: 'wake' | 'naps'; onClose: () => void; onToast: (s: string) => void }) {
  const t = useTheme(), st = useStore(), E = st.E
  const [wake, setWake] = useState(0)
  const [ed, setEd] = useState<Sleep | null>(null)
  const [isNew, setIsNew] = useState(false)
  useEffect(() => { if (open && E) { setWake(E.dayStart().t); setEd(null) } }, [open, mode])
  if (!E) return null
  const N = E.baby.name, now = Date.now(), ds = E.dayStart()
  if (mode === 'wake') return (
    <Sheet open={open} onClose={onClose}>
      <T w="semibold" size={24} style={{ lineHeight: 28, marginBottom: 14 }}>When did {N} wake up this morning?</T>
      <TimeField value={wake || ds.t} onPick={(h, m) => setWake(morningAt(E.baby, now, h, m))} label="Woke up" testID="wake-time" />
      <Button label="Save" disabled={(wake || ds.t) > now} style={{ marginTop: 22 }} onPress={() => { const next = st.setMorning(wake || ds.t); onClose(); onToast(savedLine(next, st.gate)) }} />
    </Sheet>
  )
  const naps = E.napsSince(ds.t).filter((x) => x.e != null)
  return (
    <Sheet open={open} onClose={onClose}>
      {ed ? (
        <NapForm ed={ed} isNew={isNew} onChange={setEd}
          onSave={() => { st.saveSleep(ed); setEd(null) }} onDelete={() => { st.deleteSleep(ed.id); setEd(null) }} />
      ) : (
        <>
          <T w="semibold" size={24} style={{ lineHeight: 28, marginBottom: 14 }}>Has {N} had a nap since {fmt(ds.t)}?</T>
          {naps.length ? <View style={{ borderTopWidth: 1, borderTopColor: t.line, marginBottom: 14 }}>{naps.map((x) => <NapRow key={x.id} s={x.s} e={x.e!} onPress={() => { setEd({ ...x }); setIsNew(false) }} />)}</View> : null}
          <Pill label={naps.length ? 'Add another nap' : 'Add a nap'} onPress={() => {
            const d = napDraft(E.baby, naps.length ? naps[naps.length - 1].e! : ds.t, now)
            setEd({ id: `new-${now}`, s: d.s, e: d.e, kind: 'nap', up: false, updatedAt: now }); setIsNew(true)
          }} />
          <Button label={naps.length ? 'Done' : 'No naps yet'} style={{ marginTop: 18 }} onPress={() => { onClose(); onToast(savedLine(st.E, st.gate)) }} />
        </>
      )}
    </Sheet>
  )
}

// Type what happened: the parent types or says the morning, each
// sleep it reads shows as a row to check, and Save puts them in the log in one go.
export function TypedSheet ({ open, onClose, onToast }: { open: boolean; onClose: () => void; onToast: (s: string) => void }) {
  const t = useTheme(), st = useStore(), baby = st.state.baby
  const [text, setText] = useState('')
  const [fixes, setFixes] = useState<Record<number, TypedRow | null>>({})
  const [ed, setEd] = useState<{ i: number; p: string; x: Sleep } | null>(null)
  const [woke, setWoke] = useState<{ i: number; p: string; t: number; from?: number } | null>(null)
  useEffect(() => { if (open) { setText(''); setFixes({}); setEd(null); setWoke(null) } }, [open])
  if (!baby) return null
  const now = Date.now(), r = typed(text, baby, st.state.sleeps, now, fixes)
  const fix = (i: number, x: TypedRow | null) => setFixes({ ...fixes, [i]: x })
  // A typed sleep carries what it goes in the log as; the nap the timer was running is a nap.
  const kindOf = (x: (typeof r.rows)[number]) => (x.k === 'sleep' && x.kind ? x.kind : x.k === 'wake' ? 'night' : kindFor(baby, x.s))
  const shown = r.rows.map((x) => {
    const e = x.k === 'end' ? x.t : x.k === 'sleep' ? x.e : null
    // The night typed with its start shows as Today's list will show it.
    const row: Row = x.k === 'wake' && x.from != null
      ? { at: x.from, mark: 'done', title: 'Last night', sub: range(x.from, x.t, ' to '), right: dur(x.t - x.from) }
      : x.k === 'wake' || (x.k === 'end' && x.night)
      ? { at: x.t, mark: 'edge', title: 'Woke up', right: fmt(x.t) }
      : e == null
        ? { at: x.s, mark: 'done', title: kindOf(x) === 'nap' ? 'Napping' : 'Asleep', sub: `since ${fmt(x.s)}`, right: dur(now - x.s) }
        : { at: x.s, mark: 'done', title: kindOf(x) === 'nap' ? 'Nap' : x.k === 'sleep' && x.up ? 'Back asleep' : 'Night', sub: range(x.s, e, ' to '), right: dur(e - x.s) }
    return { row, x }
  })
  // A wake-up opens the time; a sleep, the ended nap among them, opens the nap's two times.
  const change = (x: (typeof r.rows)[number]) => (x.k === 'wake' || (x.k === 'end' && x.night)
    ? () => setWoke({ i: x.i, p: x.p, t: x.t, from: x.k === 'wake' ? x.from : undefined })
    : () => { const e = x.k === 'end' ? x.t : x.e; setEd({ i: x.i, p: x.p, x: { id: 'typed', s: x.s, e, kind: kindOf(x), updatedAt: now } }) })
  // Save sits under the box at the bottom of the phone, however much was typed.
  const save = <Button label="Save" disabled={!r.rows.length} onPress={() => { const next = st.saveTyped(r); onClose(); onToast(savedLine(next, st.gate)) }} />
  return (
    <Sheet open={open} onClose={onClose} foot={ed || woke ? undefined : save}>
      {ed ? (
        <NapForm ed={ed.x} isNew={false} onChange={(x) => setEd({ ...ed, x })}
          onSave={() => { fix(ed.i, { k: 'sleep', s: ed.x.s, e: ed.x.e, p: ed.p }); setEd(null) }} onDelete={() => { fix(ed.i, null); setEd(null) }} />
      ) : woke ? (
        <>
          <T w="bold" size={22} style={{ marginBottom: 14 }}>Woke up</T>
          <TimeField value={woke.t} onPick={(h, m) => setWoke({ ...woke, t: morningAt(baby, now, h, m) })} label="Woke up" testID="typed-wake" />
          <Button label="Save" disabled={woke.t > now} style={{ marginTop: 22 }} onPress={() => { fix(woke.i, { k: 'wake', t: woke.t, p: woke.p, from: woke.from }); setWoke(null) }} />
        </>
      ) : (
        <>
          <T w="bold" size={22} style={{ marginBottom: 14 }}>Type what happened</T>
          <TextInput testID="typed" multiline autoFocus value={text} onChangeText={(v) => { setText(v); setFixes({}) }}
            placeholder="Up at 5:40, napped 6:10 to 7:28" placeholderTextColor={t.muted} accessibilityLabel="What happened"
            style={{ fontFamily: 'Figtree_400Regular', fontSize: 18, lineHeight: 26, color: t.ink, backgroundColor: t.soft, borderRadius: 18, paddingVertical: 14, paddingHorizontal: 16, minHeight: 108, textAlignVertical: 'top' }} />
          {shown.length ? (
            <View style={{ marginTop: 20, gap: 10 }}>
              <Eyebrow>Today</Eyebrow>
              <Rows rows={shown.map((y) => y.row)} onPress={(row) => { const y = shown.find((z) => z.row === row); return y ? change(y.x) : null }} />
            </View>
          ) : <T size={14.5} color={t.muted} style={{ marginTop: 12, lineHeight: 21 }}>Each sleep shows up here as you type.</T>}
          {r.left.length ? (
            <View style={{ marginTop: 16, gap: 4 }}>
              <Eyebrow>Not added</Eyebrow>
              {r.left.map((p, i) => <T key={i} size={15} color={t.muted} style={{ lineHeight: 22 }}>{`\u201C${p}\u201D`}</T>)}
            </View>
          ) : null}
        </>
      )}
    </Sheet>
  )
}

export function AskSheet ({ open, name, onUp, onBack, onClose }: { open: boolean; name: string; onUp: () => void; onBack: () => void; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose}>
      <T w="bold" size={22} style={{ marginBottom: 18 }}>Is {name} up for the day?</T>
      <View style={{ gap: 10 }}>
        <Button label="Up for the day" onPress={onUp} />
        <Button label="Going back down" alt onPress={onBack} />
      </View>
    </Sheet>
  )
}

export function JoinSheet ({ open, initial, onClose, onJoined }: { open: boolean; initial: string; onClose: () => void; onJoined: (name: string) => void }) {
  const t = useTheme(), st = useStore()
  const [text, setText] = useState(initial)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (open) { setText(initial); setErr('') } }, [open, initial])
  const key = keyFrom(text), hasLog = !!st.state.baby
  const join = async () => {
    if (!key) { setErr('That is not a Baby Nap Track link. Paste the whole link from the message.'); return }
    setBusy(true); setErr('')
    try { const baby = await st.joinShare(key); onJoined(baby.name) } catch (e) {
      setErr(String(e).includes('no such log') ? 'That link no longer works. Ask for a new one.' : 'No internet connection. Try again when you are online.')
    } finally { setBusy(false) }
  }
  return (
    <Sheet open={open} onClose={onClose}>
      <T w="bold" size={22} style={{ marginBottom: 10 }}>Join a shared log</T>
      <T size={16} style={{ lineHeight: 23, marginBottom: 14 }}>Paste the link someone sent you.{hasLog ? ` The log on this phone is replaced by theirs.` : ''}</T>
      <TextInput testID="join-link" value={text} onChangeText={setText} placeholder="https://babynaptrack.com/join/…" placeholderTextColor={t.muted} autoCapitalize="none" autoCorrect={false}
        style={{ fontFamily: 'Figtree_400Regular', fontSize: 15, color: t.ink, backgroundColor: t.soft, borderRadius: 12, padding: 14 }} />
      {err ? <T size={15} color={t.honeyText} style={{ marginTop: 10 }}>{err}</T> : null}
      <Button label={busy ? 'Joining…' : 'Join'} disabled={!text.trim() || busy} onPress={join} style={{ marginTop: 18 }} />
    </Sheet>
  )
}

export function DeleteSheet ({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const st = useStore()
  const [err, setErr] = useState('')
  const N = st.state.baby?.name ?? 'the baby', shared = !!st.state.share
  return (
    <Sheet open={open} onClose={onClose}>
      <T w="bold" size={22} style={{ marginBottom: 10 }}>Delete everything?</T>
      <T size={16} style={{ lineHeight: 23, marginBottom: 18 }}>
        {shared
          ? `This deletes ${N}'s sleep log from this phone and the shared copy, so everyone with the link loses it too. It cannot be undone.`
          : `This deletes ${N}'s sleep log from this phone. It cannot be undone.`}
      </T>
      {err ? <T size={15} style={{ marginBottom: 10 }}>{err}</T> : null}
      <Button label="Delete everything" onPress={async () => {
        try { await st.deleteAll(); onDone() } catch { setErr('No internet connection, so the shared copy could not be deleted. Try again when you are online.') }
      }} />
      <Link center label="Keep it" onPress={onClose} />
    </Sheet>
  )
}
