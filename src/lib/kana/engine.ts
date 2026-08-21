// Kana course state: which characters the learner has met, and how solid each one is. Pure
// functions over the persisted KanaProgress — no React, no UI.
import { KANA_KNOWN_STREAK, KANA_STREAK_MAX } from '../../../shared/constants'
import type { KanaProgress, Progress } from '../../../shared/types'
import { charsOfScript, type KanaScript } from './table'

/** Empty state for a learner who hasn't opened the course. */
export function emptyKanaProgress(): KanaProgress {
  return { chars: {}, traced: {} }
}

export function kanaProgress(progress: Progress): KanaProgress {
  return progress.kana ?? emptyKanaProgress()
}

// ---------------------------------------------------------------------------
// Met characters
// ---------------------------------------------------------------------------

/**
 * Whether the learner has opened this character and traced it. This, and not the streak, is what
 * makes a character eligible for practice — the chart is the curriculum, so the pool only ever
 * contains characters the learner chose to meet.
 */
export function isTraced(progress: Progress, char: string): boolean {
  return progress.kana?.traced?.[char] != null
}

/** Every character met so far, across both scripts. */
export function tracedChars(progress: Progress): string[] {
  return Object.keys(progress.kana?.traced ?? {})
}

/** Met characters of one script, in chart order. */
export function tracedInScript(progress: Progress, script: KanaScript): string[] {
  return charsOfScript(script).filter((c) => isTraced(progress, c))
}

// ---------------------------------------------------------------------------
// Mastery
// ---------------------------------------------------------------------------

/** This character's current correct-run. */
export function streakOf(progress: Progress, char: string): number {
  return progress.kana?.chars?.[char] ?? 0
}

/** Whether the learner has this character down. */
export function isKnown(progress: Progress, char: string): boolean {
  return streakOf(progress, char) >= KANA_KNOWN_STREAK
}

export function knownCount(progress: Progress, scripts: KanaScript[]): number {
  return scripts.flatMap(charsOfScript).filter((c) => isKnown(progress, c)).length
}

/**
 * Characters the learner has completed the card for. This is what the chart colours in and what the
 * headline count reports — it moves the moment you finish a character, whereas {@link knownCount}
 * only moves after repeated correct answers in practice.
 */
export function studiedCount(progress: Progress, scripts: KanaScript[]): number {
  return scripts.flatMap(charsOfScript).filter((c) => isTraced(progress, c)).length
}

export function totalKanaCount(scripts: KanaScript[]): number {
  return scripts.reduce((n, s) => n + charsOfScript(s).length, 0)
}

/** Known / traced / total for one script, for its card and chart header. */
export function scriptProgress(
  progress: Progress,
  script: KanaScript,
): { known: number; traced: number; total: number } {
  const chars = charsOfScript(script)
  return {
    known: chars.filter((c) => isKnown(progress, c)).length,
    traced: chars.filter((c) => isTraced(progress, c)).length,
    total: chars.length,
  }
}

// ---------------------------------------------------------------------------
// Progress writers (all pure: Progress in, Progress out)
// ---------------------------------------------------------------------------

function withKana(progress: Progress, change: (kp: KanaProgress) => KanaProgress): Progress {
  return { ...progress, kana: change(kanaProgress(progress)) }
}

/** Mark a character as met (idempotent — the first timestamp is kept). */
export function markTraced(progress: Progress, char: string, now: string): Progress {
  if (isTraced(progress, char)) return progress
  return withKana(progress, (kp) => ({ ...kp, traced: { ...kp.traced, [char]: now } }))
}

/**
 * Move one character's run: correct climbs to KANA_STREAK_MAX, wrong steps back by one. The ceiling
 * above KANA_KNOWN_STREAK is buffer, so a solid character survives a slip instead of flapping in and
 * out of "known".
 */
export function recordCharResult(progress: Progress, char: string, correct: boolean): Progress {
  const next = correct
    ? Math.min(KANA_STREAK_MAX, streakOf(progress, char) + 1)
    : Math.max(0, streakOf(progress, char) - 1)
  return withKana(progress, (kp) => ({ ...kp, chars: { ...kp.chars, [char]: next } }))
}

/**
 * Record one answered question. A sequence credits every character in it — getting けそむ right is
 * evidence for all three, and missing it is evidence against all three, since there's no way to
 * tell which one let the learner down.
 */
export function recordResult(progress: Progress, chars: string[], correct: boolean): Progress {
  let next = progress
  for (const c of chars) next = recordCharResult(next, c, correct)
  return next
}
