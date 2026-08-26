import { useEffect, useState } from 'react'

/** The query that decides it: any touchscreen or stylus attached, whatever else is also plugged in. */
const COARSE = '(any-pointer: coarse)'

/**
 * Whether this device has something you could reasonably write with.
 *
 * A mouse is a poor stylus, so handwriting is never *asked for* on a plain desktop — a draw question
 * there is a question about your wrist, not about the kanji. `any-pointer: coarse` catches phones,
 * tablets and touchscreen laptops; `maxTouchPoints` catches pen digitisers that report themselves as
 * a fine pointer. A machine with both a mouse and a touchscreen counts as writable — the learner can
 * pick which one to use.
 *
 * This only gates the drills the app *chooses* for you. Writing you deliberately open (the kana
 * character page's "Write it") stays available everywhere: choosing it is the whole difference.
 */
export function canHandwrite(): boolean {
  if (typeof window === 'undefined') return false
  return window.navigator.maxTouchPoints > 0 || window.matchMedia(COARSE).matches
}

/** {@link canHandwrite}, re-read when the pointer situation changes (a tablet docked to a keyboard). */
export function useHandwritingInput(): boolean {
  const [ok, setOk] = useState(canHandwrite)
  useEffect(() => {
    const mq = window.matchMedia(COARSE)
    const update = () => setOk(canHandwrite())
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  return ok
}
