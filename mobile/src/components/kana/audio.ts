import { useCallback } from 'react'
import * as Speech from 'expo-speech'
import { useLanguage } from '../../context/LanguageContext'

/**
 * Plays a single kana.
 *
 * Every sound in the course goes through this one hook, so if device TTS turns out to be unreliable
 * for isolated morae (ん and を are the usual suspects, and Android voices vary a lot) it can be
 * swapped for bundled clips — `expo-audio` is already a dependency — without touching any screen.
 *
 * Deliberately slower than SpeakButton's 0.95: a single syllable with no surrounding word is over
 * before it registers at conversational speed.
 */
export function useKanaAudio(): (char: string) => void {
  const { ttsLang } = useLanguage()
  return useCallback(
    (char: string) => {
      Speech.stop()
      Speech.speak(char, { language: ttsLang, rate: 0.8 })
    },
    [ttsLang],
  )
}
