import { useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { MiniSlider } from './MiniSlider'
import { useProgress } from '../context/ProgressContext'
import { useLanguage } from '../context/LanguageContext'
import { TASK_TUNING, type TaskType } from '@lib/tasks'
import { TASK_LABELS } from '@lib/stats'
import { fonts, radius, shadow, spacing, type Palette } from '../theme'
import { useStyles } from '../hooks/theme'

/** Settings section: adjust how often each practice task type appears (its selection weight). */
export function TaskFrequencySettings() {
  const styles = useStyles(makeStyles)
  // The active language's own task inventory (so opt-in tasks like plural / root-cloze appear too).
  const { tasks } = useLanguage()
  return (
    <View style={styles.panel}>
      <Text style={styles.h2}>Practice mix</Text>
      <Text style={styles.muted}>How often each question type shows up in practice. Slide one to 0 to turn it off.</Text>
      <View style={styles.list}>
        {tasks.map((t) => (
          <FreqRow key={t} type={t} />
        ))}
      </View>
    </View>
  )
}

function FreqRow({ type }: { type: TaskType }) {
  const styles = useStyles(makeStyles)
  const { progress, update } = useProgress()
  const stored = progress.settings.taskWeights?.[type] ?? TASK_TUNING[type].weight
  const [val, setVal] = useState(stored)

  const commit = (v: number) =>
    update((p) => ({
      ...p,
      settings: { ...p.settings, taskWeights: { ...(p.settings.taskWeights ?? {}), [type]: v } },
    }))

  return (
    <View style={styles.row}>
      <View style={styles.rowHead}>
        <Text style={styles.label} numberOfLines={2}>
          {TASK_LABELS[type]}
        </Text>
        <Text style={styles.value}>{val === 0 ? 'off' : `${val.toFixed(1)}×`}</Text>
      </View>
      <MiniSlider value={val} min={0} max={3} step={0.1} onChange={setVal} onComplete={commit} />
    </View>
  )
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  panel: { ...shadow, backgroundColor: colors.panel, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg, padding: spacing.lg },
  h2: { color: colors.ink, fontFamily: fonts.headingBold, fontSize: 20, marginBottom: 6 },
  muted: { color: colors.muted, fontFamily: fonts.body, fontSize: 13, marginBottom: spacing.md },
  list: { gap: spacing.lg },
  row: { gap: 4 },
  rowHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  label: { flex: 1, color: colors.ink, fontFamily: fonts.body, fontSize: 14 },
  value: { width: 44, textAlign: 'right', color: colors.muted, fontFamily: fonts.body, fontSize: 13, fontVariant: ['tabular-nums'] },
})
