import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { ExplanationExample, ExampleSpan, GrammarTopic, SpanRole } from '../../lib/grammar'

/**
 * Colour legend for the worked examples. Roles map to palette variables (never literals), so the
 * whole theme stays consistent and readable.
 *   stem    → accent ink   (the part that survives)
 *   ending  → correct      (the ます that gets added)
 *   dropped → incorrect    (the final kana that's dropped or changed, struck through)
 */
function spanClass(role: SpanRole): string {
  return `span-${role}`
}

/** Part 4 — the explanation, revealed only once the pass threshold has been met. */
export function Explanation({ topic }: { topic: GrammarTopic }) {
  const name = topic.explanation.revealedName
  return (
    <div className="explanation">
      {/* The form's real name, held back until here so the game stays a derivation exercise. */}
      {name && (
        <div className="explain-reveal">
          <span className="explain-reveal-label">This form is called</span>
          <span className="explain-reveal-en">{name.en}</span>
          <span className="explain-reveal-native">{name.native}</span>
        </div>
      )}
      <Legend />
      {topic.explanation.blocks.map((block) => (
        <div key={block.heading} className={`explain-block${block.footnote ? ' footnote' : ''}`}>
          <h4 className="explain-heading">{block.heading}</h4>
          {block.body.map((para) => (
            <p key={para} className="explain-body">
              {para}
            </p>
          ))}
          {block.examples?.map((ex, i) => (
            <ExampleRow key={i} example={ex} />
          ))}
        </div>
      ))}
    </div>
  )
}

function Legend() {
  const entries: { role: SpanRole; label: string }[] = [
    { role: 'stem', label: 'stem' },
    { role: 'ending', label: 'ます ending' },
    { role: 'dropped', label: 'dropped / changed' },
  ]
  return (
    <div className="explain-legend">
      {entries.map((e) => (
        <span key={e.role} className="legend-item">
          <span className={`legend-swatch ${spanClass(e.role)}`} />
          <span className="legend-label">{e.label}</span>
        </span>
      ))}
    </div>
  )
}

function ExampleRow({ example }: { example: ExplanationExample }) {
  return (
    <div className="explain-example">
      <div className="explain-example-row">
        <Spans spans={example.from} />
        <FontAwesomeIcon icon="chevron-right" className="explain-arrow" />
        <Spans spans={example.to} />
      </div>
      {example.note ? <p className="explain-example-note">{example.note}</p> : null}
    </div>
  )
}

function Spans({ spans }: { spans: ExampleSpan[] }) {
  return (
    <span className="explain-jp">
      {spans.map((s, i) => (
        // Struck through (in CSS) so "dropped" reads as dropped even without relying on colour alone.
        <span key={i} className={spanClass(s.role)}>
          {s.text}
        </span>
      ))}
    </span>
  )
}

/** Shown in place of the explanation until the learner's best attempt clears the threshold. */
export function ExplanationLocked({
  best,
  required,
  attempts,
  onRetry,
}: {
  best: number
  required: number
  attempts: number
  onRetry: () => void
}) {
  const pct = Math.round(best * 100)
  const need = Math.round(required * 100)
  return (
    <div className="explain-locked">
      <p className="explain-locked-title">
        Best so far: <strong>{pct}%</strong> of {need}%
      </p>

      <span className="stats-bar">
        {/* Scaled against the threshold, so the bar fills exactly when the explanation unlocks. */}
        <span className="stats-bar-fill" style={{ width: `${Math.min(100, (best / required) * 100)}%` }} />
      </span>

      <p className="explain-locked-note">
        {attempts === 0
          ? 'Play the game above to unlock the explanation.'
          : `${attempts} attempt${attempts === 1 ? '' : 's'} so far. Retries are unlimited and reshuffle the items — only your best attempt counts.`}
      </p>

      <button type="button" className="grammar-btn" onClick={onRetry}>
        <FontAwesomeIcon icon="rotate-left" />
        {attempts === 0 ? 'Go to the game' : 'Try again'}
      </button>
    </div>
  )
}
