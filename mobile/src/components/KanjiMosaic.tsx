import { useState } from 'react'
import { Animated, View, Text, Pressable, StyleSheet } from 'react-native'
import type { Unit } from '@shared/types'
import { isCategoryEnabled, isUnitEnabled, toggleInList } from '@lib/categories'
import { masteryProgress, masteryTier, readyForMore, type MasteryTier } from '@lib/study'
import { useContent } from '../context/ContentContext'
import { useProgress } from '../context/ProgressContext'
import { useLanguage } from '../context/LanguageContext'
import { useStagger, useStaggerStyles } from './Stagger'
import { fonts, radius, spacing, type Palette } from '../theme'
import { useColors, useStyles } from '../hooks/theme'

/** The mastery ramp, plus the two states that aren't on it. */
type TileState = MasteryTier | 'more' | 'off'

/** Split a flat list into rows of `size`. */
function chunk<T>(xs: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < xs.length; i += size) out.push(xs.slice(i, i + size))
  return out
}

/** Tile geometry, shared by the styles and the column maths so the two can't drift apart. */
const TILE = 38
const GAP = 5

/** Alpha a just-introduced tile carries, so it still reads as coloured rather than empty. */
const FILL_FLOOR = 0.18

/** `#rrggbb` → `r,g,b`, so an accent from any palette can be given a variable alpha. */
function rgbOf(hex: string): string {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16)
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`
}

const TIERS: { tier: TileState; label: string }[] = [
  { tier: 'unseen', label: 'not viewed' },
  { tier: 'introduced', label: 'introduced' },
  { tier: 'learnt', label: 'learnt' },
  { tier: 'more', label: 'ready for more' },
  { tier: 'off', label: 'off' },
]

/**
 * The whole curriculum as one board of tiles, each shaded by how solid that kanji is — the further
 * along you are, the pinker the board.
 *
 * Deliberately shows *every* enabled kanji rather than only the studied ones, because the shape of
 * what's left is the interesting part: a list of what you already know tells you nothing about the
 * road ahead. Tapping a tile studies that kanji.
 *
 * Green sits outside the pink ramp on purpose: it isn't "more mastered than solid", it's a different
 * kind of thing — this kanji has levelled far enough to have unlocked example words you haven't been
 * shown. Opening it clears the flag.
 *
 * Holding a tile drops that kanji out of practice and learning. Disabled tiles stay on the board,
 * faded: filtering them out would leave no way back in short of hunting through Settings.
 */
export function KanjiMosaic({ onSelect }: { onSelect: (u: Unit) => void }) {
  const colors = useColors()
  const styles = useStyles(makeStyles)
  const index = useContent()
  const { progress, update } = useProgress()
  const { ui } = useLanguage()
  // Everything in the enabled *categories*, disabled units included — see the note above.
  const units = index.content.units.filter((u) => isCategoryEnabled(progress.settings, u.category))
  const [width, setWidth] = useState(0)

  /*
   * Centre the board as a block, but fill each row from the left.
   *
   * Rendering explicit rows rather than one wrapping list: it lets the stagger animate ~18 nodes
   * instead of 121, and it centres correctly — `justifyContent: 'center'` on a wrapping row centres
   * every row *individually*, so a part-filled last row would float in the middle.
   */
  const cols = Math.max(1, Math.floor((width + GAP) / (TILE + GAP)))
  const gridWidth = cols * TILE + (cols - 1) * GAP
  // Chunked only once measured — at width 0 `cols` is 1, and 121 single-tile rows is a wasted pass.
  const rows = width > 0 ? chunk(units, cols) : []
  const wave = useStagger(rows.length)
  const rowAnim = useStaggerStyles(wave, rows.length)

  /*
   * Introduced → learnt is a ramp, not two steps: the tile carries the accent at an alpha that grows
   * with the level, so the board fills in gradually as a kanji beds in. Built from the palette's own
   * accent so a language that swaps its colours gets its own ramp for free.
   */
  const accentRgb = rgbOf(colors.accent)
  const fillFor = (u: Unit) => {
    const t = masteryProgress(progress.units[u.idx]?.lvl ?? 0)
    return `rgba(${accentRgb},${(FILL_FLOOR + (1 - FILL_FLOOR) * t).toFixed(3)})`
  }

  const unlockEvery = index.lang.batchUnlockEvery
  const stateOf = (u: Unit): TileState => {
    if (!isUnitEnabled(progress.settings, u)) return 'off'
    return readyForMore(progress, u, unlockEvery) ? 'more' : masteryTier(progress.units[u.idx]?.lvl ?? 0)
  }
  const waiting = units.filter((u) => stateOf(u) === 'more').length

  /** Hold to drop a kanji out of practice, hold again to bring it back. Same list Settings edits. */
  const toggleUnit = (u: Unit) =>
    update((p) => ({
      ...p,
      settings: { ...p.settings, disabledUnits: toggleInList(p.settings.disabledUnits, u.idx) },
    }))

  return (
    <View style={styles.wrap} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {waiting > 0 && (
        <View style={styles.prompt}>
          <Text style={styles.promptText}>
            Ready for more? {waiting} {waiting === 1 ? 'kanji has' : 'kanji have'} new words waiting.
          </Text>
        </View>
      )}
      {units.length === 0 ? (
        <Text style={styles.empty}>No {ui.noun} in the enabled set.</Text>
      ) : (
        <>
          {/*
            Rows, not a single wrapping list: the stagger then costs ~18 animated nodes instead of one
            per tile, which is what made the board janky. `cols` is already known from the centring
            maths, so the rows here are exactly the ones flex-wrap would have produced.
          */}
          <View style={[styles.rows, width > 0 && { width: gridWidth }]}>
            {rows.map((row, r) => (
              <Animated.View key={r} style={[styles.grid, rowAnim[r]]}>
                {row.map((u) => (
                  <Pressable
                    key={u.idx}
                    onPress={() => onSelect(u)}
                    onLongPress={() => toggleUnit(u)}
                    accessibilityRole="button"
                    accessibilityLabel={
                      stateOf(u) === 'more' ? `${u.form}, ready for more` : `${u.form}, ${stateOf(u)}`
                    }
                    accessibilityHint={
                      stateOf(u) === 'off' ? 'Hold to turn back on' : 'Hold to turn off for practice'
                    }
                    style={[
                      styles.tile,
                      styles[stateOf(u)],
                      // The ramp only applies between the two ends; unseen, ready and off are flat.
                      stateOf(u) !== 'off' &&
                        stateOf(u) !== 'more' &&
                        masteryTier(progress.units[u.idx]?.lvl ?? 0) !== 'unseen' && {
                          backgroundColor: fillFor(u),
                        },
                    ]}
                  >
                    <Text style={[styles.form, stateOf(u) === 'off' && styles.formOff]}>{u.form}</Text>
                  </Pressable>
                ))}
              </Animated.View>
            ))}
          </View>

          <View style={styles.legend}>
            {TIERS.map(({ tier, label }) => (
              <View key={tier} style={styles.legendItem}>
                <View style={[styles.swatch, styles[tier]]} />
                <Text style={styles.legendText}>{label}</Text>
              </View>
            ))}
          </View>
        </>
      )}
    </View>
  )
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  /*
   * No card: this sits directly on the page, the way the kana charts do.
   *
   * Children are centred individually rather than with `alignItems: 'center'` here — that would size
   * the wrapping grid to its content, so it would run off the side instead of wrapping.
   */
  wrap: { gap: spacing.md },
  prompt: {
    alignSelf: 'center',
    backgroundColor: colors.readySoft,
    borderColor: colors.ready,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  promptText: { color: colors.ink, fontFamily: fonts.medium, fontSize: 12, textAlign: 'center' },
  empty: { color: colors.muted, fontFamily: fonts.body, fontSize: 13, textAlign: 'center' },

  // Rows fill from the left; the block itself is centred by its computed width (see above).
  rows: { gap: GAP, alignSelf: 'center' },
  grid: { flexDirection: 'row', gap: GAP },
  tile: { width: TILE, height: TILE, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
  form: { color: colors.ink, fontSize: 20 },
  // Faded rather than hidden: an off kanji still has to be findable to switch back on.
  formOff: { color: colors.muted, opacity: 0.5 },

  // Tiles between these two ends take an interpolated alpha instead (see `fillFor`); these are the
  // legend's endpoints and the fallback.
  unseen: { backgroundColor: colors.border },
  introduced: { backgroundColor: `rgba(${rgbOf(colors.accent)},${FILL_FLOOR})` },
  learnt: { backgroundColor: colors.accent },
  // Off the ramp entirely — a prompt, not a rung.
  more: { backgroundColor: colors.ready },
  off: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border, opacity: 0.5 },

  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.xs, justifyContent: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 12, height: 12, borderRadius: 3 },
  legendText: { color: colors.muted, fontFamily: fonts.body, fontSize: 11 },
})
