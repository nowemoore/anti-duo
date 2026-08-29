import { useCallback, useMemo, useState, type ReactNode } from 'react'
import type { IconName } from '@fortawesome/fontawesome-svg-core'
import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { DefaultTheme, NavigationContainer, useNavigationContainerRef, type Theme } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { useHeaderHeight } from '@react-navigation/elements'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { TapScale } from '../components/TapScale'
import type { Unit } from '@shared/types'
import { PRACTICE_ITERATIONS } from '@shared/constants'
import { useContent } from '../context/ContentContext'
import { useProgress } from '../context/ProgressContext'
import { Bilingual } from '../components/Bilingual'
import { LanguageToggle } from '../components/LanguageToggle'
import { Icon } from '../components/Icon'
import { ActionRow } from '../components/ActionRow'
import { ProgressTally } from '../components/ProgressTally'
import { HelpButton } from '../components/HelpButton'
import { Segmented } from '../components/Segmented'
import { Stagger } from '../components/Stagger'
import { Tally } from '../components/Tally'
import { LearnPhase } from '../components/LearnPhase'
import { PracticeSession } from '../components/PracticeSession'
import { KanjiMosaic } from '../components/KanjiMosaic'
import { GrammarMenu } from '../components/grammar/GrammarMenu'
import { GrammarSection } from '../components/grammar/GrammarSection'
import { KanaMenu } from '../components/kana/KanaMenu'
import { KanaCharacter } from '../components/kana/KanaCharacter'
import { KanaPractice } from '../components/kana/KanaPractice'
import { KanaWordPractice } from '../components/kana/KanaWordPractice'
import { HeaderProvider, useHeaderConfig, useScreenHeader } from '../context/HeaderContext'
import { useTabBarHeight } from '../context/TabBarContext'
import { useLanguage } from '../context/LanguageContext'
import { hasPassed, topicProgress, topicsForLang, type GrammarTopic } from '@lib/grammar'
import { readableWords, scriptsForLang, studiedCount, totalKanaCount, type KanaScript } from '@lib/kana'
import { fonts, radius, shadow, spacing, type Palette } from '../theme'
import { useColors, useStyles } from '../hooks/theme'
import {
  ackBatches,
  applyLearned,
  introducedUnits,
  introducedWords,
  learnChunkSize,
  nextLearnSession,
  unlearnedUnits,
} from '@lib/study'

// 'home' = welcome; 'menu' = the unit page; 'grammar'/'grammarTopic' = the grammar subsections;
// 'kana*' = the script course (menu → chart → one character, plus its own practice); then the
// sessions. These are the stack's route names, so moving between them is a real push or pop.
type Route =
  | 'home'
  | 'menu'
  | 'learn'
  | 'practice'
  | 'grammar'
  | 'grammarTopic'
  | 'kana'
  | 'kanaChar'
  | 'kanaPractice'
  | 'kanaWords'

