import { useEffect, useState, type CSSProperties } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  canDrill,
  canPractiseWords,
  charsOfScript,
  chartRomaji,
  isTraced,
  markTraced,
  masteryOf,
  studiedCount,
  totalKanaCount,
  tracedToPractise,
  wordsToPractise,
  type ChartSection,
  type KanaScript,
} from '../../lib/kana'
import { KANA_DRILL_ITEMS } from '../../../shared/constants'
import type { KanaWord } from '../../../shared/types'
import { useContent } from '../../context/ContentContext'
import { useProgress } from '../../context/ProgressContext'
import { useHandwriting } from '../../lib/useHandwriting'
import { DrawCanvas, type Stroke } from '../DrawCanvas'
import { useKanaAudio } from './audio'

/**
 * The kana section: the chart on the left, the character you picked on the right.
 *
 * The two used to be separate pages, and paging between them was the whole experience of this
 * section — click a character, land on its page, go back, lose your place in the chart, click the
 * next one. They are one screen now because they are one activity: the chart is the curriculum and
 * the panel is what you do with it, so the chart stays put and only the panel changes.
 *
 * Nothing is gated. There is no prescribed order here and no "teach me five" — you pick the
 * character you want, which is why the chart has to be the thing that never leaves the screen.
 */
export function KanaMenu({
  scripts,
  onPractice,
  onWordPractice,
  onBack,
}: {
  scripts: KanaScript[]
  onPractice: () => void
  onWordPractice: () => void
  onBack: () => void
}) {
  const { progress } = useProgress()
  const kanaWords: KanaWord[] = useContent().content.kanaWords ?? []

  // One script on screen at a time, labelled in the scripts themselves: by the time you are choosing
  // between them you can read both, and the page is about reading them.
  const [activeId, setActiveId] = useState(scripts[0]?.id)
  const active = scripts.find((s) => s.id === activeId) ?? scripts[0]

  /** The character in the right-hand panel. Opens on the first of the script, never on nothing. */
  const [char, setChar] = useState<string | null>(null)
  const chars = active ? charsOfScript(active) : []
  const current = char && chars.includes(char) ? char : (chars[0] ?? null)

  const studied = studiedCount(progress, scripts)
  const total = totalKanaCount(scripts)
  // The drill is multiple choice, so one script needs enough characters to fill the options.
  const ready = canDrill(progress)
  const toGo = tracedToPractise(progress)
  // Words open on their own terms: enough of them have to be *readable* — every character studied.
  const wordsReady = canPractiseWords(progress, kanaWords)
  const wordsToGo = wordsToPractise(progress, kanaWords)

  /* Each drill on its initial, like the study home's. Ignored while a field has focus. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const el = document.activeElement
      if (el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return
      const k = e.key.toLowerCase()
      if (k === 'p' && ready) onPractice()
      else if (k === 'w' && wordsReady) onWordPractice()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onPractice, onWordPractice, ready, wordsReady])

  return (
    <div className="kana-page">
        <header className="kana-board-head">
          {/* Hung to the left of the title, so かな itself starts at the chart's own left edge. */}
          <button type="button" className="kana-board-back" onClick={onBack} aria-label="Back to study home">
            <FontAwesomeIcon icon="chevron-left" />
          </button>
          <h2 className="kana-board-title">
            <span className="kana-board-ja">かな</span>
            <span className="kana-board-en">Kana</span>
          </h2>
        </header>

        {/* Which script, how far in, what the colours mean — a centred stack under the title,
            read top to bottom before the chart itself. */}
        <div className="kana-board-meta">
          {scripts.length > 1 && (
            <div className="segmented" role="tablist" aria-label="Which script">
              {scripts.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  role="tab"
                  aria-selected={s.id === active?.id}
                  className={s.id === active?.id ? 'segment on' : 'segment'}
                  onClick={() => setActiveId(s.id)}
                >
                  {s.title.native}
                </button>
              ))}
            </div>
          )}

          <p className="kana-board-tally">
            <strong>{studied}</strong> / {total} characters unlocked
          </p>

          {/*
            Three states, which is what the data supports: never opened, opened, and drilled to the
            top of its run. No "off" — a character can't be switched out of practice the way a kanji
            can — and no "ready for more", which is about a kanji's example words.
          */}
          <div className="board-legend kana-legend">
            <span className="legend-item">
              <span className="legend-swatch kana-swatch-new" />
              <span className="legend-label">new</span>
            </span>
            <span className="legend-item">
              <span className="legend-swatch kana-swatch-studied" />
              <span className="legend-label">studied</span>
            </span>
            <span className="legend-item">
              <span className="legend-swatch kana-swatch-known" />
              <span className="legend-label">known</span>
            </span>
            <span className="legend-hint">· click a character to open it</span>
          </div>
        </div>

        {/* Basic, Voiced and Combined abreast rather than stacked: they are three readings of the
            same syllabary, and a column each keeps the whole chart on one screen. */}
        <div className="kana-charts">
          {active?.sections.map((section) => (
            <ChartRows
              key={section.id}
              section={section}
              selected={current}
              onSelect={setChar}
            />
          ))}
        </div>

      {/* The drills sit beside the meta stack and end where the chart starts, so the card below them
          begins level with the chart. Both are placed on the page grid, not nested in a column. */}
      <div className="kana-board-actions">
          <button
            type="button"
            className="big-action primary kana-drill-btn"
            onClick={onPractice}
            disabled={!ready}
            title={
              ready
                ? `${KANA_DRILL_ITEMS} questions`
                : `study ${toGo} more ${toGo === 1 ? 'character' : 'characters'} of one script first`
            }
          >
            <FontAwesomeIcon icon="play" className="big-action-icon" />
            <span className="big-action-title">Practice by ear</span>
            <kbd className="keycap kana-drill-key">P</kbd>
          </button>
          <button
            type="button"
            className="big-action kana-drill-btn"
            onClick={onWordPractice}
            disabled={!wordsReady}
            title={
              wordsReady
                ? 'the same characters in real words'
                : `${wordsToGo} more readable ${wordsToGo === 1 ? 'word' : 'words'} needed`
            }
          >
            <FontAwesomeIcon icon="book-open" className="big-action-icon" />
            <span className="big-action-title">Words practice</span>
            <kbd className="keycap kana-drill-key">W</kbd>
          </button>
        </div>

      {active && current && (
        <CharDetail
          key={current}
          char={current}
          chars={chars}
          onChange={setChar}
        />
      )}
    </div>
  )
}

