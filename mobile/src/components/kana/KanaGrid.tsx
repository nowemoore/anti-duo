import { Animated, View, Text, Pressable, StyleSheet } from 'react-native'
import { chartRomaji, type ChartSection } from '@lib/kana'
import { useStagger, useStaggerStyles } from '../Stagger'
import { edge, fonts, radius, type Palette } from '../../theme'
import { useColors, useStyles } from '../../hooks/theme'

/** How a cell reads: never opened, or studied. The fill within `studied` is a ramp — see `fillOf`. */
export type CellState = 'new' | 'studied'

/** Alpha a just-studied cell carries, so it still reads as coloured rather than empty. */
const FILL_FLOOR = 0.18

/** `#rrggbb` → `r,g,b`, so an accent from any palette can be given a variable alpha. */
function rgbOf(hex: string): string {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16)
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`
}

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
  fillOf,
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
  /**
   * How solid a studied cell is, 0..1. The chart then reads as a map of how far along the script
   * is, rather than a binary opened/not-opened. Omitted → studied cells render at full strength.
   */
  fillOf?: (char: string) => number
  onPress?: (char: string) => void
}) {
  const colors = useColors()
  const styles = useStyles(makeStyles)
  const accentRgb = rgbOf(colors.accent)
  const large = size === 'large'
  const rows = flip ? transpose(section.rows) : section.rows
  // Staggered by row rather than by cell: the wave reads the same and it's a fraction of the nodes.
  const wave = useStagger(rows.length)
  const rowAnim = useStaggerStyles(wave, rows.length)

  return (
    <View style={styles.grid}>
      {rows.map((row, r) => (
        <Animated.View key={r} style={[styles.row, rowAnim[r]]}>
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
                  state === 'studied' &&
                    fillOf != null && {
                      backgroundColor: `rgba(${accentRgb},${(FILL_FLOOR + (1 - FILL_FLOOR) * Math.min(1, Math.max(0, fillOf(char)))).toFixed(3)})`,
                    },
                ]}
              >
                <Text style={[styles.kana, large && styles.kanaLarge]}>{char}</Text>
                <Text style={[styles.romaji, large && styles.romajiLarge]}>{chartRomaji(char)}</Text>
              </Pressable>
            )
          })}
        </Animated.View>
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
    borderWidth: edge,
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
