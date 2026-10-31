// The one screen. The next nap time is the largest thing on it, then the timer, then the day's
// sleep, today's list and the week.
import { useEffect, useRef, useState } from 'react'
import { Animated, Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Circle, Defs, Path, RadialGradient, Rect, Stop } from 'react-native-svg'
import { askAbout, bedtimeRow, chairCard, chairDay, chairHero, tonight, type Chair, type ChairHero, type Cry, type DayNote, type Why } from '../lib/chair.ts'
import { ageLine, daySleep, hero, todayRows, week, type Fewer, type Ribbon as RibbonData, type Ways, type WeekRow } from '../lib/model.ts'
import { MIN, atMins, morningAt, type Engine, type Route } from '../lib/engine.ts'
import type { Gate } from '../lib/shop.ts'
import { bigTime, plain, runParts } from '../lib/words.ts'
import { F } from '../theme.ts'
import { TimeField } from '../ui/TimeField.tsx'
import { Big, Button, Eyebrow, Link, T, useTheme } from '../ui/kit.tsx'
import type { AgeChange } from '../lib/guide.ts'
import { TAB_H } from './Tabs.tsx'
import { AskCard, ChairCard, ChairNote, TripsRow } from './Chair.tsx'

type Props = {
  E: Engine
  g: Gate
  onBuy: () => void
  // Starts the free week on an iPhone whose parent said Not now in setup.
  onWeek: () => void
  onMain: () => void
  onUpForDay: () => void
  onEdit: (id: string) => void
  onNight: () => void
  // Last night's bedtime while the chair method runs: the cot time, asleep, the trips, the pick-ups and a note.
  onBedtime: () => void
  onAdd: () => void
  onMorning: (t: number) => void
  onWake: () => void
  onGap: (a: number, z: number) => void
  // No to a stretch with no nap logged: the list stops asking about it.
  onNoNap: (a: number, z: number) => void
  onOut: () => void
  onType: () => void
  // The chair method, while it runs, and the link that keeps the parent where they sat one more night.
  chair: Chair | null | undefined
  onHold: () => void
  // The button on the note once the day's naps are done: the baby is in the cot for the night.
  onCot: () => void
  // While settling, each time the parent goes over; after it, the crying and anything that made it harder.
  onTrip: () => void
  // While settling, each time the parent picks the baby up, from 14 October 2026.
  onPick: () => void
  // A nap in the cot while the plan runs, and the link that ends its count with no nap, from 1.0.35.
  onNapCot: () => void
  onNapStop: () => void
  // Tonight's plan, from the note through the day and the card at bedtime.
  onPlan: () => void
  // From 1.0.46 the note's two buttons: Yes or No to its question, and Change where I sit.
  onAnswer: (note: DayNote, yes: boolean) => void
  onPlace: () => void
  onCry: (night: string, c: Cry) => void
  onWhy: (night: string, w: Why) => void
  // After a short nap, the way the parent picks to make it up.
  onWay: (day: number, pick: Route, by: number, first: Route) => void
  // One nap fewer a day, or keep the age's naps, from the card the log brings up.
  onFewer: (n: number | null) => void
  // From 1.0.41: the chair line closed until bedtime, the line while the times still come from the
  // age, and the card when the age moves on to the next wake windows.
  hideChair: boolean
  onHideChair: () => void
  learn: string | null
  age: AgeChange | null
  onAgeOk: () => void
  onAgeKeep: () => void
}

