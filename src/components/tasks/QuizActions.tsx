import { useEffect, type ReactNode } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

interface Props {
  /** The answer has been revealed/scored. */
  answered: boolean
  /** The check button is currently allowed. */
  canCheck: boolean
  onCheck: () => void
  onContinue: () => void
  /** Optional control shown on the far left (e.g. "No clue"). */
  leftExtra?: ReactNode
}

/**
 * Shared quiz footer: a check-in-circle button and a right-chevron continue button.
 * ArrowRight / Enter also drive it (check, then continue) — ignored while typing in an input.
 */
export function QuizActions({ answered, canCheck, onCheck, onContinue, leftExtra }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowRight' && e.key !== 'Enter') return
      const el = document.activeElement
      const typing =
        el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement
      // Enter is handled by the input itself; ArrowRight should move the caret while typing.
      if (typing && !answered) return
      if (answered) {
        e.preventDefault()
        onContinue()
      } else if (canCheck) {
        e.preventDefault()
        onCheck()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [answered, canCheck, onCheck, onContinue])

  return (
    <div className="quiz-actions">
      <div className="qa-left">{leftExtra}</div>
      <div className="qa-right">
        <button
          type="button"
          className="chevron check"
          aria-label="Check"
          disabled={answered || !canCheck}
          onClick={onCheck}
        >
          <FontAwesomeIcon icon="check" />
        </button>
        <button
          type="button"
          className="chevron next"
          aria-label="Continue"
          disabled={!answered}
          onClick={onContinue}
        >
          <FontAwesomeIcon icon="chevron-right" />
        </button>
      </div>
    </div>
  )
}
