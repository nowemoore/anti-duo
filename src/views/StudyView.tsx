import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { Kanji } from '../../shared/types'
import { Bilingual } from '../components/Bilingual'
import { useContent } from '../context/ContentContext'
import { useProgress } from '../context/ProgressContext'
import { LearnPhase } from '../components/LearnPhase'
import { PracticeSession } from '../components/PracticeSession'
import {
  applyLearned,
  introducedKanji,
  learnChunkSize,
  nextLearnSession,
  unlearnedKanji,
} from '../lib/study'

type Phase = 'home' | 'learn' | 'practice'

export default function StudyView() {
  const index = useContent()
  const { progress, update } = useProgress()
  const [phase, setPhase] = useState<Phase>('home')
  const [chunk, setChunk] = useState<Kanji[]>([])
  const [reserve, setReserve] = useState<Kanji[]>([])

  function startLearn() {
    const { chunk: next, reserve: rest } = nextLearnSession(index, progress)
    if (next.length === 0) return
    setChunk(next)
    setReserve(rest)
    setPhase('learn')
  }

  // `learned` is the final set of cards the learner kept (skipped cards are excluded).
  function finishLearning(learned: Kanji[]) {
    update((p) => applyLearned(p, learned))
    setPhase('home')
  }

  if (phase === 'learn')
    return <LearnPhase chunk={chunk} reserve={reserve} onComplete={finishLearning} />
  if (phase === 'practice') return <PracticeSession onExit={() => setPhase('home')} />

  return <StudyHome onLearn={startLearn} onPractice={() => setPhase('practice')} />
}

function StudyHome({ onLearn, onPractice }: { onLearn: () => void; onPractice: () => void }) {
  const index = useContent()
  const { progress, update } = useProgress()

  const introduced = introducedKanji(index, progress).length
  const remainingToLearn = unlearnedKanji(index, progress).length
  const enabledTotal = introduced + remainingToLearn
  const chunkSize = learnChunkSize(index, progress)
  const name = progress.settings.name.trim()

  const canLearn = remainingToLearn > 0
  const canPractice = introduced > 0

  // Greeting: first visit (no name AND no saved progress) → はじめまして; otherwise welcome them back,
  // with their name when we have it.
  const hasRecord = Object.keys(progress.kanji).length > 0
  const greeting = name
    ? { ja: `おかえりなさい、${name}`, en: 'Welcome back' }
    : hasRecord
      ? { ja: 'おかえりなさい', en: 'Welcome back' }
      : { ja: 'はじめまして', en: 'Welcome' }

  function resetProgress() {
    if (!window.confirm('Reset all learning progress? Your introduced kanji and levels will be cleared (your name and dataset selection are kept).')) {
      return
    }
    update((p) => ({ settings: p.settings, kanji: {} }))
  }

  return (
    <section className="panel intro study-home">
      <h2>
        <Bilingual ja={greeting.ja} en={greeting.en} />
      </h2>
      <p className="home-status">
        {introduced} / {enabledTotal} kanji unlocked. Continue learning or{' '}
        <button type="button" className="reset-btn" onClick={resetProgress}>
          <FontAwesomeIcon icon="trash-can" />
          reset progress
        </button>
      </p>

      <div className="study-choices">
        <button type="button" className="study-choice" onClick={onLearn} disabled={!canLearn}>
          <span className="icon-circle">
            <FontAwesomeIcon icon="graduation-cap" />
          </span>
          <Bilingual ja="学ぶ" en="Learn" />
          <span className="study-choice-sub">
            {!canLearn
              ? 'All introduced'
              : introduced > 0
                ? `learn +${chunkSize} new kanji`
                : `learn your first ${chunkSize} kanji`}
          </span>
        </button>

        <button type="button" className="study-choice" onClick={onPractice} disabled={!canPractice}>
          <span className="icon-circle">
            <FontAwesomeIcon icon="dumbbell" />
          </span>
          <Bilingual ja="練習" en="Practice" />
          <span className="study-choice-sub">
            {canPractice ? 'practice kanji you already know' : 'learn some first'}
          </span>
        </button>
      </div>
    </section>
  )
}
