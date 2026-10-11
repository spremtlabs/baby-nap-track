// The few pieces every screen is drawn with.
import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react'
import { Animated, KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, Text, View, type TextStyle, type ViewStyle } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { F, type Theme } from '../theme.ts'
import type { Part } from '../lib/words.ts'

export const ThemeCtx = createContext<Theme | null>(null)
export const useTheme = () => useContext(ThemeCtx)!

export function T ({ children, style, w = 'regular', size = 16, color, numberOfLines }: { children: ReactNode; style?: TextStyle | TextStyle[]; w?: keyof typeof F; size?: number; color?: string; numberOfLines?: number }) {
  const t = useTheme()
  return <Text numberOfLines={numberOfLines} style={[{ fontFamily: F[w], fontSize: size, color: color ?? t.ink }, style as TextStyle]}>{children}</Text>
}

export function Eyebrow ({ children, hot }: { children: ReactNode; hot?: boolean }) {
  const t = useTheme()
  return <T w="bold" size={12.5} color={hot ? t.honeyText : t.muted} style={{ letterSpacing: 1.2, textTransform: 'uppercase' }}>{children}</T>
}

// A big number: figures large and light, units small beside them. In a running count every figure
// is one width, so the number does not shift sideways as the seconds change.
export function Big ({ parts, size, unit = 21 }: { parts: Part[]; size: number; unit?: number }) {
  const t = useTheme(), tab = parts.some((p) => p.s != null)
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap' }} accessible accessibilityLabel={parts.map((p) => p.n ?? p.s ?? p.u).join(' ')}>
      {parts.map((p, i) => p.n != null
        ? <Text key={i} style={{ fontFamily: F.light, fontSize: size, lineHeight: size * 1.08, letterSpacing: -size * 0.04, color: t.ink, fontVariant: tab ? ['tabular-nums'] : [] }}>{p.n}</Text>
        : p.s != null
          ? <Text key={i} style={{ fontFamily: F.light, fontSize: size * 0.47, letterSpacing: -size * 0.01, color: t.muted, fontVariant: ['tabular-nums'] }}>{p.s}</Text>
          : <Text key={i} style={{ fontFamily: F.medium, fontSize: unit, color: t.muted, marginLeft: 5, marginRight: i < parts.length - 1 ? 12 : 0 }}>{p.u}</Text>)}
    </View>
  )
}

export function Button ({ label, onPress, alt, disabled, style }: { label: string; onPress: () => void; alt?: boolean; disabled?: boolean; style?: ViewStyle }) {
  const t = useTheme()
  return (
    <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress}
      style={({ pressed }) => [{ height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: alt ? t.soft : t.btn, opacity: disabled ? 0.35 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }, style]}>
      <T w="semibold" size={19} color={alt ? t.ink : t.btnInk}>{label}</T>
    </Pressable>
  )
}

export function Link ({ label, onPress, center, ink, style }: { label: string; onPress: () => void; center?: boolean; ink?: boolean; style?: ViewStyle }) {
  const t = useTheme()
  return (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={8} style={[{ paddingVertical: 12, alignSelf: center ? 'center' : 'flex-start' }, style]}>
      <T size={15} color={ink ? t.ink : t.muted} style={{ textDecorationLine: 'underline', textDecorationColor: t.line }}>{label}</T>
    </Pressable>
  )
}

export function Pill ({ label, onPress }: { label: string; onPress: () => void }) {
  const t = useTheme()
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => ({ alignSelf: 'flex-start', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 24, backgroundColor: t.soft, opacity: pressed ? 0.7 : 1, marginTop: 4, marginBottom: 8 })}>
      <T w="semibold" size={16}>{label}</T>
    </Pressable>
  )
}

