import { Animated, View, Text, Pressable, StyleSheet } from 'react-native'
import type { KanaTask } from '@lib/kanaTasks'
import { KANA_TASK_TUNING } from '@lib/kanaTaskTypes'
import { SentenceView, type TokenOverride } from '../SentenceView'
import { SpeakButton } from '../SpeakButton'
import type { TaskUI, TaskViewProps } from './types'
import { edge, fonts, type Palette } from '../../theme'
import { useColors, useStyles } from '../../hooks/theme'
import { fadeColor, useVerdictFade } from '../../hooks/verdictFade'

/**
 * A question about a kana word. Same shell as the kanji choice tasks — a prompt, four options, the
 * verdict eased across them — because it is the same act of answering; only the subject differs.
 *
 * `kana-spell` has no sentence: the meaning is the prompt and the options are ways of writing it.
 * The other two put the word in a sentence, blanked out (cloze) or highlighted (meaning).
 *
 * The focus token is always highlighted, which is also what keeps it in kana: an unmet word renders
 * as English in ordinary reading, and here that English would be the answer printed above itself.
 */
function KanaView({ task, answer, setAnswer, phase }: TaskViewProps<KanaTask, number | null>) {
  const colors = useColors()
  const styles = useStyles(makeStyles)
  const revealed = phase === 'revealed'
  const verdict = useVerdictFade(revealed)
  const isMeaning = task.kind === 'kana-meaning'
  const hasSentence = task.sentence != null && task.tokenIndex != null

  const override: TokenOverride =
    task.kind === 'kana-cloze' && !revealed
      ? { blankWord: true }
      : { highlight: true, hideMeaning: !revealed }

  return (
    <View style={styles.root}>
      <Text style={styles.prompt}>{KANA_TASK_TUNING[task.kind].label}</Text>

      {hasSentence ? (
        <View style={styles.sentenceRow}>
          <SentenceView
            tokens={task.sentence!.tokens}
            overrides={{ [task.tokenIndex!]: override }}
            revealMeanings={revealed}
            // Inside the sentence, so it follows the last character rather than centring itself
            // against the whole block — punctuation, not a control parked in the margin.
            trailing={
              <SpeakButton
                text={task.sentence!.tokens.map((t) => t.surface).join('')}
                label="Play sentence"
                disabled={!revealed}
                small
              />
            }
          />
        </View>
      ) : (
        <View style={styles.sentenceRow}>
          <Text style={styles.gloss}>{task.word.gloss.join(', ')}</Text>
        </View>
      )}

      <View style={[styles.grid, isMeaning && styles.gridCol]}>
        {task.options.map((o, i) => {
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
            <View key={i} style={[styles.cell, isMeaning && styles.cellFull]}>
              <AnimatedPressable
                disabled={revealed}
                onPress={() => setAnswer(i)}
                style={[styles.opt, isMeaning && styles.optSlim, optFade(verdict, state, colors)]}
              >
                <Text
                  style={[
                    styles.optText,
                    // The meaning options are English glosses — Latin text on the Latin face.
                    isMeaning && styles.optTextEn,
                    optTextStyle(state, colors),
                  ]}
                >
                  {o.label}
                </Text>
              </AnimatedPressable>
              {/* Hearing it is half of telling パン from バン, so every spelling option is speakable. */}
              {!isMeaning && <SpeakButton text={o.label} label={`Play ${o.label}`} />}
            </View>
          )
        })}
      </View>
    </View>
  )
}

export const kanaTask: TaskUI<KanaTask, number | null> = {
  emptyAnswer: () => null,
  hasAnswer: (a) => a != null,
  View: KanaView,
  revealHint: (phase) =>
    phase === 'revealed' ? 'Hold a word for its reading & meaning' : 'Hold a word for its reading',
  resolve: (task, answer) =>
    answer == null
      ? { phase: 'retry' }
      : { phase: 'revealed', score: task.options[answer].correct ? 1 : -1 },
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

/** The chip's colours, eased across the reveal. Mirrors ChoiceTask's, so the two grade alike. */
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
  return { backgroundColor: fadeColor(v, from.bg, to.bg), borderColor: fadeColor(v, from.edge, to.edge) }
}

function optTextStyle(state: string, colors: Palette) {
  if (state === 'correct') return { color: colors.correct }
  if (state === 'wrong') return { color: colors.incorrect }
  if (state === 'recessed') return { color: colors.recessedInk }
  return null
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  root: { width: '100%' },
  prompt: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 10,
  },
  // The play button now flows inside the sentence, so this is just the block's own spacing.
  sentenceRow: { alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  // The meaning standing in for a sentence: it is the prompt, so it is sized like one.
  gloss: { color: colors.ink, fontFamily: fonts.body, fontSize: 20, textAlign: 'center' },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
    alignSelf: 'center',
    width: '100%',
    maxWidth: 460,
  },
  gridCol: { flexDirection: 'column', flexWrap: 'nowrap', rowGap: 10, maxWidth: 340 },
  // Room for the speak button beside each spelling; the meaning options have none, so they fill.
  cell: { width: '48%', flexDirection: 'row', alignItems: 'center', gap: 8 },
  cellFull: { width: '100%', flexDirection: 'column' },
  opt: {
    flex: 1,
    borderWidth: edge,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: colors.panel,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optSlim: { alignSelf: 'stretch', paddingVertical: 9 },
  // No family: kana is set on the OS gothic everywhere in the course.
  optText: { fontSize: 22, color: colors.ink },
  optTextEn: { fontFamily: fonts.body, fontSize: 16, textAlign: 'center' },
})