export function StudyView() {
  const index = useContent()
  const { progress, update } = useProgress()
  const { draw, id: langId } = useLanguage()
  const colors = useColors()
  const navRef = useNavigationContainerRef()
  /**
   * Push a route. Goes through the container ref rather than `useNavigation` because the handlers
   * live here, above the navigator — `navigate` to a route already on the stack pops back to it,
   * which is what every "done, return to the menu" path wants.
   */
  const go = (route: Route) => {
    if (navRef.isReady()) navRef.navigate(route as never)
  }
  /**
   * The stack draws over the app's own background, so its own surfaces stay out of the way.
   * Memoised: a fresh object every render would re-theme the container on every keystroke.
   */
  const navTheme: Theme = useMemo(
    () => ({
      dark: true,
      colors: {
        primary: colors.accent,
        background: 'transparent',
        card: 'transparent',
        text: colors.ink,
        border: 'transparent',
        notification: colors.accent,
      },
      fonts: DefaultTheme.fonts,
    }),
    [colors],
  )
  // One learn session: the units to teach, the pool "Not now" swaps from, and where we are in it.
  // Each unit runs learn → write before the next begins, so `qi`/`stage` walk that interleaving.
  const [chunk, setChunk] = useState<Unit[]>([])
  const [reserve, setReserve] = useState<Unit[]>([])
  const [qi, setQi] = useState(0)
  const [practiceRun, setPracticeRun] = useState(0)
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
    go('learn')
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
      go('menu')
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

  return (
    <NavigationContainer ref={navRef} theme={navTheme}>
      <Stack.Navigator screenOptions={screenOptions}>
        <Stack.Screen name="home" options={{ headerShown: false }}>
          {() => (
            <ScreenFrame bare>
              <StudyHome
                onOpen={() => go('menu')}
                onPractice={() => go('practice')}
                onGrammar={grammarTopics.length ? () => go('grammar') : undefined}
                // A language with no script course (Arabic) simply doesn't get the card.
                onKana={kanaScripts.length ? () => go('kana') : undefined}
                onKanaPractice={() => go('kanaPractice')}
                onKanaWords={() => go('kanaWords')}
                kanaScripts={kanaScripts}
                grammarTopics={grammarTopics}
              />
            </ScreenFrame>
          )}
        </Stack.Screen>

        <Stack.Screen name="menu">
          {() => (
            <ScreenFrame scrolls>
              <StudyMenu onLearn={startLearn} onPractice={() => go('practice')} onSelectUnit={startOne} />
            </ScreenFrame>
          )}
        </Stack.Screen>

        {/* One route for the whole learn step: the card and the writing view are two faces of the
            same unit, and moving between them is the view's own business (its chevrons), not a push. */}
        <Stack.Screen name="learn" options={withHelp}>
          {() => (
            <ScreenFrame>
              {current && stage === 'learn' ? (
                <LearnPhase
                  // Remounts per unit, so each card starts clean.
                  key={current.idx}
                  chunk={[current]}
                  reserve={reserve}
                  onComplete={finishCard}
                  totalSteps={stepTotal}
                  baseStep={stepOffset}
                  headerCount={{ current: qi + 1, total: chunk.length }}
                />
              ) : current && stage === 'write' && draw ? (
                <draw.Review
                  key={current.idx}
                  units={[current]}
                  baseStep={stepOffset + 1}
                  totalSteps={stepTotal}
                  onDone={advance}
                  // Back returns to this unit's card, so the two views are a pair you can move between.
                  onPrev={() => setStage('learn')}
                  // Only the session's final unit finishes; mid-session, writing hands on to the next kanji.
                  lastStep={qi + 1 >= chunk.length}
                />
              ) : null}
            </ScreenFrame>
          )}
        </Stack.Screen>

        <Stack.Screen name="practice" options={withHelp}>
          {() => (
            <ScreenFrame>
              <PracticeSession
                // A fresh key remounts the session, so "Keep practising" re-picks targets from the
                // levels this round just changed rather than replaying the set it started with.
                key={practiceRun}
                onExit={() => go('menu')}
                onRestart={() => setPracticeRun((n) => n + 1)}
              />
            </ScreenFrame>
          )}
        </Stack.Screen>

        <Stack.Screen name="grammar" options={withHelp}>
          {() => (
            <ScreenFrame>
              <GrammarMenu
                topics={grammarTopics}
                onSelect={(t) => {
                  setTopic(t)
                  go('grammarTopic')
                }}
              />
            </ScreenFrame>
          )}
        </Stack.Screen>

        <Stack.Screen name="grammarTopic" options={withHelp}>
          {() => <ScreenFrame>{topic ? <GrammarSection topic={topic} /> : null}</ScreenFrame>}
        </Stack.Screen>

        <Stack.Screen name="kana">
          {() => (
            <ScreenFrame scrolls>
              <KanaMenu
                scripts={kanaScripts}
                onSelect={(sc, c) => {
                  setKanaScript(sc)
                  setKanaChar(c)
                  go('kanaChar')
                }}
                onPractice={() => go('kanaPractice')}
                onWordPractice={() => go('kanaWords')}
              />
            </ScreenFrame>
          )}
        </Stack.Screen>

        <Stack.Screen name="kanaChar">
          {() => (
            <ScreenFrame>
              {kanaScript && kanaChar ? (
                <KanaCharacter char={kanaChar} script={kanaScript} onChange={setKanaChar} />
              ) : null}
            </ScreenFrame>
          )}
        </Stack.Screen>

        <Stack.Screen name="kanaPractice">
          {() => (
            <ScreenFrame>
              <KanaPractice onBack={() => go('kana')} />
            </ScreenFrame>
          )}
        </Stack.Screen>

        <Stack.Screen name="kanaWords">
          {() => (
            <ScreenFrame>
              <KanaWordPractice onBack={() => go('kana')} />
            </ScreenFrame>
          )}
        </Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  )
}

