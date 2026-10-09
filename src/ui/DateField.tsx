// A date, picked with the phone's own calendar. On the web build it is the browser's date field.
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker'
import { createElement, useState } from 'react'
import { Keyboard, Platform, Pressable, View } from 'react-native'
import { Button, Sheet, T, useTheme } from './kit.tsx'

const toYmd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const fromYmd = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }
export const sayDate = (s: string) => fromYmd(s).toLocaleDateString('en-IE', { day: 'numeric', month: 'long', year: 'numeric' })

export function DateField ({ value, onChange, placeholder, testID, big }: { value: string; onChange: (v: string) => void; placeholder: string; testID?: string; big?: boolean }) {
  const t = useTheme()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(() => new Date())
  const max = new Date()
  if (Platform.OS === 'web') {
    return createElement('input', {
      type: 'date', value, 'data-testid': testID, max: toYmd(max),
      onChange: (e: { target: { value: string } }) => onChange(e.target.value),
      style: { fontFamily: 'Figtree_400Regular', fontSize: big ? 22 : 16, color: t.ink, background: big ? 'transparent' : t.soft, border: 0, borderBottom: big ? `1.5px solid ${t.line}` : 0, borderRadius: big ? 0 : 10, padding: big ? '10px 0' : '9px 12px', width: big ? '100%' : 172, textAlign: big ? 'left' : 'right', colorScheme: t.name === 'night' ? 'dark' : 'light' },
    })
  }
  // A row in Settings keeps the iPhone's own date box. In setup that box showed today's date before
  // anything was picked, and Next stayed off, so setup shows the same field as Android and opens the
  // iPhone's calendar in a panel.
  if (Platform.OS === 'ios' && !big) {
    return <DateTimePicker testID={testID} value={value ? fromYmd(value) : max} mode="date" maximumDate={max} onChange={(_, d) => d && onChange(toYmd(d))} />
  }
  const pick = () => {
    if (Platform.OS === 'ios') {
      setDraft(value ? fromYmd(value) : max)
      // The iPhone gives the keyboard back to the name box when the panel closes if the box still
      // had it as the panel opened, and the keyboard then covered Next. So the panel waits until the
      // keyboard is down, or half a second at most.
      if (!Keyboard.isVisible()) { Keyboard.dismiss(); setOpen(true); return }
      let shown = false
      const show = () => { if (shown) return; shown = true; sub.remove(); clearTimeout(late); setOpen(true) }
      const sub = Keyboard.addListener('keyboardDidHide', show)
      const late = setTimeout(show, 500)
      Keyboard.dismiss()
      return
    }
    DateTimePickerAndroid.open({ value: value ? fromYmd(value) : max, mode: 'date', maximumDate: max, onChange: (ev, d) => { if (ev.type === 'set' && d) onChange(toYmd(d)) } })
  }
  return (
    <>
      <Pressable testID={testID} accessibilityRole="button" onPress={pick}
        style={big ? { paddingVertical: 10, borderBottomWidth: 1.5, borderBottomColor: t.line } : { backgroundColor: t.soft, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 12, minWidth: 172 }}>
        <View><T size={big ? 22 : 16} color={value ? t.ink : t.muted} style={{ textAlign: big ? 'left' : 'right' }}>{value ? sayDate(value) : placeholder}</T></View>
      </Pressable>
      {Platform.OS === 'ios' ? (
        <Sheet open={open} onClose={() => setOpen(false)}>
          <DateTimePicker testID={testID ? `${testID}-calendar` : undefined} value={draft} mode="date" display="inline" maximumDate={max} accentColor={t.sleep} themeVariant={t.name === 'night' ? 'dark' : 'light'}
            onChange={(_, d) => d && setDraft(d)} style={{ alignSelf: 'center' }} />
          <Button label="Done" style={{ marginTop: 12 }} onPress={() => { onChange(toYmd(draft)); setOpen(false) }} />
        </Sheet>
      ) : null}
    </>
  )
}
