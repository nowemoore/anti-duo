import { useState } from 'react'
import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { ActionPair, ActionRow } from '../ActionRow'
import { ScrollCue } from '../ScrollCue'
import { ProgressTally } from '../ProgressTally'
import {
  canDrill,
  canPractiseWords,
  isTraced,
  masteryOf,
  studiedCount,
  totalKanaCount,
  tracedToPractise,
  wordsToPractise,
  type KanaScript,
} from '@lib/kana'
import { KANA_DRILL_ITEMS, KANA_WORD_ITEMS } from '@shared/constants'
import { useContent } from '../../context/ContentContext'
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
  onWordPractice,
}: {
  scripts: KanaScript[]
  onSelect: (script: KanaScript, char: string) => void
  onPractice: () => void
  onWordPractice: () => void
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
  // Words come from their own list and open on their own terms: enough of them have to be *readable*
  // — every character traced — before a multiple-choice question can be filled.
  const kanaWords = useContent().content.kanaWords ?? []
  const wordsReady = canPractiseWords(progress, kanaWords)
  const wordsToGo = wordsToPractise(progress, kanaWords)
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
        {/*
          The two drills, side by side as on the vocabulary page. There is no "teach me five random
          ones" among them: the charts below are the browse *and* the curriculum, so learning is
          always a character you chose.

          Sounds first and filled — it is what a learner needs before anything else; words are where
          they go once the glyphs are easy.
        */}
        <ActionPair>
          <ActionRow
            compact
            primary
            icon="play"
            title="Practice sounds"
            sub={
              ready
                ? `${KANA_DRILL_ITEMS} questions`
                : `study ${toGo} more ${toGo === 1 ? 'character' : 'characters'} first`
            }
            disabled={!ready}
            onPress={onPractice}
          />
          <ActionRow
            compact
            icon="book-open"
            title="Practice real words"
            sub={
              wordsReady
                ? `${KANA_WORD_ITEMS} questions`
                : `${wordsToGo} more readable ${wordsToGo === 1 ? 'word' : 'words'} needed`
            }
            disabled={!wordsReady}
            onPress={onWordPractice}
          />
        </ActionPair>
        <Text style={styles.scrollNote}>or scroll to continue learning</Text>
      </View>

      <ScrollCue />

      <Segmented
        values={scripts.map((s) => s.title.en)}
        index={Math.max(0, scripts.findIndex((s) => s.id === active?.id))}
        onChange={(next) => setActiveId(scripts[next]?.id)}
        style={styles.tabs}
      />

      {active && (
        <View style={styles.script}>
          {/* The alphabet's name in its own script — the first thing an alphabet teaches you about
              itself. No English under it: the pill directly above already says "Hiragana", and
              printing it twice makes the title look like a translation rather than a name. */}
          <View style={styles.scriptHead}>
            <Text style={styles.scriptTitle}>{active.title.native}</Text>
            <Text style={styles.blurb}>{active.blurb}</Text>
          </View>

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
  /* Same rhythm as the vocabulary page: header, divider and switch sit a step apart, so the cue
     reads as the hand-off between them rather than as a band floating in its own space. The page's
     generous gap is what the chart sections need, not what these three do — so it moved onto the
     one block that wanted it (see `script`). */
  content: { gap: spacing.md, paddingTop: spacing.md },

  head: { gap: spacing.md },
  // Sits directly under the button, so the alternative to practising is obvious without hunting.
  scrollNote: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: spacing.xs,
  },

  tabs: { alignSelf: 'center', width: 260 },

  // The long scroll of dense grids starts here, and it needs the air the page used to give away to
  // every gap: the chart sections have to read as separate blocks, not one wall of cells.
  script: { gap: spacing.xl, alignItems: 'center', marginTop: spacing.xl },
  // Title and blurb are one block: the blurb finishes the sentence the title starts, so they sit
  // closer to each other than either does to the charts below.
  scriptHead: { alignItems: 'center', gap: spacing.xs },
  scriptTitle: { color: colors.ink, fontFamily: fonts.headingBold, fontSize: 20 },
  blurb: { color: colors.muted, fontFamily: fonts.body, fontSize: 12, textAlign: 'center' },
  section: { gap: spacing.sm, alignItems: 'center' },
  // Lavender, like every other label that says which part of something you are looking at. The
  // accent is reserved for what you can act on, and a section heading is not that.
  sectionLabel: { color: colors.highlightInk, fontFamily: fonts.medium, fontSize: 11 },
})
