import { Animated, View, Text, Pressable, StyleSheet } from 'react-native'
import { isWhichWordsPerfect, scoreWhichWords, type WhichWordsTask } from '@lib/tasks'
import { useReveal } from '../RevealStrip'
import { VoweledText } from '../VoweledText'
import { useLanguage } from '../../context/LanguageContext'
import { RootWord } from '../RootWord'
import { Icon } from '../Icon'
import { SpeakButton } from '../SpeakButton'
import type { TaskUI, TaskViewProps } from './types'
import { edge, fonts, type Palette } from '../../theme'
import { useColors, useStyles } from '../../hooks/theme'
import { fadeColor, useVerdictFade } from '../../hooks/verdictFade'

/**
 * T2: multi-select the real words. Tap toggles; hold reveals reading (→ + meaning once answered).
 *
 * Full-width rows with a checkbox, not a grid of chips. This is the one question in the app that
 * takes more than one answer, and a grid of tappable tiles looks exactly like the ones that take
 * only one — nothing on screen said "you may pick several" until you had already picked wrong. A
 * checkbox says it before the first tap, and it is the one control that means precisely that.
 */
function WhichWordsView({ task, answer, setAnswer, phase }: TaskViewProps<WhichWordsTask, number[]>) {
  const colors = useColors()
  const styles = useStyles(makeStyles)
  const revealed = phase === 'revealed'
  const verdict = useVerdictFade(revealed)
  const reveal = useReveal()
  const pack = useLanguage()
  const selSet = new Set(answer)
  const toggle = (i: number) => {
    if (revealed) return
    const s = new Set(answer)
    s.has(i) ? s.delete(i) : s.add(i)
    setAnswer([...s])
  }

  return (
    <View style={styles.root}>
      <VoweledText text={pack.displayForm?.(task.form) ?? task.form} style={styles.promptForm} />

      <View style={styles.grid}>
        {task.options.map((o, i) => {
          const isSel = selSet.has(i)
          // Multi-select, so "correct" means a real word. Invented ones you ticked stay highlighted
          // as your mistake; the ones you left alone recede.
          const state = revealed
            ? o.correct
              ? 'correct'
              : isSel
                ? 'wrong'
                : 'recessed'
            : isSel
              ? 'selected'
              : 'idle'
          const revealText = revealed ? `${o.reading}  ·  ${o.meaning}` : o.reading
          const canReveal = revealed ? o.correct : true
          return (
            <AnimatedPressable
              key={i}
              onPress={() => toggle(i)}
              onLongPress={canReveal ? () => reveal.show(revealText) : undefined}
              delayLongPress={150}
              onPressOut={reveal.hide}
              style={[styles.opt, optFade(verdict, state, colors)]}
            >
              {/* Ticked while you are choosing; after the reveal the box carries the verdict's
                  colour like everything else on the row, so a word you ticked wrongly still shows
                  as ticked — it was your answer, and hiding it would hide the mistake. */}
              <View style={[styles.box, isSel && styles.boxOn, isSel && boxTint(state, colors)]}>
                {isSel && <Icon name="check" size={11} color={colors.onAccent} />}
              </View>
              <RootWord
                surface={o.word}
                spans={revealed && o.correct ? pack.rootSpans?.(o.word, task.form) : undefined}
                style={[styles.optWord, optTextStyle(state, colors)]}
              />
              {/* Reserved either way, so revealing the answers doesn't reflow the rows. */}
              <View style={styles.speakSlot}>
                {revealed && o.correct && (
                  <SpeakButton text={o.reading} label={`Play ${o.word}`} small />
                )}
              </View>
            </AnimatedPressable>
          )
        })}
      </View>

      {/* Reserved, so the retry line appearing doesn't lift the options. */}
      <View style={styles.retrySlot}>
        {phase === 'retry' && (
          <Text style={styles.retry}>Not quite! Try again.</Text>
        )}
      </View>
    </View>
  )
}

export const whichWordsTask: TaskUI<WhichWordsTask, number[]> = {
  emptyAnswer: () => [],
  hasAnswer: () => true, // lockable with any (or no) selection
  View: WhichWordsView,
  revealHint: (phase) => (phase === 'revealed' ? 'Hold a word for its reading & meaning' : 'Hold a word for its reading'),
  resolve: (task, answer, phase) => {
    const sel = new Set(answer)
    if (phase === 'first' && !isWhichWordsPerfect(task, sel)) return { phase: 'retry' }
    return { phase: 'revealed', score: scoreWhichWords(task, sel) }
  },
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

/**
 * The chip's colours, eased across the reveal rather than swapped. Before the answer lands the fade
 * sits at 0, so the interpolation yields the idle or selected look and still tracks taps. Transparent
 * is spelled as a zero-alpha rgba because the keyword is not interpolable.
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
/** The ticked box's fill once a verdict is in — the row's colour, so the two agree. */
function boxTint(state: string, colors: Palette) {
  if (state === 'correct') return { backgroundColor: colors.correct, borderColor: colors.correct }
  if (state === 'wrong') return { backgroundColor: colors.incorrect, borderColor: colors.incorrect }
  return null
}

function optTextStyle(state: string, colors: Palette) {
  if (state === 'correct') return { color: colors.correct }
  if (state === 'wrong') return { color: colors.incorrect }
  if (state === 'recessed') return { color: colors.recessedInk }
  return null
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  root: { width: '100%' },
  // lineHeight fixed (matches the Learn card's bigForm) so the line size is the same in every language.
  // No family here either — the prompt is routed through VoweledText for the same split.
  promptForm: { fontSize: 64, lineHeight: 70, color: colors.ink, textAlign: 'center', marginBottom: 18 },
  // One row per option, stacked: a list is what a multi-select looks like.
  grid: { rowGap: 10, alignSelf: 'center', width: '100%', maxWidth: 460 },
  opt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: edge,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: colors.panel,
  },
  // Square, so it reads as a checkbox rather than as a radio: several of these may be ticked.
  box: {
    width: 26,
    height: 26,
    borderRadius: 7,
    borderWidth: edge,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  // Takes the row, so the speaker sits at the far edge whatever the word's length.
  // No family: VoweledText gives kanji runs the mincho face and leaves kana on the OS gothic.
  optWord: { flex: 1, fontSize: 22, color: colors.ink },
  speakSlot: { width: 34, alignItems: 'flex-end' },
  retrySlot: { minHeight: 34, justifyContent: 'center' },
  retry: { color: colors.incorrect, fontFamily: fonts.body, fontSize: 13, textAlign: 'center', paddingVertical: 8 },
})
