import { useState } from 'react'
import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { ActionRow } from '../ActionRow'
import { ProgressTally } from '../ProgressTally'
import {
  canDrill,
  isTraced,
  masteryOf,
  studiedCount,
  totalKanaCount,
  tracedToPractise,
  type KanaScript,
} from '@lib/kana'
import { KANA_DRILL_ITEMS } from '@shared/constants'
import { useProgress } from '../../context/ProgressContext'
import { useScreenHeader } from '../../context/HeaderContext'
import { useTabBarHeight } from '../../context/TabBarContext'
import { Segmented } from '../Segmented'
import { Stagger } from '../Stagger'
import { KanaGrid, type CellState } from './KanaGrid'
import { fonts, type Palette, spacing } from '../../theme'
import { useStyles } from '../../hooks/theme'

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
  onSelect,
  onPractice,
}: {
  scripts: KanaScript[]
  onSelect: (script: KanaScript, char: string) => void
  onPractice: () => void
}) {
  const styles = useStyles(makeStyles)
  const tabBar = useTabBarHeight()
  const { progress } = useProgress()

  // No help button: a kana reference chart would hand over the very thing this page teaches.
  useScreenHeader()

  // One script on screen at a time. Labels are English on purpose — a learner opening this page
  // can't yet read ひらがな, which is the entire reason they're here.
  const [activeId, setActiveId] = useState(scripts[0]?.id)
  const active = scripts.find((s) => s.id === activeId) ?? scripts[0]

  const studied = studiedCount(progress, scripts)
  const total = totalKanaCount(scripts)
  // Practice is multiple choice, so one script needs enough characters to fill the options.
  const ready = canDrill(progress)
  const toGo = tracedToPractise(progress)
  const stateOf = (char: string): CellState => (isTraced(progress, char) ? 'studied' : 'new')

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingBottom: tabBar + spacing.xxl }]}
    >
      <Stagger>
      {/* Same header as the kanji page, tightened into its own block: the page's outer gap is sized
          for the chart sections, which would push the tally miles off its button. */}
      <View style={styles.head}>
        <ProgressTally count={studied} total={total} label="characters studied" />
        {/* The only entry action here: there is no "teach me five random ones", because the charts
            below are the browse *and* the curriculum — you pick the character you want. */}
        <ActionRow
          primary
          icon="play"
          title="Practice"
          sub={
            ready
              ? `${KANA_DRILL_ITEMS} questions`
              : `study ${toGo} more ${toGo === 1 ? 'character' : 'characters'} of one script first`
          }
          disabled={!ready}
          onPress={onPractice}
        />
        <Text style={styles.scrollNote}>or scroll to continue learning</Text>
      </View>

      <Segmented
        values={scripts.map((s) => s.title.en)}
        index={Math.max(0, scripts.findIndex((s) => s.id === active?.id))}
        onChange={(next) => setActiveId(scripts[next]?.id)}
        style={styles.tabs}
      />

      {active && (
        <View style={styles.script}>
          <Text style={styles.blurb}>{active.blurb}</Text>

          {active.sections.map((section) => (
            <View key={section.id} style={styles.section}>
              <Text style={styles.sectionLabel}>{section.label}</Text>
              <KanaGrid
                section={section}
                size="large"
                flip={false}
                stateOf={stateOf}
                fillOf={(char) => masteryOf(progress, char)}
                onPress={(char) => onSelect(active, char)}
              />
            </View>
          ))}
        </View>
      )}
      </Stagger>
    </ScrollView>
  )
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  scroll: { flex: 1 },
  // Generous gaps: this page is a long scroll of dense grids, and the sections need to read as
  // separate blocks rather than one continuous wall of cells.
  content: { gap: spacing.xxl, paddingTop: spacing.md },

  head: { gap: spacing.md },
  // Sits directly under the button, so the alternative to practising is obvious without hunting.
  scrollNote: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: spacing.sm,
  },

  tabs: { alignSelf: 'center', width: 260 },

  script: { gap: spacing.xl, alignItems: 'center' },
  blurb: { color: colors.muted, fontFamily: fonts.body, fontSize: 12, textAlign: 'center' },
  section: { gap: spacing.sm, alignItems: 'center' },
  sectionLabel: { color: colors.accentInk, fontFamily: fonts.medium, fontSize: 11 },
})
