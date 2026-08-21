import { useCallback, useState, type ReactNode } from 'react'
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native'
import type { Unit } from '@shared/types'
import { useContent } from '../context/ContentContext'
import { useProgress } from '../context/ProgressContext'
import { Bilingual } from '../components/Bilingual'
import { LanguageToggle } from '../components/LanguageToggle'
import { Icon } from '../components/Icon'
import { FadeView } from '../components/FadeView'
import { LearnPhase } from '../components/LearnPhase'
import { PracticeSession } from '../components/PracticeSession'
import { KanjiMosaic } from '../components/KanjiMosaic'
import { GrammarMenu } from '../components/grammar/GrammarMenu'
import { GrammarSection } from '../components/grammar/GrammarSection'
import { KanaMenu } from '../components/kana/KanaMenu'
import { KanaCharacter } from '../components/kana/KanaCharacter'
import { KanaPractice } from '../components/kana/KanaPractice'
import { useScreenHeader } from '../context/HeaderContext'
import { useLanguage } from '../context/LanguageContext'
import { topicsForLang, type GrammarTopic } from '@lib/grammar'
import { scriptsForLang, studiedCount, totalKanaCount, type KanaScript } from '@lib/kana'
import { fonts, radius, shadow, spacing, type Palette } from '../theme'
import { useColors, useStyles } from '../hooks/theme'
import {
  ackBatches,
  applyLearned,
  introducedUnits,
  learnChunkSize,
  nextLearnSession,
  unlearnedUnits,
} from '@lib/study'

// 'home' = welcome; 'menu' = the unit page;
// 'grammar'/'grammarTopic' = the grammar subsections; 'kana*' = the script course (menu → chart →
// one character, plus its own practice); then the sessions.
type Phase =
  | 'home'
  | 'menu'
  | 'learn'
  | 'practice'
  | 'grammar'
  | 'grammarTopic'
  | 'kana'
  | 'kanaChar'
  | 'kanaPractice'

