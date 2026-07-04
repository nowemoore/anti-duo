import { useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  children: ReactNode
  gloss: string
  /** When false, hovering shows nothing (e.g. before a task is answered). */
  enabled?: boolean
  className?: string
}

/** Wraps content; on hover (mouse) or press-and-hold (touch) shows `gloss` in a small bubble. */
export function HoverGloss({ children, gloss, enabled = true, className }: Props) {
  const [pos, setPos] = useState<{ x: number; y: number; touch: boolean } | null>(null)

  const move = (x: number, y: number, touch = false) => {
    if (enabled) setPos({ x, y, touch })
  }
  const clear = () => setPos(null)

  return (
    <span
      className={className ? `hg ${className}` : 'hg'}
      onMouseEnter={(e) => move(e.clientX, e.clientY)}
      onMouseMove={(e) => move(e.clientX, e.clientY)}
      onMouseLeave={clear}
      onTouchStart={(e) => move(e.touches[0].clientX, e.touches[0].clientY, true)}
      onTouchMove={(e) => move(e.touches[0].clientX, e.touches[0].clientY, true)}
      onTouchEnd={clear}
      onTouchCancel={clear}
    >
      {children}
      {enabled &&
        pos &&
        createPortal(
          <span
            className="cursor-bubble"
            // Mouse: offset down-right of the cursor. Touch: float above the finger (centered) so
            // the fingertip doesn't cover the bubble it just summoned.
            style={
              pos.touch
                ? { left: pos.x, top: pos.y - 18, transform: 'translate(-50%, -100%)' }
                : { left: pos.x + 14, top: pos.y + 16 }
            }
          >
            {gloss}
          </span>,
          document.body,
        )}
    </span>
  )
}
