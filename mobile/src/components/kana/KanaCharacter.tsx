import { useCallback, useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native'
import { charsOfScript, isTraced, markTraced, type KanaScript } from '@lib/kana'
import { useProgress } from '../../context/ProgressContext'
import { useScreenHeader } from '../../context/HeaderContext'
import { useLanguage } from '../../context/LanguageContext'
import type { DrawStroke } from '../../lang/types'
import { DrawCanvas } from '../DrawCanvas'
import { SpeakButton } from '../SpeakButton'
import { Icon } from '../Icon'
import { useKanaAudio } from './audio'
import { fonts, radius, spacing, type Palette } from '../../theme'
import { useColors, useStyles } from '../../hooks/theme'

/** Meet it, copy it, then produce it unaided. */
type Slide = 'intro' | 'trace' | 'own'
const ORDER: Slide[] = ['intro', 'trace', 'own']

const LABEL: Record<Slide, string> = {
  intro: 'Listen and look',
  trace: 'Trace it',
  own: "Now it's your turn",
}

interface Page {
  char: string
  slide: Slide
  /** A neighbouring character's page, shown only so a swipe past the end has somewhere to land. */
  sentinel?: boolean
}

/** Which halves of the requirement a character has had so far, this session. */
interface Attempt {
  traced: boolean
  wrote: boolean
}

/**
 * The character flow: three pages — hear and look at it, trace it, write it unaided — swiped
 * horizontally, running on into the neighbouring characters at either end.
 *
 * Built on a plain paging ScrollView with explicitly sized pages, which is the pattern BrowseDetail
 * already uses for its write canvas; a virtualised list did not scroll reliably here. Rather than
 * render every character, the pager holds a five-page window — the previous character's last page,
 * this character's three, and the next character's first. Landing on one of those edge pages
 * switches character and silently re-centres, so paging feels continuous while only five pages ever
 * exist. It also keeps the gesture reversible: whatever a swipe did, the opposite swipe undoes.
 *
 * A character counts as studied only once the learner has traced it *and* written it unaided, and
 * been judged right on both — copying a shape you can see is a different skill from producing it,
 * and only the second is what writing actually needs. Merely opening a character does nothing, so
 * the chart never fills in for one you only looked at. Retrying is free.
 *
 * Only the first two pages show the character. The last deliberately shows nothing: a visible model
 * there would turn it back into a copying task.
 *
 * **A swipe cannot start on the canvas.** The canvas keeps any touch that begins on it, because many
 * kana strokes are horizontal (こ, に, エ, ー) and a pager that grabbed horizontal drags would eat
 * them mid-stroke. The margins around the canvas, the label row, and the button are the way through.
 */
export function KanaCharacter({
  char,
  script,
  onBack,
  onChange,
}: {
  char: string
  script: KanaScript
  onBack: () => void
  /** Keeps the owning view's idea of the current character in step with the pager. */
  onChange: (char: string) => void
}) {
  const colors = useColors()
  const styles = useStyles(makeStyles)
  const { update } = useProgress()
  const { draw } = useLanguage()
  const play = useKanaAudio()

  const chars = charsOfScript(script)
  const at = chars.indexOf(char)
  const prev = at > 0 ? chars[at - 1] : null
  const next = at >= 0 && at < chars.length - 1 ? chars[at + 1] : null

  // Five-page window; `base` is where this character's own three pages start.
  const base = prev ? 1 : 0
  const pages: Page[] = [
    ...(prev ? [{ char: prev, slide: 'own' as Slide, sentinel: true }] : []),
    ...ORDER.map((slide) => ({ char, slide })),
    ...(next ? [{ char: next, slide: 'intro' as Slide, sentinel: true }] : []),
  ]

  const [slide, setSlide] = useState<Slide>('intro')
  // Pages inside a horizontal ScrollView need an explicit size in both axes — otherwise flex:1
  // children (the canvas) collapse to zero height. Measure the viewport and stamp every page.
  const [size, setSize] = useState({ w: 0, h: 0 })
  const scrollRef = useRef<ScrollView>(null)
  /** Where to jump to, silently, once a character switch has re-rendered the window. */
  const pending = useRef<number | null>(null)
  const placed = useRef(false)

  // Per-character attempt record, session-local: the flow is three pages long, so a half-finished
  // visit starts again rather than earning partial credit.
  const attempts = useRef(new Map<string, Attempt>())

  // The strokes themselves live in a ref (nothing re-renders on them), but whether there is *any*
  // ink has to be state, or the button would never re-enable when you start drawing.
  const strokesRef = useRef<DrawStroke[]>([])
  const [hasInk, setHasInk] = useState(false)
  const [verdict, setVerdict] = useState<'right' | 'wrong' | null>(null)
  /**
   * True while a finger is down on the canvas, which switches paging off for the duration.
   *
   * Without it the pager cancels the touch and scrolls the moment the stroke moves sideways, so
   * horizontal strokes (こ, に, エ, ー) never land. Set on touch-down, before any movement, so the
   * pager is already disabled by the time the first move event arrives.
   */
  const [drawing, setDrawing] = useState(false)

  const canGrade = draw?.gradeChar != null && (draw.canGradeChar?.(char) ?? true)

  // No help button: a kana reference chart would hand over the very thing this page teaches.
  useScreenHeader(onBack)

  // Say the character on every page of it, not just on arrival: by the last page nothing is on
  // screen, so the sound is the only thing identifying what you're being asked to write.
  useEffect(() => {
    play(char)
    // `slide` is a dependency on purpose — it's what makes this repeat page to page.
  }, [char, slide, play])

  // Every page starts on a clean canvas.
  useEffect(() => {
    strokesRef.current = []
    setHasInk(false)
    setVerdict(null)
  }, [slide, char])

  // Put the pager where it belongs: on first measure, and after a character switch.
  useEffect(() => {
    if (!size.w) return
    if (pending.current != null) {
      scrollRef.current?.scrollTo({ x: pending.current * size.w, animated: false })
      pending.current = null
      placed.current = true
      return
    }
    if (!placed.current) {
      scrollRef.current?.scrollTo({ x: base * size.w, animated: false })
      placed.current = true
    }
  }, [size.w, char, base])

  const markAttempt = useCallback(
    (target: string, half: keyof Attempt) => {
      const cur = attempts.current.get(target) ?? { traced: false, wrote: false }
      if (cur[half]) return
      const nextAttempt = { ...cur, [half]: true }
      attempts.current.set(target, nextAttempt)
      // Both halves done → the character is met, and joins the practice pool.
      if (nextAttempt.traced && nextAttempt.wrote) {
        update((p) => (isTraced(p, target) ? p : markTraced(p, target, new Date().toISOString())))
      }
    },
    [update],
  )

  const onCanvasChange = (n: number) => {
    setHasInk(n > 0)
    setVerdict(null)
    // Without a recogniser there's no verdict to wait for, so drawing anything has to count.
    if (n > 0 && slide !== 'intro' && !canGrade) {
      markAttempt(char, slide === 'trace' ? 'traced' : 'wrote')
    }
  }

  /** Move within this character's three pages. */
  const goToSlide = (s: Slide) => {
    setSlide(s)
    if (size.w) scrollRef.current?.scrollTo({ x: (base + ORDER.indexOf(s)) * size.w, animated: true })
  }

  /** Hand over to a neighbour, remembering where its window should be positioned. */
  const switchTo = (target: string, land: Slide) => {
    const targetAt = chars.indexOf(target)
    const targetBase = targetAt > 0 ? 1 : 0
    pending.current = targetBase + ORDER.indexOf(land)
    setSlide(land)
    onChange(target)
  }

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!size.w) return
    const i = Math.round(e.nativeEvent.contentOffset.x / size.w)
    const page = pages[i]
    if (!page) return
    if (page.sentinel) {
      // Swiped off the end: adopt the neighbour, landing on the page that continues the motion.
      switchTo(page.char, page.slide)
      return
    }
    if (page.slide !== slide) setSlide(page.slide)
  }

  const check = () => {
    if (!draw?.gradeChar) return
    const right = draw.gradeChar(char, strokesRef.current)
    setVerdict(right ? 'right' : 'wrong')
    // Only a correct attempt counts toward completing the character. A wrong one can be retried
    // freely — the canvas's Clear button restarts the page.
    if (right && slide !== 'intro') markAttempt(char, slide === 'trace' ? 'traced' : 'wrote')
  }

  /**
   * The one primary action, whose meaning depends on where you are in the flow. There is no "done"
   * step: by the time the last page is answered the character is already recorded, so the button
   * offers another attempt, and leaving is the back arrow's job.
   */
  interface Action {
    label: string
    icon: 'chevron-right' | 'rotate-left'
    /** Dimmed: there's nothing to do here yet. */
    dim: boolean
    /** Null on pages you haven't landed on — they render for continuity, not for pressing. */
    press: (() => void) | null
  }

  const primary: Action =
    slide === 'intro'
      ? { label: 'Start', icon: 'chevron-right', dim: false, press: () => goToSlide('trace') }
      : !hasInk
        ? {
            label: slide === 'trace' ? 'Trace it above' : 'Write it above',
            icon: 'chevron-right',
            dim: true,
            press: null,
          }
        : canGrade && !verdict
          ? { label: 'Happy with it', icon: 'chevron-right', dim: false, press: check }
          : slide === 'trace'
            ? { label: 'Next', icon: 'chevron-right', dim: false, press: () => goToSlide('own') }
            : // Back to the trace page for another go; the intro is only listening.
              { label: 'Try again', icon: 'rotate-left', dim: false, press: () => goToSlide('trace') }

  /**
   * Every page draws a button, not just the one you're on — otherwise the incoming page carries a
   * blank gap through the swipe and the button only appears once the scroll settles. Pages you
   * haven't landed on show the state they will have on arrival, and aren't pressable.
   */
  const actionFor = (p: Page): Action => {
    if (!p.sentinel && p.slide === slide) return primary
    if (p.slide === 'intro') return { label: 'Start', icon: 'chevron-right', dim: false, press: null }
    return {
      label: p.slide === 'trace' ? 'Trace it above' : 'Write it above',
      icon: 'chevron-right',
      dim: true,
      press: null,
    }
  }

  const pageStyle = { width: size.w, height: size.h }

  return (
    <View style={styles.wrap}>
      <View style={styles.slides}>
        {ORDER.map((s) => (
          <View key={s} style={[styles.slideDot, s === slide && styles.slideDotOn]} />
        ))}
      </View>

      <View
        style={styles.pager}
        onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      >
        {size.w > 0 && (
          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            // Off while a stroke is in progress, so a horizontal stroke can't turn into a swipe.
            scrollEnabled={!drawing}
            onMomentumScrollEnd={onMomentumEnd}
          >
            {pages.map((p) => (
              <View key={`${p.char}-${p.slide}`} style={[pageStyle, styles.page]}>
                {/* Equal flex above and below the label put it exactly halfway between the progress
                    dots and the content. A centred flex:1 content area can't do this: growing the
                    label's own height pushes the content down just as fast, so the two gaps never
                    even out. */}
                <View style={styles.gap} />
                <View style={styles.labelRow}>
                  <Text style={styles.label}>{LABEL[p.slide]}</Text>
                  <SpeakButton text={p.char} label="Play the sound again" small />
                </View>
                <View style={styles.gap} />

                <View style={styles.contentArea}>
                  {p.slide === 'intro' ? (
                    // Same box the canvas occupies on the other two pages, so every page has
                    // identical geometry and the instruction above never shifts as you swipe.
                    <View style={styles.introBox}>
                      <Text style={styles.glyph}>{p.char}</Text>
                    </View>
                  ) : (
                    <View style={styles.canvas}>
                      {/* Sentinel pages get no canvas: you're only passing through them. */}
                      {!p.sentinel && (
                        <DrawCanvas
                          key={`${p.char}-${p.slide}`}
                          guide={p.slide === 'trace' ? p.char : undefined}
                          status={p.slide === slide ? (verdict ?? undefined) : undefined}
                          onChange={onCanvasChange}
                          onDrawingChange={setDrawing}
                          onStrokes={(s) => {
                            strokesRef.current = s
                          }}
                        />
                      )}
                    </View>
                  )}

                  {/* Fixed-height slot directly under the canvas, so the mark appearing doesn't
                      shift anything. The colour of the surface carries the message; this is just
                      the confirmation. */}
                  <View style={styles.markRow}>
                    {!p.sentinel && p.slide === slide && verdict && (
                      <Icon
                        name={verdict === 'right' ? 'check' : 'xmark'}
                        size={16}
                        color={verdict === 'right' ? colors.correct : colors.incorrect}
                      />
                    )}
                  </View>

                  {/* The action lives inside the page, directly beneath the mark. */}
                  {(() => {
                    const action = actionFor(p)
                    return (
                      <Pressable
                        style={[styles.primaryBtn, action.dim && styles.primaryOff]}
                        disabled={!action.press}
                        onPress={action.press ?? undefined}
                        accessibilityRole="button"
                      >
                        <Text style={styles.primaryText}>{action.label}</Text>
                        {!action.dim && <Icon name={action.icon} size={13} color={colors.onAccent} />}
                      </Pressable>
                    )
                  })()}
                </View>

                {/* Balances the two gaps above, leaving the canvas around the middle of the page. */}
                <View style={styles.gapBottom} />
              </View>
            ))}
          </ScrollView>
        )}
      </View>

    </View>
  )
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  wrap: { flex: 1, gap: spacing.sm, paddingVertical: spacing.sm },

  // One dot per slide — the only progress indicator on this screen.
  slides: { flexDirection: 'row', gap: 7, justifyContent: 'center' },
  slideDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.border },
  slideDotOn: { backgroundColor: colors.accent },

  pager: { flex: 1 },
  page: {},
  /**
   * Free space is split above the instruction, between it and the content, and below the button —
   * which leaves the canvas around the middle of the page with its button tucked underneath, and
   * keeps the two gaps around the instruction equal to each other.
   */
  gap: { flex: 1 },
  gapBottom: { flex: 2 },
  // Identical on every page, so the instruction never moves as you swipe.
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  label: { color: colors.ink, fontFamily: fonts.semibold, fontSize: 16 },

  // No flex: the spacers own the free space, so the content is exactly as tall as it needs to be.
  contentArea: { gap: spacing.md },
  /*
   * The side margins are load-bearing, not decoration. A stroke that starts on the canvas keeps the
   * gesture (it has to — こ, に and ー are horizontal strokes a pager would otherwise eat), so these
   * strips, plus the label row above and the space around the canvas, are where a swipe can begin.
   */
  canvas: { height: 230, marginHorizontal: spacing.xl },
  introBox: { height: 230, justifyContent: 'center' },
  glyph: { color: colors.ink, fontSize: 104, lineHeight: 120, textAlign: 'center' },

  markRow: { alignItems: 'center', justifyContent: 'center', minHeight: 24 },

  // Directly under the check mark, inside the page — not pinned to the foot of the screen.
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 48,
    marginHorizontal: spacing.xl,
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
  },
  primaryOff: { opacity: 0.3 },
  primaryText: { color: colors.onAccent, fontFamily: fonts.semibold, fontSize: 13 },
})
