import { useCallback, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { Unit } from '../../shared/types'
import { PRACTICE_ITERATIONS } from '../../shared/constants'
import { Bilingual } from '../components/Bilingual'
import { useContent } from '../context/ContentContext'
import { useProgress } from '../context/ProgressContext'
import { LearnPhase } from '../components/LearnPhase'
import { PracticeSession } from '../components/PracticeSession'
import { GrammarMenu } from '../components/grammar/GrammarMenu'
import { GrammarSection } from '../components/grammar/GrammarSection'
import { KanjiBoard } from '../components/KanjiBoard'
import { WriteReview } from '../components/WriteReview'
import { ProgressTally } from '../components/ProgressTally'
import { KanaMenu } from '../components/kana/KanaMenu'
import { KanaCharacter } from '../components/kana/KanaCharacter'
import { KanaPractice } from '../components/kana/KanaPractice'
import { KanaWordPractice } from '../components/kana/KanaWordPractice'
import {
  ackBatches,
  applyLearned,
  introducedUnits,
  learnChunkSize,
  nextLearnSession,
  unlearnedUnits,
} from '../lib/study'
import { scriptsForLang, studiedCount, totalKanaCount, type KanaScript } from '../lib/kana'
import { hasPassed, topicProgress, topicsForLang, type GrammarTopic } from '../lib/grammar'
import { useHandwriting } from '../lib/useHandwriting'
import { useHandwritingInput } from '../lib/useHandwritingInput'
import { useLearned } from '../lib/useLearned'

type Phase =
  | 'home'
  /** The kanji course's own page: the two actions over the browsable board. */
  | 'units'
  | 'learn'
  | 'practice'
  | 'grammar'
  | 'grammar-topic'
  | 'kana'
  | 'kana-char'
  | 'kana-practice'
  | 'kana-word'

export default function StudyView() {
  const index = useContent()
  const { progress, update } = useProgress()
  const [phase, setPhase] = useState<Phase>('home')
  const [chunk, setChunk] = useState<Unit[]>([])
  const [reserve, setReserve] = useState<Unit[]>([])
  // Where we are in a learn session: which unit, and whether we're on its card or writing it.
  const [qi, setQi] = useState(0)
  const [stage, setStage] = useState<'learn' | 'write'>('learn')
  // Which script's chart is open, and which character within it. Held here rather than in KanaMenu
  // so returning from a character lands back on the chart it was opened from.
  const [kanaScript, setKanaScript] = useState<KanaScript | null>(null)
  const [kanaChar, setKanaChar] = useState<string | null>(null)
  /** Which grammar subsection is open. Held here so backing out lands on the topic list. */
  const [topic, setTopic] = useState<GrammarTopic | null>(null)

  // A language either has a script course or it doesn't — with none, the Learn kana card never
  // renders, the same mechanism that hides Learn grammar on mobile.
  const kanaScripts = scriptsForLang('ja')
  // Same deal for grammar: no topics for a language means no Learn grammar card at all.
  const grammarTopics = topicsForLang('ja')

  /**
   * Whether a unit has anything to write: an auto-gradable word, or failing that one that can be
   * traced over a guide. Units with neither skip the writing step rather than landing on an empty
   * review — and so does everyone until the recognizer has loaded.
   *
   * The whole step is skipped on a device with no touchscreen or stylus. It's the one piece of
   * writing the app puts in front of you unasked, and with only a mouse to hand that's a chore
   * rather than a drill. Writing you go looking for (the kana character page) is still there.
   */
  const canWrite = useHandwritingInput()
  const hw = useHandwriting(canWrite)
  const isLearned = useLearned()
  const writeable = useCallback(
    (k: Unit) => {
      if (!hw || !canWrite) return false
      const has = (test: (w: string) => boolean) =>
        k.examples.some((e) => test(e.word)) || test(k.form)
      // This unit counts as learned even though the credit for it hasn't been written yet — by the
      // time the review renders it has, and the review's own check would otherwise disagree with
      // this one for the very kanji that just got taught.
      const known = (w: string) => [...w].every((c) => c === k.form || isLearned(c))
      return has((w) => hw.drawable(w) && known(w)) || has((w) => hw.traceable(w) && known(w))
    },
    [hw, canWrite, isLearned],
  )

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
   * Finished the card for the current unit. Credits it and marks its newly unlocked example words as
   * seen (which is what clears the board's "ready for more" flag), then goes straight to writing
   * *this* unit rather than banking it for the end — writing a character while it's fresh is the
   * point of the drill.
   */
  function finishCard(learned: Unit[]) {
    const unit = learned[0]
    if (!unit) return advance()
    update((p) => ackBatches(applyLearned(p, [unit]), unit, index.lang.batchUnlockEvery))
    // A "Not now" swapped the card for another; carry the one actually kept forward.
    setChunk((cs) => cs.map((c, n) => (n === qi ? unit : c)))
    if (writeable(unit)) setStage('write')
    else advance()
  }

  /** On to the next unit in the session, or back to the board when it's done. */
  function advance() {
    if (qi + 1 >= chunk.length) {
      setPhase('units')
      return
    }
    setQi(qi + 1)
    setStage('learn')
  }

  const currentUnit = chunk[qi]

  if (phase === 'learn' && currentUnit)
    return stage === 'learn' ? (
      <LearnPhase
        // Remounts per unit, so each card starts clean.
        key={currentUnit.idx}
        chunk={[currentUnit]}
        reserve={reserve}
        onComplete={finishCard}
        headerCount={{ current: qi + 1, total: chunk.length }}
      />
    ) : (
      <WriteReview
        key={currentUnit.idx}
        units={[currentUnit]}
        onDone={advance}
        // Back returns to this unit's card, so the two views are a pair you can move between.
        onPrev={() => setStage('learn')}
        // Only the session's final unit finishes; mid-session, writing hands on to the next kanji.
        lastStep={qi + 1 >= chunk.length}
        headerCount={{ current: qi + 1, total: chunk.length }}
      />
    )
  if (phase === 'practice') return <PracticeSession onExit={() => setPhase('units')} />

  if (phase === 'units')
    return <UnitsPage onLearn={startLearn} onPractice={() => setPhase('practice')} onSelectUnit={startOne} onBack={() => setPhase('home')} />

  if (phase === 'grammar')
    return (
      <GrammarMenu
        topics={grammarTopics}
        onSelect={(t) => {
          setTopic(t)
          setPhase('grammar-topic')
        }}
        onBack={() => setPhase('home')}
      />
    )

  if (phase === 'grammar-topic' && topic)
    return <GrammarSection topic={topic} onBack={() => setPhase('grammar')} />

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
      onUnits={() => setPhase('units')}
      onKana={kanaScripts.length ? () => setPhase('kana') : undefined}
      onGrammar={grammarTopics.length ? () => setPhase('grammar') : undefined}
      kanaScripts={kanaScripts}
      grammarTopics={grammarTopics}
    />
  )
}

function StudyHome({
  onUnits,
  onKana,
  onGrammar,
  kanaScripts,
  grammarTopics,
}: {
  /** Opens the kanji course's own page — Learn and Practice live there, over the board. */
  onUnits: () => void
  /** Absent when the content language has no script course — the card then doesn't render at all. */
  onKana?: () => void
  /** Same for grammar: absent when the language has no subsections. */
  onGrammar?: () => void
  kanaScripts: KanaScript[]
  grammarTopics: GrammarTopic[]
}) {
  const index = useContent()
  const { progress } = useProgress()

  const introduced = introducedUnits(index, progress).length
  const remainingToLearn = unlearnedUnits(index, progress).length
  const enabledTotal = introduced + remainingToLearn
  const name = progress.settings.name.trim()

  const kanaStudied = studiedCount(progress, kanaScripts)
  const kanaTotal = totalKanaCount(kanaScripts)
  // How far through the grammar course they are, for the card's one-liner.
  const grammarDone = grammarTopics.filter((t) => hasPassed(topicProgress(progress, t.id))).length

  // Greeting: first visit (no name AND no saved progress) → はじめまして; otherwise welcome them back,
  // with their name when we have it. Japanese only — it's a greeting, not something to be studied,
  // and the English under it was a translation nobody needed twice.
  const hasRecord = Object.keys(progress.units).length > 0
  const greeting = name
    ? `おかえりなさい、${name}`
    : hasRecord
      ? 'おかえりなさい'
      : 'はじめまして'

  return (
    <section className="panel intro study-home">
      <h2 className="home-greeting">{greeting}</h2>
      <div className="study-choices">
        {/* Kana first: it's where a learner with no Japanese at all should start, and the order the
            cards sit in is the only recommendation the home screen makes. */}
        {onKana && (
          <button type="button" className="study-choice" onClick={onKana}>
            <GlyphMark text="あア" />
            <span className="icon-circle">
              <FontAwesomeIcon icon="book-open" />
            </span>
            <span className="study-choice-text">
              <Bilingual ja="かな" en="Kana" />
              <span className="study-choice-sub">
                {kanaStudied > 0
                  ? `${kanaStudied} / ${kanaTotal} characters studied`
                  : 'hiragana and katakana from scratch'}
              </span>
            </span>
          </button>
        )}

        {/* One door per course. Learn and Practice used to sit here; they belong to the kanji
            course, so they live on its own page now — over the board of every kanji in it. */}
        <button type="button" className="study-choice" onClick={onUnits}>
          <GlyphMark text="漢字" />
          <span className="icon-circle">
            <FontAwesomeIcon icon="graduation-cap" />
          </span>
          <span className="study-choice-text">
            <Bilingual ja="漢字" en="Kanji" />
            <span className="study-choice-sub">
              {introduced} / {enabledTotal} unlocked
            </span>
          </span>
        </button>

        {/* Grammar last: its subsections gate on their own vocabulary rather than on a kanji count,
            so it's open from day one — it's simply the one you get most out of last. */}
        {onGrammar && (
          <button type="button" className="study-choice" onClick={onGrammar}>
            {/* Three brackets pulled into each other so they nest, rather than sitting in a row. */}
            <GlyphMark text="《〈【" className="nested" />
            <span className="icon-circle">
              <FontAwesomeIcon icon="book" />
            </span>
            <span className="study-choice-text">
              <Bilingual ja="文法" en="Grammar" />
              <span className="study-choice-sub">
                {grammarDone > 0
                  ? `${grammarDone} / ${grammarTopics.length} subsections completed`
                  : 'how the words fit together'}
              </span>
            </span>
          </button>
        )}
      </div>
    </section>
  )
}

/**
 * A character watermark: oversized, barely-there, and clipped by the card's right edge.
 *
 * Deliberately cropped — a whole visible glyph reads as content rather than texture. Set in a
 * hand-brushed face and coloured from the palette's ink at a low opacity, never the accent and never
 * a literal colour, so it stays texture under whatever the card is doing.
 */
function GlyphMark({ text, className }: { text: string; className?: string }) {
  return (
    <span className={className ? `glyph-mark ${className}` : 'glyph-mark'} aria-hidden="true">
      {text}
    </span>
  )
}

/**
 * The kanji course's own page: the two "let the app choose" actions over the board of every kanji in
 * the enabled set. The board is the third way in, and its own thing — pick the kanji you like.
 */
function UnitsPage({
  onLearn,
  onPractice,
  onSelectUnit,
  onBack,
}: {
  onLearn: () => void
  onPractice: () => void
  onSelectUnit: (u: Unit) => void
  onBack: () => void
}) {
  const index = useContent()
  const { progress } = useProgress()

  const introduced = introducedUnits(index, progress).length
  const remainingToLearn = unlearnedUnits(index, progress).length
  const total = introduced + remainingToLearn
  const chunkSize = learnChunkSize(index, progress)
  const canLearn = remainingToLearn > 0
  const canPractice = introduced > 0

  return (
    <section className="panel units-page">
      <div className="practice-head">
        <button type="button" className="practice-back" onClick={onBack} aria-label="Back to study home">
          <FontAwesomeIcon icon="chevron-left" />
        </button>
        <h2>
          <Bilingual ja="漢字" en="Kanji" />
        </h2>
      </div>

      <ProgressTally count={introduced} total={total} label="kanji unlocked" />

      <div className="action-rows">
        <button type="button" className="action-row primary" onClick={onPractice} disabled={!canPractice}>
          <span className="icon-circle">
            <FontAwesomeIcon icon="play" />
          </span>
          <span className="action-text">
            <span className="action-title">Practice</span>
            <span className="action-sub">
              {canPractice ? `${PRACTICE_ITERATIONS} questions` : 'learn some kanji first'}
            </span>
          </span>
          <FontAwesomeIcon icon="chevron-right" className="action-chevron" />
        </button>

        <button type="button" className="action-row" onClick={onLearn} disabled={!canLearn}>
          <span className="icon-circle">
            <FontAwesomeIcon icon="graduation-cap" />
          </span>
          <span className="action-text">
            <span className="action-title">{canLearn ? `Learn ${chunkSize} new` : 'Nothing left to learn'}</span>
            <span className="action-sub">
              {canLearn ? `${remainingToLearn} still to meet` : 'all kanji introduced'}
            </span>
          </span>
          <FontAwesomeIcon icon="chevron-right" className="action-chevron" />
        </button>
      </div>

      <p className="board-note">or pick a kanji below to study it</p>
      {/* Neither board gesture is discoverable from the tiles themselves, so both are spelled out. */}
      <p className="board-hint">click a kanji to learn it · hold (or right-click) to disable it for practice</p>
      <KanjiBoard onSelect={onSelectUnit} />
    </section>
  )
}
