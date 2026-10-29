// The three tabs along the bottom from 1.0.41, 28 October 2026: Today, Night and Menu.
// Night holds last night and the chair method. Menu holds the week, why the times are what they
// are, and Settings.
import { Pressable, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Circle, Path } from 'react-native-svg'
import { T, useTheme } from '../ui/kit.tsx'

export type Tab = 'today' | 'night' | 'menu'
// The height of the bar above the phone's own inset, which the help button and toasts sit above.
export const TAB_H = 62

export function Tabs ({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void }) {
  const t = useTheme(), insets = useSafeAreaInsets()
  const item = (id: Tab, label: string, icon: (c: string) => React.ReactNode) => {
    const on = tab === id, c = on ? t.ink : t.muted
    return (
      <Pressable key={id} testID={`tab-${id}`} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: on }} onPress={() => onTab(id)}
        style={({ pressed }) => ({ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, paddingTop: 9, paddingBottom: 6, opacity: pressed ? 0.7 : 1 })}>
        {icon(c)}
        <T size={12} w={on ? 'bold' : 'medium'} color={c}>{label}</T>
      </Pressable>
    )
  }
  return (
    <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', paddingHorizontal: 12, paddingBottom: insets.bottom, minHeight: TAB_H + insets.bottom, backgroundColor: t.bg, borderTopWidth: 1, borderTopColor: t.line }}>
      {item('today', 'Today', (c) => (
        <Svg width={22} height={22} viewBox="0 0 24 24"><Circle cx={12} cy={12} r={5} fill={c} /><Path d="M12 1v3M12 20v3M1 12h3M20 12h3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" stroke={c} strokeWidth={2} strokeLinecap="round" /></Svg>
      ))}
      {item('night', 'Night', (c) => (
        <Svg width={22} height={22} viewBox="0 0 24 24"><Path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" fill={c} /></Svg>
      ))}
      {item('menu', 'Menu', (c) => (
        <Svg width={22} height={22} viewBox="0 0 24 24"><Path d="M4 7h16M4 12h16M4 17h16" stroke={c} strokeWidth={2.2} strokeLinecap="round" /></Svg>
      ))}
    </View>
  )
}
