import { useEffect } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { charsOfScript, isTraced, kanaOf, markTraced, type KanaScript } from '../../lib/kana'
import { useProgress } from '../../context/ProgressContext'
import { SpeakButton } from '../SpeakButton'
import { useKanaAudio } from './audio'

/**
 * The character page: hear it, look at it, then say you've met it.
 *
 * **This is the desktop cut of the mobile flow, and the difference is deliberate.** On mobile a
 * character is met by tracing it and then writing it unaided, and completing both is what puts it
 * into the practice pool. There is no drawing on desktop — a mouse is a poor stylus and most desktop
 * displays aren't touch — so the flow would have no way to finish and `buildDrill` would never have
 * a pool to draw from.
 *
 * The explicit "I've learned this" below takes that role. It keeps the invariant the course is built
 * on — practice can only ever ask about characters the learner *chose* to meet — without pretending
 * a handwriting step happened. Opening the page is not enough on its own: that would silently fill
 * the practice pool with characters someone merely scrolled past.
 */
export function KanaCharacter({
  char,
  script,
  onChange,
  onBack,
}: {
  char: string
  script: KanaScript
  onChange: (char: string) => void
  onBack: () => void
}) {
  const { progress, update } = useProgress()
  const play = useKanaAudio()

  const chars = charsOfScript(script)
  const at = chars.indexOf(char)
  const prev = at > 0 ? chars[at - 1] : null
  const next = at >= 0 && at < chars.length - 1 ? chars[at + 1] : null
  const studied = isTraced(progress, char)
  const romaji = kanaOf(char)?.romaji ?? ''

  // Hear it the moment it arrives — the sound is the thing being taught, the shape is the label.
  useEffect(() => {
    play(char)
  }, [char, play])

  const markStudied = () => {
    update((p) => (isTraced(p, char) ? p : markTraced(p, char, new Date().toISOString())))
  }

  /** Mark it met and move on in one go — the common path once a learner finds their rhythm. */
  const studyAndAdvance = () => {
    markStudied()
    if (next) onChange(next)
    else onBack()
  }

  return (
    <section className="panel kana-char">
      <div className="practice-head">
        <button type="button" className="practice-back" onClick={onBack} aria-label="Back to the chart">
          <FontAwesomeIcon icon="chevron-left" />
        </button>
        <span className="kana-char-label">Listen and look</span>
      </div>

      <div className="kana-char-stage">
        <button
          type="button"
          className="kana-char-step"
          onClick={() => prev && onChange(prev)}
          disabled={!prev}
          aria-label="Previous character"
        >
          <FontAwesomeIcon icon="chevron-left" />
        </button>

        <div className="kana-char-glyph-wrap">
          <span className="kana-char-glyph">{char}</span>
          <span className="kana-char-romaji">{romaji}</span>
          <SpeakButton text={char} label="Play the sound again" />
        </div>

        <button
          type="button"
          className="kana-char-step"
          onClick={() => next && onChange(next)}
          disabled={!next}
          aria-label="Next character"
        >
          <FontAwesomeIcon icon="chevron-right" />
        </button>
      </div>

      {/* Already met: say so plainly rather than offering the button again. Revisiting a character
          to hear it is a normal thing to want, and it shouldn't look like an unfinished task. */}
      {studied ? (
        <div className="kana-char-done">
          <FontAwesomeIcon icon="circle-check" />
          <span>Studied — this one comes up in practice</span>
        </div>
      ) : (
        <p className="kana-char-hint">
          Play it a few times and look at the shape. Mark it studied when you can hear it and picture
          it — that's what puts it into practice.
        </p>
      )}

      {/* `actions` carries the shared button/pill treatment; the kana class only re-centres it. */}
      <div className="actions kana-char-actions">
        {!studied && (
          <button type="button" className="pill-btn" onClick={markStudied}>
            <span className="icon-circle">
              <FontAwesomeIcon icon="check" />
            </span>
            I've learned this
          </button>
        )}
        {next && (
          <button
            type="button"
            className={studied ? 'pill-btn' : 'pill-btn quiet'}
            onClick={studied ? () => onChange(next) : studyAndAdvance}
          >
            <span className="icon-circle">
              <FontAwesomeIcon icon="chevron-right" />
            </span>
            {studied ? 'Next character' : 'Learn it and continue'}
          </button>
        )}
      </div>
    </section>
  )
}