export function Today ({ E, g, onBuy, onWeek, onMain, onUpForDay, onEdit, onNight, onBedtime, onAdd, onMorning, onWake, onGap, onNoNap, onOut, onType, chair, onHold, onCot, onTrip, onPick, onNapCot, onNapStop, onPlan, onAnswer, onPlace, onCry, onWhy, onWay, onFewer, hideChair, onHideChair, learn, age, onAgeOk, onAgeKeep }: Props) {
  const t = useTheme(), insets = useSafeAreaInsets()
  const scroll = useRef(new Animated.Value(0)).current
  const h = chairHero(E, chair, hero(E, g), E.now), unknown = E.unknownMorning()
  const card = chairCard(E, chair, E.now), chairNote = chairDay(E, chair, E.now)
  // Tonight's question sits under the timer; last night's waits in the chart in the morning.
  const ask = askAbout(E, chair, E.now), askTonight = !!ask && !!chair && ask.night === tonight(chair, E.now).key
  const askCard = ask ? <AskCard ask={ask} onCry={(c) => onCry(ask.night, c)} onWhy={(w) => onWhy(ask.night, w)} /> : null
  // The wake-up the screen asks for starts at the usual one, or now if that has not come yet.
  const [wake, setWake] = useState<number | null>(null)
  useEffect(() => { if (!h.ask) setWake(null) }, [h.ask])
  const wakeAt = wake ?? Math.min(atMins(E.now, E.baby.wake), Math.floor(E.now / (5 * MIN)) * 5 * MIN)
  const glow = Animated.multiply(scroll.interpolate({ inputRange: [0, 260], outputRange: [1, 0], extrapolate: 'clamp' }), h.glow)

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Animated.View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 560, opacity: glow }}>
        <Svg width="100%" height="100%">
          <Defs>
            <RadialGradient id="glow" cx="40%" cy="38%" rx="75%" ry="45%">
              <Stop offset="0" stopColor={t.glow} stopOpacity={t.name === 'day' ? 0.32 : 0.18} />
              <Stop offset="0.72" stopColor={t.glow} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#glow)" />
        </Svg>
      </Animated.View>
      <Animated.ScrollView
        testID="today"
        contentContainerStyle={{ paddingTop: insets.top + 10, paddingBottom: insets.bottom + TAB_H + 96, paddingHorizontal: 24 }}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scroll } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 10, marginBottom: 30 }}>
          <View>
            <T w="bold" size={19}>{E.baby.name}</T>
            <T size={14} color={t.muted} style={{ marginTop: 2 }}>{ageLine(E)}</T>
          </View>
        </View>

        {age ? <AgeCard age={age} onOk={onAgeOk} onKeep={onAgeKeep} /> : null}
        <Eyebrow hot={h.hot}>{h.eyebrow}</Eyebrow>
        {h.ask ? (
          <>
            <T w="semibold" size={32} style={{ lineHeight: 36, letterSpacing: -0.6, marginTop: 8, marginBottom: 14 }}>{h.ask}</T>
            {h.sub ? <T size={17} style={{ lineHeight: 25, maxWidth: 340, marginBottom: 16 }}>{h.sub}</T> : null}
            <TimeField value={wakeAt} onPick={(hh, mm) => setWake(morningAt(E.baby, E.now, hh, mm))} label="Woke up" testID="wake-time" />
            <Button label={h.cta} disabled={wakeAt > E.now} onPress={() => { onMorning(wakeAt); setWake(null) }} style={{ marginTop: 30 }} />
            <Chips onType={onType} />
            <Link center label={`${E.baby.name} is asleep now`} onPress={onMain} />
          </>
        ) : h.heading ? (
          <>
            <T w="semibold" size={32} style={{ lineHeight: 36, letterSpacing: -0.6, marginTop: 8, marginBottom: 14 }}>{h.heading}</T>
            <T size={17} style={{ lineHeight: 25, maxWidth: 340 }}>{h.sub}</T>
            <Button label={h.buy} alt onPress={g.kind === 'offer' ? onWeek : onBuy} style={{ marginTop: 26 }} />
            <TimerBlock h={h} onMain={onMain} />
            {card ? <ChairCard card={card} onHold={onHold} /> : null}
            <Chips onType={onType} />
            {chairNote && (!hideChair || chairNote.ask) ? <ChairNote note={chairNote} onCot={onCot} onPlan={onPlan} onClose={onHideChair} onAnswer={(yes) => onAnswer(chairNote, yes)} onPlace={onPlace} /> : null}
          </>
        ) : (
          <>
            {h.run == null ? (
              <>
                <View style={{ marginTop: 8, marginBottom: 14 }}><Big parts={h.big} size={86} /></View>
                <T size={17} style={{ lineHeight: 25, maxWidth: 340 }}>{h.sub}</T>
                {h.note ? <T size={14} color={t.muted} style={{ marginTop: 14 }}>{h.note}</T> : null}
                {learn ? <Learning text={learn} /> : null}
                {h.ways ? <WaysCard ways={h.ways} onPick={(id) => onWay(h.ways!.day, id, h.ways!.by, h.ways!.opts[0].id)} /> : null}
                {h.fewer ? <FewerCard fewer={h.fewer} onPick={(id) => onFewer(id === 'fewer' ? h.fewer!.n : null)} /> : null}
              </>
            ) : null}
            <TimerBlock h={h} onMain={onMain} />
            {h.wake ? <WakeCard w={h.wake} name={E.baby.name} /> : null}
            {h.settling && !h.nap ? <TripsRow n={h.trips ?? 0} picks={h.picks ?? 0} name={E.baby.name} onPress={onTrip} onPick={onPick} /> : null}
            {h.napLink ? <Link center label={h.napLink} onPress={onNapCot} /> : null}
            {h.stop ? <Link center label={h.stop} onPress={onNapStop} /> : null}
            {askTonight ? askCard : null}
            {card ? <ChairCard card={card} onHold={onHold} /> : null}
            {h.upForDay ? <Link center label={`${E.baby.name} is up for the day`} onPress={onUpForDay} /> : null}
            {/* Under the timer from 1.0.28, where the line about the free week sat. That line follows it.
                From 1.0.41 it is a button beside going out. From 1.0.44 the chair method's day card
                sits under the two buttons, so it never pushes them down the screen. */}
            <Chips onType={onType} out={h.outLink} onOut={onOut} />
            {h.shop ? <T size={14} color={t.muted} style={{ marginTop: 4, lineHeight: 20 }}>{h.shop}</T> : null}
            {chairNote && (!hideChair || chairNote.ask) ? <ChairNote note={chairNote} onCot={onCot} onPlan={onPlan} onClose={onHideChair} onAnswer={(yes) => onAnswer(chairNote, yes)} onPlace={onPlace} /> : null}
          </>
        )}

        {unknown ? null : <TodaySection E={E} g={g} chair={chair} onEdit={onEdit} onNight={onNight} onBedtime={onBedtime} onAdd={onAdd} onWake={onWake} onGap={onGap} onNoNap={onNoNap} onOut={onOut} />}
      </Animated.ScrollView>
    </View>
  )
}

