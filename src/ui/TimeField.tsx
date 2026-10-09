// A time the parent taps to set with the phone's own clock. On the web build it is the browser's
// time field laid over the number, so the gate can set it.
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker'
import { createElement } from 'react'
import { Platform, Pressable, View } from 'react-native'
import { hm } from '../lib/words.ts'
import { Big, useTheme } from './kit.tsx'

const pad = (n: number) => String(n).padStart(2, '0')

export function TimeField ({ value, onPick, label, size = 46, testID }: { value: number; onPick: (h: number, m: number) => void; label: string; size?: number; testID?: string }) {
  const t = useTheme(), x = hm(value), d = new Date(value)
  const parts = [{ n: x.t }, { u: x.ap }]
  const box = { alignSelf: 'flex-start' as const, backgroundColor: t.soft, borderRadius: size > 36 ? 16 : 12, paddingHorizontal: size > 36 ? 18 : 12, paddingTop: size > 36 ? 8 : 4, paddingBottom: size > 36 ? 10 : 6 }
  if (Platform.OS === 'web') {
    return (
      <View style={box}>
        <Big parts={parts} size={size} unit={size > 36 ? 16 : 14} />
        {createElement('input', {
          type: 'time', 'aria-label': label, 'data-testid': testID, value: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
          onChange: (e: { target: { value: string } }) => { const [h, m] = e.target.value.split(':').map(Number); if (!Number.isNaN(h) && !Number.isNaN(m)) onPick(h, m) },
          onClick: (e: { currentTarget: { showPicker?: () => void } }) => { try { e.currentTarget.showPicker?.() } catch {} },
          style: { position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', border: 0, padding: 0 },
        })}
      </View>
    )
  }
  if (Platform.OS === 'ios') {
    return <DateTimePicker testID={testID} value={d} mode="time" onChange={(_, v) => v && onPick(v.getHours(), v.getMinutes())} accessibilityLabel={label} />
  }
  const open = () => DateTimePickerAndroid.open({ value: d, mode: 'time', is24Hour: false, onChange: (ev, v) => { if (ev.type === 'set' && v) onPick(v.getHours(), v.getMinutes()) } })
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={`${label}, ${x.t}${x.ap}. Change`} onPress={open}
      style={({ pressed }) => [box, { opacity: pressed ? 0.7 : 1 }]}>
      <Big parts={parts} size={size} unit={size > 36 ? 16 : 14} />
    </Pressable>
  )
}
