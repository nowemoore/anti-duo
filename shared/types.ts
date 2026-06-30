// Shared domain model — imported by both the client (src/) and the server (server/).

// ---------------------------------------------------------------------------
// Content (read-only, parsed from kanji.csv + sentences.csv)
// ---------------------------------------------------------------------------

/** A dictionary word: surface form, kana reading, English meaning. */
export interface Word {
  word: string
  reading: string
  meaning: string
}

/** One kanji and its teaching material (row of kanji.csv). */
export interface Kanji {
  /** 1–100, teaching order. */
  idx: number
  char: string
  /** Author-defined difficulty tier; new kanji are drawn from the lowest unlearned batch first. */
  batch: number
  /** Topical category (e.g. "Numbers", "Food & Drink") — used for learning-set selection. */
  category: string
  /** English meanings. */
  gloss: string[]
  /** Real words using this kanji — Learn-mode intro + Type-2 correct answers. */
  examples: Word[]
  /** Fake words containing this kanji — Type-2 distractors. */
  distractors: Word[]
}

/** A particle token — standalone grammar (は, を, です, …). Always rendered as kana verbatim; never blanked. */
export interface ParticleToken {
  kind: 'particle'
  kana: string
}

/** A content word token (okurigana included in `ja`) — renders English or Japanese by learned state. */
export interface WordToken {
  kind: 'word'
  /** Full surface form including okurigana (e.g. 食べる). */
  ja: string
  /** Whole-word kana reading (use directly for furigana; do not derive from kanji.csv). */
  reading: string
  /** English gloss (shown while no kanji learned; revealed on hover otherwise). */
  en: string
  /** Tracked kanji characters (in the 100-set) contained in this word. */
  kanji: string[]
  /** idx values of the kanji in this word that may be blanked (cloze targets). */
  targets: number[]
}

export type Token = ParticleToken | WordToken

/** One example sentence (row of sentences.csv). */
export interface Sentence {
  id: string
  /** kanji `idx` values appearing in this sentence. */
  kanjiList: number[]
  tokens: Token[]
}

/** Everything served read-only by GET /api/content. */
export interface Content {
  kanji: Kanji[]
  sentences: Sentence[]
  /** Per-character English meaning (from allkanji_meanings.csv), for every kanji used by the
   *  curriculum, its example words, radical, or components. Powers per-character look-up glosses. */
  kanjiMeanings: Record<string, string>
  /** The classifying radical char of each curriculum kanji, from allkanji_meanings.csv. */
  kanjiRadicals: Record<string, string>
  /** Component characters of each curriculum kanji (excluding itself and its radical). */
  kanjiComponents: Record<string, string[]>
}

// ---------------------------------------------------------------------------
// Progress (read/write, persisted to data/progress.json)
// ---------------------------------------------------------------------------

export interface Settings {
  name: string
  /** Category names turned off (empty = all on). A disabled category pauses all its kanji. */
  disabledCategories: string[]
  /** Individual kanji idx values turned off (empty = all on), within enabled categories. */
  disabledKanji: number[]
}

/** Per-kanji progress. `lvl`: 0 = unseen, 1 = introduced, +1 per correct answer. */
export interface KanjiProgress {
  lvl: number
}

export interface Progress {
  settings: Settings
  /** Keyed by kanji `idx` (stringified in JSON). */
  kanji: Record<number, KanjiProgress>
  /** ISO timestamp of the last Study run, if any. */
  lastRunAt?: string
}
