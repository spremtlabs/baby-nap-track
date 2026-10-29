// The way into the chair method from 1.0.41, 28 October 2026: who it suits, how the nights
// go, whether it works, and when to start. It opens from the Night tab and from setup after Tough.
// Well done for starting follows it, in the sheet the app has had since 11 October 2026.
import { useState } from 'react'
import { Pressable, ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Button, Link, T, useTheme } from '../ui/kit.tsx'
import { ChairPicture } from './Chair.tsx'

type Props = {
  name: string
  // Under six months the line on starting from six months goes on the first screen.
  young: boolean
  // After bedtime, night 1 is tomorrow and Tonight is not offered.
  canTonight: boolean
  onStart: (tomorrow: boolean) => void
  onLater: () => void
  // Back from the first screen: setup's question, or the Night tab.
  onBack: () => void
}

const NIGHTS: [string, string][] = [['Nights 1 to 3', 'Beside the cot'], ['Nights 4 to 6', 'Halfway to the door'], ['Nights 7 to 9', 'Inside the door'], ['Nights 10 to 12', 'In the hall'], ['Night 13', 'Say goodnight and leave']]

export function ChairFlow ({ name, young, canTonight, onStart, onLater, onBack }: Props) {
  const t = useTheme(), insets = useSafeAreaInsets()
  const [step, setStep] = useState(0)
  const Dots = () => <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 18 }}>{[0, 1, 2, 3].map((i) => <View key={i} style={{ width: i === step ? 20 : 7, height: 7, borderRadius: 4, backgroundColor: i === step ? t.ink : t.line }} />)}</View>
  const H = ({ children }: { children: string }) => <T w="semibold" size={30} style={{ lineHeight: 34, letterSpacing: -0.5, marginTop: 18, marginBottom: 12 }}>{children}</T>
  const Body = ({ children, muted }: { children: string; muted?: boolean }) => <T size={17} color={muted ? t.muted : t.ink} style={{ lineHeight: 25, marginBottom: 14 }}>{children}</T>
  const Back = () => <Link label="Back" onPress={() => (step ? setStep(step - 1) : onBack())} style={{ alignSelf: 'flex-start', paddingTop: 0 }} />
  const Choice = ({ label, onPress }: { label: string; onPress: () => void }) => (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
      style={({ pressed }) => ({ backgroundColor: t.soft, borderRadius: 18, paddingVertical: 17, paddingHorizontal: 18, opacity: pressed ? 0.8 : 1 })}>
      <T w="semibold" size={17}>{label}</T>
    </Pressable>
  )
  return (
    <ScrollView testID="chair-flow" style={{ flex: 1, backgroundColor: t.bg }} contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24, paddingHorizontal: 24 }}>
      <Back />
      {step === 0 && (
        <>
          <View style={{ marginTop: 12 }}><ChairPicture place={0} done={0} ranges={['1–3', '4–6', '7–9', '10–12']} /></View>
          <H>Try the chair method!</H>
          <Body>{`Lots of parents use it when cry it out isn't for them. You stay in the room with a chair beside the cot until ${name} falls asleep.`}</Body>
          {young ? <Body muted>The HSE suggests it from six months.</Body> : null}
          <View style={{ flex: 1, minHeight: 20 }} />
          <Dots />
          <Button label="Next" onPress={() => setStep(1)} />
          <Link center label="Maybe later" onPress={onLater} />
        </>
      )}
      {step === 1 && (
        <>
          <H>Every three nights you move a bit closer to the door</H>
          <View style={{ gap: 6 }}>
            {NIGHTS.map(([n, w]) => (
              <View key={n} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: t.soft, borderRadius: 14, paddingVertical: 11, paddingHorizontal: 14 }}>
                <T w="bold" size={13.5} color={t.honeyText} style={{ width: 110 }}>{n}</T>
                <T size={16} style={{ flexShrink: 1 }}>{w}</T>
              </View>
            ))}
          </View>
          <View style={{ height: 14 }} />
          <Body muted>{`You use the chair at bedtime only. In the night, settle ${name} the way you usually do.`}</Body>
          <View style={{ flex: 1, minHeight: 20 }} />
          <Dots />
          <Button label="Next" onPress={() => setStep(2)} />
        </>
      )}
      {step === 2 && (
        <>
          <H>Does it work?</H>
          <View style={{ gap: 8 }}>
            <View style={{ backgroundColor: t.soft, borderRadius: 16, padding: 14 }}>
              <T w="bold" size={18}>49 of 52 studies</T>
              <T size={15.5} style={{ lineHeight: 22 }}>found sleep training made bedtimes easier and cut night wakings.</T>
            </View>
            <View style={{ backgroundColor: t.soft, borderRadius: 16, padding: 14 }}>
              <T w="bold" size={18}>All four studies</T>
              <T size={15.5} style={{ lineHeight: 22 }}>that tested sleep training with a parent in the room found it worked.</T>
            </View>
          </View>
          <View style={{ flex: 1, minHeight: 20 }} />
          <Dots />
          <Button label="Next" onPress={() => setStep(3)} />
        </>
      )}
      {step === 3 && (
        <>
          <H>When would you like to start?</H>
          <View style={{ gap: 10 }}>
            {canTonight ? <Choice label="Tonight" onPress={() => onStart(false)} /> : null}
            <Choice label="Tomorrow night" onPress={() => onStart(true)} />
          </View>
          <View style={{ height: 16 }} />
          <Body muted>{"We'll tell you where to sit and what to do each night."}</Body>
          <View style={{ flex: 1, minHeight: 20 }} />
          <Dots />
        </>
      )}
    </ScrollView>
  )
}
