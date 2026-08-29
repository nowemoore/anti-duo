import { useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { charsOfScript, isTraced, kanaOf, markTraced, type KanaScript } from '../../lib/kana'
import { useProgress } from '../../context/ProgressContext'
import { SpeakButton } from '../SpeakButton'
import { useKanaAudio } from './audio'
import { KanaTrace } from './KanaTrace'
import { KanaWordsFor } from './KanaWordsFor'

/**
 * The character page: hear it, look at it, then say you've met it.
 *
 * Two ways to finish, and both are deliberate. The phone's way is to trace the character and then
 * write it unaided; that's the "Write it" panel, opened on demand. Alongside it sits the plain
 * "I've learned this" button — a mouse is a poor stylus and most desktop displays aren't touch, so
 * on those the button is the sane path rather than a shortcut past a real step.
 *
 * Either way the invariant holds: practice can only ever ask about characters the learner *chose*
 * to meet. Opening the page is not enough on its own — that would silently fill the practice pool
 * with characters someone merely scrolled past.
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
  /** Whether the writing panel is open. Closed by default: it's a step, not the whole page. */
  const [writing, setWriting] = useState(false)

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

  // A character switch closes the panel: the next character starts from listening, not mid-drill.
  useEffect(() => setWriting(false), [char])

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

      {/* What the character is *for*: the words it unlocks, on the page where it's learned. */}
      <KanaWordsFor char={char} />

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

      {writing && (
        <KanaTrace
          char={char}
          onMet={() => {
            markStudied()
            setWriting(false)
          }}
        />
      )}

      {/* `actions` carries the shared button/pill treatment; the kana class only re-centres it. */}
      <div className="actions kana-char-actions">
        {!writing && (
          <button type="button" className="pill-btn quiet" onClick={() => setWriting(true)}>
            <span className="icon-circle">
              <FontAwesomeIcon icon="pen-nib" />
            </span>
            {studied ? 'Write it again' : 'Write it'}
          </button>
        )}
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
