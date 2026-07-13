import { View, Text, StyleSheet } from 'react-native'
import { useProgress } from '../context/ProgressContext'
import { useLanguage } from '../context/LanguageContext'
import { taskRates, TASK_LABELS } from '@lib/stats'
import { Bilingual } from '../components/Bilingual'
import { colors, fonts, radius, shadow, spacing } from '../theme'

/** Success rate per task type — earned points ÷ attempts, cumulative across all practice. */
export function StatsView() {
  const { progress } = useProgress()
  const { ui, tasks } = useLanguage()
  const rates = taskRates(progress, tasks)
  const totalAttempts = rates.reduce((n, r) => n + r.attempts, 0)

  return (
    <View style={styles.panel}>
      <View style={styles.titleRow}>
        <Bilingual native={ui.statsTitle.native} en={ui.statsTitle.en} />
      </View>

      {totalAttempts === 0 ? (
        <Text style={styles.empty}>
          Practice some tasks and your success rate per type shows up here.
        </Text>
      ) : (
        <View style={styles.list}>
          {rates.map((r) => (
            <View key={r.type} style={styles.row}>
              <Text style={styles.label}>{TASK_LABELS[r.type]}</Text>
              <View style={styles.barRow}>
                <View style={styles.bar}>
                  <View style={[styles.fill, { width: `${Math.round((r.rate ?? 0) * 100)}%` }]} />
                </View>
                <Text style={styles.pct}>{r.rate === null ? '—' : `${Math.round(r.rate * 100)}%`}</Text>
                <Text style={styles.count}>{r.attempts === 1 ? '1 try' : `${r.attempts} tries`}</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  panel: { ...shadow, backgroundColor: colors.panel, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg, padding: spacing.lg },
  titleRow: { alignItems: 'flex-start', marginBottom: spacing.lg },
  empty: { color: colors.muted, fontFamily: fonts.body, fontSize: 14 },
  list: { gap: spacing.lg },
  row: {},
  label: { color: colors.ink, fontFamily: fonts.body, fontSize: 14, marginBottom: 6 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bar: { flex: 1, height: 8, borderRadius: 999, backgroundColor: colors.border, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 999, backgroundColor: colors.accent },
  pct: { color: colors.ink, fontFamily: fonts.body, fontSize: 13, width: 40, textAlign: 'right', fontVariant: ['tabular-nums'] },
  count: { color: colors.muted, fontFamily: fonts.body, fontSize: 11, width: 54, textAlign: 'right' },
})
