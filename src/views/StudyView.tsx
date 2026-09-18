import { useCallback, useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { IconProp } from '@fortawesome/fontawesome-svg-core'
import type { KanaWord, Progress, Unit } from '../../shared/types'
import { PRACTICE_ITERATIONS } from '../../shared/constants'
import { HelpButton } from '../components/HelpButton'
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
import { ScrollCue } from '../components/ScrollCue'
import { KanaMenu } from '../components/kana/KanaMenu'
import { KanaPractice } from '../components/kana/KanaPractice'
import { KanaWordPractice } from '../components/kana/KanaWordPractice'
import { KanaWordBoard } from '../components/kana/KanaWordBoard'
import { KanaWordCard } from '../components/kana/KanaWordCard'
import { batchesUnlocked } from '../lib/tasks'
import type { ContentIndex } from '../lib/content'
import {
  ackBatches,
  applyLearnItem,
  enabledWords,
  enabledUnits,
  introducedUnits,
  introducedWords,
  learnItemKey,
  mixedChunkSize,
  nextMixedLearnSession,
  readyForMore,
  seenBatches,
  type LearnItem,
} from '../lib/study'
import { metWordCount, scriptsForLang, studiedCount, totalKanaCount, type KanaScript } from '../lib/kana'
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
  | 'kana-practice'
  | 'kana-word'
  /** One kana word, opened from the vocabulary board. */
  | 'vocab-word'

export default function StudyView() {
  const index = useContent()
  const { progress, update } = useProgress()
  const [phase, setPhase] = useState<Phase>('home')
  const [chunk, setChunk] = useState<LearnItem[]>([])
  const [reserve, setReserve] = useState<LearnItem[]>([])
  // Where we are in a learn session: which card, and (for a kanji) whether we're on it or writing
  // it. A kana word has no writing step — it needs no tracing, it is already the word.
  const [qi, setQi] = useState(0)
  const [stage, setStage] = useState<'learn' | 'write'>('learn')
  /** Which half of the vocabulary section is showing, and which kana word is open in it. */
  const [vocabTab, setVocabTab] = useState<'kanji' | 'kana'>('kanji')
  const [vocabWord, setVocabWord] = useState<KanaWord | null>(null)
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
    const { chunk: next, reserve: rest } = nextMixedLearnSession(index, progress)
    if (next.length === 0) return
    beginSession(next, rest)
  }

  /** Study one specific kanji, chosen from the board. No reserve — there's nothing to swap for. */
  function startOne(unit: Unit) {
    beginSession([{ kind: 'unit', unit }], [])
  }

  function beginSession(units: LearnItem[], pool: LearnItem[]) {
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
  function finishCard(learned: LearnItem[]) {
    const item = learned[0]
    if (!item) return advance()
    update((p) => {
      const next = applyLearnItem(p, item, new Date().toISOString())
      // Only a kanji has example batches to acknowledge.
      return item.kind === 'unit' ? ackBatches(next, item.unit, index.lang.batchUnlockEvery) : next
    })
    // A "Not now" swapped the card for another; carry the one actually kept forward.
    setChunk((cs) => cs.map((c, n) => (n === qi ? item : c)))
    // Writing is a kanji step. A kana word is finished the moment its card is.
    if (item.kind === 'unit' && writeable(item.unit)) setStage('write')
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

  const current = chunk[qi]

  if (phase === 'learn' && current)
    return stage === 'learn' || current.kind === 'kana' ? (
      <LearnPhase
        // Remounts per card, so each starts clean.
        key={learnItemKey(current)}
        chunk={[current]}
        reserve={reserve}
        onComplete={finishCard}
        headerCount={{ current: qi + 1, total: chunk.length }}
      />
    ) : (
      <WriteReview
        key={learnItemKey(current)}
        units={[current.unit]}
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
    return (
      <VocabPage
        tab={vocabTab}
        onTab={setVocabTab}
        onLearn={startLearn}
        onPractice={() => setPhase('practice')}
        onSelectUnit={startOne}
        // A word opens as its own card rather than starting a Learn session: the board is where you
        // browse, and browsing shouldn't quietly credit you with everything you looked at.
        onSelectWord={(w) => {
          setVocabWord(w)
          setPhase('vocab-word')
        }}
        onBack={() => setPhase('home')}
      />
    )

  if (phase === 'vocab-word' && vocabWord)
    return (
      <section className="panel learn">
        <div className="learn-head">
          <button
            type="button"
            className="practice-back"
            onClick={() => setPhase('units')}
            aria-label="Back to the vocabulary board"
          >
            <FontAwesomeIcon icon="chevron-left" />
          </button>
        </div>
        <KanaWordCard word={vocabWord} />
      </section>
    )

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
        onPractice={() => setPhase('kana-practice')}
        onWordPractice={() => setPhase('kana-word')}
        onBack={() => setPhase('home')}
      />
    )

  if (phase === 'kana-practice') return <KanaPractice onBack={() => setPhase('kana')} />
  if (phase === 'kana-word') return <KanaWordPractice onBack={() => setPhase('kana')} />

  return (
    <StudyHome
      onOpenVocab={(t) => {
        setVocabTab(t)
        setPhase('units')
      }}
      onPractice={() => setPhase('practice')}
      onKana={kanaScripts.length ? () => setPhase('kana') : undefined}
      onKanaPractice={() => setPhase('kana-practice')}
      onGrammar={grammarTopics.length ? () => setPhase('grammar') : undefined}
      kanaScripts={kanaScripts}
      grammarTopics={grammarTopics}
    />
  )
}

/**
 * How many example words this unit has unlocked but not yet shown.
 *
 * The same boundary `readyForMore` tests, counted rather than asked as a yes/no: the batches between
 * what the level has released and what the card last displayed.
 */
function newExampleCount(index: ContentIndex, progress: Progress, unit: Unit): number {
  const lvl = progress.units[unit.idx]?.lvl ?? 0
  const unlocked = batchesUnlocked(lvl, index.lang.batchUnlockEvery)
  const shown = seenBatches(progress, unit.idx)
  return unit.examples.filter((e) => {
    const batch = e.batch ?? 1
    return batch > shown && batch <= unlocked
  }).length
}

/** Whole days since the epoch — the key that makes "of the day" hold still for a day. */
function dayNumber(now: Date): number {
  return Math.floor(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86_400_000,
  )
}

/**
 * The kanji this page opens on.
 *
 * Units with words waiting come first: those are the ones that have something new to say today, and
 * this is where the old "Ready for more?" strip's job now lands — as one character you can act on
 * rather than a count of characters you'd have to go find. Failing that it is simply one of the
 * kanji you know, so the slot is never empty for someone who is up to date.
 *
 * Chosen by the date rather than at random, so it is the same character all day: a "kanji of the
 * day" that changed every time you navigated home would be a kanji of the moment.
 */
function kanjiOfTheDay(
  index: ContentIndex,
  progress: Progress,
  today: number,
): { unit: Unit; fresh: number } | null {
  const known = introducedUnits(index, progress)
  const waiting = known.filter((u) => readyForMore(progress, u, index.lang.batchUnlockEvery))
  const pool = waiting.length ? waiting : known
  if (pool.length === 0) return null
  const unit = pool[today % pool.length]
  return { unit, fresh: newExampleCount(index, progress, unit) }
}

function StudyHome({
  onOpenVocab,
  onPractice,
  onKana,
  onKanaPractice,
  onGrammar,
  kanaScripts,
  grammarTopics,
}: {
  /** Opens the vocabulary section on one of its two halves. */
  onOpenVocab: (tab: 'kanji' | 'kana') => void
  onPractice: () => void
  /** Absent when the content language has no script course — the card then doesn't render at all. */
  onKana?: () => void
  onKanaPractice: () => void
  /** Same for grammar: absent when the language has no subsections. */
  onGrammar?: () => void
  kanaScripts: KanaScript[]
  grammarTopics: GrammarTopic[]
}) {
  const index = useContent()
  const { progress } = useProgress()
  const name = progress.settings.name.trim()

  const kanaWords = index.content.kanaWords ?? []
  /*
   * The card counts *words*, not kanji — the section is called Vocabulary, and the number under it
   * should be the thing it is about. Same definition the section's own tally uses: a kanji word once
   * its kanji is introduced, a kana word once it has been opened.
   */
  const wordsUnlocked = introducedWords(index, progress).size + metWordCount(progress, kanaWords)
  const wordsTotal = enabledWords(index, progress).size + kanaWords.length

  const kanaStudied = studiedCount(progress, kanaScripts)
  const kanaTotal = totalKanaCount(kanaScripts)
  // How far through the grammar course they are, for the card's one-liner.
  const grammarDone = grammarTopics.filter((t) => hasPassed(topicProgress(progress, t.id))).length

  const chunkSize = mixedChunkSize(index, progress)
  const canLearn = chunkSize > 0
  const toGo = wordsTotal - wordsUnlocked

  // Held for the life of the mount rather than read per render, so a component that re-renders at
  // midnight doesn't swap the character out from under a click.
  const [today] = useState(() => dayNumber(new Date()))
  const daily = kanjiOfTheDay(index, progress, today)
  const dailyReadings = daily ? (index.readingsOf.get(daily.unit.form) ?? []) : []

  /*
   * The two things you actually came here to do, on their initials. Ignored while a field has focus
   * — the account form and the name box are both a keystroke away — and while a modifier is held,
   * which belongs to the browser.
   */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const el = document.activeElement
      if (el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return
      const k = e.key.toLowerCase()
      if (k === 'p') onPractice()
      else if (k === 'l' && canLearn) onOpenVocab('kanji')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onPractice, onOpenVocab, canLearn])

  // Greeting: first visit (no name AND no saved progress) → はじめまして; otherwise welcome them back,
  // with their name when we have it.
  const hasRecord = Object.keys(progress.units).length > 0
  const greeting = name ? `おかえり、${name}` : hasRecord ? 'おかえりなさい' : 'はじめまして'
  const greetingEn = name ? `Welcome back, ${name}` : hasRecord ? 'Welcome back' : 'Welcome'

  return (
    <section className="study-home">
      <header className="home-greeting">
        <h2 className="home-greeting-ja">{greeting}</h2>
        <p className="home-greeting-en">{greetingEn}</p>
      </header>

      <div className="section-head">
        <span>What&apos;s on today?</span>
        <span className="section-head-ja">今日は何をしますか</span>
      </div>

      {/*
        Two columns, not three equal cards. Vocabulary is where nearly every session goes, so it gets
        the width and the day's character; kana and grammar are the two other doors, stacked beside
        it at the size of doors.
      */}
      <div className="course-row">
        <section className="course-card course-main">
          <GlyphMark text="言葉" />
          <CardHead
            icon="pen-nib"
            ja="言葉"
            en="Vocabulary"
            count={wordsUnlocked}
            total={wordsTotal}
            noun="words unlocked"
            onOpen={() => onOpenVocab('kanji')}
          />
          <ProgressBar value={wordsUnlocked} total={wordsTotal} />

          {daily && (
            <div className="daily">
              <p className="daily-head">
                <span className="daily-head-ja">今日の漢字</span>
                <span className="daily-head-en">· Kanji of the day</span>
              </p>
              <div className="daily-body">
                <span className="daily-char">{daily.unit.form}</span>
                <div className="daily-text">
                  {/* Ink, not accent: the reading is the answer to the character above it, and an
                      accented reading reads as a thing to click. */}
                  {/* The character's own readings, where the registry has them for it as a word.
                      Silent when it doesn't — an invented reading is worse than a missing line. */}
                  {dailyReadings.length > 0 && (
                    <p className="daily-reading">{dailyReadings.join(' ・ ')}</p>
                  )}
                  <p className="daily-sub">
                    {daily.unit.gloss.join('; ')}
                    {daily.fresh > 0 &&
                      ` · ${daily.fresh} new example ${daily.fresh === 1 ? 'word' : 'words'}`}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* The pair the whole page is for: carry on, or meet more. */}
          <div className="course-actions">
            <BigAction
              primary
              icon="play"
              title="Continue practising"
              sub={`${PRACTICE_ITERATIONS} mixed questions`}
              keycap="P"
              onClick={onPractice}
            />
            <BigAction
              icon="plus"
              title={canLearn ? `Learn ${chunkSize} random words` : 'Nothing left to learn'}
              sub={canLearn ? `${toGo} more to go` : 'all words introduced'}
              keycap="L"
              disabled={!canLearn}
              onClick={() => onOpenVocab('kanji')}
            />
          </div>
        </section>

        <div className="course-side">
          {/* Only for a language that ships a script course. */}
          {onKana && (
            <section className="course-card">
              <GlyphMark text="あア" />
              <CardHead
                icon="language"
                ja="かな"
                en="Kana"
                count={kanaStudied}
                total={kanaTotal}
                noun="characters unlocked"
                onOpen={onKana}
              />
              <ProgressBar value={kanaStudied} total={kanaTotal} />
              <div className="card-actions">
                <SubAction label="Scripts" onClick={onKana} />
                <SubAction label="Practice" onClick={onKanaPractice} />
              </div>
            </section>
          )}

          {/* The mark's three brackets are pulled into each other so they nest rather than sitting
              in a row. */}
          {onGrammar && (
            <section className="course-card">
              <GlyphMark text="《〈【" className="nested" />
              <CardHead
                icon="book"
                ja="文法"
                en="Grammar"
                count={grammarDone}
                total={grammarTopics.length}
                noun="subsections unlocked"
                onOpen={onGrammar}
              />
              <ProgressBar value={grammarDone} total={grammarTopics.length} />
              <div className="card-actions">
                <SubAction label="Continue" onClick={onGrammar} />
              </div>
            </section>
          )}
        </div>
      </div>
    </section>
  )
}

/**
 * A card's heading: the lavender badge, the course's name in both scripts, and where you are in it.
 *
 * The whole row is the way into the section, so it is the button — the shortcuts below it are
 * separate controls, which is why the card itself can't be one.
 */
function CardHead({
  icon,
  ja,
  en,
  count,
  total,
  noun,
  onOpen,
}: {
  icon: IconProp
  ja: string
  en: string
  count: number
  total: number
  noun: string
  onOpen: () => void
}) {
  return (
    <button type="button" className="card-head" onClick={onOpen}>
      <span className="icon-circle">
        <FontAwesomeIcon icon={icon} />
      </span>
      <span className="card-head-text">
        <span className="card-title">
          <span className="card-title-ja">{ja}</span>
          <span className="card-title-en">{en}</span>
        </span>
        {/* The count is the fact; the denominator and the noun are the frame around it. */}
        <span className="card-tally">
          <strong>{count}</strong> / {total} {noun}
        </span>
      </span>
    </button>
  )
}

/** How far along, as a bar. Lavender on a sunken track — it reports, it isn't a control. */
function ProgressBar({ value, total }: { value: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0
  return (
    <div
      className="progress-track"
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={total}
    >
      <div className="progress-fill" style={{ width: `${pct}%` }} />
    </div>
  )
}

/**
 * One of the two big actions at the foot of the Vocabulary card.
 *
 * The icon leads the whole button, centred against both lines rather than sitting inside the first
 * one — the title and its detail are one label, and a glyph tucked into the top line belongs to the
 * words next to it instead of to the button. The keycap at the far end names the shortcut.
 */
function BigAction({
  icon,
  title,
  sub,
  keycap,
  primary,
  disabled,
  onClick,
}: {
  icon: IconProp
  title: string
  sub: string
  keycap: string
  primary?: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={primary ? 'big-action primary' : 'big-action'}
      onClick={onClick}
      disabled={disabled}
    >
      <FontAwesomeIcon icon={icon} className="big-action-icon" />
      <span className="big-action-text">
        <span className="big-action-title">{title}</span>
        <span className="big-action-sub">{sub}</span>
      </span>
      <kbd className="keycap">{keycap}</kbd>
    </button>
  )
}

/** A quiet shortcut inside a card — outline only, since the card is already a surface. */
function SubAction({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="sub-action" onClick={onClick}>
      {label}
    </button>
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
 * The vocabulary section: both halves of what there is to know, behind one switch.
 *
 * The header belongs to neither half — practice draws on everything you know, and the counter is the
 * vocabulary as a whole — so the tally and the two "let the app choose" actions sit above the switch,
 * and only the board below it changes. Kanji is a curriculum with an order; kana words are gated on
 * being able to read them rather than on that order, which is why they get a tab rather than a place
 * in the same list.
 */
function VocabPage({
  tab,
  onTab,
  onLearn,
  onPractice,
  onSelectUnit,
  onSelectWord,
  onBack,
}: {
  tab: 'kanji' | 'kana'
  onTab: (next: 'kanji' | 'kana') => void
  onLearn: () => void
  onPractice: () => void
  onSelectUnit: (u: Unit) => void
  onSelectWord: (w: KanaWord) => void
  onBack: () => void
}) {
  const index = useContent()
  const { progress } = useProgress()

  const introduced = introducedUnits(index, progress).length
  // What Learn will actually teach: kanji *and* readable kana words not yet met, so the button stays
  // live while either half has something left in it.
  const chunkSize = mixedChunkSize(index, progress)
  const canLearn = chunkSize > 0
  const canPractice = introduced > 0

  const kanaWords = index.content.kanaWords ?? []
  const onKanji = tab === 'kanji' || kanaWords.length === 0
  /*
   * Both halves of the vocabulary. A kanji word counts once its kanji has been introduced; a kana
   * word counts once it has been opened, which is the equivalent act for a word with no unit behind
   * it (see markWordMet). Readability deliberately doesn't enter into it — every word in the board
   * below is open, so a fluent reader would otherwise start the section at 293 met.
   */
  const wordsMet = introducedWords(index, progress).size + metWordCount(progress, kanaWords)
  const wordsTotal = enabledWords(index, progress).size + kanaWords.length

  // Each board's own count, in the board's own unit: the kanji grid is a grid of kanji, so it is
  // counted in kanji; the kana board is a list of words, so it is counted in words. Both are the
  // halves that add up to the section tally above, split so each grid says how far along *it* is.
  const kanjiTotal = enabledUnits(index, progress).length
  const kanaMet = metWordCount(progress, kanaWords)

  return (
    <section className="panel units-page">
      <div className="practice-head">
        <button type="button" className="practice-back" onClick={onBack} aria-label="Back to study home">
          <FontAwesomeIcon icon="chevron-left" />
        </button>
        <h2>
          <Bilingual ja="ことば" en="Vocabulary" />
        </h2>
        {/* The hiragana chart lives here and nowhere else: this is the one place you are reading
            words you may not have the kana for yet. */}
        <HelpButton />
      </div>

      <ProgressTally count={wordsMet} total={wordsTotal} label="words unlocked" />
      <p className="tally-note">you can unlock more words by studying more cards</p>

      {/* Side by side: two ways to let the app choose, offered as a pair rather than a list. Learn
          leads, because meeting a word comes before drilling it. */}
      <div className="action-rows action-pair">
        <button type="button" className="action-row" onClick={onLearn} disabled={!canLearn}>
          <span className="icon-circle">
            <FontAwesomeIcon icon="plus" />
          </span>
          <span className="action-text">
            <span className="action-title">{canLearn ? `Learn ${chunkSize} random` : 'Nothing left'}</span>
            {/* Counted across the whole section, kana words included: the tally above says "words
                unlocked", so this has to be the rest of that same total, not the kanji half of it. */}
            <span className="action-sub">
              {canLearn ? `${wordsTotal - wordsMet} more to go` : 'all words introduced'}
            </span>
          </span>
        </button>

        <button type="button" className="action-row primary" onClick={onPractice} disabled={!canPractice}>
          <span className="icon-circle">
            <FontAwesomeIcon icon="play" />
          </span>
          <span className="action-text">
            <span className="action-title">Practice</span>
            <span className="action-sub">
              {canPractice ? `${PRACTICE_ITERATIONS} questions` : 'learn some words first'}
            </span>
          </span>
        </button>
      </div>

      <p className="board-note">or scroll to pick what to study</p>

      <ScrollCue />

      {/* Only worth a switch when there is a second half to switch to. Labelled in the scripts
          themselves — the section is about reading them, and by the time you are here both are. */}
      {kanaWords.length > 0 && (
        <div className="segmented" role="tablist" aria-label="Which vocabulary">
          <button
            type="button"
            role="tab"
            aria-selected={onKanji}
            className={onKanji ? 'segment on' : 'segment'}
            onClick={() => onTab('kanji')}
          >
            漢字
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={!onKanji}
            className={!onKanji ? 'segment on' : 'segment'}
            onClick={() => onTab('kana')}
          >
            かな
          </button>
        </div>
      )}

      {onKanji ? (
        <>
          {/* Neither board gesture is discoverable from the tiles, so both are spelled out. */}
          <ProgressTally count={introduced} total={kanjiTotal} label="kanji introduced" />
          <p className="board-hint">click a kanji to learn it · hold (or right-click) to disable it for practice</p>
          <KanjiBoard onSelect={onSelectUnit} />
        </>
      ) : (
        <>
          <ProgressTally count={kanaMet} total={kanaWords.length} label="kana words met" />
          <p className="board-hint">click a word to look at it · hold the eye for a phrase's meaning</p>
          <KanaWordBoard onSelect={onSelectWord} />
        </>
      )}
    </section>
  )
}
