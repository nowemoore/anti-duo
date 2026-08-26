import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  canDrill,
  canPractiseWords,
  isTraced,
  masteryOf,
  studiedCount,
  totalKanaCount,
  tracedToPractise,
  wordsToPractise,
  type KanaScript,
} from '../../lib/kana'
import { KANA_DRILL_ITEMS, KANA_WORD_ITEMS } from '../../../shared/constants'
import { useContent } from '../../context/ContentContext'
import { useProgress } from '../../context/ProgressContext'
import { Bilingual } from '../Bilingual'
import { KanaGrid, type CellState } from './KanaGrid'

/**
 * The Learn kana page: a jump into practice, then each script's full chart inline.
 *
 * Every character is reachable from here — there's no prescribed order and nothing is gated, so the
 * chart *is* the curriculum. A cell fills in as its character is practised.
 */
export function KanaMenu({
  scripts,
  onSelect,
  onPractice,
  onWordPractice,
  onBack,
}: {
  scripts: KanaScript[]
  onSelect: (script: KanaScript, char: string) => void
  onPractice: () => void
  onWordPractice: () => void
  onBack: () => void
}) {
  const { progress } = useProgress()

  // One script on screen at a time. Labels are English on purpose — a learner opening this page
  // can't yet read ひらがな, which is the entire reason they're here.
  const [activeId, setActiveId] = useState(scripts[0]?.id)
  const active = scripts.find((s) => s.id === activeId) ?? scripts[0]

  const studied = studiedCount(progress, scripts)
  const total = totalKanaCount(scripts)
  // Practice is multiple choice, so one script needs enough characters to fill the options.
  const ready = canDrill(progress)
  const toGo = tracedToPractise(progress)
  // Words come from their own list and open on their own terms: enough of them have to be *readable*
  // — every character studied — before a multiple-choice question can be filled.
  const kanaWords = useContent().content.kanaWords ?? []
  const wordsReady = canPractiseWords(progress, kanaWords)
  const wordsToGo = wordsToPractise(progress, kanaWords)
  const stateOf = (char: string): CellState => (isTraced(progress, char) ? 'studied' : 'new')

  return (
    <section className="panel kana-menu">
      <div className="practice-head">
        <button type="button" className="practice-back" onClick={onBack} aria-label="Back to study home">
          <FontAwesomeIcon icon="chevron-left" />
        </button>
        <h2>
          <Bilingual ja="かな" en="Kana" />
        </h2>
      </div>

      <p className="home-status">
        {studied} / {total} characters studied
      </p>

      <div className="study-choices">
        {/* The only entry action here: there is no "teach me five random ones", because the charts
            below are the browse *and* the curriculum — you pick the character you want. */}
        <button type="button" className="study-choice" onClick={onPractice} disabled={!ready}>
          <span className="icon-circle">
            <FontAwesomeIcon icon="play" />
          </span>
          <Bilingual ja="れんしゅう" en="Practice" />
          <span className="study-choice-sub">
            {ready
              ? `${KANA_DRILL_ITEMS} questions`
              : `study ${toGo} more ${toGo === 1 ? 'character' : 'characters'} of one script first`}
          </span>
        </button>

        {/* The second step: the same characters in real words. Available once enough words are
            readable, which is a different bar from the character drill's. */}
        <button type="button" className="study-choice" onClick={onWordPractice} disabled={!wordsReady}>
          <span className="icon-circle">
            <FontAwesomeIcon icon="book-open" />
          </span>
          <Bilingual ja="たんご" en="Words" />
          <span className="study-choice-sub">
            {wordsReady
              ? `${KANA_WORD_ITEMS} questions`
              : `${wordsToGo} more readable ${wordsToGo === 1 ? 'word' : 'words'} needed`}
          </span>
        </button>
      </div>

      <p className="kana-scroll-note">or pick a character below to study it</p>

      {scripts.length > 1 && (
        <div className="kana-tabs" role="tablist">
          {scripts.map((s) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={s.id === active?.id}
              className={s.id === active?.id ? 'active' : ''}
              onClick={() => setActiveId(s.id)}
            >
              {s.title.en}
            </button>
          ))}
        </div>
      )}

      {active && (
        <div className="kana-script">
          <p className="kana-blurb">{active.blurb}</p>
          {active.sections.map((section) => (
            <div key={section.id} className="kana-section-block">
              <h3 className="kana-section-label">{section.label}</h3>
              <KanaGrid
                section={section}
                size="large"
                stateOf={stateOf}
                fillOf={(char) => masteryOf(progress, char)}
                onSelect={(char) => onSelect(active, char)}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
