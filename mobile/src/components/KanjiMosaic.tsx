import { View, Text, Pressable, StyleSheet } from 'react-native'
import type { Unit } from '@shared/types'
import { enabledUnits, masteryTier, readyForMore, type MasteryTier } from '@lib/study'
import { useContent } from '../context/ContentContext'
import { useProgress } from '../context/ProgressContext'
import { useLanguage } from '../context/LanguageContext'
import { fonts, radius, spacing, type Palette } from '../theme'
import { useStyles } from '../hooks/theme'

/** The mastery ramp, plus the one state that isn't on it. */
type TileState = MasteryTier | 'more'

const TIERS: { tier: TileState; label: string }[] = [
  { tier: 'unseen', label: 'unseen' },
  { tier: 'shaky', label: 'shaky' },
  { tier: 'getting', label: 'getting there' },
  { tier: 'solid', label: 'solid' },
  { tier: 'more', label: 'ready for more' },
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
 */
export function KanjiMosaic({ onSelect }: { onSelect: (u: Unit) => void }) {
  const styles = useStyles(makeStyles)
  const index = useContent()
  const { progress } = useProgress()
  const { ui } = useLanguage()
  const units = enabledUnits(index, progress)

  const unlockEvery = index.lang.batchUnlockEvery
  const stateOf = (u: Unit): TileState =>
    readyForMore(progress, u, unlockEvery) ? 'more' : masteryTier(progress.units[u.idx]?.lvl ?? 0)
  const solid = units.filter((u) => masteryTier(progress.units[u.idx]?.lvl ?? 0) === 'solid').length
  const waiting = units.filter((u) => stateOf(u) === 'more').length

  return (
    <View style={styles.wrap}>
      <Text style={styles.count}>
        {solid} <Text style={styles.countOf}>/ {units.length} solid</Text>
      </Text>

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
          <View style={styles.grid}>
            {units.map((u) => (
              <Pressable
                key={u.idx}
                onPress={() => onSelect(u)}
                accessibilityRole="button"
                accessibilityLabel={
                  stateOf(u) === 'more' ? `${u.form}, ready for more` : `${u.form}, ${stateOf(u)}`
                }
                style={[styles.tile, styles[stateOf(u)]]}
              >
                <Text style={styles.form}>{u.form}</Text>
              </Pressable>
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
    backgroundColor: colors.correctSoft,
    borderColor: colors.correct,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  promptText: { color: colors.ink, fontFamily: fonts.medium, fontSize: 12, textAlign: 'center' },
  count: { color: colors.ink, fontFamily: fonts.semibold, fontSize: 14, textAlign: 'center', fontVariant: ['tabular-nums'] },
  countOf: { color: colors.muted, fontFamily: fonts.body, fontSize: 12 },
  empty: { color: colors.muted, fontFamily: fonts.body, fontSize: 13, textAlign: 'center' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, justifyContent: 'center' },
  tile: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
  form: { color: colors.ink, fontSize: 20 },

  /*
   * Four steps of the accent, from a flat neutral to the full colour. Opacity rather than four hand
   * -picked colours, so the ramp stays coherent if a language swaps its palette.
   */
  unseen: { backgroundColor: colors.border },
  shaky: { backgroundColor: colors.accentSoft },
  getting: { backgroundColor: colors.accentHover },
  solid: { backgroundColor: colors.accent },
  // Off the ramp entirely — a prompt, not a rung.
  more: { backgroundColor: colors.correct },

  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.xs, justifyContent: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 12, height: 12, borderRadius: 3 },
  legendText: { color: colors.muted, fontFamily: fonts.body, fontSize: 11 },
})
