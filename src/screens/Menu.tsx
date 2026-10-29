// The Menu tab from 1.0.41, 28 October 2026: the week, the pages about the baby's naps,
// and Settings. Why the next nap is when it is moved here from under the nap time.
import { useState } from 'react'
import { Pressable, ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { BANDS, MIN, ageText, band, withSkipDay, type Engine } from '../lib/engine.ts'
import { whyNap } from '../lib/guide.ts'
import { ageLine, type WeekRow } from '../lib/model.ts'
import { useStore } from '../lib/store.tsx'
import { dur } from '../lib/words.ts'
import { Button, Eyebrow, Link, Pill, Sheet, T, useTheme } from '../ui/kit.tsx'
import { TAB_H } from './Tabs.tsx'
import { WeekSection } from './Today.tsx'

type Props = { E: Engine; onSettings: () => void; onWindows: () => void; onAsk: (text: string) => void }

export function Menu ({ E, onSettings, onWindows, onAsk }: Props) {
  const t = useTheme(), insets = useSafeAreaInsets(), N = E.baby.name
  const st = useStore()
  const [open, setOpen] = useState<null | 'why' | 'grow'>(null)
  // The past day tapped in the week, for the sheet that marks it as not tracked.
  const [day, setDay] = useState<WeekRow | null>(null)
  const dayLogged = day ? E.loggedDays().find((d) => d.wake === day.wake) : undefined
  const markDay = () => {
    if (!day || day.wake == null) return
    st.setBaby({ skipDays: withSkipDay(E.baby, day.wake, !day.off, E.now) })
    setDay(null)
  }
  const why = whyNap(E)
  const Row = ({ label, value, onPress, id }: { label: string; value?: string; onPress: () => void; id?: string }) => (
    <Pressable testID={id} accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
      style={({ pressed }) => ({ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: t.line, opacity: pressed ? 0.7 : 1 })}>
      <T size={16} style={{ flexShrink: 1 }}>{label}</T>
      <T size={16} color={t.muted}>{value ?? '›'}</T>
    </Pressable>
  )
  // What changes as the baby grows: the age's wake windows now, and the next age's.
  const wk = E.age(), b = band(wk), next = BANDS[BANDS.indexOf(b) + 1], months = Math.max(1, Math.round(b.w / 4.345))
  const nap = (n: number) => (n === 1 ? '1 nap' : `${n} naps`)
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView testID="menu" contentContainerStyle={{ paddingTop: insets.top + 20, paddingBottom: insets.bottom + TAB_H + 40, paddingHorizontal: 24 }}>
        <T w="bold" size={19}>Menu</T>
        <T size={14} color={t.muted} style={{ marginTop: 2 }}>{N}, {ageLine(E)}</T>
        <WeekSection E={E} first onDay={setDay} />
        <View style={{ marginTop: 40, marginBottom: 2 }}><Eyebrow>{`${N}'s naps`}</Eyebrow></View>
        <View style={{ borderTopWidth: 1, borderTopColor: t.line }}>
          <Row id="menu-why" label={why.title.startsWith('Why') ? `Why the next nap is at ${why.title.slice(4, -1)}` : why.title} onPress={() => setOpen('why')} />
          <Row id="menu-grow" label={`How naps change as ${N} grows`} onPress={() => setOpen('grow')} />
        </View>
        <View style={{ marginTop: 32, marginBottom: 2 }}><Eyebrow>Settings</Eyebrow></View>
        <View style={{ borderTopWidth: 1, borderTopColor: t.line }}>
          <Row id="menu-settings" label="Settings" onPress={onSettings} />
        </View>
      </ScrollView>

      <Sheet open={open === 'why'} onClose={() => setOpen(null)} foot={<Button label="Close" onPress={() => setOpen(null)} />}>
        <View testID="why-sheet" style={{ gap: 12 }}>
          <T w="bold" size={24}>{why.title}</T>
          {why.lines.map((x, i) => <T key={i} size={16.5} style={{ lineHeight: 24 }}>{x}</T>)}
          <View style={{ marginTop: 6 }}><Pill label={`Change ${N}'s wake windows`} onPress={() => { setOpen(null); onWindows() }} /></View>
          <Link label="Still have a question? Ask us!" onPress={() => { setOpen(null); onAsk(`${why.title} `) }} />
        </View>
      </Sheet>
      <Sheet open={day != null} onClose={() => setDay(null)}>
        {day && day.wake != null ? (
          <View testID="day-sheet" style={{ gap: 12 }}>
            <T w="bold" size={24}>{new Date(day.wake).toLocaleDateString('en-IE', { weekday: 'long', day: 'numeric', month: 'long' })}</T>
            <T size={16.5} style={{ lineHeight: 24 }}>{`${dur(dayLogged?.day ?? 0)} of naps logged.`}</T>
            <T size={16.5} style={{ lineHeight: 24 }}>{day.off
              ? `This day is out of ${N}'s averages and nap times. The naps are still in the log.`
              : `If you didn't track this day, it comes out of ${N}'s averages and nap times. The naps stay in the log.`}</T>
            <View style={{ marginTop: 8 }}><Button label={day.off ? 'Count this day again' : "We didn't track this day"} onPress={markDay} /></View>
            <Link center label="Close" onPress={() => setDay(null)} />
          </View>
        ) : null}
      </Sheet>
      <Sheet open={open === 'grow'} onClose={() => setOpen(null)} foot={<Button label="Close" onPress={() => setOpen(null)} />}>
        <View testID="grow-sheet" style={{ gap: 12 }}>
          <T w="bold" size={24}>{`How naps change as ${N} grows`}</T>
          <T size={16.5} style={{ lineHeight: 24 }}>{`At ${ageText(E.baby, E.now)}, most babies stay awake for ${dur(b.min * MIN)} to ${dur(b.max * MIN)} between naps and have ${nap(b.naps)} a day.`}</T>
          {next ? <T size={16.5} style={{ lineHeight: 24 }}>{`From ${months} months it's ${dur(next.min * MIN)} to ${dur(next.max * MIN)}, with ${nap(next.naps)} a day. We'll tell you the morning it changes.`}</T> : null}
        </View>
      </Sheet>
    </View>
  )
}
