// The chair method on screen: the picture with the nights under it, the note on Today through
// the day, the card at bedtime, the chart under Today's list, and the sheet that starts it.
import { useState } from 'react'
import { Pressable, View } from 'react-native'
import { SvgXml } from 'react-native-svg'
import { CRY, WHY, tripsSoFar, type Ask, type Card, type Chart, type Cry, type DayNote, type Guide, type Intro, type Why } from '../lib/chair.ts'
import { SCENE_STOPS, chairScene } from '../lib/chairArt.ts'
import { Button, Eyebrow, Link, Sheet, T, useTheme } from '../ui/kit.tsx'

const W = 380, H = 172

// The bedroom at night, with the nights each place covers under it and tonight's in honey.
export function ChairPicture ({ place, done, ranges }: { place: number; done: number; ranges: string[] }) {
  const t = useTheme()
  const [w, setW] = useState(0)
  return (
    <View testID="chair-picture" onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {w ? <SvgXml xml={chairScene(place, done)} width={w} height={(w * H) / W} /> : <View style={{ height: 0 }} />}
      <View style={{ height: 40, marginTop: 6 }}>
        {SCENE_STOPS.map((s, i) => {
          const on = i === place
          return (
            <View key={i} style={{ position: 'absolute', top: 4, left: `${(s.x / W) * 100}%`, width: 76, marginLeft: -38, alignItems: 'center' }}>
              <View style={{ paddingHorizontal: 10, height: 28, borderRadius: 14, justifyContent: 'center', backgroundColor: on ? t.honey : 'transparent' }}>
                <T w={on ? 'bold' : 'semibold'} size={14.5} color={on ? '#151A2C' : t.muted} numberOfLines={1} style={{ fontVariant: ['tabular-nums'] }}>{ranges[i]}</T>
              </View>
            </View>
          )
        })}
      </View>
    </View>
  )
}

// On Today through the day: which night it is, where to sit tonight and when bedtime is.
export function ChairNote ({ note }: { note: DayNote }) {
  const t = useTheme()
  return (
    <View testID="chair-day" style={{ marginTop: -12, marginBottom: 26, backgroundColor: t.soft, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 16, gap: 3 }}>
      <Eyebrow>{note.head}</Eyebrow>
      <T size={15.5} style={{ lineHeight: 22 }}>{note.line}</T>
    </View>
  )
}

// On Today at bedtime, while settling, and when the baby wakes in the night.
export function ChairCard ({ card, onHold }: { card: Card; onHold: () => void }) {
  const t = useTheme()
  return (
    <View style={{ marginTop: 22, backgroundColor: t.soft, borderRadius: 20, paddingTop: 14, paddingHorizontal: 10, paddingBottom: card.hold || card.line ? 4 : 6 }}>
      <View style={{ paddingHorizontal: 4, paddingBottom: 10 }}><Eyebrow>{card.eyebrow}</Eyebrow></View>
      <ChairPicture place={card.place} done={card.done} ranges={card.ranges} />
      {card.line ? <T size={15.5} style={{ paddingHorizontal: 4, paddingBottom: 10, lineHeight: 22 }}>{card.line}</T> : null}
      {card.hold ? (
        <Pressable accessibilityRole="button" onPress={onHold} hitSlop={6} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 4, alignSelf: 'flex-start' }}>
          <T size={15.5} style={{ textDecorationLine: 'underline', textDecorationColor: t.muted }}>{card.hold}</T>
        </Pressable>
      ) : null}
    </View>
  )
}

// Minutes to fall asleep, one bar a night, in the four places the parent sits. Last night's is honey.
export function ChairChart ({ chart, ask, onHold }: { chart: Chart; ask?: React.ReactNode; onHold: () => void }) {
  const t = useTheme(), top = 92
  return (
    <View>
      <View style={{ marginTop: 44, marginBottom: 10 }}><Eyebrow>Chair method</Eyebrow></View>
      {ask}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: t.muted }} />
        <T size={13} color={t.muted}>Minutes to fall asleep, one bar a night</T>
      </View>
      <View style={{ flexDirection: 'row', gap: 14 }}>
        {chart.groups.map((g, i) => (
          <View key={i} style={{ flex: 1, minWidth: 0 }}>
            <View style={{ height: top + 20, flexDirection: 'row', alignItems: 'flex-end', gap: 5, borderBottomWidth: 1.5, borderBottomColor: t.line }}>
              {g.bars.map((b, j) => (
                <View key={j} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end' }}>
                  {b ? (
                    <>
                      <T size={12.5} w="semibold" style={{ marginBottom: 4, fontVariant: ['tabular-nums'] }}>{String(b.min)}</T>
                      <View style={{ alignSelf: 'stretch', height: Math.max(4, Math.round((b.min / chart.max) * top)), borderTopLeftRadius: 7, borderTopRightRadius: 7, borderBottomLeftRadius: 2, borderBottomRightRadius: 2, backgroundColor: b.last ? t.honey : t.muted, opacity: b.last ? 1 : 0.55 }} />
                    </>
                  ) : null}
                </View>
              ))}
            </View>
            <T size={13.5} w="semibold" color={t.muted} style={{ textAlign: 'center', marginTop: 7 }}>{g.label}</T>
          </View>
        ))}
      </View>
      {/* The coach: a heading for last night, what happened, one line of what is known, and on a
          move day the link that keeps the parent where they are. */}
      <View testID="chair-coach" style={{ marginTop: 18, gap: 8 }}>
        {chart.head ? <T w="semibold" size={19} style={{ lineHeight: 26, marginBottom: 2 }}>{chart.head}</T> : null}
        {chart.say.map((x, i) => <T key={i} size={16} style={{ lineHeight: 23 }}>{x}</T>)}
      </View>
      {chart.note ? (
        <View testID="chair-known" style={{ marginTop: 14, backgroundColor: t.soft, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 16 }}>
          <T size={15} style={{ lineHeight: 22 }}>{chart.note}</T>
        </View>
      ) : null}
      {chart.stay ? (
        <View testID="chair-stay" style={{ marginTop: 14 }}>
          <T size={15.5} style={{ lineHeight: 22 }}>{chart.stay.line}</T>
          <Pressable accessibilityRole="button" onPress={onHold} hitSlop={6} style={{ minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }}>
            <T size={15.5} style={{ textDecorationLine: 'underline', textDecorationColor: t.muted }}>{chart.stay.link}</T>
          </Pressable>
        </View>
      ) : null}
    </View>
  )
}

