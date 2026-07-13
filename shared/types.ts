// Shared domain model — imported by both the client (src/) and the server (server/).
//
// Neutral across languages: a "Unit" is the atom you learn (a kanji, an Arabic root, …), and a
// Sentence is a stream of Tokens. Anything a specific language needs that the engine doesn't — an
// Arabic word's voweled form, a plural, a token's lemma — rides in the optional `extra` bag, read
// only by that language's pack. The engine never looks inside `extra`.

// ---------------------------------------------------------------------------
// Content (read-only, parsed from the per-language dbs)
// ---------------------------------------------------------------------------

/** A dictionary word: surface form, reading, meaning. */
export interface Word {
  word: string
  reading: string
  meaning: string
  /** Language-specific fields (e.g. Arabic `voweled`, `plural`) — read only by the language pack. */
  extra?: Record<string, unknown>
}

/** One learnable unit and its teaching material (a kanji, an Arabic root, …). */
export interface Unit {
  /** Teaching order. */
  idx: number
  /** The unit's written form (a kanji character, a root, …). */
  form: string
  /** Author-defined difficulty tier; new units are drawn from the lowest unlearned batch first. */
  batch: number
  /** Topical category — used for learning-set selection. */
  category: string
  /** English meanings. */
  gloss: string[]
  /** Real words built on this unit — Learn-mode intro + correct answers. */
  examples: Word[]
  /** Plausible fake words — distractors. */
  distractors: Word[]
  /** Language-specific fields (e.g. Arabic `batchesReleased`) — read only by the language pack. */
  extra?: Record<string, unknown>
}

/** A particle/scaffold token — standalone grammar; always rendered verbatim, never blanked. */
export interface ParticleToken {
  kind: 'particle'
  surface: string
}

/** A content word token — renders gloss or surface form by learned state. */
export interface WordToken {
  kind: 'word'
  /** Full surface form (e.g. 食べる). */
  surface: string
  /** Whole-word reading (use directly for the reading annotation). */
  reading: string
  /** English gloss (shown while the unit isn't learned; revealed on hold otherwise). */
  gloss: string
  /** Tracked unit forms contained in this word. */
  units: string[]
  /** idx values of the units in this word that may be blanked (cloze targets). */
  targets: number[]
  /** Language-specific fields (e.g. Arabic `lemma`, `inflected`) — read only by the language pack. */
  extra?: Record<string, unknown>
}

export type Token = ParticleToken | WordToken

/** One example sentence. */
export interface Sentence {
  id: string
  /** unit `idx` values appearing in this sentence. */
  unitList: number[]
  tokens: Token[]
}

/** Everything served read-only by GET /api/content. */
export interface Content {
  /** Content language id — selects the engine-tier LangEngine. Defaults to 'ja' when absent. */
  lang?: string
  units: Unit[]
  sentences: Sentence[]
  /** Per-character English meaning, for every char used by the curriculum, its example words,
   *  radical, or components. Powers per-character look-up glosses. (JA breakdown data.) */
  kanjiMeanings: Record<string, string>
  /** The classifying radical char of each curriculum unit. (JA breakdown data.) */
  kanjiRadicals: Record<string, string>
  /** Component characters of each curriculum unit (excluding itself and its radical). (JA.) */
  kanjiComponents: Record<string, string[]>
}

// ---------------------------------------------------------------------------
// Progress (read/write, persisted to data/progress.json)
// ---------------------------------------------------------------------------

export interface Settings {
  name: string
  /** Category names turned off (empty = all on). A disabled category pauses all its units. */
  disabledCategories: string[]
  /** Individual unit idx values turned off (empty = all on), within enabled categories. */
  disabledUnits: number[]
  /**
   * Per-task-type appearance weight, keyed by TaskType (0 = off, higher = more often). A task
   * absent here falls back to its built-in default weight.
   */
  taskWeights?: Record<string, number>
}

/** Per-unit progress. `lvl`: 0 = unseen, 1 = introduced, +1 per correct answer. */
export interface UnitProgress {
  lvl: number
}

/**
 * Cumulative practice tally for one task type. `points` is earned score in [0, attempts]: each
 * answered task earns (delta + 1) / 2 out of 1 possible, so the success rate is `points / attempts`.
 */
export interface TaskStats {
  attempts: number
  points: number
}

export interface Progress {
  settings: Settings
  /** Keyed by unit `idx` (stringified in JSON). */
  units: Record<number, UnitProgress>
  /** Cumulative per-task-type success tally, keyed by TaskType. Absent until the first answer. */
  stats?: Record<string, TaskStats>
  /** ISO timestamp of the last Study run, if any. */
  lastRunAt?: string
}
