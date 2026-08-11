import { useCallback, useMemo, useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import type { Unit } from '@shared/types'
import { DrawCanvas } from '../../components/DrawCanvas'
import { Icon } from '../../components/Icon'
import { FadeView } from '../../components/FadeView'
import { scoreWord, drawable, traceable, type RawStroke } from './handwriting'
import { useLearned } from '../../hooks/useLearned'
import { useAuth } from '../../context/AuthContext'
import { logTracedAttempt, toTarget } from './drawTarget'
import { colors, fonts, spacing } from '../../theme'

/**
 * Single-unit write practice — the "write" page of the browse-detail view. Freely repeatable:
 * draw → lock → ✓/✗ (on-device recognizer) → Try again. No header, no stats (unlike DrawReview,
 * which does the same loop across a whole just-learned set). JA-only, so the static (JA) palette is fine.
 */
export function DrawPractice({ unit }: { unit: Unit }) {
  const userId = useAuth().session?.user?.id
  const isLearned = useLearned()
  const canDraw = useCallback((w: string) => drawable(w) && [...w].every((c) => isLearned(c)), [isLearned])
  const canTrace = useCallback((w: string) => traceable(w) && [...w].every((c) => isLearned(c)), [isLearned])
  const target = useMemo(() => toTarget(unit, canDraw, canTrace), [unit, canDraw, canTrace])

  const [strokes, setStrokes] = useState<RawStroke[]>([])
  const [revealed, setRevealed] = useState(false)
  const [correct, setCorrect] = useState(false)
  const [attempt, setAttempt] = useState(0)

  if (!target) {
    return (
      <View style={styles.root}>
        <View style={styles.center}>
          <Text style={styles.none}>This one isn’t drawable yet.</Text>
        </View>
      </View>
    )
  }

  const lockIn = () => {
    if (revealed || strokes.length === 0) return
    // A traced word has no reference pattern to score against — reveal it without a verdict.
    setCorrect(target.traced ? false : scoreWord(target.word, strokes).correct)
    setRevealed(true)
    logTracedAttempt(userId, target, strokes)
  }
  const giveUp = () => {
    if (!revealed) {
      setCorrect(false)
      setRevealed(true)
    }
  }
  const tryAgain = () => {
    setStrokes([])
    setRevealed(false)
    setCorrect(false)
    setAttempt((a) => a + 1)
  }

  const hasDrawn = strokes.length > 0

  return (
    <View style={styles.root}>
      {/* No verdict for a traced word — there's nothing to check it against. */}
      {revealed && !target.traced && (
        <View style={styles.corner}>
          <Icon
            name={correct ? 'circle-check' : 'circle-xmark'}
            size={26}
            color={correct ? colors.correct : colors.incorrect}
          />
        </View>
      )}

      <View style={styles.prompt}>
        <Text style={styles.reading}>{target.reading || target.meaning}</Text>
        {target.traced && <Text style={styles.traceHint}>Trace over the outline — not graded yet.</Text>}
      </View>

      <FadeView key={attempt} style={styles.canvasFade}>
        <DrawCanvas
          key={attempt}
          disabled={revealed}
          initialStrokes={strokes}
          onStrokes={(s) => !revealed && setStrokes(s)}
          onNoClue={giveUp}
          guide={target.traced ? target.word : undefined}
        />
      </FadeView>

      <View style={styles.answerSlot}>
        {revealed && (
          <View style={styles.answer}>
            <Text style={styles.answerWord}>{target.word}</Text>
            <Text style={styles.answerMeaning}>{target.meaning}</Text>
          </View>
        )}
      </View>

      <Pressable
        style={[styles.btn, !revealed && !hasDrawn && styles.disabled]}
        onPress={revealed ? tryAgain : lockIn}
        disabled={!revealed && !hasDrawn}
        accessibilityLabel={revealed ? 'Try again' : 'Lock in your answer'}
      >
        <Icon name={revealed ? 'rotate-left' : 'lock'} size={15} color={colors.onAccent} />
        <Text style={styles.btnText}>{revealed ? 'Try again' : 'Lock in answer'}</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  none: { color: colors.muted, fontFamily: fonts.body },
  corner: { position: 'absolute', top: 0, right: 0, zIndex: 2 },
  prompt: { alignItems: 'center', marginBottom: spacing.md },
  reading: { color: colors.ink, fontFamily: fonts.body, fontSize: 30 },
  traceHint: { color: colors.muted, fontFamily: fonts.body, fontSize: 11, fontStyle: 'italic', marginTop: 2 },
  canvasFade: { flex: 1 },
  answerSlot: { height: 64, justifyContent: 'center', marginTop: spacing.sm },
  answer: { alignItems: 'center', gap: 2 },
  answerWord: { color: colors.ink, fontSize: 30 },
  answerMeaning: { color: colors.muted, fontFamily: fonts.body, fontSize: 12 },
  btn: {
    height: 46,
    borderRadius: 23,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.accent,
    marginTop: spacing.sm,
  },
  btnText: { color: colors.onAccent, fontFamily: fonts.semibold, fontSize: 14 },
  disabled: { opacity: 0.35 },
})
