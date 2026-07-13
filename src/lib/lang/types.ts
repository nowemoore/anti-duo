import type { Option } from '../tasks'

/**
 * The engine's per-language extension points: pure logic the neutral engine (tasks, learned) calls so
 * it never hardcodes one language. Rides on the ContentIndex (`index.lang`), resolved from the
 * content's language id. This is the ENGINE tier; the UI-tier LanguagePack (mobile/src/lang) is a
 * separate object that owns presentation (strings, furigana, the draw view, TTS…).
 */
export interface LangEngine {
  id: string
  /**
   * Options for a "pick the reading" task, or null to skip this word. JA makes it okurigana-aware:
   * every distractor reproduces the trailing kana so the ending is never a giveaway.
   */
  readingOptions(correct: string, surface: string, pool: string[]): Option[] | null
  /**
   * Whether a word with no tracked units still renders in native script. JA: true iff kana-only, so
   * an unfamiliar kanji (island 島, a name 田中) is never shown as if it were known.
   */
  nativeWhenUntracked(surface: string): boolean
}
