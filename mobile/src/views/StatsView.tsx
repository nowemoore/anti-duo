import { useMemo } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { WORD_KNOWN_STREAK } from '@shared/constants'
import { enabledWords } from '@lib/study'
import { knownWordCount, taskRates, TASK_LABELS } from '@lib/stats'
import { useContent } from '../context/ContentContext'
import { useProgress } from '../context/ProgressContext'
import { useLanguage } from '../context/LanguageContext'
import { Bilingual } from '../components/Bilingual'
import { fonts, radius, shadow, spacing, type Palette } from '../theme'
import { useStyles } from '../hooks/theme'

/** Vocabulary mastered + success rate per task type. */
export function StatsView() {
  const styles = useStyles(makeStyles)
  const { progress } = useProgress()
  const { ui, tasks } = useLanguage()
  const rates = taskRates(progress, tasks)
  const totalAttempts = rates.reduce((n, r) => n + r.attempts, 0)

  return (
    <View style={styles.stack}>
      <KnownWordsCard />
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
    </View>
  )
}

/**
 * Vocabulary you've shown you know, as opposed to kanji you've been introduced to. A word counts
 * once you've answered it right WORD_KNOWN_STREAK times running; a miss walks it back.
 *
 * Both sides are scoped to the enabled learning set, so switching a category off moves the total as
 * well as the count — the caption says so, since otherwise the number looks like lost progress.
 */
function KnownWordsCard() {
  const styles = useStyles(makeStyles)
  const index = useContent()
  const { progress } = useProgress()

  // 900+ words across every unit — worth memoising rather than rebuilding the set each render.
  const words = useMemo(() => enabledWords(index, progress), [index, progress])
  const known = knownWordCount(progress, words)
  const total = words.size
  const pct = total === 0 ? 0 : Math.round((known / total) * 100)

  return (
    <View style={styles.panel}>
      <View style={styles.titleRow}>
        <Bilingual native="覚えた言葉" en="Words you know" />
      </View>

      <View style={styles.bigRow}>
        <Text style={styles.big}>{known}</Text>
        <Text style={styles.bigOf}>/ {total}</Text>
      </View>

      <View style={styles.bar}>
        <View style={[styles.fill, { width: `${pct}%` }]} />
      </View>

      <Text style={styles.caption}>
        {known === 0
          ? `A word counts here once you've answered it correctly ${WORD_KNOWN_STREAK} times in a row.`
          : `${WORD_KNOWN_STREAK} correct in a row to count; a miss walks it back. Out of the words in your enabled set.`}
      </Text>
    </View>
  )
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  stack: { gap: spacing.lg },
  panel: { ...shadow, backgroundColor: colors.panel, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg, padding: spacing.lg },
  bigRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginBottom: spacing.md },
  big: { color: colors.ink, fontFamily: fonts.headingBold, fontSize: 40, fontVariant: ['tabular-nums'] },
  bigOf: { color: colors.muted, fontFamily: fonts.body, fontSize: 15, fontVariant: ['tabular-nums'] },
  caption: { color: colors.muted, fontFamily: fonts.body, fontSize: 11, lineHeight: 16, marginTop: spacing.sm },
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