/**
 * One block of the chart, a row at a time.
 *
 * Laid out as stored: each row is one consonant group and the vowels run across it. Transposing it
 * was tried — あいうえお down a column is how a gojūon chart is drawn on paper — but eleven columns
 * of cells is a wide thing, and it forced the three blocks to stack down the page instead of sitting
 * side by side where all of かな is visible at once.
 *
 * No row names and no per-row counts. Both were furniture in front of the grid: the label column
 * pushed the cells away from the block's own title, and with vowels as rows there is no 行 to name.
 * How far along you are is the fill of the cells and the tally above them.
 */
function ChartRows({
  section,
  selected,
  onSelect,
}: {
  section: ChartSection
  selected: string | null
  onSelect: (char: string) => void
}) {
  const rows = section.rows
  // Widest row in the block: five for Basic and Voiced, three for Combined — so a block sizes itself
  // rather than every block being cut to the same number of tracks.
  const cols = Math.max(1, ...rows.map((r) => r.length))
  return (
    <div className="kana-block" style={{ '--cols': cols } as CSSProperties}>
      {section.label && <h3 className="kana-section-label">{section.label}</h3>}
      <div className="kana-cells">
        {rows.flat().map((c, i) =>
          c ? (
            <Cell key={i} char={c} selected={c === selected} onSelect={onSelect} />
          ) : (
            <span key={i} className="kana-cell empty" aria-hidden="true" />
          ),
        )}
      </div>
    </div>
  )
}

/** Alpha a just-studied cell carries, so it still reads as coloured rather than empty. */
const FILL_FLOOR = 0.18

function Cell({
  char,
  selected,
  onSelect,
}: {
  char: string
  selected: boolean
  onSelect: (char: string) => void
}) {
  const { progress } = useProgress()
  const seen = isTraced(progress, char)
  // A studied cell's alpha tracks its practice run, so the chart is a map of how far along you are.
  const fill = seen ? FILL_FLOOR + (1 - FILL_FLOOR) * masteryOf(progress, char) : 0
  return (
    <button
      type="button"
      className={`kana-cell${seen ? '' : ' new'}${selected ? ' selected' : ''}`}
      style={seen ? { background: `color-mix(in srgb, var(--accent) ${(fill * 100).toFixed(1)}%, transparent)` } : undefined}
      aria-label={`${char}, ${chartRomaji(char)}`}
      aria-pressed={selected}
      onClick={() => onSelect(char)}
    >
      <span className="kana">{char}</span>
      <span className="romaji">{chartRomaji(char)}</span>
    </button>
  )
}

/**
 * The character, on the right, for as long as it is the one you picked.
 *
 * Hear it, look at it, then form it by hand — over the guide first, then without. Tracing is how you
 * meet a character, so finishing a trace is what marks it studied; it moves no levels, because
 * copying a shape is not the same as recalling it, and only the drill tests recall.
 */