// The timer: a round button beside its words. Tap it when the baby falls asleep and it counts,
// tap it again when the baby wakes. While a sleep runs a ring round the button fills once a minute
// and the count moves every second, so one glance shows it is on. It
// replaced the 216 wide circle of 1.0.5 on 7 October 2026.
const BTN = 76, RING = BTN + 14, R = RING / 2 - 3, C = 2 * Math.PI * R

function TimerBlock ({ h, onMain }: { h: ChairHero; onMain: () => void }) {
  return (
    <View style={{ marginTop: h.run != null ? 18 : 28 }}>
      {h.run != null ? <T size={17} style={{ lineHeight: 25, marginBottom: 16 }}>{h.sub}</T> : null}
      <Timer run={h.run} caption={h.caption} onPress={onMain} settling={!!h.settling} />
    </View>
  )
}

// While the baby settles in the cot for the chair method, the ring is honey and the button is a
// moon, and the next tap is the baby asleep.
function Timer ({ run, caption, onPress, settling }: { run: number | null; caption: string; onPress: () => void; settling: boolean }) {
  const t = useTheme()
  const [, setTick] = useState(0)
  useEffect(() => {
    if (run == null) return
    const id = setInterval(() => setTick(Date.now()), 250)
    return () => clearInterval(id)
  }, [run])
  const ms = run == null ? 0 : Math.max(0, Date.now() - run), sec = Math.floor(ms / 1000)
  // Hours, minutes and seconds every time, so a count of six minutes never reads as 6 o'clock.
  const hh = Math.floor(sec / 3600), mm = String(Math.floor(sec / 60) % 60).padStart(2, '0'), ss = String(sec % 60).padStart(2, '0')
  return (
    <Pressable testID="timer" accessibilityRole="button" accessibilityLabel={run == null ? 'Start the timer' : settling ? 'Fell asleep' : 'Stop the timer'} onPress={onPress}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 16, opacity: pressed ? 0.8 : 1 })}>
      <View style={{ width: RING, height: RING, alignItems: 'center', justifyContent: 'center' }}>
        {run != null ? (
          <Svg width={RING} height={RING} style={{ position: 'absolute', top: 0, left: 0 }}>
            <Circle cx={RING / 2} cy={RING / 2} r={R} stroke={t.line} strokeWidth={4} fill="none" />
            <Circle cx={RING / 2} cy={RING / 2} r={R} stroke={settling ? t.honey : t.sleep} strokeWidth={4} fill="none" strokeLinecap="round"
              strokeDasharray={`${C} ${C}`} strokeDashoffset={C * (1 - (ms % 60000) / 60000)} transform={`rotate(-90 ${RING / 2} ${RING / 2})`} />
          </Svg>
        ) : null}
        <View style={{ width: BTN, height: BTN, borderRadius: BTN / 2, backgroundColor: t.btn, alignItems: 'center', justifyContent: 'center' }}>
          {run == null
            ? <Svg width={26} height={30} viewBox="0 0 34 38" style={{ marginLeft: 5 }}><Path d="M5 4.2v29.6a2.2 2.2 0 0 0 3.3 1.9l23.6-14.8a2.2 2.2 0 0 0 0-3.8L8.3 2.3A2.2 2.2 0 0 0 5 4.2z" fill={t.btnInk} /></Svg>
            : settling
              ? <Svg width={26} height={26} viewBox="0 0 24 24"><Path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" fill={t.btnInk} /></Svg>
              : <View style={{ width: 22, height: 22, borderRadius: 4, backgroundColor: t.btnInk }} />}
        </View>
      </View>
      <View style={{ flex: 1 }}>
        {run == null
          ? <T w="semibold" size={26}>Start</T>
          : <Text accessibilityRole="timer" accessibilityLabel={plain(runParts(ms).parts)}
              style={{ fontFamily: F.light, fontSize: hh >= 10 ? 38 : 42, lineHeight: 48, letterSpacing: -1.2, color: t.ink, fontVariant: ['tabular-nums'] }}>{`${hh}:${mm}:${ss}`}</Text>}
        <T size={15} color={t.muted} style={{ marginTop: 2, lineHeight: 21 }}>{caption}</T>
      </View>
    </Pressable>
  )
}

