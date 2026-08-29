import { Fragment } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { fonts, type Palette } from '../theme'
import { useStyles } from '../hooks/theme'

/** One key entry: the colour a tile takes, and what that colour means. */
export interface LegendItem {
  color: string
  label: string
}

/**
 * The key for a board of coloured tiles, on one line above the grid it explains.
 *
 * Sized to fit without wrapping: small swatches, small type, and `flexShrink` on each entry so the
 * labels give way before the row can break. The dots between entries are load-bearing — five
 * swatch-and-label pairs in a row read as one long phrase otherwise, with no telling where each
 * ends.
 */
export function Legend({ items }: { items: LegendItem[] }) {
  const styles = useStyles(makeStyles)
  return (
    <View style={styles.legend}>
      {items.map((item, i) => (
        <Fragment key={item.label}>
          {i > 0 && <Text style={styles.dot}>·</Text>}
          <View style={styles.item}>
            <View style={[styles.swatch, { backgroundColor: item.color }]} />
            <Text style={styles.text} numberOfLines={1}>
              {item.label}
            </Text>
          </View>
        </Fragment>
      ))}
    </View>
  )
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  legend: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  swatch: { width: 8, height: 8, borderRadius: 2 },
  text: { color: colors.muted, fontFamily: fonts.body, fontSize: 9, flexShrink: 1 },
  dot: { color: colors.muted, fontSize: 13, marginHorizontal: 5 },
})