function CharDetail({
  char,
  chars,
  onChange,
}: {
  char: string
  chars: string[]
  onChange: (char: string) => void
}) {
  const { update } = useProgress()
  const play = useKanaAudio()
  const hw = useHandwriting()
  const words: KanaWord[] = useContent().content.kanaWords ?? []

  /** With the guide, or from memory. The second half is the one that is actually a test of anything. */
  const [guided, setGuided] = useState(true)
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [attempt, setAttempt] = useState(0)
  const [verdict, setVerdict] = useState<boolean | null>(null)

  const at = chars.indexOf(char)
  const next = at >= 0 && at < chars.length - 1 ? chars[at + 1] : null
  const mine = words.filter((w) => w.word.includes(char))

  // Hear it the moment it arrives — the sound is the thing being taught, the shape is the label.
  useEffect(() => {
    play(char)
  }, [char, play])

  const markStudied = () => {
    update((p) => (isTraced(p, char) ? p : markTraced(p, char, new Date().toISOString())))
  }

  const clear = () => {
    setStrokes([])
    setVerdict(null)
    setAttempt((n) => n + 1)
  }

  /** Done with the guide: the ink is the whole of tracing, so this is just the handover. */
  const fromMemory = () => {
    setGuided(false)
    clear()
  }

  /*
   * Grade the unaided attempt, then mark the character met either way. A wrong verdict is another
   * look, not a lockout — the point is to have formed the shape, and the drill is where recall is
   * actually tested.
   */
  const check = () => {
    if (strokes.length === 0 || verdict != null) return
    setVerdict(hw ? hw.gradeKana(char, strokes) : true)
    markStudied()
  }

  return (
    <aside className="kana-detail">
      <div className="kana-detail-head">
        <span className="kana-detail-glyph">{char}</span>
        <div className="kana-detail-text">
          <button
            type="button"
            className="sub-action kana-play"
            onClick={() => play(char)}
            aria-label="Play the sound again"
            title="Play the sound again"
          >
            <FontAwesomeIcon icon="volume-high" />
          </button>
        </div>
      </div>

      {/*
        Tracing and the words it unlocks, side by side rather than stacked.

        They are two different kinds of thing — one is work, the other is the reason for it — so
        putting the words in their own column keeps the card short enough to sit beside the chart
        without scrolling, and lets you see what the character is *for* while you are forming it.
      */}
      <div className="kana-detail-body">
        <div className="kana-detail-trace">
          <DrawCanvas
            // Re-keyed per half and per retry, so each one starts on a genuinely blank canvas.
            key={`${char}-${guided ? 'guide' : 'memory'}-${attempt}`}
            disabled={verdict != null}
            onStrokes={setStrokes}
            guide={guided ? char : undefined}
            status={verdict == null ? undefined : verdict ? 'right' : 'wrong'}
          />

        </div>

        {mine.length > 0 && (
          /* A hairline between the two, and nothing else: a full rule would make the card look like
             two cards that happen to be touching. */
          <div className="kana-detail-words">
            <div className="section-head">
              <span>Words with {char}</span>
            </div>
            {/* Chips, not a list with locks and glosses: this is a reason to learn the character,
                and a reason is better made short. The words' own page is where they are studied. */}
            <div className="kana-word-chips">
              {mine.slice(0, 10).map((w) => (
                <span key={w.idx} className="kana-detail-word" title={w.gloss.join(' / ')}>
                  {w.word}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/*
        Both ways out of the character, on one line under the whole card: another go at the shape, or
        on to the next one. The trace button used to sit under the canvas, inside a half-width column
        — which cost the canvas the height and read as a caption on it rather than as a decision.
      */}
      <div className="kana-detail-foot">
        {guided ? (
          <button
            type="button"
            className="sub-action kana-trace-go"
            onClick={fromMemory}
            disabled={strokes.length === 0}
          >
            Trace from memory
          </button>
        ) : verdict == null ? (
          <button
            type="button"
            className="sub-action kana-trace-go"
            onClick={check}
            disabled={strokes.length === 0}
          >
            Check it
          </button>
        ) : (
          <button type="button" className="sub-action kana-trace-go" onClick={() => { setGuided(true); clear() }}>
            {verdict ? 'Studied — trace again' : 'Studied — try again'}
          </button>
        )}

        {next && (
          <button type="button" className="sub-action kana-next" onClick={() => onChange(next)}>
            Next character
            <FontAwesomeIcon icon="chevron-right" />
          </button>
        )}
      </div>
    </aside>
  )
}