export function StudyView() {
  const styles = useStyles(makeStyles)
  const index = useContent()
  const { progress, update } = useProgress()
  const { draw, id: langId } = useLanguage()
  const [phase, setPhase] = useState<Phase>('home')
  // One learn session: the units to teach, the pool "Not now" swaps from, and where we are in it.
  // Each unit runs learn → write before the next begins, so `qi`/`stage` walk that interleaving.
  const [chunk, setChunk] = useState<Unit[]>([])
  const [reserve, setReserve] = useState<Unit[]>([])
  const [qi, setQi] = useState(0)
  const [stage, setStage] = useState<'learn' | 'write'>('learn')
  const [topic, setTopic] = useState<GrammarTopic | null>(null)
  const [kanaScript, setKanaScript] = useState<KanaScript | null>(null)
  const [kanaChar, setKanaChar] = useState<string | null>(null)
  const grammarTopics = topicsForLang(langId)
  const kanaScripts = scriptsForLang(langId)

  function startLearn() {
    const { chunk: next, reserve: rest } = nextLearnSession(index, progress)
    if (next.length === 0) return
    beginSession(next, rest)
  }

  /** Study one specific kanji, chosen from the board. No reserve — there's nothing to swap for. */
  function startOne(unit: Unit) {
    beginSession([unit], [])
  }

  function beginSession(units: Unit[], pool: Unit[]) {
    setChunk(units)
    setReserve(pool)
    setQi(0)
    setStage('learn')
    setPhase('learn')
  }

  /**
   * Whether a unit has anything to write: an auto-gradable word, or failing that one that can be
   * traced over a guide. The same predicate decides both the review contents and the dot count —
   * they used to differ (examples-or-form vs form-only), so the dots could disagree with the review.
   */
  const writeable = useCallback(
    (k: Unit) => {
      const has = (test?: (w: string) => boolean) =>
        test != null && (k.examples.some((e) => test(e.word)) || test(k.form))
      return has(draw?.isDrawable) || has(draw?.isTraceable)
    },
    [draw],
  )

  /**
   * Finished the card for the current unit. Credits it, marks any newly unlocked example words as
   * seen, then goes straight to writing *this* unit rather than banking it for the end — writing a
   * character while it's fresh is the point of the drill.
   */
  function finishCard(learned: Unit[], pool: Unit[]) {
    const unit = learned[0]
    if (!unit) return advance()
    update((p) => ackBatches(applyLearned(p, [unit]), unit, index.lang.batchUnlockEvery))
    // A "Not now" swaps the card and requeues into the pool; carry both forward.
    setChunk((cs) => cs.map((c, n) => (n === qi ? unit : c)))
    setReserve(pool)
    if (writeable(unit)) setStage('write')
    else advance()
  }

  /** On to the next unit in the session, or back to the board when it's done. */
  function advance() {
    if (qi + 1 >= chunk.length) {
      setPhase('menu')
      return
    }
    setQi(qi + 1)
    setStage('learn')
  }

  // Dots run across the whole session: one per learn card plus one per unit that can be written.
  const stepsFor = (u: Unit) => 1 + (writeable(u) ? 1 : 0)
  const stepTotal = chunk.reduce((n, u) => n + stepsFor(u), 0)
  const stepOffset = chunk.slice(0, qi).reduce((n, u) => n + stepsFor(u), 0)
  const current = chunk[qi]

  let content
  if (phase === 'learn' && current && stage === 'learn')
    content = (
      <LearnPhase
        // Remounts per unit, so each card starts clean.
        key={current.idx}
        chunk={[current]}
        reserve={reserve}
        onComplete={finishCard}
        onExit={() => setPhase('menu')}
        totalSteps={stepTotal}
        baseStep={stepOffset}
        headerCount={{ current: qi + 1, total: chunk.length }}
      />
    )
  else if (phase === 'learn' && current && stage === 'write')
    content = draw ? (
      <draw.Review
        key={current.idx}
        units={[current]}
        baseStep={stepOffset + 1}
        totalSteps={stepTotal}
        onDone={advance}
        onExit={() => setPhase('menu')}
      />
    ) : null
  else if (phase === 'practice') content = <PracticeSession onExit={() => setPhase('menu')} />
  else if (phase === 'grammar')
    content = (
      <GrammarMenu
        topics={grammarTopics}
        onBack={() => setPhase('home')}
        onSelect={(t) => {
          setTopic(t)
          setPhase('grammarTopic')
        }}
      />
    )
  else if (phase === 'grammarTopic' && topic)
    content = <GrammarSection topic={topic} onBack={() => setPhase('grammar')} />
  else if (phase === 'kana')
    content = (
      <KanaMenu
        scripts={kanaScripts}
        onBack={() => setPhase('home')}
        onSelect={(s, c) => {
          setKanaScript(s)
          setKanaChar(c)
          setPhase('kanaChar')
        }}
        onPractice={() => setPhase('kanaPractice')}
      />
    )
  else if (phase === 'kanaChar' && kanaScript && kanaChar)
    content = (
      <KanaCharacter
        char={kanaChar}
        script={kanaScript}
        onBack={() => setPhase('kana')}
        onChange={setKanaChar}
      />
    )
  else if (phase === 'kanaPractice') content = <KanaPractice onBack={() => setPhase('kana')} />
  else if (phase === 'menu')
    content = (
      <StudyMenu
        onBack={() => setPhase('home')}
        onLearn={startLearn}
        onPractice={() => setPhase('practice')}
        onSelectUnit={startOne}
      />
    )
  else
    content = (
      <StudyHome
        onOpen={() => setPhase('menu')}
        onGrammar={grammarTopics.length ? () => setPhase('grammar') : undefined}
        // A language with no script course (Arabic) simply doesn't get the card.
        onKana={kanaScripts.length ? () => setPhase('kana') : undefined}
        kanaScripts={kanaScripts}
      />
    )

  return (
    <FadeView key={phase} style={styles.fill}>
      {content}
    </FadeView>
  )
}