// While the baby settles: each time the parent gets up to pat or shush.
export function TripsRow ({ n, onPress }: { n: number; onPress: () => void }) {
  const t = useTheme()
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 14 }}>
      <Pressable accessibilityRole="button" accessibilityLabel="I went over" onPress={onPress}
        style={({ pressed }) => ({ paddingVertical: 12, paddingHorizontal: 20, borderRadius: 24, backgroundColor: t.soft, opacity: pressed ? 0.7 : 1 })}>
        <T w="semibold" size={16}>I went over</T>
      </Pressable>
      <T size={15} color={t.muted}>{tripsSoFar(n)}</T>
    </View>
  )
}

// After the baby is asleep: how much crying, and anything that made settling harder.
export function AskCard ({ ask, onCry, onWhy }: { ask: Ask; onCry: (c: Cry) => void; onWhy: (w: Why) => void }) {
  const t = useTheme()
  return (
    <View testID="chair-ask" style={{ marginTop: 22, marginBottom: 6, backgroundColor: t.soft, borderRadius: 20, padding: 16, gap: 12 }}>
      <T w="semibold" size={17} style={{ lineHeight: 23 }}>{ask.question}</T>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {CRY.map((c) => (
          <Pressable key={c.value} accessibilityRole="button" onPress={() => onCry(c.value)}
            style={({ pressed }) => ({ flex: 1, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: t.bg, opacity: pressed ? 0.7 : 1 })}>
            <T w="semibold" size={16}>{c.label}</T>
          </Pressable>
        ))}
      </View>
      <T size={14.5} color={t.muted}>Anything making it harder?</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {WHY.map((w) => {
          const on = ask.why.includes(w.value)
          return (
            <Pressable key={w.value} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => onWhy(w.value)}
              style={({ pressed }) => ({ paddingVertical: 9, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1.5, borderColor: on ? t.ink : t.line, backgroundColor: on ? t.ink : 'transparent', opacity: pressed ? 0.7 : 1 })}>
              <T w="medium" size={15} color={on ? t.bg : t.ink}>{w.label}</T>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

// The sheet Settings opens: how the plan goes, what to expect and the button that starts it. Once
// the plan is on it says well done, when bedtime is and the first night step by step, and its
// button goes back to Today. The button stays at the bottom of the sheet while the words scroll.
// Opened again from Settings while the plan runs, it has no button.
export function ChairSheet ({ open, intro, guide, running, onClose, onStart, onDone }: { open: boolean; intro: Intro | null; guide: Guide | null; running: boolean; onClose: () => void; onStart: () => void; onDone: () => void }) {
  const t = useTheme()
  if (!intro) return null
  const first = ['1–3', '4–6', '7–9', '10–12']
  if (guide) {
    return (
      <Sheet key="on" open={open} onClose={onDone} tall foot={<Button label={guide.cta} onPress={onDone} />}>
        <View testID="chair-guide">
          <T w="bold" size={24} style={{ lineHeight: 30, marginBottom: 6 }}>{guide.title}</T>
          <T w="semibold" size={17.5} style={{ lineHeight: 25, marginBottom: 14 }}>{guide.when}</T>
          <ChairPicture place={0} done={0} ranges={first} />
          <View style={{ gap: 12, marginTop: 12 }}>
            {guide.steps.map((x, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: t.soft, alignItems: 'center', justifyContent: 'center', marginTop: -1 }}>
                  <T w="bold" size={14}>{String(i + 1)}</T>
                </View>
                <T size={16.5} style={{ flex: 1, lineHeight: 24 }}>{x}</T>
              </View>
            ))}
          </View>
          <T size={15} color={t.muted} style={{ lineHeight: 21, marginTop: 16 }}>{guide.after}</T>
        </View>
      </Sheet>
    )
  }
  return (
    <Sheet key="intro" open={open} onClose={onClose} tall foot={running ? undefined : <Button label={intro.cta} onPress={onStart} />}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
        <T w="bold" size={22}>Chair method</T>
        <Link label="Back" onPress={onClose} style={{ paddingVertical: 0 }} />
      </View>
      <ChairPicture place={0} done={0} ranges={first} />
      <View style={{ gap: 12, marginTop: 10 }}>
        {intro.steps.map((x, i) => <T key={i} size={16.5} style={{ lineHeight: 24 }}>{x}</T>)}
      </View>
      <View testID="chair-goes" style={{ gap: 10, marginTop: 18, marginBottom: 8, backgroundColor: t.soft, borderRadius: 16, padding: 16 }}>
        {intro.goes.map((x, i) => <T key={i} size={15.5} style={{ lineHeight: 22 }}>{x}</T>)}
      </View>
    </Sheet>
  )
}
