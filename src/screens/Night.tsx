// The Night tab from 1.0.41, 28 October 2026. With the chair method on, it holds tonight's
// plan, the chart of minutes to fall asleep with the morning's coaching, and last night. With it
// off, a card offers the chair method and last night sits under it. It draws in the night colours.
import { ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { askAbout, bedtimeRow, chairChart, nightPlan, tonight, type Chair, type Cry, type Why } from '../lib/chair.ts'
import type { Engine } from '../lib/engine.ts'
import { ageLine, todayRows } from '../lib/model.ts'
import type { Gate } from '../lib/shop.ts'
import { NIGHT_THEME } from '../theme.ts'
import { Button, Link, T, ThemeCtx } from '../ui/kit.tsx'
import { AskCard, ChairChart, ChairPicture, NightPlanView } from './Chair.tsx'
import { TAB_H } from './Tabs.tsx'
import { Rows } from './Today.tsx'

type Props = {
  E: Engine
  g: Gate
  chair: Chair | null | undefined
  onFlow: () => void
  onStop: () => void
  onNight: () => void
  onBedtime: () => void
  onHold: () => void
  // From 1.0.46: Change where I sit, under tonight's plan.
  onPlace: () => void
  onCry: (night: string, c: Cry) => void
  onWhy: (night: string, w: Why) => void
}

export function Night (p: Props) {
  return <ThemeCtx.Provider value={NIGHT_THEME}><NightBody {...p} /></ThemeCtx.Provider>
}

function NightBody ({ E, g, chair, onFlow, onStop, onNight, onBedtime, onHold, onPlace, onCry, onWhy }: Props) {
  const t = NIGHT_THEME, insets = useSafeAreaInsets(), N = E.baby.name, now = E.now
  const plan = chair ? nightPlan(E, chair, now) : null
  const chart = E.unknownMorning() ? null : chairChart(E, chair, now)
  const ask = askAbout(E, chair, now), askTonight = !!ask && !!chair && ask.night === tonight(chair, now).key
  const bed = bedtimeRow(E, chair), night = todayRows(E, g).rows.filter((r) => r.night)
  const rows = bed ? [bed, ...night] : night
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView testID="night" contentContainerStyle={{ paddingTop: insets.top + 20, paddingBottom: insets.bottom + TAB_H + 40, paddingHorizontal: 24 }}>
        <T w="bold" size={19} color={t.ink}>{plan ? 'Tonight' : 'Night'}</T>
        <T size={14} color={t.muted} style={{ marginTop: 2, marginBottom: 22 }}>{plan ? `Chair method, ${plan.head.toLowerCase()}` : `${N}, ${ageLine(E)}`}</T>
        {plan ? <NightPlanView plan={plan} /> : (
          <View style={{ backgroundColor: t.soft, borderRadius: 22, padding: 18, gap: 10 }}>
            <ChairPicture place={0} done={0} ranges={['1–3', '4–6', '7–9', '10–12']} />
            <T w="bold" size={20} style={{ marginTop: 4 }}>Bedtimes tough?</T>
            <T size={15.5} style={{ lineHeight: 22 }}>It takes 13 nights, and you start whenever you're ready.</T>
            <Button label="See how it works" onPress={onFlow} style={{ marginTop: 6 }} />
          </View>
        )}
        {ask && askTonight ? <AskCard ask={ask} onCry={(c) => onCry(ask.night, c)} onWhy={(w) => onWhy(ask.night, w)} /> : null}
        {chart ? <ChairChart chart={chart} ask={ask && !askTonight ? <AskCard ask={ask} onCry={(c) => onCry(ask.night, c)} onWhy={(w) => onWhy(ask.night, w)} /> : null} onHold={onHold} /> : null}
        {rows.length ? (
          <View style={{ marginTop: 30 }}>
            <Rows rows={rows} onPress={(r) => (r.bed ? onBedtime : r.night ? onNight : null)} />
          </View>
        ) : null}
        {plan ? <Link center label="Change where I sit" onPress={onPlace} style={{ marginTop: 18 }} /> : null}
        {plan ? <Link center label="Stop the chair method" onPress={onStop} style={{ paddingTop: 0 }} /> : null}
      </ScrollView>
    </View>
  )
}