/**
 * A character watermark: oversized, barely-there, and clipped by the card's right edge.
 *
 * Deliberately cropped — a whole visible glyph reads as content rather than texture. Colour is
 * always `colors.ink` at a low opacity, never the accent and never a literal hex, so it inherits
 * whatever palette the active language brings.
 *
 * Set in the brush face (Yuji Syuku) rather than left to the OS font: the watermark is decoration,
 * and a hand-brushed glyph is what makes it read as texture rather than as a stray character.
 */
function GlyphMark({
  text,
  size,
  opacity,
  lineHeight,
  right = -18,
  letterSpacing,
}: {
  text: string
  size: number
  opacity: number
  /** Overrides the derived line box — a mark whose glyphs nest needs its own vertical rhythm. */
  lineHeight?: number
  /** How far past the card's right edge the text sits; more negative crops more. */
  right?: number
  /** Negative values pull the glyphs together, so brackets nest instead of sitting in a row. */
  letterSpacing?: number
}) {
  const colors = useColors()
  /*
   * RN has no `calc`, so the vertical centring offset is half the line box, precomputed.
   *
   * The box is a shade *taller* than the font size, not shorter. A short box does crop the glyph top
   * and bottom, but the result reads as the card accidentally covering the character rather than as
   * a deliberate bleed — the grid watermark runs edge to edge and looked right next to it. Cropping
   * happens on the right edge only, which is where it reads as intentional.
   */
  const box = lineHeight ?? Math.round(size * 1.1)
  return (
    <Text
      numberOfLines={1}
      pointerEvents="none"
      style={{
        position: 'absolute',
        right,
        top: '50%',
        transform: [{ translateY: -box / 2 }],
        color: colors.ink,
        opacity,
        fontFamily: fonts.brush,
        fontSize: size,
        lineHeight: box,
        ...(letterSpacing != null ? { letterSpacing } : {}),
      }}
    >
      {text}
    </Text>
  )
}

/**
 * Clips a watermark to the card without clipping the card's shadow.
 *
 * `overflow: 'hidden'` on the card itself would do the cropping, but on iOS it also sets
 * `clipsToBounds`, which kills the drop shadow — so the clipping happens on this inset layer instead
 * and the card keeps its `shadow` spread untouched.
 */
function Watermark({ children }: { children: ReactNode }) {
  const styles = useStyles(makeStyles)
  return (
    <View pointerEvents="none" style={styles.clip}>
      {children}
    </View>
  )
}

