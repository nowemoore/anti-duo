import { View, Text, Pressable, StyleSheet } from 'react-native'
import type { ExplanationExample, ExampleSpan, GrammarTopic, SpanRole } from '@lib/grammar'
import { Icon } from '../Icon'
import { fonts, radius, spacing, type Palette } from '../../theme'
import { useColors, useStyles } from '../../hooks/theme'

/**
 * Colour legend for the worked examples. Roles map to palette variables (never literals), so both
 * the Japanese and Arabic palettes — and any future theme — stay consistent and readable.
 *   stem    → accent ink   (the part that survives)
 *   ending  → correct      (the ます that gets added)
 *   dropped → incorrect    (the final kana that's dropped or changed, struck through)
 */
function spanColor(role: SpanRole, colors: Palette): string {
  if (role === 'stem') return colors.accentInk
  if (role === 'ending') return colors.correct
  if (role === 'dropped') return colors.incorrect
  return colors.ink
}

/** Part 4 — the explanation, revealed only once the pass threshold has been met. */
export function Explanation({ topic }: { topic: GrammarTopic }) {
  const styles = useStyles(makeStyles)
  const name = topic.explanation.revealedName
  return (
    <View style={styles.wrap}>
      {/* The form's real name, held back until here so the game stays a derivation exercise. */}
      {name && (
        <View style={styles.reveal}>
          <Text style={styles.revealLabel}>This form is called</Text>
          <Text style={styles.revealEn}>{name.en}</Text>
          <Text style={styles.revealNative}>{name.native}</Text>
        </View>
      )}
      <Legend />
      {topic.explanation.blocks.map((block) => (
        <View key={block.heading} style={[styles.block, block.footnote && styles.footnoteBlock]}>
          <Text style={[styles.heading, block.footnote && styles.footnoteHeading]}>{block.heading}</Text>
          {block.body.map((para) => (
            <Text key={para} style={[styles.body, block.footnote && styles.footnoteBody]}>
              {para}
            </Text>
          ))}
          {block.examples?.map((ex, i) => (
            <ExampleRow key={i} example={ex} />
          ))}
        </View>
      ))}
    </View>
  )
}

function Legend() {
  const colors = useColors()
  const styles = useStyles(makeStyles)
  const entries: { role: SpanRole; label: string }[] = [
    { role: 'stem', label: 'stem' },
    { role: 'ending', label: 'ます ending' },
    { role: 'dropped', label: 'dropped / changed' },
  ]
  return (
    <View style={styles.legend}>
      {entries.map((e) => (
        <View key={e.role} style={styles.legendItem}>
          <View style={[styles.swatch, { backgroundColor: spanColor(e.role, colors) }]} />
          <Text style={styles.legendLabel}>{e.label}</Text>
        </View>
      ))}
    </View>
  )
}

function ExampleRow({ example }: { example: ExplanationExample }) {
  const colors = useColors()
  const styles = useStyles(makeStyles)
  return (
    <View style={styles.example}>
      <View style={styles.exampleRow}>
        <Spans spans={example.from} />
        <Icon name="chevron-right" size={12} color={colors.muted} />
        <Spans spans={example.to} />
      </View>
      {example.note ? <Text style={styles.exampleNote}>{example.note}</Text> : null}
    </View>
  )
}

function Spans({ spans }: { spans: ExampleSpan[] }) {
  const colors = useColors()
  const styles = useStyles(makeStyles)
  return (
    <Text style={styles.jp}>
      {spans.map((s, i) => (
        <Text
          key={i}
          style={[
            { color: spanColor(s.role, colors) },
            // Struck through so "dropped" reads as dropped even without relying on colour alone.
            s.role === 'dropped' && styles.struck,
          ]}
        >
          {s.text}
        </Text>
      ))}
    </Text>
  )
}

/** Shown in place of the explanation until the learner's best attempt clears the threshold. */
export function ExplanationLocked({
  best,
  required,
  attempts,
  onRetry,
}: {
  best: number
  required: number
  attempts: number
  onRetry: () => void
}) {
  const colors = useColors()
  const styles = useStyles(makeStyles)
  const pct = Math.round(best * 100)
  const need = Math.round(required * 100)
  return (
    <View style={styles.locked}>
      <Text style={styles.lockedTitle}>
        Best so far: <Text style={styles.lockedPct}>{pct}%</Text> of {need}%
      </Text>

      <View style={styles.track}>
        {/* Scaled against the threshold, so the bar fills exactly when the explanation unlocks. */}
        <View style={[styles.trackFill, { width: `${Math.min(100, (best / required) * 100)}%` }]} />
      </View>

      <Text style={styles.lockedNote}>
        {attempts === 0
          ? 'Play the game above to unlock the explanation.'
          : `${attempts} attempt${attempts === 1 ? '' : 's'} so far. Retries are unlimited and reshuffle the items — only your best attempt counts.`}
      </Text>

      <Pressable style={styles.retryBtn} onPress={onRetry}>
        <Icon name="rotate-left" size={13} color={colors.onAccent} />
        <Text style={styles.retryText}>{attempts === 0 ? 'Go to the game' : 'Try again'}</Text>
      </Pressable>
    </View>
  )
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  wrap: { gap: spacing.lg },
  reveal: {
    alignItems: 'center',
    gap: 2,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  revealLabel: { color: colors.muted, fontFamily: fonts.body, fontSize: 11 },
  revealEn: { color: colors.accentInk, fontFamily: fonts.semibold, fontSize: 17 },
  revealNative: { color: colors.ink, fontSize: 15 },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  swatch: { width: 9, height: 9, borderRadius: 3 },
  legendLabel: { color: colors.muted, fontFamily: fonts.body, fontSize: 11 },
  block: { gap: spacing.sm },
  heading: { color: colors.ink, fontFamily: fonts.semibold, fontSize: 14 },
  body: { color: colors.ink, fontFamily: fonts.body, fontSize: 13, lineHeight: 20 },
  example: {
    gap: 4,
    backgroundColor: colors.panelStrong,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  exampleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
  jp: { fontSize: 22 },
  struck: { textDecorationLine: 'line-through' },
  exampleNote: { color: colors.muted, fontFamily: fonts.body, fontSize: 11, lineHeight: 17 },
  footnoteBlock: { opacity: 0.85, borderTopColor: colors.border, borderTopWidth: 1, paddingTop: spacing.md },
  footnoteHeading: { fontSize: 12, color: colors.muted },
  footnoteBody: { fontSize: 12, color: colors.muted },
  locked: { alignItems: 'center', gap: spacing.sm },
  lockedTitle: { color: colors.ink, fontFamily: fonts.body, fontSize: 14 },
  lockedPct: { fontFamily: fonts.semibold, color: colors.accentInk },
  track: {
    alignSelf: 'stretch',
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
    overflow: 'hidden',
    marginTop: spacing.xs,
  },
  trackFill: { height: 6, backgroundColor: colors.accent },
  lockedNote: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingVertical: 11,
    paddingHorizontal: spacing.xl,
  },
  retryText: { color: colors.onAccent, fontFamily: fonts.semibold, fontSize: 13 },
})
