import type { ComponentType } from 'react'
import type { TaskType } from '@lib/tasks'
import type { Unit, Content } from '@shared/types'
import type { TaskUI } from '../components/tasks/types'
import type { Palette } from '../theme'

/** A finger-drawn stroke: a path of points (structurally the recognizer's + canvas's stroke type). */
export type DrawStroke = { x: number; y: number }[]

export interface DrawReviewProps {
  units: Unit[]
  onDone: () => void
  baseStep?: number
  totalSteps?: number
}

/**
 * A language's handwriting/draw capability (JA: the on-device kanji recognizer + canvas views).
 * Absent → the engine never offers a draw task and there's no post-learn write review.
 */
export interface DrawCapability {
  /** Recognizer coverage: can this word be auto-graded at all (patterns exist, right length)? */
  isDrawable: (word: string) => boolean
  /** Post-learn write-review screen. */
  Review: ComponentType<DrawReviewProps>
}

/** A stacked native-over-English label's two strings. */
export interface NativeText {
  native: string
  en: string
}

/** User-facing shell strings for a language (the native + English copy of the app chrome). */
export interface UiStrings {
  /** The learnable unit's English name, for interpolated prose + counters (JA: 'kanji'). */
  noun: string
  /** Home greeting, by whether a name is set / any progress exists. */
  greeting: (name: string, hasRecord: boolean) => NativeText
  learnEntry: NativeText
  grammarEntry: NativeText
  learn: NativeText
  practice: NativeText
  notNow: NativeText
  statsTitle: NativeText
  summaryTitle: NativeText
  learnHeader: (step: number, total: number) => NativeText
  questionHeader: (step: number, total: number) => NativeText
  /** The how-to-use manual content (task descriptions + personalise tips) — language-specific prose. */
  manual: {
    tasks: { title: string; desc: string }[]
    points: string[]
  }
}

/**
 * A language pack: everything that differs between languages hangs off this one object. The engine and
 * shell stay language-blind and read what they need from the active pack (via LanguageContext). Adding
 * a language = a `content.<id>.json` + one of these; no engine changes.
 */
export interface LanguagePack {
  id: string
  label: { native: string; en: string }
  /** Text direction for this language's script (Arabic → 'rtl'). */
  direction: 'ltr' | 'rtl'
  /** This language's colour palette. Absent → the default (Japanese) palette. */
  palette?: Palette
  /** BCP-47 locale for text-to-speech (expo-speech). */
  ttsLang: string
  /** Canonical (committed) reading of raw type-task input, used for grading (JA: romaji→kana). */
  toReading: (raw: string) => string
  /**
   * As-you-type transform for the input field, if it differs from {@link toReading}. JA needs this for
   * IME buffering (a trailing "n" is held until the next key, so "kana" → かな not かんあ). Languages
   * with no live/commit distinction omit it and the input falls back to {@link toReading}.
   */
  toReadingLive?: (raw: string) => string
  /** Placeholder for the type-the-reading input. */
  inputHint: string
  /** Which task types this language offers (subset of the global registry). */
  tasks: TaskType[]
  /** Optional script reference (kana chart, Arabic alphabet…) shown behind the help button. */
  reference?: { title: { native: string; en: string }; Chart: ComponentType }
  /** User-facing shell strings (greetings, card labels, headers…) in this language + English. */
  ui: UiStrings
  /** Handwriting/draw capability (recognizer coverage + write-review), if the language has one. */
  draw?: DrawCapability
  /** Task modules this language contributes beyond the built-ins (draw, plural…), keyed by task kind. */
  taskUIs?: Record<string, TaskUI>
  /** Renders a word with its reading stacked above (JA furigana / ruby). Absent → plain surface. */
  Ruby?: ComponentType<{ surface: string; reading: string }>
  /** Per-character gloss for hold-to-reveal (JA: a kanji's meaning). Absent → no per-char reveal. */
  charGloss?: (content: Content, char: string) => string | undefined
  /**
   * Which characters of a surface word belong to the unit (Arabic: the root letters within a word),
   * as indices into `[...surface]` — for highlighting them. Returns null when they can't be located
   * (a weak root that mutates); absent → no root highlighting.
   */
  rootSpans?: (surface: string, unitForm: string) => number[] | null
  /** How to display a unit's written form when shown as "the unit" (Arabic: root letters split by dots). */
  displayForm?: (form: string) => string
  /**
   * Optional expandable detail panel behind the "zoom" button on a Learn card — the language's extra
   * insight into a unit. JA fills it with the radical + components breakdown; another language could
   * show a root's etymology, cognates, mnemonics, or notes. It's a free component, so each language
   * owns its own layout + labels. Absent (or `has` false for a unit) → no zoom button on that card.
   */
  detail?: {
    /** Whether this unit has any detail to show (gates the zoom button per unit). */
    has: (content: Content, unit: Unit) => boolean
    /** The collapsible detail body for this unit. */
    View: ComponentType<{ unit: Unit }>
  }
}