/** Welcome screen: greeting + the "Learn" entry card (with progress), grammar, and the script course. */
function StudyHome({
  onOpen,
  onGrammar,
  onKana,
  kanaScripts,
}: {
  onOpen: () => void
  onGrammar?: () => void
  onKana?: () => void
  kanaScripts: KanaScript[]
}) {
  const colors = useColors()
  const styles = useStyles(makeStyles)
  const index = useContent()
  const { progress } = useProgress()
  const { ui, id: langId } = useLanguage()

  const introduced = introducedUnits(index, progress).length
  const remainingToLearn = unlearnedUnits(index, progress).length
  const enabledTotal = introduced + remainingToLearn
  const name = progress.settings.name.trim()

  const hasRecord = Object.keys(progress.units).length > 0
  const greeting = ui.greeting(name, hasRecord)
  // Japanese only for now: the glyphs are Japanese, so Arabic keeps the same layout without them.
  const marks = langId === 'ja'

  return (
    <View style={styles.home}>
      {/* Language switch pinned to the very top; the greeting floats in the space below it. */}
      <LanguageToggle />

      <View style={styles.greetingWrap}>
        <Bilingual native={greeting.native} en={greeting.en} large />
      </View>

      <View style={styles.cardsCol}>
        {/* Only for languages that ship a script course; `kanaEntry` is optional for the same reason. */}
        {onKana && ui.kanaEntry && (
          <Pressable style={styles.entryCard} onPress={onKana}>
            {marks && (
              <Watermark>
                <GlyphMark text="あア" size={150} opacity={0.06} />
              </Watermark>
            )}
            <View style={styles.iconCircle}>
              <Icon name="language" size={22} color={colors.onAccent} />
            </View>
            <View style={styles.entryText}>
              <Text style={styles.entryTitle}>{ui.kanaEntry.native}</Text>
              <Text style={styles.entrySub}>
                {studiedCount(progress, kanaScripts)} / {totalKanaCount(kanaScripts)} characters studied
              </Text>
            </View>
          </Pressable>
        )}

        <Pressable style={styles.entryCard} onPress={onOpen}>
          {marks && (
            <Watermark>
              <GlyphMark text="漢字" size={150} opacity={0.06} />
            </Watermark>
          )}
          <View style={styles.iconCircle}>
            <Icon name="pen-nib" size={22} color={colors.onAccent} />
          </View>
          <View style={styles.entryText}>
            <Text style={styles.entryTitle}>{ui.learnEntry.native}</Text>
            <Text style={styles.entrySub}>
              {introduced} / {enabledTotal} {ui.noun} learnt
            </Text>
          </View>
        </Pressable>

        {/* Languages with no grammar subsections yet keep the original disabled placeholder. */}
        <Pressable
          style={[styles.entryCard, !onGrammar && styles.entryDisabled]}
          onPress={onGrammar}
          disabled={!onGrammar}
        >
          {marks && (
            <Watermark>
              {/*
                Three brackets pulled into each other by the negative tracking, so they nest.
                No `lineHeight` override: a box shorter than the font size clips the glyphs top and
                bottom, which is what made the other marks look like the card was covering them.
              */}
              <GlyphMark text="《〈【" size={92} letterSpacing={-22} right={-4} opacity={0.07} />
            </Watermark>
          )}
          <View style={[styles.iconCircle, !onGrammar && styles.iconMuted]}>
            <Icon name="book" size={22} color={onGrammar ? colors.onAccent : colors.muted} />
          </View>
          <View style={styles.entryText}>
            <Text style={styles.entryTitle}>{ui.grammarEntry.native}</Text>
            <Text style={styles.entrySub}>{onGrammar ? 'grammar subsections' : 'coming soon'}</Text>
          </View>
        </Pressable>
      </View>
    </View>
  )
}

/** The unit page: Back + the Learn / Practice cards. (Browsing lives in Stats, as the mosaic.) */
function StudyMenu({
  onBack,
  onLearn,
  onPractice,
  onSelectUnit,
}: {
  onBack: () => void
  onLearn: () => void
  onPractice: () => void
  onSelectUnit: (u: Unit) => void
}) {
  const colors = useColors()
  const styles = useStyles(makeStyles)
  const index = useContent()
  const { progress } = useProgress()
  const { ui } = useLanguage()
  const introduced = introducedUnits(index, progress).length
  const remainingToLearn = unlearnedUnits(index, progress).length
  const chunkSize = learnChunkSize(index, progress)
  const canLearn = remainingToLearn > 0
  const canPractice = introduced > 0

  useScreenHeader(onBack) // back button in the app top bar; no step label here

  return (
    <ScrollView style={styles.menuScroll} contentContainerStyle={styles.menuWrap}>
      <Text style={styles.unlockedHeader}>
        {introduced} / {introduced + remainingToLearn} {ui.noun} unlocked
      </Text>

      {/* The two ways in: let the app pick, or pick one yourself off the board below. */}
      <Pressable
        style={[styles.teachBtn, !canLearn && styles.teachBtnOff]}
        onPress={onLearn}
        disabled={!canLearn}
        accessibilityRole="button"
        accessibilityState={{ disabled: !canLearn }}
      >
        <Icon
          name="graduation-cap"
          size={16}
          color={canLearn ? colors.onAccent : colors.muted}
        />
        <Text style={[styles.teachText, !canLearn && styles.teachTextOff]}>
          {canLearn ? `Teach me ${chunkSize} random ${ui.noun}` : `All ${ui.noun} introduced`}
        </Text>
      </Pressable>

      <ChoiceCard
        icon="dumbbell"
        native={ui.practice.native}
        en={ui.practice.en}
        sub={canPractice ? `practice ${ui.noun} you already know` : 'learn some first'}
        disabled={!canPractice}
        onPress={onPractice}
      />

      <Text style={styles.boardNote}>or tap any {ui.noun} to study it</Text>
      <KanjiMosaic onSelect={onSelectUnit} />
    </ScrollView>
  )
}

