/** A word with its reading above it. `<ruby>` is the web's native furigana; RN has to fake it. */
export function Furigana({
  surface,
  reading,
  className,
}: {
  surface: string
  reading: string
  className?: string
}) {
  return (
    <ruby className={className}>
      {surface}
      <rt>{reading}</rt>
    </ruby>
  )
}
