// Grammar subsection model — topic-agnostic. A grammar topic is *data*: a vocabulary intro, a
// minigame item bank, four reflection prompts, and an explanation. Adding a second topic means
// writing one more module in ./topics and registering it; no component logic is copied.
//
// Pure TS (no React, no react-native) — this folder is vendored into the mobile app by
// mobile/scripts/sync-shared.js and also type-checked by the web build.
import type { Progress } from '../../../shared/types'
import type { ContentIndex } from '../content'

/**
 * A vocabulary word shown in the intro part. The list presents the Japanese only — the gloss is
 * never on screen by default, and surfaces just while the learner holds the reveal button.
 */
export interface GrammarVocab {
  /** Written form, e.g. 毎朝. */
  word: string
  /** Whole-word reading in kana, e.g. まいあさ. */
  reading: string
  /** English gloss, shown only while the row's reveal button is held (replaces the reading). */
  meaning: string
  /**
   * `idx` values of the curriculum units written in this word. Credited as learned once the topic
   * is passed, so the intro doubles as a way to unlock its own vocabulary. Empty for kana-only words.
   */
  unitIdxs: number[]
}

/**
 * Whether an item's time-word frame is a habitual or a future cue. The minigame balances the two so
 * it can't accidentally teach "ます = future" — ます is non-past and covers both.
 */
export type CueKind = 'habitual' | 'future'

/** A time-word frame the minigame drops a verb into, e.g. 毎朝（食べる）. */
export interface GrammarCue {
  word: string
  reading: string
  /** English gloss, shown only in the game's hold-to-reveal strip (never in the vocab intro). */
  meaning: string
  kind: CueKind
}

/**
 * Item difficulty tier. `regular` items are shuffled freely; `exception` items are always held back
 * to the end (shuffled among themselves) so the trick isn't spoiled early.
 */
export type GrammarTier = 'regular' | 'exception'

/** One binary-choice minigame item: a dictionary-form verb and two candidate polite forms. */
export interface GrammarItem {
  /** Stable id — attempt history is keyed by this, so never renumber a shipped bank. */
  id: string
  /** Dictionary form in kanji, e.g. 食べる. */
  form: string
  /** Dictionary-form reading, rendered as furigana above `form`. */
  reading: string
  /** English gloss, shown only in the game's hold-to-reveal strip. */
  meaning: string
  /** The correct polite form, in kana. */
  correct: string
  /** The plausible-but-wrong polite form, in kana. */
  wrong: string
  tier: GrammarTier
  /** Author-facing note on why this item exists (verb class, trap). Not shown in the game. */
  note?: string
}

/** One free-writing reflection prompt. */
export interface ReflectionPrompt {
  /** Stable id — answers are persisted per question id. */
  id: string
  prompt: string
  /** Shows the learner's missed items from their last attempt next to this prompt (collapsed). */
  showMissedItems?: boolean
}

/**
 * One run of coloured Japanese in the explanation. `role` maps to a palette colour at render time,
 * so the explanation carries no hard-coded colours of its own.
 *   stem    – the part of the verb that survives
 *   ending  – the ます ending
 *   dropped – the final kana that is dropped or changed
 *   plain   – uncoloured text
 */
export type SpanRole = 'stem' | 'ending' | 'dropped' | 'plain'

export interface ExampleSpan {
  text: string
  role: SpanRole
}

/** A worked example: dictionary form → polite form, each as coloured spans. */
export interface ExplanationExample {
  from: ExampleSpan[]
  to: ExampleSpan[]
  /** Short English note under the example. */
  note?: string
}

/** One block of the explanation reveal. */
export interface ExplanationBlock {
  heading: string
  /** English prose paragraphs. */
  body: string[]
  examples?: ExplanationExample[]
  /** Renders smaller and dimmer — used for the irregulars footnote. */
  footnote?: boolean
}

/** A complete grammar subsection, supplied as data. */
export interface GrammarTopic {
  /** Stable id — progress is keyed by this. */
  id: string
  /** Japanese title shown before the reveal — name the form only, e.g. 〜ます (never 丁寧形). */
  titleNative: string
  /**
   * English title shown before the explanation is unlocked. Name the *form*, not the grammar term —
   * the term is itself part of what part 4 reveals (see `explanation.revealedName`). Same for
   * `titleNative` and `blurb`: no terminology anywhere a learner can read it early.
   */
  titleEn: string
  /** One-line description for the topic list — pre-reveal, so no grammar terminology. */
  blurb: string
  vocab: {
    /** Section label, e.g. "Vocabulary". */
    title: string
    /** Line above the word list saying what the words are for. */
    note?: string
    words: GrammarVocab[]
  }
  minigame: {
    /** Section label, e.g. "Which form is right?". */
    title: string
    /**
     * Framing shown above the first question. Sets expectations before anything is scored — someone
     * meeting the pattern for the first time is *supposed* to miss a good number of these.
     */
    intro?: string
    /** A fixed bank. Supply either this or {@link buildItems}. */
    items?: GrammarItem[]
    /**
     * A bank derived from the learner's own progress.
     *   scope 'run' — the sampled bank for ONE attempt; fresh on every call.
     *   scope 'all' — every candidate, unsampled and NOT learner-scoped, used to resolve item ids
     *                 recorded by past attempts. These must differ: the learned set can shrink
     *                 (see study.forgottenUnits), so resolving history against 'run' would lose items.
     */
    buildItems?: (ctx: GrammarContext, scope: 'run' | 'all') => GrammarItem[]
    /** Minimum available items before this part unlocks. Default 1. */
    minItems?: number
    /** Item ids from a previous bank → their current ids, so old attempt history still resolves. */
    legacyItemIds?: Record<string, string>
    /** Time-word frames the items are dropped into, drawn balanced across cue kinds. */
    cues: GrammarCue[]
  }
  reflection: {
    title: string
    prompts: ReflectionPrompt[]
  }
  explanation: {
    title: string
    /**
     * The form's actual grammatical name, revealed at the top of part 4 and nowhere else. Naming it
     * earlier would hand the learner the answer the minigame is meant to make them derive.
     */
    revealedName?: { native: string; en: string }
    blocks: ExplanationBlock[]
  }
}

/**
 * What a learner-derived bank needs to build itself: the content, and this learner's progress.
 * Threaded through the engine so topics can be data-driven without the engine knowing about verbs.
 */
export interface GrammarContext {
  index: ContentIndex
  progress: Progress
}

/** A minigame item paired with the frame and option order chosen for one attempt. */
export interface PreparedItem {
  item: GrammarItem
  cue: GrammarCue
  /** The two options in presentation order; exactly one has `correct: true`. */
  options: { label: string; correct: boolean }[]
}
