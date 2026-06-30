import { useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  children: ReactNode
  gloss: string
  /** When false, hovering shows nothing (e.g. before a task is answered). */
  enabled?: boolean
  className?: string
}

/** Wraps content; on hover/touch shows `gloss` in a small bubble that follows the cursor. */
export function HoverGloss({ children, gloss, enabled = true, className }: Props) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)

  const move = (x: number, y: number) => {
    if (enabled) setPos({ x, y })
  }
  const clear = () => setPos(null)

  return (
    <span
      className={className ? `hg ${className}` : 'hg'}
      onMouseEnter={(e) => move(e.clientX, e.clientY)}
      onMouseMove={(e) => move(e.clientX, e.clientY)}
      onMouseLeave={clear}
      onTouchStart={(e) => move(e.touches[0].clientX, e.touches[0].clientY)}
      onTouchMove={(e) => move(e.touches[0].clientX, e.touches[0].clientY)}
      onTouchEnd={clear}
      onTouchCancel={clear}
    >
      {children}
      {enabled &&
        pos &&
        createPortal(
          <span className="cursor-bubble" style={{ left: pos.x + 14, top: pos.y + 16 }}>
            {gloss}
          </span>,
          document.body,
        )}
    </span>
  )
}
