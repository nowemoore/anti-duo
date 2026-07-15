import { useEffect, useRef, useState, type ReactNode } from 'react'
import { View, Text, Pressable, ScrollView, StyleSheet, PanResponder, Animated, Dimensions, Easing } from 'react-native'
import type { Unit } from '@shared/types'
import { SKIP_REQUEUE_GAP } from '@shared/constants'
import { skipCard } from '@lib/study'
import { releasedExamples } from '@lib/tasks'
import { useContent } from '../context/ContentContext'
import { useProgress } from '../context/ProgressContext'
import { useLanguage } from '../context/LanguageContext'
import { Bilingual } from './Bilingual'
import { Icon } from './Icon'
import { RootWord } from './RootWord'
import { VoweledText } from './VoweledText'
import { SpeakButton } from './SpeakButton'
import { useScreenHeader } from '../context/HeaderContext'
import { fonts, radius, shadow, spacing, type Palette } from '../theme'
import { useColors, useStyles } from '../hooks/theme'

const SCREEN_W = Dimensions.get('window').width

interface Props {
  chunk: Unit[]
  reserve: Unit[]
  onComplete: (learned: Unit[]) => void
  /** Back to the unit page (Learn/Practice menu). */
  onExit: () => void
  /** Total progress dots across learn + the write review that follows (defaults to just this set). */
  totalSteps?: number
}

