// The last screen of setup from 1.0.41: the first nap time, the one the welcome screens promised.
// Go to Today closes it. With no nap time to give, such as a locked phone, it closes itself.
import { useEffect } from 'react'
import { View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { Engine } from '../lib/engine.ts'
import { hero } from '../lib/model.ts'
import type { Gate } from '../lib/shop.ts'
import { Big, Button, Eyebrow, T, useTheme } from '../ui/kit.tsx'

export function FirstNap ({ E, g, onDone }: { E: Engine; g: Gate; onDone: () => void }) {
  const t = useTheme(), insets = useSafeAreaInsets(), h = hero(E, g), N = E.baby.name
  const show = !h.ask && !h.heading && h.run == null && h.big.some((p) => p.u === 'am' || p.u === 'pm')
  useEffect(() => { if (!show) onDone() }, [show])
  if (!show) return null
  return (
    <View testID="first-nap" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: t.bg, paddingTop: insets.top + 60, paddingBottom: insets.bottom + 30, paddingHorizontal: 24 }}>
      <T w="bold" size={18}>Baby Nap Track</T>
      <View style={{ height: 80 }} />
      <Eyebrow hot>{`${N}'s first nap`}</Eyebrow>
      <View style={{ marginTop: 10, marginBottom: 16 }}><Big parts={h.big} size={86} /></View>
      <T size={17} style={{ lineHeight: 25 }}>{`${h.sub} Tap Start as soon as ${N}'s asleep.`}</T>
      <View style={{ flex: 1 }} />
      <Button label="Go to Today" onPress={onDone} />
    </View>
  )
}
