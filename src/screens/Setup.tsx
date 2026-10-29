// The first open, from 1.0.41, 28 October 2026: three welcome screens, then one question a
// screen with a bar that shows how many are left. The name, the birthday, the email, the usual day
// with the typical naps for the age, this morning, the naps since, and how bedtimes are going. Tough
// opens the chair method. From 1.0.43 the parent then picks how the naps run, unless the chair method
// started, which runs them its own way. The last question asks about sharing the log. On an iPhone two
// screens follow: whether Baby Nap Track may send usage counts, and the free week.
import { useState } from 'react'
import { Pressable, ScrollView, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Path } from 'react-native-svg'
import { MIN, atMins, defaultBed, morningAt, targetFor, type Baby, type Sleep, type Style } from '../lib/engine.ts'
import { styleTexts, typicalNaps } from '../lib/guide.ts'
import { napDraft } from '../lib/model.ts'
import { weekScreen } from '../lib/shop.ts'
import { fmt } from '../lib/words.ts'
import { DateField } from '../ui/DateField.tsx'
import { TimeField } from '../ui/TimeField.tsx'
import { Big, Button, Eyebrow, Link, Pill, Sheet, T, useTheme } from '../ui/kit.tsx'
import { looksLikeEmail } from '../lib/signup.ts'
import { ChairFlow } from './ChairFlow.tsx'
import { NapForm, NapRow } from './Sheets.tsx'

type Nap = { s: number; e: number }
// What setup hands on besides the baby: the chair method if the parent started it, and whether
// they asked to send a link to someone else.
export type SetupExtras = { chair: null | 'tonight' | 'tomorrow'; share: boolean }

