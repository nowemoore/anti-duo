import { View, Text, Pressable, StyleSheet } from 'react-native'
import type { Unit } from '@shared/types'
import { applyLearned } from '@lib/study'
import { learnedVerbCount, topicsForLang, unitsNeededForVerbs } from '@lib/grammar'
import { useContent } from '../context/ContentContext'
import { useProgress } from '../context/ProgressContext'
import { useLanguage } from '../context/LanguageContext'
import { Icon } from './Icon'
import { fonts, radius, spacing, type Palette } from '../theme'
import { useColors, useStyles } from '../hooks/theme'

/**
 * Development-only shortcuts, for reaching states that would otherwise take a long study session to
 * reproduce. Rendered only under `__DEV__`, so it is stripped from release builds.
 *
 * The grammar seeder introduces the *fewest* units that unlock a given number of verbs, rather than
 * a pile of random kanji — so the resulting profile is small and targeted, and you can see the
 * locked and unlocked states of a topic without learning half the curriculum.
 */
export function DevTools() {
  const colors = useColors()
  const styles = useStyles(makeStyles)
  const index = useContent()
  const { progress, update } = useProgress()
  const lang = useLanguage().id

  const topics = topicsForLang(lang)
  const topic = topics[0]
  if (!__DEV__ || !topic) return null

  const needed = topic.minigame.minItems ?? 0
  const have = learnedVerbCount(index, progress)

  /** Introduce exactly enough units to know `target` verbs (on top of whatever is already known). */
  function seedVerbs(target: number) {
    const idxs = unitsNeededForVerbs(index, progress, target)
    const units = idxs
      .map((idx) => index.byIdx.get(idx))
      .filter((u): u is Unit => u !== undefined)
    if (units.length) update((p) => applyLearned(p, units))
  }

  /** Everything introduced — the far end of the curriculum. */
  function seedAll() {
    update((p) => applyLearned(p, index.content.units))
  }

  return (
    <View style={styles.panel}>
      <View style={styles.head}>
        <Icon name="triangle-exclamation" size={13} color={colors.accentInk} />
        <Text style={styles.title}>Dev tools</Text>
      </View>
      <Text style={styles.status}>
        You know {have} verb{have === 1 ? '' : 's'} · {topic.titleEn} needs {needed}
      </Text>

      <View style={styles.row}>
        <Pressable style={styles.btn} onPress={() => seedVerbs(needed - 1)}>
          <Text style={styles.btnText}>Just below the gate ({needed - 1})</Text>
        </Pressable>
        <Pressable style={styles.btn} onPress={() => seedVerbs(needed)}>
          <Text style={styles.btnText}>Exactly the gate ({needed})</Text>
        </Pressable>
      </View>
      <View style={styles.row}>
        <Pressable style={styles.btn} onPress={() => seedVerbs(needed * 2)}>
          <Text style={styles.btnText}>Comfortably past ({needed * 2})</Text>
        </Pressable>
        <Pressable style={styles.btn} onPress={seedAll}>
          <Text style={styles.btnText}>Learn everything</Text>
        </Pressable>
      </View>

      <Text style={styles.note}>
        Seeds only introduce units — nothing here is removed. Use Reset progress to go back.
      </Text>
    </View>
  )
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  panel: {
    backgroundColor: colors.panel,
    borderColor: colors.accentSoft,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { color: colors.accentInk, fontFamily: fonts.semibold, fontSize: 13 },
  status: { color: colors.muted, fontFamily: fonts.body, fontSize: 12 },
  row: { flexDirection: 'row', gap: spacing.sm },
  btn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
  },
  btnText: { color: colors.ink, fontFamily: fonts.medium, fontSize: 11, textAlign: 'center' },
  note: { color: colors.muted, fontFamily: fonts.body, fontSize: 10, fontStyle: 'italic' },
})
