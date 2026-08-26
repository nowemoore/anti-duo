import { useCallback } from 'react'

/**
 * Speech for the kana course.
 *
 * The web counterpart of the mobile module of the same name, and it exists for the same reason:
 * every sound in the course goes through one place, so if browser TTS turns out to be unreliable for
 * isolated morae (ん and を are the usual suspects, and installed voices vary a lot) it can be
 * swapped for bundled clips without touching any screen.
 *
 * Kept separate from {@link SpeakButton} because these are fire-and-forget calls made by a screen —
 * a question playing itself as it arrives — rather than a control the learner presses.
 */
const supported = typeof window !== 'undefined' && 'speechSynthesis' in window

function pickJaVoice(): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices()
  return (
    voices.find((v) => v.lang === 'ja-JP') ??
    voices.find((v) => v.lang.toLowerCase().startsWith('ja'))
  )
}

function speak(text: string, rate: number): void {
  if (!supported) return
  const synth = window.speechSynthesis
  synth.cancel() // never let two questions overlap
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'ja-JP'
  const voice = pickJaVoice()
  if (voice) u.voice = voice
  u.rate = rate
  synth.speak(u)
}

/**
 * Plays a single kana.
 *
 * Deliberately slower than {@link useWordAudio}: a single syllable with no surrounding word is over
 * before it registers at conversational speed.
 */
export function useKanaAudio(): (char: string) => void {
  return useCallback((char: string) => speak(char, 0.8), [])
}

/**
 * Plays a whole kana word.
 *
 * Separate from {@link useKanaAudio} only in rate: an isolated mora needs slowing down to register,
 * but a word read at 0.8 sounds laboured and stops matching how it is actually said.
 */
export function useWordAudio(): (word: string) => void {
  return useCallback((word: string) => speak(word, 0.95), [])
}