const Stack = createNativeStackNavigator()

/**
 * Every study screen sits under the system navigation bar, so the back control, its swipe gesture
 * and the push/pop transitions are UIKit's rather than ours.
 *
 * There is no bar to see: no title, no background, no blur, no hairline — just the chevron floating
 * on the page, the way it looked before it was native. All that changes is that it's now UIKit's
 * control, with UIKit's swipe-back and transitions behind it.
 */
const screenOptions = {
  title: '',
  headerTransparent: true,
  headerStyle: { backgroundColor: 'transparent' },
  headerShadowVisible: false,
  // Chevron only — no "Back", and no previous screen's title trailing it.
  headerBackButtonDisplayMode: 'minimal',
  headerBackTitle: '',
} as const

/**
 * Opts a screen into the script-reference button, in the system bar's right slot. Declared per
 * screen rather than derived from the header config, which is now scoped to inside the screen and
 * so can't be read from the bar.
 */
const withHelp = { ...screenOptions, headerRight: () => <HelpButton /> } as const

/**
 * Wraps one screen. The provider is per screen on purpose — see {@link HeaderProvider}; sharing one
 * across the stack let a departing screen's step header render over the screen beneath it.
 */
function ScreenFrame({
  children,
  bare,
  scrolls,
}: {
  children: ReactNode
  bare?: boolean
  /**
   * This screen is one long scroll, so it runs *under* the floating tab bar and pads its own
   * content instead. Without it the screen ends above the bar, leaving a band of bare background
   * that reads as a grey stripe across the foot of the page.
   */
  scrolls?: boolean
}) {
  return (
    <HeaderProvider>
      <ScreenBody bare={bare} scrolls={scrolls}>
        {children}
      </ScreenBody>
    </HeaderProvider>
  )
}

/**
 * The page body under the transparent bar: the step title and dots this screen registered via
 * `useScreenHeader`, then the screen itself.
 *
 * `useHeaderHeight` rather than a constant — a transparent header doesn't inset its content, and
 * the bar's height varies with the device's status bar.
 */
