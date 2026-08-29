/**
 * What the learner actually did, alongside the score.
 *
 * The score alone answers "were they right"; the log needs "what did they pick", because a
 * distractor nobody ever chooses and one everybody chooses are indistinguishable in a running tally.
 * Optional, and every field with it: a task reports what it has, and the row records the rest as
 * null rather than a task view inventing a shape it doesn't own.
 */
export interface AnswerDetail {
  /** The chosen option / typed reading / selected set, as displayed. */
  picked?: string | null
  /** A draw task's strokes, which are saved to their own table and linked from the answer row. */
  strokes?: unknown
  /** True when the learner overturned the recognizer's verdict on a drawing. */
  overrodeVerdict?: boolean
}

/** The callback every task view reports through. */
export type ReportResult = (delta: number, detail?: AnswerDetail) => void
