// How a writing attempt is recorded. The *choice* of what to write lives in @lib/drawTarget, shared
// with the web app so the two clients can't drift on it; this file adds the mobile-only half —
// persisting a traced attempt for recognizer training.
import { saveDrawing } from '../../lib/drawings'
import type { RawStroke } from '@lib/handwriting'
import { toTarget, type Target } from '@lib/drawTarget'

export { toTarget }
export type { Target }

/**
 * Persist a traced attempt for later recognizer training. Fire-and-forget, and a no-op without a
 * signed-in user or Supabase — writing must never interrupt practice.
 *
 * Only traced attempts are logged from these screens: graded ones already flow through
 * PracticeSession, and duplicating them here would double-count.
 */
export function logTracedAttempt(
  userId: string | undefined,
  target: Target,
  strokes: RawStroke[],
): void {
  if (!userId || !target.traced || strokes.length === 0) return
  void saveDrawing({
    userId,
    lang: 'ja',
    unitIdx: target.unitIdx,
    word: target.word,
    strokes,
    correct: null, // nothing graded it
    mode: 'traced',
  }).catch(() => {})
}