function ChoiceCard({
  icon,
  native,
  en,
  sub,
  disabled,
  onPress,
}: {
  icon: 'graduation-cap' | 'dumbbell' | 'book'
  native: string
  en: string
  sub: string
  disabled?: boolean
  onPress: () => void
}) {
  const colors = useColors()
  const styles = useStyles(makeStyles)
  return (
    <Pressable
      style={[styles.choice, disabled && styles.choiceDisabled]}
      onPress={onPress}
      disabled={disabled}
    >
      <View style={styles.iconCircle}>
        <Icon name={icon} size={22} color={colors.onAccent} />
      </View>
      <Bilingual native={native} en={en} />
      <Text style={styles.choiceSub}>{sub}</Text>
    </Pressable>
  )
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  fill: { flex: 1 },
  menuScroll: { flex: 1 },
  // Was a centred column of two cards; now a scrolling page, because the board below is long.
  menuWrap: { gap: spacing.md, paddingVertical: spacing.md, paddingBottom: spacing.xxl },
  teachBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 52,
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
  },
  teachBtnOff: { backgroundColor: colors.panel, borderColor: colors.border, borderWidth: 1 },
  teachText: { color: colors.onAccent, fontFamily: fonts.semibold, fontSize: 15 },
  teachTextOff: { color: colors.muted, fontFamily: fonts.body, fontSize: 14 },
  boardNote: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  // Faint section header over the Learn/Practice cards.
  unlockedHeader: {
    textAlign: 'center',
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
    opacity: 0.7,
    marginBottom: spacing.lg,
    fontVariant: ['tabular-nums'],
  },
  // Language toggle sits flush at the very top; the greeting centres in the gap between it and the cards.
  home: { flex: 1, alignItems: 'center', width: '100%' },
  greetingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', width: '100%' },
  /*
   * Clips a watermark to its card. Inset rather than `overflow: 'hidden'` on the card itself:
   * on iOS that also sets clipsToBounds, which would drop the card's shadow.
   */
  clip: { ...StyleSheet.absoluteFillObject, overflow: 'hidden', borderRadius: radius.lg },
  cardsCol: { alignSelf: 'stretch', gap: spacing.md, paddingBottom: spacing.md },
  /*
   * Content is a left-aligned row (circle, then label over counter), but the card keeps the footprint
   * it had when that content was a centred stack — hence the minHeight. Without it the row collapses
   * the card to roughly half its former height and the whole column shifts down the screen.
   */
  entryCard: {
    ...shadow,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    minHeight: 158,
    gap: spacing.md,
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  entryDisabled: { opacity: 0.5 },
  entryText: { flex: 1, gap: 2 },
  // No fontFamily on the native label — the bundled Latin faces have no CJK glyphs (see Bilingual).
  entryTitle: { color: colors.ink, fontSize: 16, fontWeight: '600' },
  entrySub: { color: colors.muted, fontFamily: fonts.body, fontSize: 12 },
  iconMuted: { backgroundColor: colors.border },
  choicesCol: { alignSelf: 'stretch', gap: spacing.md },
  choice: {
    ...shadow,
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  choiceDisabled: { opacity: 0.45 },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceSub: { color: colors.muted, fontFamily: fonts.body, fontSize: 12, textAlign: 'center' },
})
