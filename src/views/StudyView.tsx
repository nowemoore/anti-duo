import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { Unit } from '../../shared/types'
import { Bilingual } from '../components/Bilingual'
import { useContent } from '../context/ContentContext'
import { useProgress } from '../context/ProgressContext'
import { LearnPhase } from '../components/LearnPhase'
import { PracticeSession } from '../components/PracticeSession'
import { KanaMenu } from '../components/kana/KanaMenu'
import { KanaCharacter } from '../components/kana/KanaCharacter'
import { KanaPractice } from '../components/kana/KanaPractice'
import { KanaWordPractice } from '../components/kana/KanaWordPractice'
import {
  applyLearned,
  introducedUnits,
  learnChunkSize,
  nextLearnSession,
  unlearnedUnits,
} from '../lib/study'
import { scriptsForLang, studiedCount, totalKanaCount, type KanaScript } from '../lib/kana'

type Phase = 'home' | 'learn' | 'practice' | 'kana' | 'kana-char' | 'kana-practice' | 'kana-word'

export default function StudyView() {
  const index = useContent()
  const { progress, update } = useProgress()
  const [phase, setPhase] = useState<Phase>('home')
  const [chunk, setChunk] = useState<Unit[]>([])
  const [reserve, setReserve] = useState<Unit[]>([])
  // Which script's chart is open, and which character within it. Held here rather than in KanaMenu
  // so returning from a character lands back on the chart it was opened from.
  const [kanaScript, setKanaScript] = useState<KanaScript | null>(null)
  const [kanaChar, setKanaChar] = useState<string | null>(null)

  // A language either has a script course or it doesn't — with none, the Learn kana card never
  // renders, the same mechanism that hides Learn grammar on mobile.
  const kanaScripts = scriptsForLang('ja')

  function startLearn() {
    const { chunk: next, reserve: rest } = nextLearnSession(index, progress)
    if (next.length === 0) return
    setChunk(next)
    setReserve(rest)
    setPhase('learn')
  }

  // `learned` is the final set of cards the learner kept (skipped cards are excluded).
  function finishLearning(learned: Unit[]) {
    update((p) => applyLearned(p, learned))
    setPhase('home')
  }

  if (phase === 'learn')
    return <LearnPhase chunk={chunk} reserve={reserve} onComplete={finishLearning} />
  if (phase === 'practice') return <PracticeSession onExit={() => setPhase('home')} />

  if (phase === 'kana')
    return (
      <KanaMenu
        scripts={kanaScripts}
        onSelect={(script, char) => {
          setKanaScript(script)
          setKanaChar(char)
          setPhase('kana-char')
        }}
        onPractice={() => setPhase('kana-practice')}
        onWordPractice={() => setPhase('kana-word')}
        onBack={() => setPhase('home')}
      />
    )

  if (phase === 'kana-char' && kanaScript && kanaChar)
    return (
      <KanaCharacter
        char={kanaChar}
        script={kanaScript}
        onChange={setKanaChar}
        onBack={() => setPhase('kana')}
      />
    )

  if (phase === 'kana-practice') return <KanaPractice onBack={() => setPhase('kana')} />
  if (phase === 'kana-word') return <KanaWordPractice onBack={() => setPhase('kana')} />

  return (
    <StudyHome
      onLearn={startLearn}
      onPractice={() => setPhase('practice')}
      onKana={kanaScripts.length ? () => setPhase('kana') : undefined}
      kanaScripts={kanaScripts}
    />
  )
}

function StudyHome({
  onLearn,
  onPractice,
  onKana,
  kanaScripts,
}: {
  onLearn: () => void
  onPractice: () => void
  /** Absent when the content language has no script course — the card then doesn't render at all. */
  onKana?: () => void
  kanaScripts: KanaScript[]
}) {
  const index = useContent()
  const { progress, update } = useProgress()

  const introduced = introducedUnits(index, progress).length
  const remainingToLearn = unlearnedUnits(index, progress).length
  const enabledTotal = introduced + remainingToLearn
  const chunkSize = learnChunkSize(index, progress)
  const name = progress.settings.name.trim()

  const canLearn = remainingToLearn > 0
  const canPractice = introduced > 0
  const kanaStudied = studiedCount(progress, kanaScripts)
  const kanaTotal = totalKanaCount(kanaScripts)

  // Greeting: first visit (no name AND no saved progress) → はじめまして; otherwise welcome them back,
  // with their name when we have it.
  const hasRecord = Object.keys(progress.units).length > 0
  const greeting = name
    ? { ja: `おかえりなさい、${name}`, en: 'Welcome back' }
    : hasRecord
      ? { ja: 'おかえりなさい', en: 'Welcome back' }
      : { ja: 'はじめまして', en: 'Welcome' }

  function resetProgress() {
    if (!window.confirm('Reset all learning progress? Your introduced kanji and levels will be cleared (your name and dataset selection are kept).')) {
      return
    }
    update((p) => ({ settings: p.settings, units: {} }))
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

        {/* A parallel course rather than a step inside the kanji one, so it's never gated on kanji
            progress — a learner can start here on day one, which is usually the right order. */}
        {onKana && (
          <button type="button" className="study-choice" onClick={onKana}>
            <span className="icon-circle">
              <FontAwesomeIcon icon="book-open" />
            </span>
            <Bilingual ja="かな" en="Kana" />
            <span className="study-choice-sub">
              {kanaStudied > 0
                ? `${kanaStudied} / ${kanaTotal} characters studied`
                : 'hiragana and katakana from scratch'}
            </span>
          </button>
        )}
      </div>
    </section>
  )
}
