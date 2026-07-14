import { useState } from 'react'
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native'
import { useAuth } from '../context/AuthContext'
import { useSync } from '../context/SyncContext'
import { Icon } from './Icon'
import { fonts, radius, shadow, spacing, type Palette } from '../theme'
import { useColors, useStyles } from '../hooks/theme'

/** Settings card: optional cloud login (emailed code) that backs up and syncs progress. */
export function AccountSettings() {
  const { configured, loading, session, email, sendCode, verifyCode, signOut } = useAuth()
  const colors = useColors()
  const styles = useStyles(makeStyles)

  if (!configured) {
    return (
      <View style={styles.panel}>
        <Text style={styles.h2}>Cloud backup</Text>
        <Text style={styles.muted}>
          Not set up yet. Add your Supabase project URL and key in{' '}
          <Text style={styles.code}>src/lib/supabaseConfig.ts</Text> to back up your progress and
          sync it across devices. Until then, everything is saved on this device.
        </Text>
      </View>
    )
  }

  return (
    <View style={styles.panel}>
      <Text style={styles.h2}>Cloud backup</Text>
      {loading ? (
        <View style={styles.statusRow}>
          <Icon name="spinner" size={13} color={colors.muted} />
          <Text style={styles.muted}>Checking sign-in…</Text>
        </View>
      ) : session ? (
        <SignedIn email={email} onSignOut={signOut} />
      ) : (
        <SignedOut sendCode={sendCode} verifyCode={verifyCode} />
      )}
    </View>
  )
}

function SignedIn({ email, onSignOut }: { email: string | null; onSignOut: () => Promise<void> }) {
  const colors = useColors()
  const styles = useStyles(makeStyles)
  const { state, error } = useSync()
  const status = {
    syncing: { icon: 'spinner' as const, text: 'Syncing…' },
    synced: { icon: 'cloud' as const, text: 'Backed up' },
    error: { icon: 'triangle-exclamation' as const, text: error ?? 'Sync error' },
    idle: { icon: 'cloud' as const, text: '' },
  }[state]

  return (
    <View style={{ gap: 12 }}>
      <Text style={styles.muted}>
        Signed in as <Text style={styles.email}>{email}</Text>. Your progress backs up automatically.
      </Text>
      {status.text ? (
        <View style={styles.statusRow}>
          <Icon name={status.icon} size={13} color={state === 'error' ? colors.incorrect : colors.muted} />
          <Text style={styles.muted}>{status.text}</Text>
        </View>
      ) : null}
      <Pressable style={styles.secondaryBtn} onPress={onSignOut}>
        <Icon name="arrow-right-from-bracket" size={13} color={colors.accentInk} />
        <Text style={styles.secondaryText}>Sign out</Text>
      </Pressable>
    </View>
  )
}

function SignedOut({
  sendCode,
  verifyCode,
}: {
  sendCode: (email: string) => Promise<void>
  verifyCode: (email: string, code: string) => Promise<void>
}) {
  const colors = useColors()
  const styles = useStyles(makeStyles)
  const [stage, setStage] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async (fn: () => Promise<void>, after?: () => void) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
      after?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  if (stage === 'email') {
    return (
      <View style={{ gap: 10 }}>
        <Text style={styles.muted}>Sign in with your email — we'll send a one-time code, no password.</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          placeholderTextColor={colors.muted}
          style={styles.input}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          inputMode="email"
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable
          style={[styles.primaryBtn, (busy || !email.trim()) && styles.disabled]}
          disabled={busy || !email.trim()}
          onPress={() => run(() => sendCode(email), () => setStage('code'))}
        >
          <Icon name={busy ? 'spinner' : 'paper-plane'} size={13} color={colors.onAccent} />
          <Text style={styles.primaryText}>{busy ? 'Sending…' : 'Email me a code'}</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <View style={{ gap: 10 }}>
      <Text style={styles.muted}>
        Enter the code sent to <Text style={styles.email}>{email}</Text>.
      </Text>
      <TextInput
        value={code}
        onChangeText={(t) => setCode(t.replace(/[^0-9]/g, ''))}
        placeholder="––––––"
        placeholderTextColor={colors.muted}
        style={[styles.input, styles.codeInput]}
        keyboardType="number-pad"
        inputMode="numeric"
        maxLength={10}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable
        style={[styles.primaryBtn, (busy || code.length < 6) && styles.disabled]}
        disabled={busy || code.length < 6}
        onPress={() => run(() => verifyCode(email, code))}
      >
        <Icon name={busy ? 'spinner' : 'right-to-bracket'} size={13} color={colors.onAccent} />
        <Text style={styles.primaryText}>{busy ? 'Verifying…' : 'Verify & sign in'}</Text>
      </Pressable>
      <Pressable
        onPress={() => {
          setStage('email')
          setCode('')
          setError(null)
        }}
      >
        <Text style={styles.link}>Use a different email</Text>
      </Pressable>
    </View>
  )
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  panel: { ...shadow, backgroundColor: colors.panel, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg, padding: spacing.lg },
  h2: { color: colors.ink, fontFamily: fonts.headingBold, fontSize: 20, marginBottom: spacing.md },
  muted: { color: colors.muted, fontFamily: fonts.body, fontSize: 13, lineHeight: 19 },
  email: { color: colors.ink, fontFamily: fonts.semibold },
  code: { fontFamily: fonts.semibold, color: colors.accentInk },
  input: {
    fontSize: 16,
    color: colors.ink,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.bg,
  },
  codeInput: { fontSize: 22, letterSpacing: 6, textAlign: 'center', fontVariant: ['tabular-nums'] },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingVertical: 11,
  },
  primaryText: { color: colors.onAccent, fontFamily: fonts.semibold, fontSize: 14 },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.pill,
    paddingVertical: 9,
    paddingHorizontal: 16,
  },
  secondaryText: { color: colors.accentInk, fontFamily: fonts.semibold, fontSize: 14 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  error: { color: colors.incorrect, fontFamily: fonts.body, fontSize: 13 },
  link: { color: colors.accentInk, fontFamily: fonts.semibold, fontSize: 13, alignSelf: 'flex-start' },
  disabled: { opacity: 0.4 },
})