// A line, then two choices, each with what the rest of today would be. A tap picks one.
function Choices<I extends string> ({ id, say, opts, onPick }: { id: string; say: string; opts: { id: I; title: string; line: string; on?: boolean }[]; onPick: (id: I) => void }) {
  const t = useTheme()
  return (
    <View testID={id} style={{ marginTop: 22 }}>
      <T size={15} color={t.muted} style={{ lineHeight: 21, marginBottom: 10 }}>{say}</T>
      <View style={{ gap: 10 }}>
        {opts.map((o) => (
          <Pressable key={o.id} testID={`${id}-${o.id}`} accessibilityRole="button" accessibilityLabel={o.title} accessibilityHint={o.line} accessibilityState={{ selected: !!o.on }} onPress={() => onPick(o.id)}
            style={({ pressed }) => ({ paddingVertical: 14, paddingHorizontal: 18, borderRadius: 18, backgroundColor: t.soft, borderWidth: 2, borderColor: o.on ? t.ink : 'transparent', opacity: pressed ? 0.8 : 1 })}>
            <T w="semibold" size={17}>{o.title}</T>
            <T size={15} color={t.muted} style={{ marginTop: 2, lineHeight: 21 }}>{o.line}</T>
          </Pressable>
        ))}
      </View>
    </View>
  )
}

// After a short nap: two ways to make it up, each with the next nap and tonight's bedtime. A tap
// picks one and the day follows it.
const WaysCard = ({ ways, onPick }: { ways: Ways; onPick: (id: Route) => void }) => <Choices id="way" say={ways.say} opts={ways.opts} onPick={onPick} />

// One nap fewer, when the log shows it on most of the last five days. A tap on either settles it
// for a week, and Settings keeps the choice.
const FewerCard = ({ fewer, onPick }: { fewer: Fewer; onPick: (id: 'fewer' | 'keep') => void }) => <Choices id="fewer" say={fewer.say} opts={fewer.opts} onPick={onPick} />

// Under the timer while a nap runs late: the time to wake the baby so the naps end when the
// parent set them to.
function WakeCard ({ w, name }: { w: NonNullable<ChairHero['wake']>; name: string }) {
  const t = useTheme()
  return (
    <View testID="wake-card" style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 22, paddingVertical: 14, paddingHorizontal: 18, borderRadius: 18, backgroundColor: t.soft }}>
      <View>
        <T size={14} color={t.muted}>{w.now ? 'Optional wake' : 'Optional wake at'}</T>
        {w.now ? <T w="light" size={32} style={{ lineHeight: 38 }}>Now</T> : <Big parts={bigTime(w.at)} size={32} unit={14} />}
      </View>
      <T size={15} color={t.muted} style={{ flexShrink: 1, textAlign: 'right' }}>{w.left}</T>
    </View>
  )
}

