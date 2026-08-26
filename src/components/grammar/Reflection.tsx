import { useEffect, useRef, useState } from 'react'
import type { GrammarTopicProgress } from '../../../shared/types'
import { missedItems, type GrammarContext, type GrammarTopic } from '../../lib/grammar'
import { Disclosure } from './PartCard'

/** Idle delay before an in-progress answer is committed to storage. */
const SAVE_IDLE_MS = 800

/**
 * Part 3 — four free-writing prompts. Each answer is persisted separately (per topic, per question
 * id) with its own nullable `feedback` field, reserved for LLM review later; nothing generates
 * feedback today.
 */
export function Reflection({
  topic,
  tp,
  ctx,
  onSave,
}: {
  topic: GrammarTopic
  tp: GrammarTopicProgress
  /** Content + progress, used to resolve the recorded attempt's items back to their bank entries. */
  ctx: GrammarContext
  onSave: (questionId: string, answer: string) => void
}) {
  const missed = missedItems(topic, tp, ctx)

  return (
    <div className="reflection">
      <p className="reflection-intro">
        No right answers here — write what you noticed. Your notes are saved as you type.
      </p>

      {topic.reflection.prompts.map((p, n) => (
        <div key={p.id} className="reflection-block">
          <p className="reflection-prompt">
            <span className="reflection-num">{n + 1}. </span>
            {p.prompt}
          </p>

          {p.showMissedItems && (
            <Disclosure label={`Your missed items (${missed.length})`}>
              {missed.length === 0 ? (
                <p className="miss-none">
                  Nothing missed in your last attempt — good sign, but the question still stands.
                </p>
              ) : (
                missed.map(({ item, picked }) => (
                  <div key={item.id} className="miss-row">
                    <span className="miss-verb">{item.form}</span>
                    <span className="miss-picked">you picked {picked}</span>
                  </div>
                ))
              )}
            </Disclosure>
          )}

          <AnswerField
            value={tp.reflections[p.id]?.answer ?? ''}
            onCommit={(text) => onSave(p.id, text)}
          />
        </div>
      ))}
    </div>
  )
}

/**
 * One textarea. Keeps the text in local state so typing never waits on a progress write, and commits
 * on idle plus on blur — the debounce alone would lose the tail if the part is collapsed mid-word.
 */
function AnswerField({ value, onCommit }: { value: string; onCommit: (text: string) => void }) {
  const [text, setText] = useState(value)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pending = useRef<string | null>(null)

  const commit = () => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
    if (pending.current != null) {
      onCommit(pending.current)
      pending.current = null
    }
  }

  // Flush whatever is still pending if the field goes away (part collapsed, section closed). Held in
  // a ref so the unmount effect never re-runs — re-running it would flush on every keystroke.
  const commitRef = useRef(commit)
  commitRef.current = commit
  useEffect(() => () => commitRef.current(), [])

  const change = (next: string) => {
    setText(next)
    pending.current = next
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(commit, SAVE_IDLE_MS)
  }

  return (
    <textarea
      className="reflection-input"
      value={text}
      onChange={(e) => change(e.target.value)}
      onBlur={commit}
      placeholder="Write your thoughts…"
      rows={4}
    />
  )
}
