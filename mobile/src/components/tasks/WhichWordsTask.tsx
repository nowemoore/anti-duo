import { Animated, View, Text, Pressable, StyleSheet } from 'react-native'
import { isWhichWordsPerfect, scoreWhichWords, type WhichWordsTask } from '@lib/tasks'
import { useReveal } from '../RevealStrip'
import { VoweledText } from '../VoweledText'
import { useLanguage } from '../../context/LanguageContext'
import { RootWord } from '../RootWord'
import { SpeakButton } from '../SpeakButton'
import type { TaskUI, TaskViewProps } from './types'
import { fonts, type Palette } from '../../theme'
import { useColors, useStyles } from '../../hooks/theme'
import { fadeColor, useVerdictFade } from '../../hooks/verdictFade'

/** T2: multi-select the real words. Tap toggles; hold reveals reading (→ + meaning once answered). */
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
            <View key={i} style={styles.cell}>
              <AnimatedPressable
                onPress={() => toggle(i)}
                onLongPress={canReveal ? () => reveal.show(revealText) : undefined}
                delayLongPress={150}
                onPressOut={reveal.hide}
                style={[styles.opt, optFade(verdict, state, colors)]}
              >
                <RootWord
                  surface={o.word}
                  spans={revealed && o.correct ? pack.rootSpans?.(o.word, task.form) : undefined}
                  style={[styles.optWord, optTextStyle(state, colors)]}
                />
              </AnimatedPressable>
              {revealed && o.correct && (
                <SpeakButton text={o.reading} label={`Play ${o.word}`} small style={styles.optSpeak} />
              )}
            </View>
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
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12, alignSelf: 'center', width: '100%', maxWidth: 460 },
  cell: { width: '48%', position: 'relative' },
  opt: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 10,
    backgroundColor: colors.panel,
    alignItems: 'center',
  },
  // No family: VoweledText gives kanji runs the mincho face and leaves kana on the OS gothic.
  optWord: { fontSize: 22, color: colors.ink },
  optSpeak: { position: 'absolute', top: 6, right: 6 },
  retrySlot: { minHeight: 34, justifyContent: 'center' },
  retry: { color: colors.incorrect, fontFamily: fonts.body, fontSize: 13, textAlign: 'center', paddingVertical: 8 },
})