function Heading ({ children }: { children: string }) {
  return <View style={{ marginTop: 44, marginBottom: 10 }}><Eyebrow>{children}</Eyebrow></View>
}

// The day's graph: the sleeps, the naps planned, the time out and any stretch with no nap logged.
export function Ribbon ({ r, keys = true }: { r: RibbonData; keys?: boolean }) {
  const t = useTheme()
  return (
    <View>
      <View style={{ height: 26, borderRadius: 8, backgroundColor: t.soft, marginTop: 18, marginBottom: 6 }}>
        {r.blocks.map((b, i) => (
          <View key={i} style={{ position: 'absolute', top: 0, bottom: 0, left: `${b.s}%`, width: `${Math.max(1.2, b.e - b.s)}%` }}>
            <View style={{
              flex: 1, marginRight: 2, borderRadius: 6,
              backgroundColor: b.gap ? 'transparent' : b.out ? t.honeySoft : b.plan ? t.sleepPlan : b.run ? t.sleepRun : t.sleep,
              borderWidth: b.plan || b.gap ? 1.5 : 0, borderStyle: 'dashed', borderColor: b.gap ? t.honey : t.sleep,
            }} />
          </View>
        ))}
      </View>
      <View style={{ height: 18, marginBottom: 12 }}>
        {r.labels.map((l, i) => (
          <T key={i} size={12.5} w={l.plan || l.out ? 'semibold' : 'regular'} color={l.out ? t.honeyText : l.plan ? t.ink : t.muted}
            style={l.edge === 'r' ? { position: 'absolute', right: 0, top: 0 } : { position: 'absolute', left: `${l.at}%`, top: 0 }}>{l.text}</T>
        ))}
      </View>
      {keys || r.gaps || r.outs ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 18, rowGap: 8, marginBottom: keys ? 0 : 10 }}>
        <Key label="Slept" />
        {r.planned ? <Key label="Planned naps" kind="plan" /> : null}
        {r.outs ? <Key label="Out" kind="out" /> : null}
        {r.gaps ? <Key label="No nap logged" kind="gap" /> : null}
      </View> : null}
    </View>
  )
}

function Key ({ label, kind }: { label: string; kind?: 'plan' | 'out' | 'gap' }) {
  const t = useTheme()
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
      <View style={{
        width: 16, height: 9, borderRadius: 5,
        backgroundColor: kind === 'gap' ? 'transparent' : kind === 'out' ? t.honeySoft : kind === 'plan' ? t.sleepPlan : t.sleep,
        borderWidth: kind === 'plan' || kind === 'gap' ? 1.5 : 0, borderStyle: 'dashed', borderColor: kind === 'gap' ? t.honey : t.sleep,
      }} />
      <T size={13} color={t.muted}>{label}</T>
    </View>
  )
}

// From 1.0.41 the day's sleep and today's list are one card: the total against the aim, the graph,
// the line about what is left, then the list.
function TodaySection ({ E, g, chair, onEdit, onNight, onBedtime, onAdd, onWake, onGap, onNoNap, onOut }: { E: Engine; g: Gate; chair: Chair | null | undefined; onEdit: (id: string) => void; onNight: () => void; onBedtime: () => void; onAdd: () => void; onWake: () => void; onGap: (a: number, z: number) => void; onNoNap: (a: number, z: number) => void; onOut: () => void }) {
  const t = useTheme(), d = daySleep(E, g)
  const { heading, rows: list } = todayRows(E, g), bed = bedtimeRow(E, chair)
  // Bedtime goes just above Last night, while the chair method covers last night.
  const rows = bed ? list.flatMap((r) => (r.night ? [bed, r] : [r])) : list
  return (
    <View testID="today-card" style={{ marginTop: 30, backgroundColor: t.name === 'day' ? '#FFFFFF' : t.soft, borderRadius: 22, paddingHorizontal: 18, paddingTop: 16, paddingBottom: 6 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
        <T w="bold" size={18}>{heading}</T>
        <T size={14} color={t.muted} style={{ flexShrink: 1, textAlign: 'right' }}>{`${plain(d.so)} ${d.of} day sleep`}</T>
      </View>
      <Ribbon r={d} keys={false} />
      <T size={15} style={{ lineHeight: 21, marginBottom: 12 }}>{d.say}</T>
      <Rows rows={rows} onNo={(r) => onNoNap(r.gap![0], r.gap![1])} onPress={(r) => (r.bed ? onBedtime : r.night ? onNight : r.wake ? onWake : r.gap ? () => onGap(r.gap![0], r.gap![1]) : r.out ? onOut : r.edit ? () => onEdit(r.edit!) : null)} />
      <Link center label="Add a sleep you missed" onPress={onAdd} />
    </View>
  )
}

// Under the timer from 1.0.41: typing the day in, and planning the naps around going out, side by
// side. The second carries the whole question for a screen reader.
function Chips ({ onType, out, onOut }: { onType: () => void; out?: string | null; onOut?: () => void }) {
  const t = useTheme()
  const chip = (label: string, a11y: string, onPress: () => void) => (
    <Pressable accessibilityRole="button" accessibilityLabel={a11y} onPress={onPress}
      style={({ pressed }) => ({ backgroundColor: t.soft, borderRadius: 18, paddingVertical: 9, paddingHorizontal: 14, opacity: pressed ? 0.7 : 1 })}>
      <T w="semibold" size={14.5}>{label}</T>
    </Pressable>
  )
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 22 }}>
      {chip('Type what happened', 'Type what happened', onType)}
      {out && onOut ? chip(out.split('?')[0] + '?', out, onOut) : null}
    </View>
  )
}

