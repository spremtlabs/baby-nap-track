// The first minute: the baby's name and birthday, the usual day, and this morning so far. On an
// iPhone two screens follow: whether Baby Nap Track may send usage
// counts, and the free week, which starts only when the parent taps it.
import { useState } from 'react'
import { ScrollView, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { MIN, ageText, atMins, defaultBed, morningAt, targetFor, type Baby, type Sleep } from '../lib/engine.ts'
import { napDraft } from '../lib/model.ts'
import { weekScreen } from '../lib/shop.ts'
import { fmt, hours, lenParts, timeParts } from '../lib/words.ts'
import { DateField } from '../ui/DateField.tsx'
import { TimeField } from '../ui/TimeField.tsx'
import { Big, Button, Eyebrow, Link, Pill, Sheet, Stepper, T, useTheme } from '../ui/kit.tsx'
import { looksLikeEmail } from '../lib/signup.ts'
import { NapForm, NapRow } from './Sheets.tsx'

type Nap = { s: number; e: number }

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

type Props = {
  // `email` is what the parent typed, or empty.
  onDone: (baby: Baby, woke: number, naps: Nap[], email: string) => void
  onJoin: () => void
  shopLine: string
  // On an iPhone that has not answered yet, the question about usage counts.
  askCounts: boolean
  onCounts: (yes: boolean) => void
  // On an iPhone whose App Store offers the free week and whose parent has not started it, its price.
  offer: string | null
  // Opens Apple's sheet on the `7-day Trial` item. Resolves true once the week has started or is
  // waiting on the App Store, and setup is then over.
  onWeek: () => Promise<boolean>
}

export function Setup ({ onDone, onJoin, shopLine, askCounts, onCounts, offer, onWeek }: Props) {
  const t = useTheme(), insets = useSafeAreaInsets()
  const [step, setStep] = useState(1)
  const [email, setEmail] = useState('')
  const emailBad = !!email.trim() && !looksLikeEmail(email)
  // The question about counts is settled when setup opens, so Back from the free week still finds it.
  const [asks] = useState(askCounts)
  // This morning's wake-up and naps wait here while an iPhone asks about counts and the free week,
  // with the screen Back returns to.
  const [kept, setKept] = useState<{ woke: number; naps: Nap[]; from: number } | null>(null)
  const [starting, setStarting] = useState(false)
  const [name, setName] = useState('')
  const [born, setBorn] = useState('')
  const [early, setEarly] = useState(false)
  const [due, setDue] = useState('')
  const [wake, setWake] = useState(420)
  const [bed, setBed] = useState<number | null>(null)
  const [target, setTarget] = useState<number | null>(null)
  // A day sleep aim changed here is the parent's own. Left alone, it follows the nights, from 1.0.23.
  const [aimSet, setAimSet] = useState(false)
  const [woke, setWoke] = useState<number | null>(null)
  const [naps, setNaps] = useState<Nap[]>([])
  const [ed, setEd] = useState<{ i: number; x: Sleep } | null>(null)

  const baby: Baby = { name: name.trim(), born, due: early ? due : '', wake, bed: bed ?? 1140, target: target ?? 180, ...(aimSet ? { aimSet } : {}) }
  const weeks = born ? (Date.now() - new Date((early && due) || born).getTime()) / (7 * 864e5) : 0
  // This morning's wake-up starts at the usual one, or now if that has not come yet.
  const wokeAt = woke ?? Math.min(atMins(Date.now(), wake), Math.floor(Date.now() / (5 * MIN)) * 5 * MIN)
  const toStep2 = () => { setBed((b) => b ?? defaultBed(weeks)); setTarget((x) => x ?? targetFor(weeks)); setStep(2) }

  const Brand = () => <T w="bold" size={20} style={{ marginBottom: 40 }}>Baby Nap Track</T>
  const Back = ({ to }: { to: number }) => <Link label="Back" onPress={() => setStep(to)} style={{ marginTop: -20, marginBottom: 6 }} />
  const H1 = ({ children }: { children: React.ReactNode }) => <T w="semibold" size={32} style={{ lineHeight: 36, letterSpacing: -0.6, marginBottom: 22 }}>{children}</T>
  const Label = ({ children }: { children: string }) => <T w="semibold" size={14} color={t.muted} style={{ marginBottom: 8 }}>{children}</T>
  const Line = ({ children }: { children: string }) => <T size={14.5} color={t.muted} style={{ lineHeight: 21, textAlign: 'center', marginBottom: 14 }}>{children}</T>
  const Body = ({ children, gap }: { children: React.ReactNode; gap?: boolean }) => <T size={17} style={{ lineHeight: 25, marginBottom: gap ? 16 : 0 }}>{children}</T>

  // After the questions about the baby. Android finishes here, as it always has.
  const next = (list: Nap[], from: number) => {
    if (!asks && !offer) return onDone(baby, wokeAt, list, email)
    setKept({ woke: wokeAt, naps: list, from }); setStep(asks ? 5 : 6)
  }
  const finish = () => onDone(baby, kept?.woke ?? wokeAt, kept?.naps ?? [], email)
  const answer = (yes: boolean) => { onCounts(yes); if (offer) setStep(6); else finish() }
  const start = async () => {
    setStarting(true)
    const over = await onWeek()
    setStarting(false)
    if (over) finish()
  }
  const week = offer ? weekScreen(offer, Date.now()) : null

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bg }} contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + 50, paddingBottom: insets.bottom + 30, paddingHorizontal: 24 }} keyboardShouldPersistTaps="handled">
      {step === 1 && (
        <>
          <Brand />
          <H1>Let's get your first nap time.</H1>
          <Label>Your baby's name</Label>
          <TextInput testID="name" value={name} onChangeText={setName} autoCapitalize="words" autoCorrect={false}
            style={{ fontFamily: 'Figtree_400Regular', fontSize: 22, color: t.ink, paddingVertical: 10, borderBottomWidth: 1.5, borderBottomColor: t.line, marginBottom: 26 }} />
          <Label>Date of birth</Label>
          <DateField big testID="born" value={born} onChange={setBorn} placeholder="Pick a date" />
          <Link label={early ? 'Born on time? Remove the due date' : 'Born early? Add the due date'} onPress={() => setEarly(!early)} style={{ marginTop: 14 }} />
          {early ? (<View style={{ marginTop: 10 }}><Label>Due date</Label><DateField big value={due} onChange={setDue} placeholder="Pick a date" /></View>) : null}
          {/* The email can stay blank: Apple turns back an app that needs one to work. */}
          <View style={{ marginTop: 26 }}>
            <Label>Your email</Label>
            <TextInput testID="email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email"
              style={{ fontFamily: 'Figtree_400Regular', fontSize: 22, color: t.ink, paddingVertical: 10, borderBottomWidth: 1.5, borderBottomColor: t.line }} />
            <T size={14.5} color={emailBad ? t.honeyText : t.muted} style={{ lineHeight: 21, marginTop: 8 }}>{emailBad ? "That doesn't look like an email address yet." : "We'll email you sleep tips as your baby grows."}</T>
          </View>
          <View style={{ flex: 1, minHeight: 30 }} />
          {shopLine ? <T size={14.5} color={t.muted} style={{ lineHeight: 21, textAlign: 'center', marginBottom: 6 }}>{shopLine}</T> : null}
          <Link center label="Someone sent you a link? Join their log" onPress={onJoin} />
          <Button label="Next" disabled={!name.trim() || !born || emailBad} onPress={toStep2} />
        </>
      )}
      {step === 2 && (
        <>
          <Back to={1} />
          <Brand />
          <H1>{baby.name}'s day</H1>
          <T size={17} style={{ lineHeight: 25, marginBottom: 18 }}>{baby.name} is {ageText(baby, Date.now())} old. Most babies this age sleep about {hours(targetFor(weeks) * MIN)} in the day. Change any of these to fit {baby.name}.</T>
          <View style={{ borderTopWidth: 1, borderTopColor: t.line }}>
            <Stepper label="Usual wake-up" value={timeParts(wake)} onLess={() => setWake(clamp(wake - 15, 300, 600))} onMore={() => setWake(clamp(wake + 15, 300, 600))} />
            <Stepper label="Bedtime" value={timeParts(baby.bed)} onLess={() => setBed(clamp(baby.bed - 15, 1050, 1380))} onMore={() => setBed(clamp(baby.bed + 15, 1050, 1380))} />
            <Stepper label="Day sleep to aim for" value={lenParts(baby.target)} onLess={() => { setTarget(clamp(baby.target - 15, 30, 420)); setAimSet(true) }} onMore={() => { setTarget(clamp(baby.target + 15, 30, 420)); setAimSet(true) }} />
          </View>
          <View style={{ flex: 1, minHeight: 30 }} />
          <Button label="Next" onPress={() => { setWoke(null); setStep(3) }} />
        </>
      )}
      {step === 3 && (
        <>
          <Back to={2} />
          <Brand />
          <H1>When did {baby.name} wake up this morning?</H1>
          <T size={17} style={{ lineHeight: 25, marginBottom: 20 }}>Baby Nap Track works out the next nap from there.</T>
          <TimeField value={wokeAt} onPick={(h, m) => setWoke(morningAt(baby, Date.now(), h, m))} label="Woke up" testID="wake-time" />
          <View style={{ flex: 1, minHeight: 30 }} />
          {/* Under half an hour awake, there has been no nap to ask about. */}
          <Button label="Next" disabled={wokeAt > Date.now()} onPress={() => (Date.now() - wokeAt < 30 * MIN ? next([], 3) : setStep(4))} />
        </>
      )}
      {step === 4 && (
        <>
          <Back to={3} />
          <Brand />
          <H1>Has {baby.name} had a nap since {fmt(wokeAt)}?</H1>
          {naps.length ? <View style={{ borderTopWidth: 1, borderTopColor: t.line, marginBottom: 14 }}>{naps.map((x, i) => <NapRow key={i} s={x.s} e={x.e} onPress={() => setEd({ i, x: { id: `n${i}`, s: x.s, e: x.e, kind: 'nap', updatedAt: 0 } })} />)}</View> : null}
          <Pill label={naps.length ? 'Add another nap' : 'Add a nap'} onPress={() => {
            const d = napDraft(baby, naps.length ? naps[naps.length - 1].e : wokeAt, Date.now())
            setEd({ i: -1, x: { id: 'new', s: d.s, e: d.e, kind: 'nap', updatedAt: 0 } })
          }} />
          <View style={{ flex: 1, minHeight: 30 }} />
          <Button label={naps.length ? 'Done' : 'No naps yet'} onPress={() => next(naps, 4)} />
          <Sheet open={!!ed} onClose={() => setEd(null)}>
            {ed ? <NapForm ed={ed.x} isNew={ed.i < 0} onChange={(x) => setEd({ ...ed, x })}
              onSave={() => { const n = { s: ed.x.s, e: ed.x.e! }; setNaps((l) => (ed.i < 0 ? [...l, n] : l.map((y, j) => (j === ed.i ? n : y))).sort((a, b) => a.s - b.s)); setEd(null) }}
              onDelete={() => { setNaps((l) => l.filter((_, j) => j !== ed.i)); setEd(null) }} /> : null}
          </Sheet>
        </>
      )}
      {step === 5 && (
        <>
          <Back to={kept?.from ?? 4} />
          <Brand />
          <H1>Can Baby Nap Track send us counts of how it's used?</H1>
          <Body gap>They show us which parts of Baby Nap Track get used, so we know what to work on next.</Body>
          <Body>We'd get a count each day you open Baby Nap Track, and when you do things like finish setup or share a log. {offer ? "It says which day of the free week you're on and how many sleeps you've logged." : "It says how many sleeps you've logged."} {baby.name}'s name, birthday and sleep times are never in it.</Body>
          <View style={{ flex: 1, minHeight: 30 }} />
          <Line>You can change this any time in Settings.</Line>
          <View style={{ gap: 10 }}>
            <Button label="Yes, send them" alt onPress={() => answer(true)} />
            <Button label="No, don't send them" alt onPress={() => answer(false)} />
          </View>
        </>
      )}
      {step === 6 && week && (
        <>
          <Back to={asks ? 5 : kept?.from ?? 4} />
          <Brand />
          <Eyebrow>{week.eyebrow}</Eyebrow>
          <View style={{ marginTop: 8, marginBottom: 14 }}><Big parts={week.big} size={86} /></View>
          <Body gap>{week.gives}</Body>
          <Body>{week.after}</Body>
          <View style={{ flex: 1, minHeight: 30 }} />
          <Line>{week.line}</Line>
          <Button label={week.start} disabled={starting} onPress={start} />
          <Link center label={week.later} onPress={finish} style={{ paddingTop: 10, paddingBottom: 0 }} />
        </>
      )}
    </ScrollView>
  )
}
