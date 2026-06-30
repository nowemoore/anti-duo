import type { ReactNode } from 'react'

interface Props {
  ja: ReactNode
  en: ReactNode
  className?: string
}

/** A stacked Japanese-over-English label (like the nav buttons). Used for UI chrome titles. */
export function Bilingual({ ja, en, className }: Props) {
  return (
    <span className={className ? `bilingual ${className}` : 'bilingual'}>
      <span className="ja">{ja}</span>
      <span className="en">{en}</span>
    </span>
  )
}
