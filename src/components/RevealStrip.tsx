import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

/**
 * Fixed-height dark band showing held text, or a hint when nothing is held.
 *
 * The mobile app's practice cards land every hold-to-reveal gloss in one place rather than showing
 * it inline; this is the web counterpart. It spans its container edge to edge (a negative margin
 * cancels the surrounding padding — see `.reveal-strip` in index.css).
 */
export function RevealStrip({ text, hint }: { text: string | null; hint: string }) {
  return (
    <div className="reveal-strip">
      {/* Leading eye marks the strip as the place revealed text lands, in both states. */}
      <FontAwesomeIcon icon="eye" className={text ? 'reveal-eye on' : 'reveal-eye'} />
      {text ? <span className="reveal-text">{text}</span> : <span className="reveal-hint">{hint}</span>}
    </div>
  )
}
