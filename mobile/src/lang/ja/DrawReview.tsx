import { useCallback, useMemo, useRef, useState } from 'react'
import { View, Text, PanResponder, StyleSheet } from 'react-native'
import { PagerChevron } from '../../components/PagerChevron'
import { RevealSpacer } from '../../components/RevealStrip'
import { TapScale } from '../../components/TapScale'
import { useScreenHeader } from '../../context/HeaderContext'
import { Bilingual } from '../../components/Bilingual'
import { Icon } from '../../components/Icon'
import { FadeView } from '../../components/FadeView'
import { DrawCanvas } from '../../components/DrawCanvas'
import { scoreWord, drawable, traceable, type RawStroke } from '@lib/handwriting'
import { logTracedAttempt, toTarget, type Target } from './drawTarget'
import { useLearned } from '../../hooks/useLearned'
import { useAuth } from '../../context/AuthContext'
import type { DrawReviewProps } from '../types'
import { colors, fonts, btnPrimary, radius, shadow, spacing, btnLabel } from '../../theme'

/** Per-item state, kept so you can flip back to a passed word and see your answer without redoing it. */
interface Slot {
  strokes: RawStroke[]
  revealed: boolean
  correct: boolean
  attempt: number
}

/**
 * Write-it reinforcement after a Learn set: one word per just-learned unit. Same lock-in + chevron
 * pager as Practice; ✓/✗ shows in the corner and the button becomes Try again. Low-stakes (no stats).
 * Answers persist per item, so paging back shows a passed word already done.
 */
