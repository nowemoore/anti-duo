import { useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

const supported = typeof window !== 'undefined' && 'speechSynthesis' in window

function pickJaVoice(): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices()
  return (
    voices.find((v) => v.lang === 'ja-JP') ??
    voices.find((v) => v.lang.toLowerCase().startsWith('ja'))
  )
}

interface Props {
  /** What to pronounce — pass the kana reading so the pronunciation is always correct. */
  text: string
  label?: string
  className?: string
  /** Render the button but keep it inert (e.g. reserve its space before a cloze is filled). */
  disabled?: boolean
}

/** Speaks Japanese text via the browser's built-in speech (no backend, no data leaves the device). */
export function SpeakButton({ text, label, className, disabled }: Props) {
  // Track whether voices have loaded so we can disable when there's no Japanese voice at all.
  const [hasJaVoice, setHasJaVoice] = useState(() => (supported ? Boolean(pickJaVoice()) : false))

  useEffect(() => {
    if (!supported) return
    const update = () => setHasJaVoice(Boolean(pickJaVoice()))
    update()
    window.speechSynthesis.addEventListener('voiceschanged', update)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', update)
  }, [])

  if (!supported) return null

  const speak = () => {
    const synth = window.speechSynthesis
    synth.cancel() // stop anything already playing
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'ja-JP'
    const voice = pickJaVoice()
    if (voice) u.voice = voice
    u.rate = 0.95
    synth.speak(u)
  }

  return (
    <button
      type="button"
      className={className ? `speak-btn ${className}` : 'speak-btn'}
      aria-label={label ?? 'Play pronunciation'}
      title={hasJaVoice ? undefined : 'No Japanese voice installed'}
      disabled={disabled || !hasJaVoice}
      onClick={speak}
    >
      <FontAwesomeIcon icon="volume-high" />
    </button>
  )
}
