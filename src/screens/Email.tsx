// The parent's email in Settings, for anyone who left it out of setup.
import { useState } from 'react'
import { TextInput, View } from 'react-native'
import { signUpProblem, type SignUp } from '../lib/signup.ts'
import { Button, Pill, T, useTheme } from '../ui/kit.tsx'

function EmailBox ({ onSignUp, card }: { onSignUp: (email: string) => Promise<SignUp>; card: boolean }) {
  const t = useTheme()
  const [v, setV] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const go = async () => { setBusy(true); setErr(''); const r = await onSignUp(v); setBusy(false); setErr(signUpProblem(r)) }
  return (
    <>
      <TextInput testID={card ? 'email' : 'email-settings'} value={v} onChangeText={setV} placeholder="Your email" placeholderTextColor={t.muted}
        keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" onSubmitEditing={() => { if (v.trim()) go() }}
        style={{ fontFamily: 'Figtree_400Regular', fontSize: 16, color: t.ink, backgroundColor: card ? t.bg : t.soft, borderRadius: 12, paddingVertical: 13, paddingHorizontal: 14 }} />
      {err ? <T size={14.5} color={t.honeyText} style={{ lineHeight: 20 }}>{err}</T> : null}
      {card
        ? <Button label={busy ? 'Saving…' : 'Save'} disabled={!v.trim() || busy} onPress={go} />
        : <Pill label={busy ? 'Saving…' : 'Save'} onPress={() => { if (v.trim() && !busy) go() }} />}
    </>
  )
}

// The box, or a line saying we have the email.
export function EmailSettings ({ name, signedUp, onSignUp }: { name: string; signedUp: boolean; onSignUp: (email: string) => Promise<SignUp> }) {
  const t = useTheme()
  if (signedUp) return <T size={14.5} color={t.muted} style={{ lineHeight: 21, marginTop: 6, marginBottom: 10 }}>We have your email, and we'll send you sleep tips as {name} grows.</T>
  return (
    <View style={{ gap: 10, marginTop: 6, marginBottom: 6 }}>
      <T size={14.5} color={t.muted} style={{ lineHeight: 21 }}>Add your email and we'll send you sleep tips as {name} grows. You can unsubscribe from any email.</T>
      <EmailBox onSignUp={onSignUp} card={false} />
    </View>
  )
}
