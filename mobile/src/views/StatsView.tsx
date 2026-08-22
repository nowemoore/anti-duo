import { useMemo, useState } from 'react'
import { View, Text, Modal, FlatList, StyleSheet } from 'react-native'
import { TapScale } from '../components/TapScale'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { WORD_KNOWN_STREAK } from '@shared/constants'
import { introducedWords } from '@lib/study'
import { knownWordCount, taskRates, TASK_LABELS } from '@lib/stats'
import { useContent } from '../context/ContentContext'
import { useProgress } from '../context/ProgressContext'
import { useLanguage } from '../context/LanguageContext'
import { Bilingual } from '../components/Bilingual'
import { Stagger } from '../components/Stagger'
import { Icon } from '../components/Icon'
import { taskIcon } from '../components/TaskChip'
import { Tally } from '../components/Tally'
import { fonts, radius, shadow, spacing, type Palette } from '../theme'
import { useColors, useStyles } from '../hooks/theme'

/** Vocabulary mastered + success rate per task type. (The kanji board lives in Learn kanji.) */
export function StatsView() {
  const colors = useColors()
  const styles = useStyles(makeStyles)
  const { progress } = useProgress()
  const { ui, tasks } = useLanguage()
  const rates = taskRates(progress, tasks)
  const totalAttempts = rates.reduce((n, r) => n + r.attempts, 0)

  return (
    <View style={styles.stack}>
      <Stagger>
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
              <View style={styles.labelRow}>
                {taskIcon(r.type) && <Icon name={taskIcon(r.type)!} size={11} color={colors.muted} />}
                <Text style={styles.label}>{TASK_LABELS[r.type]}</Text>
              </View>
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
      </Stagger>
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
  const colors = useColors()
  const styles = useStyles(makeStyles)
  const index = useContent()
  const { progress } = useProgress()
  const [listOpen, setListOpen] = useState(false)

  // Hundreds of words even part-way in — worth memoising rather than rebuilding the set each render.
  const words = useMemo(() => introducedWords(index, progress), [index, progress])
  const known = knownWordCount(progress, words)
  const total = words.size
  const pct = total === 0 ? 0 : Math.round((known / total) * 100)

  return (
    <>
      <TapScale
        style={styles.panel}
        onPress={() => setListOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Show every word and its progress"
      >
        <View style={styles.titleRow}>
          <Bilingual native="覚えた言葉" en="Words you know" />
        </View>

        <View style={styles.bigRow}>
          <Tally count={known} total={total} style={styles.big} />
        </View>

        <View style={styles.bar}>
          <View style={[styles.fill, { width: `${pct}%` }]} />
        </View>

        {/* The chevron sits with the caption rather than beside the count: it points at the card as
            a whole, and it was competing with the number for the top line. */}
        <View style={styles.captionRow}>
          <Text style={styles.caption}>
            {total === 0
              ? 'Learn some kanji and the words that use them show up here.'
              : known === 0
                ? `Out of the words in the kanji you've learned. One counts once you've answered it correctly ${WORD_KNOWN_STREAK} times in a row — tap to see them all.`
                : `Out of the words in the kanji you've learned. ${WORD_KNOWN_STREAK} correct in a row to count; a miss walks it back. Tap to see them all.`}
          </Text>
          <Icon name="chevron-right" size={14} color={colors.muted} />
        </View>
      </TapScale>

      <WordListModal open={listOpen} onClose={() => setListOpen(false)} words={words} />
    </>
  )
}

/**
 * Every word in the enabled set with its progress, most-progressed first.
 *
 * A FlatList in its own Modal rather than rows in the Stats scroll view: there are ~900 of them, and
 * only the visible slice should ever be rendered.
 */
function WordListModal({
  open,
  onClose,
  words,
}: {
  open: boolean
  onClose: () => void
  words: ReadonlySet<string>
}) {
  const colors = useColors()
  const styles = useStyles(makeStyles)
  const index = useContent()
  const { progress } = useProgress()
  const insets = useSafeAreaInsets()

  // Sorted by run, so what you're closest to knowing is at the top and untouched words sink.
  const rows = useMemo(() => {
    const out = [...words].map((word) => ({
      word,
      reading: index.wordReadings.get(word) ?? word,
      streak: progress.words?.[word] ?? 0,
    }))
    out.sort((a, b) => b.streak - a.streak || a.reading.localeCompare(b.reading, 'ja'))
    return out
  }, [words, index, progress])

  return (
    <Modal visible={open} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.modal, { paddingTop: insets.top }]}>
        <View style={styles.modalHead}>
          <Text style={styles.modalTitle}>Words you know</Text>
          <TapScale onPress={onClose} hitSlop={8} accessibilityLabel="Close">
            <Icon name="xmark" size={20} color={colors.muted} />
          </TapScale>
        </View>

        <FlatList
          data={rows}
          keyExtractor={(r) => r.word}
          contentContainerStyle={styles.modalList}
          initialNumToRender={20}
          renderItem={({ item }) => (
            <View style={styles.wordRow}>
              <Text style={styles.wordReading} numberOfLines={1}>
                {item.reading}
              </Text>
              <StreakDots streak={item.streak} />
            </View>
          )}
        />
      </View>
    </Modal>
  )
}

/** WORD_KNOWN_STREAK dots; runs beyond the threshold are buffer and still show as full. */
function StreakDots({ streak }: { streak: number }) {
  const styles = useStyles(makeStyles)
  const filled = Math.min(streak, WORD_KNOWN_STREAK)
  return (
    <View style={styles.dots} accessibilityLabel={`${filled} of ${WORD_KNOWN_STREAK}`}>
      {Array.from({ length: WORD_KNOWN_STREAK }, (_, i) => (
        <View key={i} style={[styles.dot, i < filled && styles.dotOn]} />
      ))}
    </View>
  )
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  stack: { gap: spacing.lg },
  panel: { ...shadow, backgroundColor: colors.panel, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg, padding: spacing.lg },
  bigRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginBottom: spacing.md },
  big: { fontFamily: fonts.semibold, fontSize: 28, fontVariant: ['tabular-nums'] },
  captionRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, marginTop: spacing.sm },
  caption: { flex: 1, color: colors.muted, fontFamily: fonts.body, fontSize: 11, lineHeight: 16 },
  titleRow: { alignItems: 'flex-start', marginBottom: spacing.lg },
  empty: { color: colors.muted, fontFamily: fonts.body, fontSize: 14 },
  list: { gap: spacing.lg },
  row: {},
  // Icon and name on one line, so the bar underneath still starts at the row's left edge.
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  label: { color: colors.ink, fontFamily: fonts.body, fontSize: 14 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bar: { flex: 1, height: 8, borderRadius: 999, backgroundColor: colors.border, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 999, backgroundColor: colors.accent },
  pct: { color: colors.ink, fontFamily: fonts.body, fontSize: 13, width: 40, textAlign: 'right', fontVariant: ['tabular-nums'] },
  count: { color: colors.muted, fontFamily: fonts.body, fontSize: 11, width: 54, textAlign: 'right' },
  modal: { flex: 1, backgroundColor: colors.bg },
  modalHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
  },
  modalTitle: { color: colors.ink, fontFamily: fonts.headingBold, fontSize: 18 },
  modalList: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  wordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: 10,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
  },
  wordReading: { flex: 1, color: colors.ink, fontSize: 17 },
  dots: { flexDirection: 'row', gap: 5 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  dotOn: { backgroundColor: colors.accent },
})