function ScreenBody({
  children,
  bare,
  scrolls,
}: {
  children: ReactNode
  bare?: boolean
  scrolls?: boolean
}) {
  const styles = useStyles(makeStyles)
  const header = useHeaderConfig()
  const insets = useSafeAreaInsets()
  const barHeight = useHeaderHeight()
  const tabBar = useTabBarHeight()
  // `bare` is the home screen, which shows no bar at all — it still has to clear the status bar.
  const top = bare ? insets.top + spacing.sm : barHeight
  return (
    <View style={[styles.screen, { paddingTop: top, paddingBottom: scrolls ? 0 : tabBar }]}>
      {header.title && (
        <View style={styles.titleRow}>
          <Bilingual native={header.title.ja} en={header.title.en} />
        </View>
      )}
      {header.progress != null && (
        <View style={styles.dotsRow}>
          {Array.from({ length: header.progress.total }, (_, k) => (
            <View key={k} style={[styles.dot, k < header.progress!.current && styles.dotOn]} />
          ))}
        </View>
      )}
      {children}
    </View>
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
   * The box is a shade *taller* than the font size, not shorter. A short box does crop the glyph top
   * and bottom, but the result reads as the card accidentally covering the character rather than as
   * a deliberate bleed — the grid watermark runs edge to edge and looked right next to it. Cropping
   * happens on the right edge only, which is where it reads as intentional.
   */
  const box = lineHeight ?? Math.round(size * 1.1)
  /*
   * Centred by the layout engine, not by hand.
   *
   * This used to be `top: '50%'` with a `translateY(-box / 2)`, which assumes the text renders at
   * exactly `box` tall — it doesn't, because RN adds the font's own ascent/descent padding around
   * the line box, so every mark sat a few points low. The wrapper is anchored top-to-bottom and has
   * no width of its own, so the glyph still sizes to its content and overflows the right edge.
   */
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, right, justifyContent: 'center' }}>
      <Text
        numberOfLines={1}
        style={{
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
    </View>
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

/**
 * A labelled rule across the column — "What's on today?" on one side, the same in the language being
 * learned on the other. Sets the screen up as a menu of things to do rather than a stack of cards.
 */
function SectionHeader({ left, right }: { left: string; right: string }) {
  const styles = useStyles(makeStyles)
  return (
    <View style={styles.rule}>
      <Text style={styles.ruleLeft}>{left}</Text>
      <View style={styles.ruleLine} />
      <Text style={styles.ruleRight}>{right}</Text>
    </View>
  )
}

/** One of the home screen's sections: a heading row, then whatever actions that section offers. */
function SectionCard({
  icon,
  title,
  stat,
  mark,
  onPress,
  children,
}: {
  icon: IconName
  title: string
  stat: ReactNode
  /** Watermark glyph, or null for a language whose script has none to draw with. */
  mark?: ReactNode
  /** Set when the whole card is the action — it then shows a chevron and takes no child buttons. */
  onPress?: () => void
  children?: ReactNode
}) {
  const colors = useColors()
  const styles = useStyles(makeStyles)
  const body = (
    <>
      {mark}
      <View style={styles.sectionHead}>
        <View style={styles.iconCircle}>
          <Icon name={icon} size={20} color={colors.onAccent} />
        </View>
        <View style={styles.entryText}>
          <Text style={styles.entryTitle}>{title}</Text>
          <Text style={styles.entrySub}>{stat}</Text>
        </View>
        {onPress ? <Icon name="chevron-right" size={14} color={colors.muted} /> : null}
      </View>
      {children}
    </>
  )
  /*
   * A card carrying its own buttons must not be pressable itself: two overlapping targets, one of
   * which wins by accident, is worse than a card that simply holds controls. Grammar has nothing
   * inside it, so there the whole card is the button and it shows a chevron to say so.
   */
  return onPress ? (
    <TapScale style={styles.section} onPress={onPress}>
      {body}
    </TapScale>
  ) : (
    <View style={styles.section}>{body}</View>
  )
}

/** A secondary action inside a section — quiet, sitting under the heading row. */
function SubAction({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const colors = useColors()
  const styles = useStyles(makeStyles)
  return (
    <TapScale style={styles.subBtn} onPress={onPress} accessibilityRole="button">
      <Icon name={icon} size={13} color={colors.ink} />
      <Text style={styles.subBtnText}>{label}</Text>
    </TapScale>
  )
}

/**
 * Welcome screen: a greeting, then the three courses as sections you can act on directly.
 *
 * Each section says where you are and offers its own ways in, so the common moves — open the charts,
 * browse the board, start practising — are one tap from here rather than three.
 */
function StudyHome({
  onOpen,
  onPractice,
  onGrammar,
  onKana,
  onKanaPractice,
  onKanaWords,
  kanaScripts,
  grammarTopics,
}: {
  onOpen: () => void
  onPractice: () => void
  onGrammar?: () => void
  onKana?: () => void
  onKanaPractice: () => void
  onKanaWords: () => void
  kanaScripts: KanaScript[]
  grammarTopics: GrammarTopic[]
}) {
  const colors = useColors()
  const styles = useStyles(makeStyles)
  const index = useContent()
  const { progress } = useProgress()
  const { ui, id: langId } = useLanguage()
  /** Which half of the vocabulary this section is reporting on. */
  const [vocabMode, setVocabMode] = useState(0)

  const introduced = introducedUnits(index, progress).length
  const remainingToLearn = unlearnedUnits(index, progress).length
  const enabledTotal = introduced + remainingToLearn
  const wordsMet = introducedWords(index, progress).size
  const kanaWords = index.content.kanaWords ?? []
  const readable = readableWords(progress, kanaWords).length
  const grammarDone = grammarTopics.filter((t) => hasPassed(topicProgress(progress, t.id))).length
  const name = progress.settings.name.trim()

  const hasRecord = Object.keys(progress.units).length > 0
  const greeting = ui.greeting(name, hasRecord)
  // Japanese only for now: the glyphs are Japanese, so Arabic keeps the same layout without them.
  const marks = langId === 'ja'
  const onKanji = vocabMode === 0

  return (
    <View style={styles.home}>
      {/* Language switch pinned to the very top; the greeting floats in the space below it. */}
      <LanguageToggle />

      <View style={styles.greetingWrap}>
        <Bilingual native={greeting.native} en={greeting.en} large />
      </View>

      <View style={styles.cardsCol}>
        <Stagger>
          <SectionHeader left={ui.todayHeader.en} right={ui.todayHeader.native} />

          {/* Only for languages that ship a script course; `kanaSection` is optional for that reason. */}
          {onKana && ui.kanaSection && (
            <SectionCard
              icon="language"
              title={`${ui.kanaSection.native}・${ui.kanaSection.en}`}
              stat={
                <>
                  <Tally count={studiedCount(progress, kanaScripts)} total={totalKanaCount(kanaScripts)} />
                  {' characters'}
                </>
              }
              mark={
                marks ? (
                  <Watermark>
                    <GlyphMark text="あア" size={150} opacity={0.06} />
                  </Watermark>
                ) : null
              }
            >
              <View style={styles.subRow}>
                <SubAction icon="table-cells" label="Charts" onPress={onKana} />
                <SubAction icon="ear-listen" label="Practice" onPress={onKanaPractice} />
              </View>
            </SectionCard>
          )}

          <SectionCard
            icon="pen-nib"
            title={`${ui.vocabSection.native}・${ui.vocabSection.en}`}
            stat={
              onKanji ? (
                <>
                  {`${wordsMet} met · `}
                  <Tally count={introduced} total={enabledTotal} />
                  {` ${ui.noun}`}
                </>
              ) : (
                <>
                  <Tally count={readable} total={kanaWords.length} />
                  {' words readable'}
                </>
              )
            }
            mark={
              marks ? (
                <Watermark>
                  <GlyphMark text="言葉" size={150} opacity={0.06} />
                </Watermark>
              ) : null
            }
          >
            {/* The same control the kana charts use, one level up: which half of the vocabulary this
                section is about. It swaps the counter and the way in — not the practice below, which
                draws on everything you know either way. */}
            {kanaWords.length > 0 && (
              <Segmented
                values={['Kanji', 'Kana']}
                index={vocabMode}
                onChange={setVocabMode}
                style={styles.vocabSwitch}
              />
            )}
            <View style={styles.subRow}>
              {onKanji ? (
                <SubAction icon="table-cells" label="Board" onPress={onOpen} />
              ) : (
                <SubAction icon="comment" label="Kana words" onPress={onKanaWords} />
              )}
            </View>
            <TapScale style={styles.jumpBtn} onPress={onPractice} accessibilityRole="button">
              <Icon name="play" size={13} color={colors.onAccent} />
              <View style={styles.jumpText}>
                <Text style={styles.jumpTitle}>Jump straight to practice</Text>
                <Text style={styles.jumpSub}>{`${PRACTICE_ITERATIONS} mixed questions`}</Text>
              </View>
              <Icon name="chevron-right" size={14} color={colors.onAccent} />
            </TapScale>
          </SectionCard>

          {/* Languages with no grammar subsections yet keep the original disabled placeholder. */}
          <SectionCard
            icon="book"
            title={`${ui.grammarSection.native}・${ui.grammarSection.en}`}
            stat={
              onGrammar ? (
                <>
                  <Tally count={grammarDone} total={grammarTopics.length} />
                  {' subsections'}
                </>
              ) : (
                'coming soon'
              )
            }
            mark={
              marks ? (
                <Watermark>
                  <GlyphMark text="《〈【" size={92} letterSpacing={-22} right={-4} opacity={0.07} />
                </Watermark>
              ) : null
            }
            onPress={onGrammar}
          />
        </Stagger>
      </View>
    </View>
  )
}

/** The unit page: the Learn / Practice actions over the browsable board. */
function StudyMenu({
  onLearn,
  onPractice,
  onSelectUnit,
}: {
  onLearn: () => void
  onPractice: () => void
  onSelectUnit: (u: Unit) => void
}) {
  const styles = useStyles(makeStyles)
  const tabBar = useTabBarHeight()
  const index = useContent()
  const { progress } = useProgress()
  const { ui } = useLanguage()
  const introduced = introducedUnits(index, progress).length
  const remainingToLearn = unlearnedUnits(index, progress).length
  const chunkSize = learnChunkSize(index, progress)
  const total = introduced + remainingToLearn
  const canLearn = remainingToLearn > 0
  const canPractice = introduced > 0

  useScreenHeader() // the system bar owns the back control; no step label on this screen

  return (
    <ScrollView
      style={styles.menuScroll}
      contentContainerStyle={[styles.menuWrap, { paddingBottom: tabBar + spacing.xxl }]}
    >
      <Stagger>
      <ProgressTally count={introduced} total={total} label={`${ui.noun} unlocked`} />

      {/* Two ways to let the app choose for you; the board below is the third, and its own thing. */}
      <ActionRow
        primary
        icon="play"
        title="Practice"
        sub={canPractice ? `${PRACTICE_ITERATIONS} questions` : `learn some ${ui.noun} first`}
        disabled={!canPractice}
        onPress={onPractice}
      />
      <ActionRow
        icon="plus"
        title={canLearn ? `Learn ${chunkSize} new` : 'Nothing left to learn'}
        sub={canLearn ? `${remainingToLearn} still to meet` : `all ${ui.noun} introduced`}
        disabled={!canLearn}
        onPress={onLearn}
      />

      <Text style={styles.boardNote}>or keep scrolling to study {ui.noun} you like</Text>
      <Text style={styles.boardHint}>
        tap {ui.noun} to learn it · hold {ui.noun} to disable it for practice
      </Text>
      <KanjiMosaic onSelect={onSelectUnit} />
      </Stagger>
    </ScrollView>
  )
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  fill: { flex: 1 },
  // Page gutter lives here rather than on the app body, so the system bar spans the full width.
  screen: { flex: 1, paddingHorizontal: spacing.lg },
  titleRow: { alignItems: 'center', paddingBottom: spacing.sm },
  dotsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 7,
    marginBottom: spacing.md,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  dotOn: { backgroundColor: colors.accent },
  menuScroll: { flex: 1 },
  // Was a centred column of two cards; now a scrolling page, because the board below is long.
  menuWrap: { gap: spacing.md, paddingTop: spacing.md },
  boardNote: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  // The board's two gestures, spelled out — neither is discoverable from the tiles themselves.
  boardHint: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11,
    textAlign: 'center',
    marginTop: -spacing.sm,
  },
  // Count and total at one size — the total is the thing being counted against, not a footnote.
  // One font and size throughout — only the colour separates the count from what it's counting.

  // Fill only: the row owns its own layout (badge, two-line text, chevron), so it can't take
  // the centred single-label shell the button helpers carry.
  // A lightened well rather than a tint: on the filled row an accent-on-accent badge vanishes.
  // No fontFamily: the system face is SF Pro on iOS, which is what makes these read as controls.

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
  /* A labelled rule: the label sits at one end, the line takes whatever is left. */
  rule: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  ruleLeft: {
    color: colors.accentInk,
    fontFamily: fonts.semibold,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  ruleLine: { flex: 1, height: 1, backgroundColor: colors.border },
  ruleRight: { color: colors.muted, fontSize: 12 },
  /*
   * A section holds a heading row and its own controls, so it grows with its content rather than
   * keeping the fixed height the old single-action cards needed.
   */
  section: {
    ...shadow,
    alignSelf: 'stretch',
    gap: spacing.md,
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  subRow: { flexDirection: 'row', gap: spacing.sm },
  // Quiet, and each takes an equal share of the row however many there are.
  subBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.panelStrong,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
  },
  subBtnText: { color: colors.ink, fontFamily: fonts.medium, fontSize: 14 },
  vocabSwitch: { marginBottom: spacing.xs },
  /* The one filled control on the screen, and rounder than the quiet ones so it reads as the way in
     rather than a third sibling. */
  jumpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.accent,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
  },
  jumpText: { flex: 1 },
  jumpTitle: { color: colors.onAccent, fontFamily: fonts.semibold, fontSize: 15 },
  jumpSub: { color: colors.onAccent, fontFamily: fonts.body, fontSize: 12, opacity: 0.75 },
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
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