// While the nap times still come from the age: which of the first 3 days of naps this is.
function Learning ({ text }: { text: string }) {
  const t = useTheme(), n = Number(/day (\d)/.exec(text)?.[1] ?? 1)
  return (
    <View testID="learning" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', backgroundColor: t.soft, borderRadius: 14, paddingVertical: 6, paddingHorizontal: 11, marginTop: 14 }}>
      <View style={{ flexDirection: 'row', gap: 3 }}>{[1, 2, 3].map((k) => <View key={k} style={{ width: 14, height: 5, borderRadius: 3, backgroundColor: k <= n ? t.sleep : t.line }} />)}</View>
      <T w="semibold" size={13}>{text}</T>
    </View>
  )
}

// The card when the age moves on to the next wake windows. Sounds good keeps the new times, and the
// link keeps the old ones for a week, after which the card asks again.
function AgeCard ({ age, onOk, onKeep }: { age: AgeChange; onOk: () => void; onKeep: () => void }) {
  const t = useTheme()
  return (
    <View testID="age-card" style={{ backgroundColor: t.name === 'day' ? '#FFFFFF' : t.soft, borderRadius: 22, padding: 18, gap: 10, marginBottom: 28 }}>
      <T w="bold" size={20}>{age.title}</T>
      {age.lines.map((x, i) => <T key={i} size={16} style={{ lineHeight: 23 }}>{x}</T>)}
      <Button label="Sounds good" onPress={onOk} style={{ marginTop: 6 }} />
      <Link center label="Not ready yet? Keep the old times for a week" onPress={onKeep} />
    </View>
  )
}

// One answer to the question a row asks.
function Answer ({ label, a11y, onPress }: { label: string; a11y: string; onPress: () => void }) {
  const t = useTheme()
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={a11y} onPress={onPress} hitSlop={6}
      style={({ pressed }) => ({ minWidth: 76, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 22, backgroundColor: t.soft, alignItems: 'center', opacity: pressed ? 0.7 : 1 })}>
      <T w="semibold" size={15.5}>{label}</T>
    </Pressable>
  )
}

