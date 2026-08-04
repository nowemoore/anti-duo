import { useMemo } from 'react'
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native'
import {
  bestAccuracy,
  hasPassed,
  isMinigameGated,
  topicProgress,
  unitsNeededForVerbs,
  type GrammarTopic,
} from '@lib/grammar'
import { useContent } from '../../context/ContentContext'
import { useProgress } from '../../context/ProgressContext'
import { useScreenHeader } from '../../context/HeaderContext'
import { Icon } from '../Icon'
import { Bilingual } from '../Bilingual'
import { fonts, radius, shadow, spacing, type Palette } from '../../theme'
import { useColors, useStyles } from '../../hooks/theme'

/** The grammar landing page: one card per subsection available in the current language. */
export function GrammarMenu({
  topics,
  onBack,
  onSelect,
}: {
  topics: GrammarTopic[]
  onBack: () => void
  onSelect: (topic: GrammarTopic) => void
}) {
  const colors = useColors()
  const styles = useStyles(makeStyles)
  const { progress } = useProgress()
  const index = useContent()
  const ctx = useMemo(() => ({ index, progress }), [index, progress])

  useScreenHeader(onBack, undefined, undefined, true)

  if (topics.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No grammar subsections for this language yet.</Text>
      </View>
    )
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      {topics.map((topic) => {
        const tp = topicProgress(progress, topic.id)
        const done = hasPassed(tp)
        const started = tp.vocabDoneAt != null || tp.attempts.length > 0
        // Same predicate the unlock gate itself uses, so the card can't claim one thing while the
        // section does another.
        const needed = topic.minigame.minItems ?? 0
        const gated = isMinigameGated(topic, tp, ctx)
        // The minimum number of extra kanji that would clear the gate — a real count, not the verb
        // shortfall relabelled, since a compound verb can need more than one.
        const kanjiToGo = gated ? unitsNeededForVerbs(index, progress, needed).length : 0

        return (
          <Pressable
            key={topic.id}
            style={[styles.card, gated && styles.cardLocked]}
            onPress={() => onSelect(topic)}
            disabled={gated}
            accessibilityState={{ disabled: gated }}
          >
            <View style={[styles.iconCircle, done && styles.iconDone, gated && styles.iconGated]}>
              <Icon
                name={gated ? 'lock' : done ? 'circle-check' : 'book'}
                size={20}
                color={gated ? colors.muted : colors.onAccent}
              />
            </View>
            <Bilingual native={topic.titleNative} en={topic.titleEn} />
            <Text style={[styles.sub, gated && styles.subGated]}>
              {gated
                ? `You need ${needed} verbs to start.`
                : done
                  ? `Completed · best ${Math.round(bestAccuracy(tp) * 100)}%`
                  : started
                    ? `In progress · best ${Math.round(bestAccuracy(tp) * 100)}%`
                    : topic.blurb}
            </Text>
            {gated && (
              <Text style={styles.subHint}>
                {kanjiToGo > 0
                  ? `Learn ${kanjiToGo} more kanji and come back.`
                  : 'Learn more kanji and come back.'}
              </Text>
            )}
          </Pressable>
        )
      })}
    </ScrollView>
  )
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  scroll: { flex: 1 },
  content: { gap: spacing.md, paddingVertical: spacing.md },
  card: {
    ...shadow,
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardLocked: { opacity: 0.55 },
  iconDone: { backgroundColor: colors.c400 },
  iconGated: { backgroundColor: colors.border },
  sub: { color: colors.muted, fontFamily: fonts.body, fontSize: 12, textAlign: 'center' },
  subGated: { color: colors.ink },
  subHint: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: colors.muted, fontFamily: fonts.body, fontSize: 13 },
})
