import { useState } from 'react'
import { View, Text, TextInput, Alert, StyleSheet } from 'react-native'
import { TapScale } from '../components/TapScale'
import { useProgress } from '../context/ProgressContext'
import { useLanguage } from '../context/LanguageContext'
import { AccountSettings } from '../components/AccountSettings'
import { CategorySettings } from '../components/CategorySettings'
import { DevTools } from '../components/DevTools'
import { TaskFrequencySettings } from '../components/TaskFrequencySettings'
import { Icon } from '../components/Icon'
import { edge, fonts, radius, shadow, spacing, type Palette } from '../theme'
import { useColors, useStyles } from '../hooks/theme'

export function SettingsView() {
  const colors = useColors()
  const styles = useStyles(makeStyles)
  const { progress, update, saving } = useProgress()
  const { ui } = useLanguage()

  function resetProgress() {
    Alert.alert(
      'Reset progress?',
      `Your introduced ${ui.noun} and levels will be cleared (your name and dataset selection are kept).`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => update((p) => ({ settings: p.settings, units: {} })),
        },
      ],
    )
  }

  return (
    <View style={{ gap: spacing.lg }}>
      <View style={styles.panel}>
        <Text style={styles.h2}>Profile</Text>
        <Text style={styles.fieldLabel}>Your name</Text>
        <TextInput
          value={progress.settings.name}
          onChangeText={(t) => update((p) => ({ ...p, settings: { ...p.settings, name: t } }))}
          placeholder="Enter your name"
          placeholderTextColor={colors.muted}
          style={styles.input}
        />
        <View style={styles.saveRow}>
          <Icon name={saving ? 'spinner' : 'check'} size={13} color={colors.muted} />
          <Text style={styles.saveText}>{saving ? 'Saving…' : 'Saved'}</Text>
        </View>
      </View>

      <AccountSettings />
      <CategorySettings />
      <TaskFrequencySettings />

      {/* Renders nothing outside a development build. */}
      <DevTools />

      <TapScale style={styles.resetBtn} onPress={resetProgress}>
        <Icon name="trash-can" size={13} color={colors.accentInk} />
        <Text style={styles.resetText}>Reset progress</Text>
      </TapScale>
    </View>
  )
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  panel: { ...shadow, backgroundColor: colors.panel, borderColor: colors.border, borderWidth: edge, borderRadius: radius.lg, padding: spacing.lg },
  h2: { color: colors.ink, fontFamily: fonts.headingBold, fontSize: 20, marginBottom: spacing.md },
  fieldLabel: { color: colors.ink, fontFamily: fonts.semibold, fontSize: 14, marginBottom: 6 },
  input: {
    fontSize: 16,
    color: colors.ink,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderWidth: edge,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.bg,
  },
  saveRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  saveText: { color: colors.muted, fontFamily: fonts.body, fontSize: 13 },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 8,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.pill,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  resetText: { color: colors.accentInk, fontFamily: fonts.semibold, fontSize: 14 },
})

