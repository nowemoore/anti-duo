import { useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import type { Kanji } from '@shared/types'
import { useContent } from '../context/ContentContext'
import { useProgress } from '../context/ProgressContext'
import { Bilingual } from '../components/Bilingual'
import { Icon } from '../components/Icon'
import { FadeView } from '../components/FadeView'
import { LearnPhase } from '../components/LearnPhase'
import { PracticeSession } from '../components/PracticeSession'
import { DrawReview } from '../components/DrawReview'
import { useScreenHeader } from '../context/HeaderContext'
import { drawable } from '../lib/handwriting'
import { colors, fonts, radius, shadow, spacing } from '../theme'
import {
  applyLearned,
  introducedKanji,
  learnChunkSize,
  nextLearnSession,
  unlearnedKanji,
} from '@lib/study'

// 'home' = welcome; 'menu' = the kanji page; then the session phases.
type Phase = 'home' | 'menu' | 'learn' | 'practice' | 'review'

export function StudyView() {
  const index = useContent()
  const { progress, update } = useProgress()
  const [phase, setPhase] = useState<Phase>('home')
  const [chunk, setChunk] = useState<Kanji[]>([])
  const [reserve, setReserve] = useState<Kanji[]>([])
  const [reviewKanji, setReviewKanji] = useState<Kanji[]>([])

  function startLearn() {
    const { chunk: next, reserve: rest } = nextLearnSession(index, progress)
    if (next.length === 0) return
    setChunk(next)
    setReserve(rest)
    setPhase('learn')
  }

  function finishLearning(learned: Kanji[]) {
    update((p) => applyLearned(p, learned))
    // Reinforce the just-learned kanji by writing them (low-stakes; skips any without a drawable word).
    const reviewable = learned.filter((k) => k.examples.some((e) => drawable(e.word)) || drawable(k.char))
    if (reviewable.length) {
      setReviewKanji(reviewable)
      setPhase('review')
    } else {
      setPhase('menu')
    }
  }

  // Learn dots continue into the write review: N kanji to learn + the writeable ones to review.
  const writeSteps = chunk.filter((k) => drawable(k.char)).length
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
    content = (
      <DrawReview
        kanji={reviewKanji}
        baseStep={chunk.length}
        totalSteps={stepTotal}
        onDone={() => setPhase('menu')}
      />
    )
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

/** Welcome screen: greeting + the "Learn kanji" entry card (with progress) + a stubbed grammar card. */
function StudyHome({ onOpen }: { onOpen: () => void }) {
  const index = useContent()
  const { progress } = useProgress()

  const introduced = introducedKanji(index, progress).length
  const remainingToLearn = unlearnedKanji(index, progress).length
  const enabledTotal = introduced + remainingToLearn
  const name = progress.settings.name.trim()

  const hasRecord = Object.keys(progress.kanji).length > 0
  const greeting = name
    ? { ja: `おかえりなさい、${name}`, en: 'Welcome back' }
    : hasRecord
      ? { ja: 'おかえりなさい', en: 'Welcome back' }
      : { ja: 'はじめまして', en: 'Welcome' }

  return (
    <View style={styles.home}>
      <Bilingual ja={greeting.ja} en={greeting.en} large />

      <View style={styles.cardsCol}>
        <Pressable style={styles.entryCard} onPress={onOpen}>
          <View style={styles.iconCircle}>
            <Icon name="pen-nib" size={22} color={colors.onAccent} />
          </View>
          <Bilingual ja="漢字を学ぶ" en="Learn kanji" />
          <Text style={styles.entrySub}>
            {introduced} / {enabledTotal} kanji learnt
          </Text>
        </Pressable>

        {/* Not wired yet — a placeholder for an upcoming grammar mode. */}
        <View style={[styles.entryCard, styles.entryDisabled]}>
          <View style={[styles.iconCircle, styles.iconMuted]}>
            <Icon name="circle-check" size={22} color={colors.muted} />
          </View>
          <Bilingual ja="文法を学ぶ" en="Learn grammar" />
          <Text style={styles.entrySub}>coming soon</Text>
        </View>
      </View>
    </View>
  )
}

/** The kanji page: Back + the Learn / Practice cards. */
function StudyMenu({
  onBack,
  onLearn,
  onPractice,
}: {
  onBack: () => void
  onLearn: () => void
  onPractice: () => void
}) {
  const index = useContent()
  const { progress } = useProgress()
  const introduced = introducedKanji(index, progress).length
  const remainingToLearn = unlearnedKanji(index, progress).length
  const chunkSize = learnChunkSize(index, progress)
  const canLearn = remainingToLearn > 0
  const canPractice = introduced > 0

  useScreenHeader(onBack) // back button in the app top bar; no step label here

  return (
    <View style={styles.menuWrap}>
      <Text style={styles.unlockedHeader}>
        {introduced} / {introduced + remainingToLearn} kanji unlocked
      </Text>
      <View style={styles.choicesCol}>
        <ChoiceCard
          icon="graduation-cap"
          ja="学ぶ"
          en="Learn"
          sub={
            !canLearn
              ? 'All introduced'
              : introduced > 0
                ? `learn +${chunkSize} new kanji`
                : `learn your first ${chunkSize} kanji`
          }
          disabled={!canLearn}
          onPress={onLearn}
        />
        <ChoiceCard
          icon="dumbbell"
          ja="練習"
          en="Practice"
          sub={canPractice ? 'practice kanji you already know' : 'learn some first'}
          disabled={!canPractice}
          onPress={onPractice}
        />
      </View>
    </View>
  )
}

function ChoiceCard({
  icon,
  ja,
  en,
  sub,
  disabled,
  onPress,
}: {
  icon: 'graduation-cap' | 'dumbbell'
  ja: string
  en: string
  sub: string
  disabled?: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      style={[styles.choice, disabled && styles.choiceDisabled]}
      onPress={onPress}
      disabled={disabled}
    >
      <View style={styles.iconCircle}>
        <Icon name={icon} size={22} color={colors.onAccent} />
      </View>
      <Bilingual ja={ja} en={en} />
      <Text style={styles.choiceSub}>{sub}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
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
  home: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.lg, width: '100%' },
  cardsCol: { alignSelf: 'stretch', gap: spacing.md },
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
