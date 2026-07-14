import { useState } from 'react'
import { View, Text, TextInput, Pressable, Alert, Modal, ScrollView, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useProgress } from '../context/ProgressContext'
import { useLanguage } from '../context/LanguageContext'
import { AccountSettings } from '../components/AccountSettings'
import { CategorySettings } from '../components/CategorySettings'
import { TaskFrequencySettings } from '../components/TaskFrequencySettings'
import { ManualView } from './ManualView'
import { Icon } from '../components/Icon'
import { fonts, radius, shadow, spacing, type Palette } from '../theme'
import { useColors, useStyles } from '../hooks/theme'

export function SettingsView() {
  const colors = useColors()
  const styles = useStyles(makeStyles)
  const { progress, update, saving } = useProgress()
  const { ui } = useLanguage()
  const [manualOpen, setManualOpen] = useState(false)
  const insets = useSafeAreaInsets()

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

      <Pressable style={styles.manualCard} onPress={() => setManualOpen(true)}>
        <View style={styles.manualIcon}>
          <Icon name="book" size={16} color={colors.accentInk} />
        </View>
        <View style={styles.manualCardBody}>
          <Text style={styles.manualCardTitle}>How to use this tool</Text>
          <Text style={styles.manualCardSub}>Learn, Practice, and the task types explained</Text>
        </View>
        <Icon name="chevron-right" size={16} color={colors.muted} />
      </Pressable>

      <AccountSettings />
      <CategorySettings />
      <TaskFrequencySettings />

      <Pressable style={styles.resetBtn} onPress={resetProgress}>
        <Icon name="trash-can" size={13} color={colors.accentInk} />
        <Text style={styles.resetText}>Reset progress</Text>
      </Pressable>

      <Modal visible={manualOpen} animationType="slide" onRequestClose={() => setManualOpen(false)}>
        <View style={[styles.modal, { paddingTop: insets.top }]}>
          <Pressable
            onPress={() => setManualOpen(false)}
            hitSlop={8}
            style={[styles.modalClose, { top: insets.top + 6 }]}
          >
            <Icon name="xmark" size={20} color={colors.muted} />
          </Pressable>
          <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 40 }}>
            <ManualView />
          </ScrollView>
        </View>
      </Modal>
    </View>
  )
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  panel: { ...shadow, backgroundColor: colors.panel, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg, padding: spacing.lg },
  h2: { color: colors.ink, fontFamily: fonts.headingBold, fontSize: 20, marginBottom: spacing.md },
  fieldLabel: { color: colors.ink, fontFamily: fonts.semibold, fontSize: 14, marginBottom: 6 },
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
  saveRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  saveText: { color: colors.muted, fontFamily: fonts.body, fontSize: 13 },
  manualCard: {
    ...shadow,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  manualIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  manualCardBody: { flex: 1 },
  manualCardTitle: { color: colors.ink, fontFamily: fonts.semibold, fontSize: 15 },
  manualCardSub: { color: colors.muted, fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
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
  modal: { flex: 1, backgroundColor: colors.bg },
  modalClose: {
    position: 'absolute',
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.panel,
    zIndex: 2,
  },
})

