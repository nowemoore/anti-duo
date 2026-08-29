import { useMemo } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  bestAccuracy,
  hasPassed,
  isMinigameGated,
  missingRequiredUnits,
  topicProgress,
  unitsNeededForVerbs,
  type GrammarTopic,
} from '../../lib/grammar'
import { useContent } from '../../context/ContentContext'
import { useProgress } from '../../context/ProgressContext'
import { Bilingual } from '../Bilingual'

/** The grammar landing page: one card per subsection available in the current language. */
export function GrammarMenu({
  topics,
  onSelect,
  onBack,
}: {
  topics: GrammarTopic[]
  onSelect: (topic: GrammarTopic) => void
  onBack: () => void
}) {
  const { progress } = useProgress()
  const index = useContent()
  const ctx = useMemo(() => ({ index, progress }), [index, progress])

  return (
    <section className="panel grammar-menu">
      <div className="practice-head">
        <button type="button" className="practice-back" onClick={onBack} aria-label="Back to study home">
          <FontAwesomeIcon icon="chevron-left" />
        </button>
        <h2>
          <Bilingual ja="文法" en="Grammar" />
        </h2>
      </div>

      {topics.length === 0 ? (
        <p className="stats-empty">No grammar subsections for this language yet.</p>
      ) : (
        <div className="grammar-topics">
          {topics.map((topic) => {
            const tp = topicProgress(progress, topic.id)
            const done = hasPassed(tp)
            const started = tp.vocabDoneAt != null || tp.attempts.length > 0
            // Same predicate the unlock gate itself uses, so the card can't claim one thing while
            // the section does another.
            const needed = topic.minigame.minItems ?? 0
            const gated = isMinigameGated(topic, tp, ctx)
            // The minimum number of extra kanji that would clear the gate — a real count, not the
            // verb shortfall relabelled, since a compound verb can need more than one.
            const kanjiToGo = gated ? unitsNeededForVerbs(index, progress, needed).length : 0
            // A topic can be held back by its frames as well as by its verb bank.
            const missingForms = gated
              ? missingRequiredUnits(topic, ctx).map((i) => index.byIdx.get(i)?.form ?? '')
              : []

            return (
              <button
                key={topic.id}
                type="button"
                className="grammar-topic"
                onClick={() => onSelect(topic)}
                disabled={gated}
              >
                <span className={`icon-circle${done ? ' done' : ''}${gated ? ' gated' : ''}`}>
                  <FontAwesomeIcon icon={gated ? 'lock' : done ? 'circle-check' : 'book'} />
                </span>
                <Bilingual ja={topic.titleNative} en={topic.titleEn} />
                <span className="study-choice-sub">
                  {gated
                    ? missingForms.length > 0
                      ? `Needs the kanji ${missingForms.join(' ')}.`
                      : `You need ${needed} verbs to start.`
                    : done
                      ? `Completed · best ${Math.round(bestAccuracy(tp) * 100)}%`
                      : started
                        ? `In progress · best ${Math.round(bestAccuracy(tp) * 100)}%`
                        : topic.blurb}
                </span>
                {gated && (
                  <span className="grammar-topic-hint">
                    {missingForms.length > 0
                      ? 'They frame every question, so the game needs them first.'
                      : kanjiToGo > 0
                        ? `Learn ${kanjiToGo} more kanji and come back.`
                        : 'Learn more kanji and come back.'}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}