type Props = {
  // `email` is what the parent typed, or empty.
  onDone: (baby: Baby, woke: number, naps: Nap[], email: string, extras: SetupExtras) => void
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

type Step = 'w1' | 'w2' | 'w3' | 'name' | 'born' | 'email' | 'day' | 'woke' | 'naps' | 'bed' | 'style' | 'chair' | 'share' | 'counts' | 'week'
const ASKS: Step[] = ['name', 'born', 'email', 'day', 'woke', 'naps', 'bed', 'style']

export function Setup ({ onDone, onJoin, shopLine, askCounts, onCounts, offer, onWeek }: Props) {
  const t = useTheme(), insets = useSafeAreaInsets()
  const [step, setStep] = useState<Step>('w1')
  const [email, setEmail] = useState('')
  const emailBad = !!email.trim() && !looksLikeEmail(email)
  // The question about counts is settled when setup opens, so Back from the free week still finds it.
  const [asks] = useState(askCounts)
  const [starting, setStarting] = useState(false)
  const [name, setName] = useState('')
  const [born, setBorn] = useState('')
  const [early, setEarly] = useState(false)
  const [due, setDue] = useState('')
  const [wake, setWake] = useState(420)
  const [bed, setBed] = useState<number | null>(null)
  const [woke, setWoke] = useState<number | null>(null)
  const [naps, setNaps] = useState<Nap[]>([])
  const [ed, setEd] = useState<{ i: number; x: Sleep } | null>(null)
  const [chair, setChair] = useState<SetupExtras['chair']>(null)
  // How the naps run, from 1.0.43. Left unset when the chair method starts, which runs them its own way.
  const [style, setStyle] = useState<Style | null>(null)
  const [share, setShare] = useState(false)

  const weeks = born ? (Date.now() - new Date((early && due) || born).getTime()) / (7 * 864e5) : 0
  // The day sleep aim comes from the age and is never asked, from 1.0.41. Settings can change it.
  const baby: Baby = { name: name.trim(), born, due: early ? due : '', wake, bed: bed ?? 1140, target: targetFor(weeks), style }
  const N = baby.name
  // This morning's wake-up starts at the usual one, or now if that has not come yet.
  const wokeAt = woke ?? Math.min(atMins(Date.now(), wake), Math.floor(Date.now() / (5 * MIN)) * 5 * MIN)
  const toDay = () => { setBed((b) => b ?? defaultBed(weeks)); setStep('day') }

  const Brand = ({ skip }: { skip?: boolean }) => (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
      <T w="bold" size={18}>Baby Nap Track</T>
      {skip ? <Link label="Skip" onPress={() => setStep('name')} style={{ paddingVertical: 0 }} /> : null}
    </View>
  )
  const Bar = ({ at }: { at: Step }) => (
    <View style={{ flexDirection: 'row', gap: 4, marginBottom: 22 }}>{ASKS.map((x, i) => <View key={x} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= ASKS.indexOf(at) ? t.ink : t.line }} />)}</View>
  )
  const Back = ({ to }: { to: Step }) => <Link label="Back" onPress={() => setStep(to)} style={{ alignSelf: 'flex-start', paddingTop: 0, paddingBottom: 6 }} />
  const H1 = ({ children }: { children: React.ReactNode }) => <T w="semibold" size={30} style={{ lineHeight: 34, letterSpacing: -0.5, marginTop: 10, marginBottom: 14 }}>{children}</T>
  const Body = ({ children, muted }: { children: React.ReactNode; muted?: boolean }) => <T size={17} color={muted ? t.muted : t.ink} style={{ lineHeight: 25, marginBottom: 16 }}>{children}</T>
  const Line = ({ children }: { children: string }) => <T size={14.5} color={t.muted} style={{ lineHeight: 21, textAlign: 'center', marginBottom: 14 }}>{children}</T>
  const Grow = () => <View style={{ flex: 1, minHeight: 30 }} />
  const Dots = ({ at }: { at: number }) => <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 18 }}>{[0, 1, 2].map((i) => <View key={i} style={{ width: i === at ? 20 : 7, height: 7, borderRadius: 4, backgroundColor: i === at ? t.ink : t.line }} />)}</View>
  const Art = ({ children }: { children: React.ReactNode }) => <View style={{ backgroundColor: t.name === 'day' ? '#FFFFFF' : t.soft, borderRadius: 26, padding: 22, marginBottom: 26 }}>{children}</View>
  const Choice = ({ label, note, onPress }: { label: string; note?: string; onPress: () => void }) => (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
      style={({ pressed }) => ({ backgroundColor: t.name === 'day' ? '#FFFFFF' : t.soft, borderRadius: 18, paddingVertical: 17, paddingHorizontal: 18, opacity: pressed ? 0.8 : 1 })}>
      <T w="semibold" size={17}>{label}</T>
      {note ? <T size={14.5} color={t.muted} style={{ marginTop: 4, lineHeight: 20 }}>{note}</T> : null}
    </Pressable>
  )

  // After the questions about the baby. Android finishes here, as it always has.
  const after = (c: SetupExtras['chair'], sh: boolean) => {
    if (!asks && !offer) return onDone(baby, wokeAt, naps, email, { chair: c, share: sh })
    setStep(asks ? 'counts' : 'week')
  }
  const finish = () => onDone(baby, wokeAt, naps, email, { chair, share })
  const answer = (yes: boolean) => { onCounts(yes); if (offer) setStep('week'); else finish() }
  const start = async () => {
    setStarting(true)
    const over = await onWeek()
    setStarting(false)
    if (over) finish()
  }
  const week = offer ? weekScreen(offer, Date.now()) : null
  const typical = typicalNaps(weeks, wake, bed ?? 1140)
  const field = { fontFamily: 'Figtree_400Regular', fontSize: 22, color: t.ink, paddingVertical: 10, borderBottomWidth: 1.5, borderBottomColor: t.line }
  const play = <Svg width={22} height={25} viewBox="0 0 34 38" style={{ marginLeft: 4 }}><Path d="M5 4.2v29.6a2.2 2.2 0 0 0 3.3 1.9l23.6-14.8a2.2 2.2 0 0 0 0-3.8L8.3 2.3A2.2 2.2 0 0 0 5 4.2z" fill={t.btnInk} /></Svg>

  if (step === 'chair') {
    const evening = new Date(); evening.setHours(Math.floor((bed ?? 1140) / 60), (bed ?? 1140) % 60, 0, 0)
    return <ChairFlow name={N} young={weeks < 26} canTonight={Date.now() < evening.getTime()} onBack={() => setStep('bed')} onLater={() => { setChair(null); setStep('style') }} onStart={(tomorrow) => { setChair(tomorrow ? 'tomorrow' : 'tonight'); setStyle(null); setStep('share') }} />
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bg }} contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + 40, paddingBottom: insets.bottom + 30, paddingHorizontal: 24 }} keyboardShouldPersistTaps="handled">
      {step === 'w1' && (
        <>
          <Brand skip />
          <Art>
            <Eyebrow hot>Nap window in 35 min</Eyebrow>
            <View style={{ marginTop: 6, marginBottom: 6 }}><Big parts={[{ n: '12:20' }, { u: 'pm' }]} size={64} /></View>
            <T size={14} color={t.muted}>Put your baby down between 12:10 and 12:30pm.</T>
          </Art>
          <H1>Never guess the next nap again!</H1>
          <Body>{"You'll get the time for every nap, and a heads up 15 minutes before."}</Body>
          <Grow />
          <Dots at={0} />
          <Button label="Next" onPress={() => setStep('w2')} />
        </>
      )}
      {step === 'w2' && (
        <>
          <Brand skip />
          <Art>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: t.btn, alignItems: 'center', justifyContent: 'center' }}>{play}</View>
              <View style={{ flexShrink: 1 }}><T w="semibold" size={24}>Start</T><T size={14} color={t.muted}>Tap when your baby falls asleep.</T></View>
            </View>
          </Art>
          <H1>Tap Start, or type it in later</H1>
          <Body>Tap Start when your baby falls asleep, and again when they wake up. Forgot? Type in the times when you get a minute.</Body>
          <Grow />
          <Dots at={1} />
          <Button label="Next" onPress={() => setStep('w3')} />
        </>
      )}
      {step === 'w3' && (
        <>
          <Brand />
          <Art>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[['Mon', '12:20'], ['Tue', '12:05'], ['Wed', '12:10']].map(([d, x]) => (
                <View key={d} style={{ flex: 1, backgroundColor: t.bg, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12 }}>
                  <Eyebrow>{d}</Eyebrow>
                  <Big parts={[{ n: x }, { u: 'pm' }]} size={22} unit={11} />
                </View>
              ))}
            </View>
          </Art>
          <H1>{"It gets to know your baby's naps"}</H1>
          <Body>{"It works off your baby's age to begin with. After 3 days, it works off the naps you've logged."}</Body>
          <Grow />
          <Dots at={2} />
          {shopLine ? <Line>{shopLine}</Line> : null}
          <Button label="Let's get started!" onPress={() => setStep('name')} />
          <Link center label="Did someone send you a link? Join their log" onPress={onJoin} />
        </>
      )}
      {step === 'name' && (
        <>
          <Bar at="name" />
          <Back to="w3" />
          <H1>{"What's your baby's name?"}</H1>
          <TextInput testID="name" value={name} onChangeText={setName} autoCapitalize="words" autoCorrect={false} accessibilityLabel="Your baby's name" style={field} />
          <Grow />
          <Button label="Next" disabled={!name.trim()} onPress={() => setStep('born')} />
        </>
      )}
      {step === 'born' && (
        <>
          <Bar at="born" />
          <Back to="name" />
          <H1>When was {N} born?</H1>
          <DateField big testID="born" value={born} onChange={setBorn} placeholder="Pick a date" />
          <Link label={early ? `Born on time? Remove the due date` : `Was ${N} born early? Add the due date`} onPress={() => setEarly(!early)} style={{ marginTop: 14, alignSelf: 'flex-start' }} />
          {early ? <View style={{ marginTop: 10 }}><T w="semibold" size={14} color={t.muted} style={{ marginBottom: 8 }}>Due date</T><DateField big value={due} onChange={setDue} placeholder="Pick a date" /></View> : null}
          <Grow />
          <Button label="Next" disabled={!born} onPress={() => setStep('email')} />
        </>
      )}
      {step === 'email' && (
        <>
          <Bar at="email" />
          <Back to="born" />
          <H1>Would you like our new sleep guides by email?</H1>
          <Body>{"We'll send you each new guide when it goes up."}</Body>
          {/* The email can stay blank: Apple turns back an app that needs one to work. */}
          <TextInput testID="email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" placeholder="Your email" placeholderTextColor={t.muted} accessibilityLabel="Your email" style={field} />
          {emailBad ? <T size={14.5} color={t.honeyText} style={{ lineHeight: 21, marginTop: 8 }}>{"That doesn't look like an email address yet."}</T> : null}
          <Grow />
          <Button label="Next" disabled={emailBad} onPress={toDay} />
          <Link center label="No thanks" onPress={() => { setEmail(''); toDay() }} />
        </>
      )}
      {step === 'day' && (
        <>
          <Bar at="day" />
          <Back to="email" />
          <H1>{`When does ${N}'s day start and end?`}</H1>
          <Body>{`We've filled in a usual day for ${weeks < 52 ? `${Math.max(1, Math.round(weeks / 4.345))} months` : 'this age'}. Change the times if ${N}'s are different.`}</Body>
          <View style={{ borderTopWidth: 1, borderTopColor: t.line }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: t.line }}>
              <T size={17}>Wakes up</T>
              <TimeField size={22} testID="usual-wake" label="Wakes up" value={atMins(Date.now(), wake)} onPick={(h, m) => setWake(h * 60 + m)} />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: t.line }}>
              <T size={17}>Bedtime</T>
              <TimeField size={22} testID="usual-bed" label="Bedtime" value={atMins(Date.now(), bed ?? 1140)} onPick={(h, m) => setBed(h * 60 + m)} />
            </View>
          </View>
          <View testID="typical-naps" style={{ backgroundColor: t.name === 'day' ? '#FFFFFF' : t.soft, borderRadius: 18, paddingVertical: 14, paddingHorizontal: 16, marginTop: 20 }}>
            <Eyebrow>{`Typical naps at ${weeks < 52 ? `${Math.max(1, Math.round(weeks / 4.345))} months` : 'this age'}`}</Eyebrow>
            {typical.rows.map((r, i) => (
              <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, marginTop: i ? 0 : 6 }}>
                <T size={15.5}>{r.label}</T><T w="semibold" size={15.5}>{r.at}</T>
              </View>
            ))}
            <T size={14} color={t.muted} style={{ marginTop: 6 }}>{`That's ${typical.total} of naps in all.`}</T>
          </View>
          <Grow />
          <Button label="Next" onPress={() => { setWoke(null); setStep('woke') }} />
        </>
      )}
      {step === 'woke' && (
        <>
          <Bar at="woke" />
          <Back to="day" />
          <H1>What time did {N} wake up this morning?</H1>
          <TimeField value={wokeAt} onPick={(h, m) => setWoke(morningAt(baby, Date.now(), h, m))} label="Woke up" testID="wake-time" />
          <Grow />
          {/* Under half an hour awake, there has been no nap to ask about. */}
          <Button label="Next" disabled={wokeAt > Date.now()} onPress={() => setStep(Date.now() - wokeAt < 30 * MIN ? 'bed' : 'naps')} />
        </>
      )}
      {step === 'naps' && (
        <>
          <Bar at="naps" />
          <Back to="woke" />
          <H1>Has {N} had a nap since {fmt(wokeAt)}?</H1>
          {naps.length ? <View style={{ borderTopWidth: 1, borderTopColor: t.line, marginBottom: 14 }}>{naps.map((x, i) => <NapRow key={i} s={x.s} e={x.e} onPress={() => setEd({ i, x: { id: `n${i}`, s: x.s, e: x.e, kind: 'nap', updatedAt: 0 } })} />)}</View> : null}
          <Pill label={naps.length ? 'Add another nap' : 'Add a nap'} onPress={() => {
            const d = napDraft(baby, naps.length ? naps[naps.length - 1].e : wokeAt, Date.now())
            setEd({ i: -1, x: { id: 'new', s: d.s, e: d.e, kind: 'nap', updatedAt: 0 } })
          }} />
          <Grow />
          <Button label={naps.length ? 'Next' : 'No naps yet'} onPress={() => setStep('bed')} />
          <Sheet open={!!ed} onClose={() => setEd(null)}>
            {ed ? <NapForm ed={ed.x} isNew={ed.i < 0} onChange={(x) => setEd({ ...ed, x })}
              onSave={() => { const n = { s: ed.x.s, e: ed.x.e! }; setNaps((l) => (ed.i < 0 ? [...l, n] : l.map((y, j) => (j === ed.i ? n : y))).sort((a, b) => a.s - b.s)); setEd(null) }}
              onDelete={() => { setNaps((l) => l.filter((_, j) => j !== ed.i)); setEd(null) }} /> : null}
          </Sheet>
        </>
      )}
      {step === 'bed' && (
        <>
          <Bar at="bed" />
          <Back to={Date.now() - wokeAt < 30 * MIN ? 'woke' : 'naps'} />
          <H1>How are bedtimes going?</H1>
          <View style={{ gap: 10 }}>
            <Choice label="Pretty good" onPress={() => { setChair(null); setStep('style') }} />
            <Choice label="Tough. We'd love some help" onPress={() => setStep('chair')} />
            <Choice label="Not sure yet" onPress={() => { setChair(null); setStep('style') }} />
          </View>
          <Grow />
        </>
      )}
      {step === 'style' && (
        <>
          <Bar at="style" />
          <Back to="bed" />
          <H1>How should {N}'s naps work?</H1>
          <View style={{ gap: 10 }}>
            {styleTexts(N).map((x) => <Choice key={x.id} label={x.title} note={x.line} onPress={() => { setStyle(x.id); setStep('share') }} />)}
          </View>
          <View style={{ marginTop: 16 }}><Body muted>You can change this in Settings.</Body></View>
          <Grow />
        </>
      )}
      {step === 'share' && (
        <>
          <Back to={chair ? 'bed' : 'style'} />
          <H1>Does anyone else put {N} down for naps?</H1>
          <Body>Send them a link, and every nap you log shows up on their phone too.</Body>
          <Grow />
          <Button label="Send a link" onPress={() => { setShare(true); after(chair, true) }} />
          <Link center label="Not now" onPress={() => { setShare(false); after(chair, false) }} />
        </>
      )}
      {step === 'counts' && (
        <>
          <Back to="share" />
          <H1>{"Can Baby Nap Track send us counts of how it's used?"}</H1>
          <Body>They show us which parts of Baby Nap Track get used, so we know what to work on next.</Body>
          <Body>We'd get a count each day you open Baby Nap Track, and when you do things like finish setup or share a log. {offer ? "It says which day of the free week you're on and how many sleeps you've logged." : "It says how many sleeps you've logged."} {N}'s name, birthday and sleep times are never in it.</Body>
          <Grow />
          <Line>You can change this any time in Settings.</Line>
          <View style={{ gap: 10 }}>
            <Button label="Yes, send them" alt onPress={() => answer(true)} />
            <Button label="No, don't send them" alt onPress={() => answer(false)} />
          </View>
        </>
      )}
      {step === 'week' && week && (
        <>
          <Back to={asks ? 'counts' : 'share'} />
          <Eyebrow>{week.eyebrow}</Eyebrow>
          <View style={{ marginTop: 8, marginBottom: 14 }}><Big parts={week.big} size={86} /></View>
          <Body>{week.gives}</Body>
          <Body>{week.after}</Body>
          <Grow />
          <Line>{week.line}</Line>
          <Button label={week.start} disabled={starting} onPress={start} />
          <Link center label={week.later} onPress={finish} style={{ paddingTop: 10, paddingBottom: 0 }} />
        </>
      )}
    </ScrollView>
  )
}
