import { useCallback, useState, type ReactNode } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { IconProp } from '@fortawesome/fontawesome-svg-core'
import type { KanaWord, Unit } from '../../shared/types'
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
import { ScrollCue } from '../components/ScrollCue'
import { KanaMenu } from '../components/kana/KanaMenu'
import { KanaCharacter } from '../components/kana/KanaCharacter'
import { KanaPractice } from '../components/kana/KanaPractice'
import { KanaWordPractice } from '../components/kana/KanaWordPractice'
import { KanaWordBoard } from '../components/kana/KanaWordBoard'
import { KanaWordCard } from '../components/kana/KanaWordCard'
import {
  ackBatches,
  applyLearnItem,
  enabledWords,
  introducedUnits,
  introducedWords,
  learnItemKey,
  mixedChunkSize,
  nextMixedLearnSession,
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
  | 'kana-char'
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
  // Which script's chart is open, and which character within it. Held here rather than in KanaMenu
  // so returning from a character lands back on the chart it was opened from.
  const [kanaScript, setKanaScript] = useState<KanaScript | null>(null)
  const [kanaChar, setKanaChar] = useState<string | null>(null)
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

      <div className="section-head">
        <span>What&apos;s on today?</span>
        <span className="section-head-ja">今日は</span>
      </div>

      <div className="study-choices">
        {/* Kana first: it's where a learner with no Japanese at all should start, and the order the
            cards sit in is the only recommendation the home screen makes. */}
        {onKana && (
          <SectionCard
            icon="language"
            mark={<GlyphMark text="あア" />}
            title={<Bilingual ja="かな" en="Kana" />}
            stat={
              kanaStudied > 0
                ? `${kanaStudied} / ${kanaTotal} characters studied`
                : 'hiragana and katakana from scratch'
            }
            onOpen={onKana}
          >
            <SubAction icon="table-cells" label="Scripts" onClick={onKana} />
            <SubAction icon="ear-listen" label="Practice" onClick={onKanaPractice} />
          </SectionCard>
        )}

        <SectionCard
          icon="pen-nib"
          mark={<GlyphMark text="言葉" />}
          title={<Bilingual ja="ことば" en="Vocabulary" />}
          stat={`${wordsUnlocked} / ${wordsTotal} words unlocked`}
          onOpen={() => onOpenVocab('kanji')}
        >
          {/* Both halves of the vocabulary, each opening the section on its own tab. */}
          <SubAction icon="pen-nib" label="Kanji" onClick={() => onOpenVocab('kanji')} />
          {kanaWords.length > 0 && (
            <SubAction icon="comment" label="Kana words" onClick={() => onOpenVocab('kana')} />
          )}
        </SectionCard>

        {/* Grammar last: its subsections gate on their own vocabulary rather than on a kanji count,
            so it's open from day one — it's simply the one you get most out of last. The mark's
            three brackets are pulled into each other so they nest rather than sitting in a row. */}
        {onGrammar && (
          <SectionCard
            icon="book"
            mark={<GlyphMark text="《〈【" className="nested" />}
            title={<Bilingual ja="文法" en="Grammar" />}
            stat={
              grammarDone > 0
                ? `${grammarDone} / ${grammarTopics.length} subsections completed`
                : 'how the words fit together'
            }
            onOpen={onGrammar}
          />
        )}
      </div>

      {/* The one move that needs no decision, so it sits on its own below the sections rather than
          inside any one of them: practice draws on everything you know. */}
      <button type="button" className="jump-btn" onClick={onPractice}>
        <span className="jump-text">
          <span className="jump-title">
            <FontAwesomeIcon icon="play" />
            Jump straight to practice
          </span>
          <span className="jump-sub">{PRACTICE_ITERATIONS} mixed questions</span>
        </span>
        <FontAwesomeIcon icon="chevron-right" />
      </button>
    </section>
  )
}

/**
 * One course, as a card you can act on directly.
 *
 * The card itself opens the section; the buttons inside it are shortcuts past the section's own
 * landing, so the common moves are one click from here rather than three. It's a div rather than a
 * button because it *contains* buttons — nesting those would be invalid markup — so the heading row
 * is the button and the card is the frame around it.
 */
function SectionCard({
  icon,
  mark,
  title,
  stat,
  onOpen,
  children,
}: {
  icon: IconProp
  mark?: ReactNode
  title: ReactNode
  stat: ReactNode
  onOpen: () => void
  children?: ReactNode
}) {
  return (
    <div className="study-choice section-card">
      {mark}
      <button type="button" className="section-open" onClick={onOpen}>
        <span className="icon-circle">
          <FontAwesomeIcon icon={icon} />
        </span>
        <span className="study-choice-text">
          {title}
          <span className="study-choice-sub">{stat}</span>
        </span>
        <FontAwesomeIcon icon="chevron-right" className="action-chevron" />
      </button>
      {children && <div className="section-subs">{children}</div>}
    </div>
  )
}

/** A secondary action inside a section — quiet, sitting under the heading row. */
function SubAction({
  icon,
  label,
  onClick,
}: {
  icon: IconProp
  label: string
  onClick: () => void
}) {
  return (
    <button type="button" className="sub-action" onClick={onClick}>
      <FontAwesomeIcon icon={icon} />
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

  return (
    <section className="panel units-page">
      <div className="practice-head">
        <button type="button" className="practice-back" onClick={onBack} aria-label="Back to study home">
          <FontAwesomeIcon icon="chevron-left" />
        </button>
        <h2>
          <Bilingual ja="ことば" en="Vocabulary" />
        </h2>
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
          <p className="board-hint">click a kanji to learn it · hold (or right-click) to disable it for practice</p>
          <KanjiBoard onSelect={onSelectUnit} />
        </>
      ) : (
        <>
          <p className="board-hint">click a word to look at it · hold the eye for a phrase's meaning</p>
          <KanaWordBoard onSelect={onSelectWord} />
        </>
      )}
    </section>
  )
}