export function Rows ({ rows, onPress, onNo }: { rows: ReturnType<typeof todayRows>['rows']; onPress?: (r: ReturnType<typeof todayRows>['rows'][number]) => (() => void) | null; onNo?: (r: ReturnType<typeof todayRows>['rows'][number]) => void }) {
  const t = useTheme()
  return (
    <View style={{ borderTopWidth: 1, borderTopColor: t.line }}>
      {rows.map((r, i) => {
        const gap = r.mark === 'gap', out = r.mark === 'out', quiet = r.mark === 'plan' || r.mark === 'next'
        // A stretch with no nap logged asks whether the baby napped, and Yes and No answer it. Yes
        // opens the nap to add, and No takes the row away.
        const yes = gap && onPress ? onPress(r) : null
        if (gap && yes && onNo) return (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: t.line }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, marginTop: 6, borderWidth: 1.5, borderColor: t.honey, borderStyle: 'dashed' }} />
            <View style={{ flex: 1, gap: 2 }}>
              <T w="semibold" size={16} color={t.honeyText}>{r.title}</T>
              <T size={14} color={t.muted}>{r.sub}</T>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 10, marginBottom: 2 }}>
                <Answer label="Yes" a11y={`${r.title}, Yes`} onPress={yes} />
                <Answer label="No" a11y={`${r.title}, No`} onPress={() => onNo(r)} />
              </View>
            </View>
          </View>
        )
        const body = (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: t.line }}>
            <View style={{
              width: 10, height: 10, borderRadius: 5,
              backgroundColor: r.mark === 'done' ? t.sleep : out ? t.honey : 'transparent',
              borderWidth: 1.5, borderColor: gap || out ? t.honey : r.mark === 'edge' ? t.muted : t.sleep, borderStyle: quiet || gap ? 'dashed' : 'solid',
            }} />
            <View style={{ flex: 1, gap: 2 }}>
              <T w={r.mark === 'plan' ? 'medium' : 'semibold'} size={16} color={gap ? t.honeyText : r.mark === 'plan' ? t.muted : t.ink}>{r.title}</T>
              {r.sub ? <T size={14} color={t.muted}>{r.sub}</T> : null}
            </View>
            <T size={15} w={gap ? 'bold' : 'regular'} color={gap ? t.honeyText : quiet ? t.muted : t.ink} style={{ fontVariant: ['tabular-nums'] }}>{r.right}</T>
          </View>
        )
        const press = onPress ? onPress(r) : null
        return press ? <Pressable key={i} accessibilityRole="button" accessibilityLabel={`${r.title}, ${r.right}`} onPress={press}>{body}</Pressable> : <View key={i}>{body}</View>
      })}
    </View>
  )
}

// A tap on a past day opens the sheet that marks it as not tracked, on the Menu from 1.0.42.
export function WeekSection ({ E, first, onDay }: { E: Engine; first?: boolean; onDay?: (r: WeekRow) => void }) {
  const t = useTheme(), w = week(E)
  if (w.empty) return (
    <View>
      <Heading>This week</Heading>
      <T size={15.5} color={t.muted} style={{ lineHeight: 22 }}>Your week fills in here as you log, one bar of day sleep for each day.</T>
    </View>
  )
  const pc = (v: number) => `${(v / w.max) * 100}%` as const
  return (
    <View>
      <Heading>This week</Heading>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <View style={{ width: 2, height: 14, backgroundColor: t.ink, opacity: 0.6, borderRadius: 1 }} />
        <T size={13} color={t.muted}>{w.key}</T>
      </View>
      {w.rows.map((r, i) => {
        const body = (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, height: 34 }}>
            <T size={13.5} w={r.today ? 'bold' : 'regular'} color={r.off ? t.muted : undefined} style={{ width: 52, opacity: r.off ? 0.7 : 1 }}>{r.label}</T>
            <View style={{ flex: 1, height: 12, borderRadius: 6, backgroundColor: t.soft, opacity: r.off ? 0.5 : 1 }}>
              {r.off ? null : <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: pc(r.value), borderRadius: 6, backgroundColor: t.sleep }} />}
              <View style={{ position: 'absolute', top: -5, bottom: -5, width: 2, marginLeft: -1, left: pc(w.target), backgroundColor: t.ink, opacity: 0.6, borderRadius: 1 }} />
            </View>
            <T size={13.5} color={t.muted} style={{ width: 84, textAlign: 'right', fontVariant: ['tabular-nums'], opacity: r.off ? 0.7 : 1 }}>{r.text}</T>
          </View>
        )
        return onDay && r.wake != null
          ? <Pressable key={i} testID={`week-day-${i}`} accessibilityRole="button" accessibilityLabel={`${r.label}, ${r.text}`} onPress={() => onDay(r)} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>{body}</Pressable>
          : <View key={i}>{body}</View>
      })}
      {w.avg ? (
        <View style={{ flexDirection: 'row', gap: 18, marginTop: 22 }}>
          <View style={{ flex: 1 }}><Big parts={w.avg.day} size={34} unit={14} /><T size={13.5} color={t.muted} style={{ marginTop: 6 }}>Average day sleep</T></View>
          <View style={{ flex: 1 }}><Big parts={w.avg.night} size={34} unit={14} /><T size={13.5} color={t.muted} style={{ marginTop: 6 }}>Average night sleep</T></View>
        </View>
      ) : null}
    </View>
  )
}
