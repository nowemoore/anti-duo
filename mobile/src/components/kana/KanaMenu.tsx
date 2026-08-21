import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native'
import { isTraced, studiedCount, totalKanaCount, type KanaScript } from '@lib/kana'
import { useProgress } from '../../context/ProgressContext'
import { useScreenHeader } from '../../context/HeaderContext'
import { Icon } from '../Icon'
import { Bilingual } from '../Bilingual'
import { KanaGrid, type CellState } from './KanaGrid'
import { fonts, radius, spacing, type Palette } from '../../theme'
import { useColors, useStyles } from '../../hooks/theme'

/**
 * The Learn kana page: a jump into practice, then each script's full chart inline.
 *
 * Every character is reachable from here — there's no prescribed order and nothing is gated, so the
 * chart *is* the curriculum. A cell fills in once its character has been completed.
 *
 * Vowels run across the columns and each row is one consonant group, which is the arrangement the
 * charts learners meet elsewhere use. (The compact reference behind the help button keeps its own
 * transposed layout; it's optimised for fitting in a popover, not for study.)
 */
export function KanaMenu({
  scripts,
  onBack,
  onSelect,
  onPractice,
}: {
  scripts: KanaScript[]
  onBack: () => void
  onSelect: (script: KanaScript, char: string) => void
  onPractice: () => void
}) {
  const colors = useColors()
  const styles = useStyles(makeStyles)
  const { progress } = useProgress()

  // No help button: a kana reference chart would hand over the very thing this page teaches.
  useScreenHeader(onBack)

  const studied = studiedCount(progress, scripts)
  const total = totalKanaCount(scripts)
  const stateOf = (char: string): CellState => (isTraced(progress, char) ? 'studied' : 'new')

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Text style={styles.tally}>
        {studied} <Text style={styles.tallyOf}>/ {total} studied</Text>
      </Text>

      {/* Nothing to practise until at least one character has been completed. */}
      <Pressable
        style={[styles.practice, studied === 0 && styles.practiceOff]}
        onPress={onPractice}
        disabled={studied === 0}
        accessibilityRole="button"
        accessibilityState={{ disabled: studied === 0 }}
      >
        <Icon
          name="dumbbell"
          size={16}
          color={studied === 0 ? colors.muted : colors.onAccent}
        />
        <Text style={[styles.practiceText, studied === 0 && styles.practiceTextOff]}>
          {studied === 0 ? 'Learn a character to unlock practice' : 'Jump to practice'}
        </Text>
      </Pressable>
      <Text style={styles.scrollNote}>or scroll to continue learning</Text>

      {scripts.map((script) => (
        <View key={script.id} style={styles.script}>
          <Bilingual native={script.title.native} en={script.title.en} large />
          <Text style={styles.blurb}>{script.blurb}</Text>

          {script.sections.map((section) => (
            <View key={section.id} style={styles.section}>
              <Text style={styles.sectionLabel}>{section.label}</Text>
              <KanaGrid
                section={section}
                size="large"
                flip={false}
                stateOf={stateOf}
                onPress={(char) => onSelect(script, char)}
              />
            </View>
          ))}
        </View>
      ))}
    </ScrollView>
  )
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  scroll: { flex: 1 },
  // Generous gaps: this page is a long scroll of dense grids, and the sections need to read as
  // separate blocks rather than one continuous wall of cells.
  content: { gap: spacing.xxl, paddingVertical: spacing.md, paddingBottom: spacing.xxl },

  tally: { color: colors.ink, fontFamily: fonts.headingBold, fontSize: 26, textAlign: 'center' },
  tallyOf: { color: colors.muted, fontFamily: fonts.body, fontSize: 14 },

  practice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 48,
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
  },
  practiceOff: { backgroundColor: colors.panel, borderColor: colors.border, borderWidth: 1 },
  practiceText: { color: colors.onAccent, fontFamily: fonts.semibold, fontSize: 14 },
  practiceTextOff: { color: colors.muted, fontFamily: fonts.body, fontSize: 13 },
  // Sits directly under the button, so the alternative to practising is obvious without hunting.
  scrollNote: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: -spacing.lg,
  },

  script: { gap: spacing.xl, alignItems: 'center' },
  blurb: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
    textAlign: 'center',
    marginTop: -spacing.md,
  },
  section: { gap: spacing.sm, alignItems: 'center' },
  sectionLabel: { color: colors.accentInk, fontFamily: fonts.medium, fontSize: 11 },
})
