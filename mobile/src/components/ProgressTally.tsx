import { View, Text, StyleSheet } from 'react-native'
import { fonts, radius, spacing, type Palette } from '../theme'
import { useStyles } from '../hooks/theme'

/**
 * "80 of 238 kanji unlocked", with a bar under it. The header every section page opens with.
 *
 * Both numbers at one size — the count is the interesting half, but blowing it up makes the total
 * look like a footnote when it's the thing being counted against. Only colour separates them.
 *
 * Shared rather than copied so the kanji and kana pages can't drift; the wording after the total is
 * the caller's, since one page counts what's unlocked and the other what's been studied.
 */
export function ProgressTally({ count, total, label }: { count: number; total: number; label: string }) {
  const styles = useStyles(makeStyles)
  return (
    <View style={styles.tally}>
      <View style={styles.row}>
        <Text style={styles.count}>{count}</Text>
        <Text style={styles.of}>
          of {total} {label}
        </Text>
      </View>
      <View style={styles.bar}>
        <View style={[styles.fill, { width: `${total ? (count / total) * 100 : 0}%` }]} />
      </View>
    </View>
  )
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  tally: { gap: spacing.sm, paddingHorizontal: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  count: { color: colors.ink, fontFamily: fonts.semibold, fontSize: 17 },
  of: { color: colors.muted, fontFamily: fonts.semibold, fontSize: 17 },
  bar: { height: 6, borderRadius: 3, backgroundColor: colors.border, overflow: 'hidden' },
  /* Lavender, not the accent: a bar reports where you are, it isn't something to act on. */
  fill: { height: '100%', backgroundColor: colors.highlight, borderRadius: radius.sm },
})
