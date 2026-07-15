import { useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import type { Unit } from '@shared/types'
import { useContent } from '../context/ContentContext'
import { useProgress } from '../context/ProgressContext'
import { Bilingual } from '../components/Bilingual'
import { LanguageToggle } from '../components/LanguageToggle'
import { Icon } from '../components/Icon'
import { FadeView } from '../components/FadeView'
import { LearnPhase } from '../components/LearnPhase'
import { PracticeSession } from '../components/PracticeSession'
import { useScreenHeader } from '../context/HeaderContext'
import { useLanguage } from '../context/LanguageContext'
import { fonts, radius, shadow, spacing, type Palette } from '../theme'
import { useColors, useStyles } from '../hooks/theme'
import {
  applyLearned,
  introducedUnits,
  learnChunkSize,
  nextLearnSession,
  unlearnedUnits,
} from '@lib/study'

// 'home' = welcome; 'menu' = the unit page; then the session phases.
type Phase = 'home' | 'menu' | 'learn' | 'practice' | 'review'

export function StudyView() {
  const styles = useStyles(makeStyles)
  const index = useContent()
  const { progress, update } = useProgress()
  const { draw } = useLanguage()
  const [phase, setPhase] = useState<Phase>('home')
  const [chunk, setChunk] = useState<Unit[]>([])
  const [reserve, setReserve] = useState<Unit[]>([])
  const [reviewUnits, setReviewUnits] = useState<Unit[]>([])

  function startLearn() {
    const { chunk: next, reserve: rest } = nextLearnSession(index, progress)
    if (next.length === 0) return
    setChunk(next)
    setReserve(rest)
    setPhase('learn')
  }

  function finishLearning(learned: Unit[]) {
    update((p) => applyLearned(p, learned))
    // Reinforce the just-learned units by writing them (low-stakes; skips any without a drawable word).
    const reviewable = learned.filter((k) => k.examples.some((e) => draw?.isDrawable(e.word)) || draw?.isDrawable(k.form))
    if (reviewable.length) {
      setReviewUnits(reviewable)
      setPhase('review')
    } else {
      setPhase('menu')
    }
  }

  // Learn dots continue into the write review: N units to learn + the writeable ones to review.
  const writeSteps = chunk.filter((k) => draw?.isDrawable(k.form)).length
  const stepTotal = chunk.length + writeSteps

  let content
  if (phase === 'learn')
    content = (
      <LearnPhase
        chunk={chunk}
        reserve={reserve}
        onComplete={finishLearning}
        onExit={() => setPhase('menu')}
        totalSteps={stepTotal}
      />
    )
  else if (phase === 'practice') content = <PracticeSession onExit={() => setPhase('menu')} />
  else if (phase === 'review')
    content = draw ? (
      <draw.Review
        units={reviewUnits}
        baseStep={chunk.length}
        totalSteps={stepTotal}
        onDone={() => setPhase('menu')}
      />
    ) : null
  else if (phase === 'menu')
    content = (
      <StudyMenu
        onBack={() => setPhase('home')}
        onLearn={startLearn}
        onPractice={() => setPhase('practice')}
      />
    )
  else content = <StudyHome onOpen={() => setPhase('menu')} />

  return (
    <FadeView key={phase} style={styles.fill}>
      {content}
    </FadeView>
  )
}

/** Welcome screen: greeting + the "Learn" entry card (with progress) + a stubbed grammar card. */
function StudyHome({ onOpen }: { onOpen: () => void }) {
  const colors = useColors()
  const styles = useStyles(makeStyles)
  const index = useContent()
  const { progress } = useProgress()
  const { ui } = useLanguage()

  const introduced = introducedUnits(index, progress).length
  const remainingToLearn = unlearnedUnits(index, progress).length
  const enabledTotal = introduced + remainingToLearn
  const name = progress.settings.name.trim()

  const hasRecord = Object.keys(progress.units).length > 0
  const greeting = ui.greeting(name, hasRecord)

  return (
    <View style={styles.home}>
      {/* Language switch pinned to the very top; the greeting floats in the space below it. */}
      <LanguageToggle />

      <View style={styles.greetingWrap}>
        <Bilingual native={greeting.native} en={greeting.en} large />
      </View>

      <View style={styles.cardsCol}>
        <Pressable style={styles.entryCard} onPress={onOpen}>
          <View style={styles.iconCircle}>
            <Icon name="pen-nib" size={22} color={colors.onAccent} />
          </View>
          <Bilingual native={ui.learnEntry.native} en={ui.learnEntry.en} />
          <Text style={styles.entrySub}>
            {introduced} / {enabledTotal} {ui.noun} learnt
          </Text>
        </Pressable>

        {/* Not wired yet — a placeholder for an upcoming grammar mode. */}
        <View style={[styles.entryCard, styles.entryDisabled]}>
          <View style={[styles.iconCircle, styles.iconMuted]}>
            <Icon name="circle-check" size={22} color={colors.muted} />
          </View>
          <Bilingual native={ui.grammarEntry.native} en={ui.grammarEntry.en} />
          <Text style={styles.entrySub}>coming soon</Text>
        </View>
      </View>
    </View>
  )
}

/** The unit page: Back + the Learn / Practice cards. */
function StudyMenu({
  onBack,
  onLearn,
  onPractice,
}: {
  onBack: () => void
  onLearn: () => void
  onPractice: () => void
}) {
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
    <View style={styles.menuWrap}>
      <Text style={styles.unlockedHeader}>
        {introduced} / {introduced + remainingToLearn} {ui.noun} unlocked
      </Text>
      <View style={styles.choicesCol}>
        <ChoiceCard
          icon="graduation-cap"
          native={ui.learn.native}
          en={ui.learn.en}
          sub={
            !canLearn
              ? 'All introduced'
              : introduced > 0
                ? `learn +${chunkSize} new ${ui.noun}`
                : `learn your first ${chunkSize} ${ui.noun}`
          }
          disabled={!canLearn}
          onPress={onLearn}
        />
        <ChoiceCard
          icon="dumbbell"
          native={ui.practice.native}
          en={ui.practice.en}
          sub={canPractice ? `practice ${ui.noun} you already know` : 'learn some first'}
          disabled={!canPractice}
          onPress={onPractice}
        />
      </View>
    </View>
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
  icon: 'graduation-cap' | 'dumbbell'
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
  menuWrap: { flex: 1, justifyContent: 'center' },
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
  cardsCol: { alignSelf: 'stretch', gap: spacing.md, paddingBottom: spacing.md },
  entryCard: {
    ...shadow,
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  entryDisabled: { opacity: 0.5 },
  entrySub: { color: colors.muted, fontFamily: fonts.body, fontSize: 12, textAlign: 'center' },
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
