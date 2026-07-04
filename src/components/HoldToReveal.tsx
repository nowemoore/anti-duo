import { useState, type ReactNode } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

interface Props {
  children: ReactNode
  label?: string
}

/** An eye icon you press-and-hold (mouse or touch) to reveal hidden content. */
export function HoldToReveal({ children, label = 'Hold to reveal' }: Props) {
  const [shown, setShown] = useState(false)
  const show = () => setShown(true)
  const hide = () => setShown(false)

  return (
    <span className="hold">
      <button
        type="button"
        className="hold-btn"
        aria-label={label}
        aria-pressed={shown}
        onMouseDown={show}
        onMouseUp={hide}
        onMouseLeave={hide}
        onTouchStart={(e) => {
          e.preventDefault()
          show()
        }}
        // Blur on release so touch doesn't leave the eye focused (and looking activated) afterward.
        onTouchEnd={(e) => {
          e.currentTarget.blur()
          hide()
        }}
        onTouchCancel={(e) => {
          e.currentTarget.blur()
          hide()
        }}
      >
        <FontAwesomeIcon icon="eye" />
      </button>
      <span className={shown ? 'hold-content shown' : 'hold-content'}>{children}</span>
    </span>
  )
}