export function StepButton ({ label, a11y, onPress }: { label: string; a11y: string; onPress: () => void }) {
  const t = useTheme()
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={a11y} onPress={onPress}
      style={({ pressed }) => ({ minWidth: 46, height: 42, paddingHorizontal: 8, borderRadius: 12, backgroundColor: t.soft, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}>
      <T w="semibold" size={16}>{label}</T>
    </Pressable>
  )
}

// A setting with a value and two buttons to move it.
export function Stepper ({ label, value, onLess, onMore }: { label: string; value: Part[]; onLess: () => void; onMore: () => void }) {
  const t = useTheme()
  return (
    <View style={[s.row, { borderBottomColor: t.line }]}>
      <View style={{ flex: 1 }}>
        <T size={15} color={t.muted}>{label}</T>
        <Big parts={value} size={32} unit={14} />
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <StepButton label="−" a11y={`${label}, less`} onPress={onLess} />
        <StepButton label="+" a11y={`${label}, more`} onPress={onMore} />
      </View>
    </View>
  )
}

export function Segmented<V extends string | number> ({ options, value, onChange }: { options: { value: V; label: string }[]; value: V; onChange: (v: V) => void }) {
  const t = useTheme()
  return (
    <View style={{ flexDirection: 'row', backgroundColor: t.soft, borderRadius: 12, padding: 3, marginBottom: 14 }}>
      {options.map((o) => {
        const on = o.value === value
        return (
          <Pressable key={String(o.value)} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => onChange(o.value)}
            style={{ flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center', backgroundColor: on ? t.bg : 'transparent' }}>
            <T w={on ? 'bold' : 'medium'} size={15} color={on ? t.ink : t.muted}>{o.label}</T>
          </Pressable>
        )
      })}
    </View>
  )
}

export function Toggle ({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  const t = useTheme()
  return (
    <Pressable accessibilityRole="switch" accessibilityLabel={label} accessibilityState={{ checked: value }} onPress={() => onChange(!value)}
      style={{ width: 52, height: 32, borderRadius: 16, backgroundColor: value ? t.ink : t.line, padding: 3 }}>
      <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: value ? t.bg : '#fff', transform: [{ translateX: value ? 20 : 0 }] }} />
    </Pressable>
  )
}

// A panel that rises from the bottom over a dimmed screen. Tapping the dim closes it. It rises
// with the keyboard, so a box being typed in stays in sight. `end` keeps the last line in view,
// for the chat. `foot` stays at the bottom of the panel while the rest scrolls above it.
// 11 October 2026: a long morning typed in pushed Save below the bottom of the phone.
export function Sheet ({ open, onClose, children, tall, end, foot }: { open: boolean; onClose: () => void; children: ReactNode; tall?: boolean; end?: boolean; foot?: ReactNode }) {
  const t = useTheme(), insets = useSafeAreaInsets()
  const rise = useRef(new Animated.Value(0)).current
  const scroll = useRef<ScrollView>(null)
  useEffect(() => { if (open) { rise.setValue(0); Animated.timing(rise, { toValue: 1, duration: 260, useNativeDriver: true }).start() } }, [open])
  return (
    <Modal visible={open} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <ThemeCtx.Provider value={t}>
        <Pressable accessibilityLabel="Close" onPress={onClose} style={[StyleSheet.absoluteFill, { backgroundColor: t.scrim }]} />
        <KeyboardAvoidingView behavior="padding" style={[StyleSheet.absoluteFill, { justifyContent: 'flex-end' }]} pointerEvents="box-none">
          <Animated.View style={{ maxHeight: tall ? '92%' : '88%', backgroundColor: t.sheet, borderTopLeftRadius: 28, borderTopRightRadius: 28, transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [60, 0] }) }], opacity: rise }}>
            <ScrollView ref={scroll} onContentSizeChange={() => { if (end) scroll.current?.scrollToEnd({ animated: true }) }}
              style={{ flexShrink: 1 }} contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: foot ? 16 : 24 + insets.bottom }} keyboardShouldPersistTaps="handled">
              <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: t.line, alignSelf: 'center', marginBottom: 18 }} />
              {children}
            </ScrollView>
            {foot ? <View style={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 16 + insets.bottom, borderTopWidth: 1, borderTopColor: t.line }}>{foot}</View> : null}
          </Animated.View>
        </KeyboardAvoidingView>
      </ThemeCtx.Provider>
    </Modal>
  )
}

export function Toast ({ text, action, onAction, visible }: { text: string; action?: string; onAction?: () => void; visible: boolean }) {
  const t = useTheme(), insets = useSafeAreaInsets()
  const v = useRef(new Animated.Value(0)).current
  useEffect(() => { Animated.timing(v, { toValue: visible ? 1 : 0, duration: 220, useNativeDriver: true }).start() }, [visible])
  return (
    <Animated.View pointerEvents={visible ? 'auto' : 'none'} style={{ position: 'absolute', left: 16, right: 16, bottom: 20 + insets.bottom, opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }], backgroundColor: t.btn, borderRadius: 18, paddingVertical: 15, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <T size={15} color={t.btnInk} style={{ flex: 1 }}>{text}</T>
      {action ? <Pressable accessibilityRole="button" onPress={onAction} hitSlop={10}><T w="bold" size={15} color={t.btnInk} style={{ textDecorationLine: 'underline' }}>{action}</T></Pressable> : null}
    </Animated.View>
  )
}

export const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 12, borderBottomWidth: 1 },
})