export function DrawReview({
  units,
  onDone,
  onPrev,
  lastStep,
  baseStep = 0,
  totalSteps,
}: DrawReviewProps) {
  // Same rule as the global useDrawableWord hook, sourced directly (this lives inside the pack) so the
  // pack doesn't import LanguageContext → registry → pack (a cycle).
  const userId = useAuth().session?.user?.id
  const isLearned = useLearned()
  const canDraw = useCallback((w: string) => drawable(w) && [...w].every((c) => isLearned(c)), [isLearned])
  const canTrace = useCallback((w: string) => traceable(w) && [...w].every((c) => isLearned(c)), [isLearned])
  // Units with no recognizer coverage fall back to tracing rather than being dropped from the review.
  const targets = useMemo(
    () => units.map((k) => toTarget(k, canDraw, canTrace)).filter((t): t is Target => t !== null),
    [units, canDraw, canTrace],
  )
  const [slots, setSlots] = useState<Slot[]>(() =>
    targets.map(() => ({ strokes: [], revealed: false, correct: false, attempt: 0 })),
  )
  const [pos, setPos] = useState(0)
  // Created here, above the early return below, so hook order is the same on every render; the
  // handlers themselves are rebuilt further down once `slot` and the movers exist.
  const pan = useRef(PanResponder.create({ onMoveShouldSetPanResponder: () => false }))

  const total = targets.length
  const cur = targets[pos]
  const slot = slots[pos]

  useScreenHeader(
    cur ? { ja: '書いてみよう', en: `Write ${pos + 1}/${total}` } : undefined,
    cur ? { current: baseStep + pos + 1, total: totalSteps ?? baseStep + total } : undefined,
  )

  if (!cur || !slot) {
    return (
      <>
        <View style={styles.panel}>
          <View style={styles.doneWrap}>
            <Bilingual native="よくできました" en="Nice work!" large />
            <TapScale style={styles.donePrimary} onPress={onDone}>
              <Text style={styles.lockText}>Done</Text>
            </TapScale>
          </View>
        </View>
        <RevealSpacer />
      </>
    )
  }

  const patch = (upd: Partial<Slot>) => setSlots((s) => s.map((x, k) => (k === pos ? { ...x, ...upd } : x)))
  const setStrokes = (strokes: RawStroke[]) => {
    if (!slot.revealed) patch({ strokes })
  }
  const lockIn = () => {
    if (slot.revealed || slot.strokes.length === 0) return
    // A traced word has no reference pattern to score against — reveal it without a verdict.
    patch({ revealed: true, correct: cur.traced ? false : scoreWord(cur.word, slot.strokes).correct })
    logTracedAttempt(userId, cur, slot.strokes)
  }
  const giveUp = () => {
    if (!slot.revealed) patch({ revealed: true, correct: false })
  }
  const tryAgain = () => patch({ strokes: [], revealed: false, correct: false, attempt: slot.attempt + 1 })
  // Off the first item, "back" leaves this view entirely — in the learn flow that's the card that
  // introduced the character, so the two views become a pair you can move between.
  const prev = () => {
    if (pos > 0) setPos(pos - 1)
    else onPrev?.()
  }
  const canPrev = pos > 0 || onPrev != null
  // Finishing the last item ends the session, so the forward control says so rather than implying
  // there's another question behind it.
  const finishes = lastStep === true && pos + 1 >= total
  const next = () => {
    if (!slot.revealed) return
    if (pos + 1 >= total) onDone()
    else setPos(pos + 1)
  }

  const hasDrawn = slot.strokes.length > 0

  /*
   * Horizontal swipe between this view and the card that introduced the character.
   *
   * Safe alongside the canvas without any coordination: the canvas claims a touch the moment it
   * lands and refuses to hand it back, so this only ever sees drags that began somewhere else — the
   * prompt, the margins, the answer slot. Drawing is never interrupted, including the horizontal
   * strokes that a pager would otherwise swallow.
   */
  pan.current = PanResponder.create({
    onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.4,
    onPanResponderRelease: (_e, g) => {
      if (g.dx > 60) prev()
      else if (g.dx < -60 && slot.revealed) next()
    },
  })

  return (
    <>
    <View style={styles.panel} {...pan.current.panHandlers}>
      {/* No verdict for a traced word — there's nothing to check it against. */}
      {slot.revealed && !cur.traced && (
        <View style={styles.corner}>
          <Icon
            name={slot.correct ? 'circle-check' : 'circle-xmark'}
            size={26}
            color={slot.correct ? colors.correct : colors.incorrect}
          />
        </View>
      )}

      <View style={styles.prompt}>
        {/*
          The wrapping and shrink-to-fit are for the English fallback only. Applied to both, they
          scaled a short kana reading down too: fitting *two* lines into the box caps a single line
          at half its height, so the reading came out tiny for no reason.
        */}
        <Text
          style={[styles.reading, !cur.reading && styles.readingEn]}
          numberOfLines={cur.reading ? 1 : 2}
          adjustsFontSizeToFit={!cur.reading}
        >
          {cur.reading || cur.meaning}
        </Text>
        {cur.traced && <Text style={styles.traceHint}>Trace over the outline — not graded yet.</Text>}
      </View>

      <FadeView key={`${pos}-${slot.attempt}`} style={styles.canvasFade}>
        <DrawCanvas
          key={`${pos}-${slot.attempt}`}
          disabled={slot.revealed}
          initialStrokes={slot.strokes}
          onNoClue={giveUp}
          onStrokes={setStrokes}
          guide={cur.traced ? cur.word : undefined}
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
        <PagerChevron dir="prev" onPress={prev} disabled={!canPrev} />

        {slot.revealed ? (
          <TapScale style={[styles.lockBtn, styles.lockActive]} onPress={tryAgain} accessibilityLabel="Try again">
            <Icon name="rotate-left" size={15} color={colors.ink} />
            <Text style={styles.lockText}>Try again</Text>
          </TapScale>
        ) : (
          <TapScale
            style={[styles.lockBtn, styles.lockActive, !hasDrawn && styles.disabled]}
            onPress={lockIn}
            disabled={!hasDrawn}
            accessibilityLabel="Lock in your answer"
          >
            <Icon name="lock" size={15} color={colors.ink} />
            <Text style={styles.lockText}>Lock in answer</Text>
          </TapScale>
        )}

        {/* The last card of a session finishes rather than advances, so it says so. */}
        <PagerChevron
          dir="next"
          onPress={next}
          disabled={!slot.revealed}
          icon={finishes ? 'check' : undefined}
          label={finishes ? 'Finish' : 'Next'}
        />
      </View>
    </View>
    {/* Nothing to reveal here — the word is the question. The space is held so this card comes out
        the same size as the Learn card it alternates with. */}
    <RevealSpacer />
    </>
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
  /*
   * The prompt is the kana reading when there is one and the English meaning when there isn't, so the
   * face follows the text rather than the field: brush for Japanese, the Latin body face for English.
   */
  reading: { color: colors.ink, fontFamily: fonts.brush, fontSize: 30 },
  // Smaller, since English needs the width a kana reading doesn't.
  readingEn: { fontFamily: fonts.body, fontSize: 18, textAlign: 'center' },
  traceHint: { color: colors.muted, fontFamily: fonts.body, fontSize: 11, fontStyle: 'italic', marginTop: 2 },
  canvasFade: { flex: 1 },
  answerSlot: { height: 70, justifyContent: 'center', marginTop: spacing.md },
  answer: { alignItems: 'center', gap: 2 },
  answerWord: { color: colors.ink, fontSize: 30, fontFamily: fonts.mincho },
  answerMeaning: { color: colors.muted, fontFamily: fonts.body, fontSize: 12 },
  pager: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: spacing.md },
  // Bare glyphs, matching the system back chevron in the navigation bar: no circle, no fill,
  // no border. The 46pt box is the tap target, not a visible button.
  lockBtn: {
    ...btnPrimary(colors),
    flex: 1,
  },
  lockActive: { backgroundColor: colors.accent },
  lockText: btnLabel(colors),
  disabled: { opacity: 0.35 },
  doneWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  donePrimary: { paddingVertical: 13, paddingHorizontal: 32, borderRadius: radius.pill, backgroundColor: colors.accent },
})
