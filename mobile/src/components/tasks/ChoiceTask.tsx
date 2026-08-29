import { Animated, View, Pressable, StyleSheet } from 'react-native'
import { checkChoice, type ChoiceTask } from '@lib/tasks'
import { SentenceView, type TokenOverride } from '../SentenceView'
import { SpeakButton } from '../SpeakButton'
import { VoweledText } from '../VoweledText'
import { useLanguage } from '../../context/LanguageContext'
import type { TaskUI, TaskViewProps } from './types'
import { edge, fonts, type Palette } from '../../theme'
import { useColors, useStyles } from '../../hooks/theme'
import { fadeColor, useVerdictFade } from '../../hooks/verdictFade'

function sentenceSpeech(task: ChoiceTask): string {
  return task.sentence.tokens.map((t) => t.surface).join('')
}

/** T3: read the sentence, pick one option. Covers cloze / root-cloze / pick-reading / pick-meaning. */
function ChoiceView({ task, answer, setAnswer, phase }: TaskViewProps<ChoiceTask, number | null>) {
  const colors = useColors()
  const styles = useStyles(makeStyles)
  const pack = useLanguage()
  const revealed = phase === 'revealed'
  const verdict = useVerdictFade(revealed)
  const isCloze = task.kind === 'cloze' // blank one char; select the target unit form
  const isRootCloze = task.kind === 'root-cloze' // blank the whole word; select which root fills it
  const isPickReading = task.kind === 'pick-reading' // select pronunciation
  const isMeaning = task.kind === 'pick-meaning'
  const formSelect = isCloze || isRootCloze // options are unit forms (rendered large)
  // Only pick-reading stacks one per row: its options are readings with a speak button beside each,
  // which needs the width. Meanings go two-up like every other four-option question — a column of
  // four short glosses left most of the card empty and pushed the last one near the fold.
  const stacked = isPickReading

  let override: TokenOverride
  if (isCloze) {
    override = revealed ? { forceReading: true, highlight: true } : { blankChar: task.blankChar }
  } else if (isRootCloze) {
    override = revealed ? { forceReading: true, highlight: true } : { blankWord: true }
  } else if (isPickReading) {
    override = { highlight: true, hideReading: true }
  } else {
    override = { highlight: true, hideMeaning: true }
  }
  const overrides = { [task.tokenIndex]: override }

  return (
    <View style={styles.root}>
      <View style={styles.sentenceRow}>
        <SentenceView
          tokens={task.sentence.tokens}
          overrides={overrides}
          revealMeanings={revealed}
          // Inside the sentence, so it follows the last character rather than centring itself
          // against the whole block — punctuation, not a control parked in the margin.
          trailing={
            <SpeakButton text={sentenceSpeech(task)} label="Play sentence" disabled={!revealed} small />
          }
        />
      </View>

      <View style={[styles.grid, stacked && styles.gridCol]}>
        {task.options.map((o, i) => {
          // Once revealed: the answer, the one you actually picked, and the also-rans. The last of
          // those recede — left untouched they'd read as choices still in play.
          const state = !revealed
            ? answer === i
              ? 'selected'
              : 'idle'
            : o.correct
              ? 'correct'
              : answer === i
                ? 'wrong'
                : 'recessed'
          return (
            <View key={i} style={[styles.cell, stacked && styles.cellFull, isPickReading && styles.readingCell]}>
              <AnimatedPressable
                disabled={revealed}
                onPress={() => setAnswer(i)}
                style={[
                  styles.opt,
                  formSelect && styles.optBig,
                  isMeaning && styles.optMeaning,
                  stacked && styles.optSlim,
                  isPickReading && styles.optFlex,
                  optFade(verdict, state, colors),
                ]}
              >
                <VoweledText
                  text={formSelect ? (pack.displayForm?.(o.label) ?? o.label) : o.label}
                  // A long gloss shrinks to fit its cell rather than wrapping to a fourth line and
                  // making one option taller than the other three. Two lines, then it scales.
                  numberOfLines={isMeaning ? 2 : undefined}
                  shrinkToFit={isMeaning}
                  style={[
                    styles.optText,
                    // pick-meaning's options are English glosses — Latin text on a Latin face.
                    isMeaning && styles.optTextEn,
                    formSelect && styles.clozeOptText,
                    isPickReading && styles.readingText,
                    isMeaning && styles.meaningText,
                    optTextStyle(state, colors),
                  ]}
                />
              </AnimatedPressable>
              {isPickReading && <SpeakButton text={o.label} label={`Play ${o.label}`} />}
            </View>
          )
        })}
      </View>
    </View>
  )
}

export const choiceTask: TaskUI<ChoiceTask, number | null> = {
  emptyAnswer: () => null,
  hasAnswer: (a) => a != null,
  View: ChoiceView,
  revealHint: (phase) => (phase === 'revealed' ? 'Hold a word for its reading & meaning' : 'Hold a word for its reading'),
  resolve: (task, answer) =>
    answer == null ? { phase: 'retry' } : { phase: 'revealed', score: checkChoice(task, answer) ? 1 : -1 },
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

/**
 * The chip's colours, eased across the reveal rather than swapped.
 *
 * Before the answer lands the fade sits at 0, so the interpolation just yields the idle or selected
 * look and still tracks taps; afterwards it eases to the verdict. Transparent is spelled as a
 * zero-alpha rgba because the keyword is not interpolable.
 */
function optFade(v: Animated.Value, state: string, colors: Palette) {
  const from =
    state === 'selected'
      ? { bg: colors.accentSoft, edge: colors.accent }
      : { bg: colors.panel, edge: colors.border }
  const to =
    state === 'correct'
      ? { bg: colors.correctSoft, edge: colors.correct }
      : state === 'wrong'
        ? { bg: colors.incorrectSoft, edge: colors.incorrect }
        : state === 'recessed'
          ? { bg: colors.recessed, edge: 'rgba(0,0,0,0)' }
          : from
  return {
    backgroundColor: fadeColor(v, from.bg, to.bg),
    borderColor: fadeColor(v, from.edge, to.edge),
  }
}
function optTextStyle(state: string, colors: Palette) {
  if (state === 'correct') return { color: colors.correct }
  if (state === 'wrong') return { color: colors.incorrect }
  if (state === 'recessed') return { color: colors.recessedInk }
  return null
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  root: { width: '100%' },
  // The play button now flows inside the sentence, so this is just the block's own spacing.
  sentenceRow: { alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10, alignSelf: 'center', width: '100%', maxWidth: 460 },
  gridCol: { flexDirection: 'column', flexWrap: 'nowrap', rowGap: 10, maxWidth: 340 },
  cell: { width: '48%' },
  cellFull: { width: '100%' },
  readingCell: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  opt: {
    borderWidth: edge,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: colors.panel,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optFlex: { flex: 1 },
  optSlim: { paddingVertical: 9 },
  optBig: { paddingVertical: 18, minHeight: 56 },
  optMeaning: { minHeight: 62 },
  // No family: VoweledText gives kanji runs the mincho face and leaves kana on the OS gothic.
  optText: { fontSize: 20, color: colors.ink },
  optTextEn: { fontFamily: fonts.body },
  // Fixed lineHeight so the unit-form options (kanji char / Arabic root) share a row size across modes.
  clozeOptText: { fontSize: 32, lineHeight: 40 },
  readingText: { fontSize: 22 },
  // Two to a row, so each cell has to hold its own height whatever the gloss is: a fixed minHeight
  // keeps the four cells a matched pair of pairs instead of a ragged grid.
  meaningText: { fontSize: 15, lineHeight: 20, textAlign: 'center' },
})
