import { Text, StyleSheet, type StyleProp, type TextStyle } from 'react-native'
import { type Palette } from '../theme'
import { useStyles } from '../hooks/theme'

/**
 * A count against its total — "5/10", used wherever the app shows progress as a pair.
 *
 * One rule, everywhere: no spaces around the slash, both numbers at the same size, and only colour
 * separating them. The total is the thing being counted against, so shrinking it makes it read as a
 * footnote; the count is what changed, so it takes the brighter ink.
 *
 * The size comes from the caller (or from the surrounding `Text`, since this nests) — deliberately,
 * because the same pair appears at 44pt on a summary and 12pt on a card subtitle.
 */
export function Tally({
  count,
  total,
  style,
}: {
  count: number
  total: number
  style?: StyleProp<TextStyle>
}) {
  const styles = useStyles(makeStyles)
  return (
    <Text style={[styles.count, style]}>
      {count}
      {/* Nested, so it inherits the size and face and can only differ in colour. */}
      <Text style={styles.total}>/{total}</Text>
    </Text>
  )
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  count: { color: colors.ink },
  total: { color: colors.muted },
})
