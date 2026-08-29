import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

/**
 * The hand-off between a page's header and the board below it: a rule broken by three chevrons
 * pointing down.
 *
 * The three sit level and a little heavier than the rule — quiet enough to belong to the divider,
 * solid enough to be seen as arrows rather than as texture on the line. (A graded fade was tried and
 * reads wrong: the arrows run left to right while the motion they stand for is downward, so the
 * gradient pulled the eye sideways along the rule.)
 */
export function ScrollCue() {
  return (
    <div className="scroll-cue" aria-hidden="true">
      <span className="cue-line" />
      {/* Stacked tight so the three read as one falling mark rather than three separate chevrons. */}
      <span className="cue-arrows">
        <FontAwesomeIcon icon="chevron-down" />
        <FontAwesomeIcon icon="chevron-down" />
        <FontAwesomeIcon icon="chevron-down" />
      </span>
      <span className="cue-line" />
    </div>
  )
}