/** Introduces new unit one card at a time: char, glosses, breakdown, and up to 5 example words. */
export function LearnPhase({ chunk, reserve, onComplete, onExit, totalSteps }: Props) {
  const colors = useColors()
  const styles = useStyles(makeStyles)
  const [cards, setCards] = useState<Unit[]>(chunk)
  const [pool, setPool] = useState<Unit[]>(reserve)
  const [i, setI] = useState(0)
  const { ui } = useLanguage()

  const unit = cards[i]
  const isFirst = i === 0
  const isLast = i === cards.length - 1
  const canSkip = pool.length > 0 || cards.length > 1

  // The card is a fixed height that normally fits, so only allow vertical scrolling when it genuinely
  // overflows (e.g. the breakdown is expanded). Otherwise it wouldn't scroll into empty reserved space.
  const [scrollEnabled, setScrollEnabled] = useState(false)
  const viewportH = useRef(0)
  const contentH = useRef(0)
  const syncScrollable = () => setScrollEnabled(contentH.current - viewportH.current > 1)

  // The card tracks the finger horizontally via this value; releasing past a threshold slides it out
  // and swaps in the next card (which slides in from the opposite side).
  const dragX = useRef(new Animated.Value(0)).current
  const animating = useRef(false)

  const snapBack = () => {
    Animated.spring(dragX, { toValue: 0, useNativeDriver: true, bounciness: 4, speed: 18 }).start()
  }
  const swap = (out: number, apply: () => void) => {
    if (animating.current) return
    animating.current = true
    Animated.timing(dragX, { toValue: out, duration: 140, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(() => {
      apply()
      dragX.setValue(-out)
      Animated.timing(dragX, { toValue: 0, duration: 230, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(() => {
        animating.current = false
      })
    })
  }

  const goBack = () => {
    if (isFirst || animating.current) return
    swap(SCREEN_W, () => setI((n) => Math.max(0, n - 1)))
  }
  const goNext = () => {
    if (animating.current) return
    if (isLast) {
      onComplete(cards)
      return
    }
    swap(-SCREEN_W, () => setI((n) => n + 1))
  }
  const skip = () => {
    if (!canSkip || animating.current) return
    swap(-SCREEN_W, () => {
      const res = skipCard(cards, pool, i, SKIP_REQUEUE_GAP)
      setCards(res.cards)
      setPool(res.reserve)
      setI(res.index)
    })
  }

  // Drag the card with the finger; commit on release past the threshold, else snap back.
  const pan = useRef(PanResponder.create({ onMoveShouldSetPanResponder: () => false }))
  pan.current = PanResponder.create({
    onMoveShouldSetPanResponder: (_e, g) =>
      !animating.current && Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.2,
    onPanResponderMove: (_e, g) => {
      // Resist dragging past the first card (nowhere to go back to).
      dragX.setValue(isFirst && g.dx > 0 ? g.dx * 0.3 : g.dx)
    },
    onPanResponderRelease: (_e, g) => {
      if (g.dx < -60) goNext()
      else if (g.dx > 60 && !isFirst) goBack()
      else snapBack()
    },
    onPanResponderTerminate: snapBack,
  })

  // Back button, step label, and progress bar live in the app-level top bar (above the card).
  const learnHead = ui.learnHeader(i + 1, cards.length)
  useScreenHeader(
    onExit,
    { ja: learnHead.native, en: learnHead.en },
    { current: i + 1, total: totalSteps ?? cards.length },
  )

  return (
    <View style={styles.panel} {...pan.current.panHandlers}>
      <ScrollView
        style={styles.cardScroll}
        contentContainerStyle={styles.cardScrollContent}
        keyboardShouldPersistTaps="handled"
        scrollEnabled={scrollEnabled}
        bounces={false}
        overScrollMode="never"
        onLayout={(e) => {
          viewportH.current = e.nativeEvent.layout.height
          syncScrollable()
        }}
        onContentSizeChange={(_w, h) => {
          contentH.current = h
          syncScrollable()
        }}
      >
        <Animated.View style={{ transform: [{ translateX: dragX }] }}>
          <LearnCard key={unit.idx} unit={unit} />
        </Animated.View>
      </ScrollView>

      <View style={styles.pager}>
        <Pressable
          style={[styles.chevron, styles.chevBack, isFirst && styles.disabled]}
          onPress={goBack}
          disabled={isFirst}
        >
          <Icon name="chevron-left" size={18} color={colors.muted} />
        </Pressable>
        <Pressable style={[styles.skip, !canSkip && styles.disabled]} onPress={skip} disabled={!canSkip}>
          <Icon name="forward" size={13} color={colors.muted} />
          <Bilingual native={ui.notNow.native} en={ui.notNow.en} />
        </Pressable>
        <Pressable style={[styles.chevron, styles.chevNext]} onPress={goNext}>
          <Icon name="chevron-right" size={18} color={colors.onAccent} />
        </Pressable>
      </View>
    </View>
  )
}

function LearnCard({ unit }: { unit: Unit }) {
  const colors = useColors()
  const styles = useStyles(makeStyles)
  const { content } = useContent()
  const { progress } = useProgress()
  const pack = useLanguage()
  const charGloss = (ch: string) => pack.charGloss?.(content, ch)
  const DetailView = pack.detail?.View
  const hasReveal = pack.detail ? pack.detail.has(content, unit) : false
  const [expanded, setExpanded] = useState(false)

  // Staged word release: show only the batch this unit has unlocked (Arabic ≤4). Languages that don't
  // stage their words (Japanese) get every example, exactly as before.
  const lvl = progress.units[unit.idx]?.lvl ?? 0
  const examples = releasedExamples(unit, { levelOf: () => lvl })

  const toggle = () => setExpanded((v) => !v)

  // Hold-to-reveal: the meaning shows in the caption strip only while a unit/eye is held,
  // reverting to the hint on release. Resets per card (LearnCard is keyed by unit).
  const [caption, setCaption] = useState<{ key: string; label: string; meaning: string } | null>(null)
  const show = (key: string, label: string, meaning: string) => setCaption({ key, label, meaning })
  const hide = () => setCaption(null)

  return (
    <View style={styles.card}>
      <View style={styles.formRow}>
        {hasReveal && <View style={styles.formSpacer} />}
        <Text style={styles.bigForm}>{pack.displayForm?.(unit.form) ?? unit.form}</Text>
        {hasReveal && (
          <Pressable style={[styles.revealBtn, expanded && styles.revealBtnOn]} onPress={toggle}>
            <Icon name="magnifying-glass" size={13} color={expanded ? colors.onAccent : colors.ink} />
          </Pressable>
        )}
      </View>

      {hasReveal && DetailView && (
        <Collapse open={expanded}>
          <DetailView unit={unit} />
        </Collapse>
      )}

      {/* Reserve 2 lines so the card height doesn't jump between unit with short vs long meanings. */}
      <View style={styles.glossWrap}>
        <Text style={styles.gloss}>{unit.gloss.join(', ')}</Text>
      </View>

      {/* minHeight reserves 5 rows so the card is the same height regardless of example count. */}
      <View style={styles.examples}>
        {examples.slice(0, 5).map((ex, idx) => {
          const wordKey = `w:${idx}`
          const wordOn = caption?.key === wordKey
          return (
            <View key={idx} style={styles.example}>
              <View style={styles.exWordCell}>
                {pack.charGloss ? (
                  // Per-character reveal (JA: hold a kanji for its meaning).
                  <ExampleWord
                    word={ex.word}
                    wordIndex={idx}
                    gloss={charGloss}
                    activeKey={caption?.key}
                    onShow={show}
                    onHide={hide}
                  />
                ) : (
                  // One joined word (keeps Arabic letters connected), root letters highlighted.
                  <RootWord surface={ex.word} spans={pack.rootSpans?.(ex.word, unit.form)} style={styles.exWord} />
                )}
              </View>
              <VoweledText text={ex.reading} style={styles.exReading} />
              <View style={styles.exActions}>
                <SpeakButton text={ex.reading} label={`Pronounce ${ex.word}`} />
                <Pressable
                  onPressIn={() => show(wordKey, ex.word, ex.meaning)}
                  onPressOut={hide}
                  style={[styles.eyeBtn, wordOn && styles.eyeBtnOn]}
                  accessibilityLabel={`Meaning of ${ex.word}`}
                  hitSlop={6}
                >
                  <Icon name="eye" size={16} color={wordOn ? colors.onAccent : colors.muted} />
                </Pressable>
              </View>
            </View>
          )
        })}
      </View>

      {/* Fixed caption strip: the pinned meaning shows here, never under the finger. */}
      <View style={styles.caption}>
        {caption ? (
          <Text style={styles.captionText} numberOfLines={2}>
            <Text style={styles.captionLabel}>{caption.label}</Text>
            {`  ·  ${caption.meaning}`}
          </Text>
        ) : pack.charGloss ? (
          <Text style={styles.captionHint} numberOfLines={2}>
            Hold a {pack.ui.noun} or the eye button to reveal its meaning here
          </Text>
        ) : (
          // Languages with no per-character gloss (Arabic): the eye button is the only way to reveal.
          <View style={styles.captionHintRow}>
            <Text style={styles.captionHint}>hold </Text>
            <Icon name="eye" size={12} color={colors.onChipMuted} />
            <Text style={styles.captionHint}> to reveal the meaning</Text>
          </View>
        )}
      </View>
    </View>
  )
}

/** A word whose unit characters reveal their meaning in the caption strip while held. */
function ExampleWord({
  word,
  wordIndex,
  gloss,
  activeKey,
  onShow,
  onHide,
}: {
  word: string
  wordIndex: number
  gloss: (char: string) => string | undefined
  activeKey?: string
  onShow: (key: string, label: string, meaning: string) => void
  onHide: () => void
}) {
  const styles = useStyles(makeStyles)
  return (
    <View style={styles.exWordRow}>
      {[...word].map((ch, i) => {
        const g = gloss(ch)
        if (!g) {
          return (
            <Text key={i} style={styles.exWord}>
              {ch}
            </Text>
          )
        }
        // Key by position so holding one instance highlights only it, not every copy of the unit.
        const key = `k:${wordIndex}:${i}`
        const on = activeKey === key
        return (
          <Pressable
            key={i}
            onPressIn={() => onShow(key, ch, g.split(';')[0].trim())}
            onPressOut={onHide}
            hitSlop={4}
            style={[styles.charBtn, on && styles.charBtnOn]}
          >
            <Text style={[styles.exWord, on && styles.exCharOn]}>{ch}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

/**
 * Cross-platform height + fade reveal for the unit breakdown. Replaces LayoutAnimation, which is a
 * no-op on react-native-web (so the breakdown used to pop open on the PWA instead of animating). The
 * content is measured out-of-flow and centered to match the card.
 */
function Collapse({ open, children }: { open: boolean; children: ReactNode }) {
  const styles = useStyles(makeStyles)
  const anim = useRef(new Animated.Value(open ? 1 : 0)).current
  const [height, setHeight] = useState(0)

  useEffect(() => {
    Animated.timing(anim, {
      toValue: open ? 1 : 0,
      duration: 240,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: false,
    }).start()
  }, [open, anim])

  // The inner is always rendered (out of flow) so its height is measured on mount — the card remounts
  // per unit, so without this the first expand would animate from an unmeasured 0 and just pop open.
  return (
    <Animated.View
      style={{
        alignSelf: 'stretch',
        height: anim.interpolate({ inputRange: [0, 1], outputRange: [0, height] }),
        opacity: anim,
        overflow: 'hidden',
      }}
    >
      <View style={styles.collapseInner} onLayout={(e) => setHeight(e.nativeEvent.layout.height)}>
        {children}
      </View>
    </Animated.View>
  )
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  panel: {
    ...shadow,
    flex: 1,
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  cardScroll: { flex: 1 },
  cardScrollContent: { flexGrow: 1 },
  skip: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  disabled: { opacity: 0.3 },
  card: { alignItems: 'center' },
  formRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', gap: 8, marginTop: spacing.md },
  formSpacer: { width: 34 }, // balances the reveal button so the unit stays centered
  bigForm: { fontSize: 64, lineHeight: 70, color: colors.ink, fontWeight: '600' },
  revealBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  revealBtnOn: { backgroundColor: colors.accent },
  // Whole block is centered (card is alignItems:center); rows inside are left-aligned so the
  // radical and component characters share one column.
  breakdown: { alignItems: 'flex-start', gap: 6, marginTop: spacing.md },
  radicalRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  radicalTag: { color: colors.accentInk, fontFamily: fonts.medium, fontSize: 11, letterSpacing: 1 },
  comp: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  compChar: { fontSize: 16, color: colors.muted, width: 22, textAlign: 'center' },
  compMeaning: { fontSize: 13, color: colors.muted, fontFamily: fonts.body },
  accentText: { color: colors.accentInk },
  collapseInner: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  glossWrap: { alignSelf: 'stretch', minHeight: 44, justifyContent: 'center', marginTop: spacing.sm, marginBottom: spacing.md },
  gloss: { color: colors.ink, fontFamily: fonts.body, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  examples: { alignSelf: 'stretch', minHeight: 48 * 5 }, // reserve 5 rows so cards match
  example: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    paddingVertical: 4, // trimmed so bigger text fits without growing the row
    borderTopColor: colors.border,
    borderTopWidth: 1,
    gap: spacing.sm,
  },
  // Three aligned columns: word | reading | actions.
  exWordCell: { flex: 1 },
  exWordRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  exWord: { fontSize: 25, color: colors.ink },
  // Underline as a bottom border with a gap, so it sits below the (now larger) unit instead of overlapping.
  charBtn: { borderBottomWidth: 1.5, borderBottomColor: colors.border, paddingBottom: 3 },
  charBtnOn: { borderBottomColor: colors.accent },
  exCharOn: { color: colors.accentInk },
  exReading: { flex: 1, color: colors.muted, fontFamily: fonts.body, fontSize: 17 },
  exActions: { width: 82, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 },
  eyeBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  eyeBtnOn: { backgroundColor: colors.accent },
  caption: {
    alignSelf: 'stretch',
    height: 56, // fixed so the card doesn't resize when a meaning is shown
    justifyContent: 'center',
    backgroundColor: colors.c900,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  captionText: { color: colors.onChip, fontFamily: fonts.body, fontSize: 14, textAlign: 'center' },
  captionLabel: { color: colors.onChipAccent, fontFamily: fonts.semibold, fontSize: 16 },
  captionHint: { color: colors.onChipMuted, fontFamily: fonts.body, fontSize: 12, textAlign: 'center', fontStyle: 'italic' },
  captionHintRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  pager: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.lg },
  chevron: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  chevBack: { borderWidth: 1.5, borderColor: colors.border },
  chevNext: { backgroundColor: colors.accent, borderWidth: 1.5, borderColor: colors.accent },
})
