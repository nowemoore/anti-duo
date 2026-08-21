import { View, Text, Pressable, StyleSheet } from 'react-native'
import { chartRomaji, type ChartSection } from '@lib/kana'
import { fonts, radius, type Palette } from '../../theme'
import { useStyles } from '../../hooks/theme'

/** How a cell reads: never opened, or studied. Two states only — mastery lives inside the card. */
export type CellState = 'new' | 'studied'

/**
 * One block of the kana chart. Used both for the small read-only reference behind the help button
 * and for the large tappable chart in the Learn kana section, so the two can never fall out of
 * step visually.
 *
 * Data is stored consonant-row × vowel-column and transposed at render, so consonants run across
 * the x-axis and vowels down the y-axis — the arrangement the reference chart has always used.
 */
export function KanaGrid({
  section,
  size = 'small',
  flip = true,
  stateOf,
  onPress,
}: {
  section: ChartSection
  size?: 'small' | 'large'
  /**
   * Transpose before rendering, putting consonants across the x-axis and vowels down the y-axis —
   * the arrangement the compact reference chart has always used. `false` keeps the stored layout,
   * so vowels run across the columns and each row is one consonant group.
   */
  flip?: boolean
  /** Shading per character. Omitted → every cell renders plain. */
  stateOf?: (char: string) => CellState
  onPress?: (char: string) => void
}) {
  const styles = useStyles(makeStyles)
  const large = size === 'large'

  return (
    <View style={styles.grid}>
      {(flip ? transpose(section.rows) : section.rows).map((row, r) => (
        <View key={r} style={styles.row}>
          {row.map((char, c) => {
            if (!char) {
              return (
                <View
                  key={c}
                  style={[styles.cell, large && styles.cellLarge, section.wide && (large ? styles.wideLarge : styles.wide), styles.empty]}
                />
              )
            }
            const state = stateOf?.(char) ?? 'studied'
            return (
              <Pressable
                key={c}
                disabled={!onPress}
                onPress={() => onPress?.(char)}
                accessibilityRole={onPress ? 'button' : undefined}
                accessibilityLabel={onPress ? `${char}, ${chartRomaji(char)}` : undefined}
                style={[
                  styles.cell,
                  large && styles.cellLarge,
                  section.wide && (large ? styles.wideLarge : styles.wide),
                  state === 'new' && styles.cellNew,
                ]}
              >
                <Text style={[styles.kana, large && styles.kanaLarge]}>{char}</Text>
                <Text style={[styles.romaji, large && styles.romajiLarge]}>{chartRomaji(char)}</Text>
              </Pressable>
            )
          })}
        </View>
      ))}
    </View>
  )
}

function transpose(rows: (string | null)[][]): (string | null)[][] {
  const cols = Math.max(...rows.map((r) => r.length))
  const out: (string | null)[][] = []
  for (let c = 0; c < cols; c++) out.push(rows.map((r) => r[c] ?? null))
  return out
}

const kanaBg = 'rgba(227,152,221,0.20)'
const makeStyles = (colors: Palette) => StyleSheet.create({
  grid: { gap: 2 },
  row: { flexDirection: 'row', gap: 2 },
  cell: {
    width: 22,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(227,152,221,0.4)',
    borderRadius: 4,
    backgroundColor: kanaBg,
  },
  cellLarge: { width: 42, paddingVertical: 6, borderRadius: radius.sm },
  wide: { width: 27 },
  wideLarge: { width: 50 },
  // Untraced: visibly available but clearly not yet started.
  cellNew: { backgroundColor: 'transparent', borderColor: colors.border },
  empty: { borderWidth: 0, backgroundColor: 'transparent' },
  kana: { fontSize: 13, color: colors.ink },
  kanaLarge: { fontSize: 22, lineHeight: 27 },
  romaji: { fontSize: 8, color: colors.muted, fontFamily: fonts.body },
  romajiLarge: { fontSize: 10 },
})
