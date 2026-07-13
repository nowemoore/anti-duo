import { useCallback, useMemo, useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import type { Unit } from '@shared/types'
import { useScreenHeader } from '../../context/HeaderContext'
import { Bilingual } from '../../components/Bilingual'
import { Icon } from '../../components/Icon'
import { FadeView } from '../../components/FadeView'
import { DrawCanvas } from '../../components/DrawCanvas'
import { scoreWord, drawable, type RawStroke } from './handwriting'
import { useLearned } from '../../hooks/useLearned'
import type { DrawReviewProps } from '../types'
import { colors, fonts, radius, shadow, spacing } from '../../theme'

interface Target {
  word: string
  reading: string
  meaning: string
}

/** Per-item state, kept so you can flip back to a passed word and see your answer without redoing it. */
interface Slot {
  strokes: RawStroke[]
  revealed: boolean
  correct: boolean
  attempt: number
}

function toTarget(k: Unit, canDraw: (w: string) => boolean): Target | null {
  const words = k.examples.filter((e) => canDraw(e.word))
  if (words.length) {
    const ex = words[Math.floor(Math.random() * words.length)]
    return { word: ex.word, reading: ex.reading, meaning: ex.meaning }
  }
  if (canDraw(k.form)) return { word: k.form, reading: '', meaning: k.gloss.join(', ') }
  return null
}

/**
 * Write-it reinforcement after a Learn set: one word per just-learned unit. Same lock-in + chevron
 * pager as Practice; ✓/✗ shows in the corner and the button becomes Try again. Low-stakes (no stats).
 * Answers persist per item, so paging back shows a passed word already done.
 */
export function DrawReview({ units, onDone, baseStep = 0, totalSteps }: DrawReviewProps) {
  // Same rule as the global useDrawableWord hook, sourced directly (this lives inside the pack) so the
  // pack doesn't import LanguageContext → registry → pack (a cycle).
  const isLearned = useLearned()
  const canDraw = useCallback((w: string) => drawable(w) && [...w].every((c) => isLearned(c)), [isLearned])
  const targets = useMemo(
    () => units.map((k) => toTarget(k, canDraw)).filter((t): t is Target => t !== null),
    [units, canDraw],
  )
  const [slots, setSlots] = useState<Slot[]>(() =>
    targets.map(() => ({ strokes: [], revealed: false, correct: false, attempt: 0 })),
  )
  const [pos, setPos] = useState(0)

  const total = targets.length
  const cur = targets[pos]
  const slot = slots[pos]

  useScreenHeader(
    onDone,
    cur ? { ja: '書いてみよう', en: `Write ${pos + 1} / ${total}` } : undefined,
    cur ? { current: baseStep + pos + 1, total: totalSteps ?? baseStep + total } : undefined,
  )

  if (!cur || !slot) {
    return (
      <View style={styles.panel}>
        <View style={styles.doneWrap}>
          <Bilingual native="よくできました" en="Nice work!" large />
          <Pressable style={styles.donePrimary} onPress={onDone}>
            <Text style={styles.lockText}>Done</Text>
          </Pressable>
        </View>
      </View>
    )
  }

  const patch = (upd: Partial<Slot>) => setSlots((s) => s.map((x, k) => (k === pos ? { ...x, ...upd } : x)))
  const setStrokes = (strokes: RawStroke[]) => {
    if (!slot.revealed) patch({ strokes })
  }
  const lockIn = () => {
    if (slot.revealed || slot.strokes.length === 0) return
    patch({ revealed: true, correct: scoreWord(cur.word, slot.strokes).correct })
  }
  const giveUp = () => {
    if (!slot.revealed) patch({ revealed: true, correct: false })
  }
  const tryAgain = () => patch({ strokes: [], revealed: false, correct: false, attempt: slot.attempt + 1 })
  const prev = () => {
    if (pos > 0) setPos(pos - 1)
  }
  const next = () => {
    if (!slot.revealed) return
    if (pos + 1 >= total) onDone()
    else setPos(pos + 1)
  }

  const hasDrawn = slot.strokes.length > 0

  return (
    <View style={styles.panel}>
      {slot.revealed && (
        <View style={styles.corner}>
          <Icon
            name={slot.correct ? 'circle-check' : 'circle-xmark'}
            size={26}
            color={slot.correct ? colors.correct : colors.incorrect}
          />
        </View>
      )}

      <View style={styles.prompt}>
        <Text style={styles.reading}>{cur.reading || cur.meaning}</Text>
      </View>

      <FadeView key={`${pos}-${slot.attempt}`} style={styles.canvasFade}>
        <DrawCanvas
          key={`${pos}-${slot.attempt}`}
          disabled={slot.revealed}
          initialStrokes={slot.strokes}
          onNoClue={giveUp}
          onStrokes={setStrokes}
        />
      </FadeView>

      <View style={styles.answerSlot}>
        {slot.revealed && (
          <View style={styles.answer}>
            <Text style={styles.answerWord}>{cur.word}</Text>
            <Text style={styles.answerMeaning}>{cur.meaning}</Text>
          </View>
        )}
      </View>

      <View style={styles.pager}>
        <Pressable
          style={[styles.chevron, styles.chevSide, pos === 0 && styles.disabled]}
          onPress={prev}
          disabled={pos === 0}
          accessibilityLabel="Previous"
        >
          <Icon name="chevron-left" size={18} color={colors.muted} />
        </Pressable>

        {slot.revealed ? (
          <Pressable style={[styles.lockBtn, styles.lockActive]} onPress={tryAgain} accessibilityLabel="Try again">
            <Icon name="rotate-left" size={15} color={colors.onAccent} />
            <Text style={styles.lockText}>Try again</Text>
          </Pressable>
        ) : (
          <Pressable
            style={[styles.lockBtn, styles.lockActive, !hasDrawn && styles.disabled]}
            onPress={lockIn}
            disabled={!hasDrawn}
            accessibilityLabel="Lock in your answer"
          >
            <Icon name="lock" size={15} color={colors.onAccent} />
            <Text style={styles.lockText}>Lock in answer</Text>
          </Pressable>
        )}

        <Pressable
          style={[styles.chevron, styles.chevNext, !slot.revealed && styles.disabled]}
          onPress={next}
          disabled={!slot.revealed}
          accessibilityLabel="Next"
        >
          <Icon name="chevron-right" size={18} color={colors.onAccent} />
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  panel: {
    ...shadow,
    flex: 1,
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  corner: { position: 'absolute', top: 10, right: 10, zIndex: 2 },
  prompt: { alignItems: 'center', marginBottom: spacing.md },
  reading: { color: colors.ink, fontFamily: fonts.body, fontSize: 30 },
  canvasFade: { flex: 1 },
  answerSlot: { height: 70, justifyContent: 'center', marginTop: spacing.md },
  answer: { alignItems: 'center', gap: 2 },
  answerWord: { color: colors.ink, fontSize: 30 },
  answerMeaning: { color: colors.muted, fontFamily: fonts.body, fontSize: 12 },
  pager: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: spacing.md },
  chevron: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  chevSide: { borderWidth: 1.5, borderColor: colors.border },
  chevNext: { backgroundColor: colors.accent, borderWidth: 1.5, borderColor: colors.accent },
  lockBtn: {
    flex: 1,
    height: 46,
    borderRadius: 23,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  lockActive: { backgroundColor: colors.accent },
  lockText: { color: colors.onAccent, fontFamily: fonts.semibold, fontSize: 14 },
  disabled: { opacity: 0.35 },
  doneWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  donePrimary: { paddingVertical: 13, paddingHorizontal: 32, borderRadius: radius.pill, backgroundColor: colors.accent },
})
