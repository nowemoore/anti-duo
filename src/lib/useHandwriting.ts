import { useEffect, useState } from 'react'

type Handwriting = typeof import('./handwriting')

/**
 * The recognizer and its reference patterns, loaded on demand.
 *
 * The two pattern sets are ~900 KB together — most of the app's weight for a feature a learner may
 * never open. Behind a dynamic import they become their own chunk, fetched the first time something
 * asks whether a word is drawable and shared by every caller after that.
 */
let pending: Promise<Handwriting> | null = null

function load(): Promise<Handwriting> {
  pending ??= import('./handwriting')
  return pending
}

/**
 * The loaded module, or null until it arrives. Nothing here throws — it just stays null on failure.
 *
 * Pass `enabled: false` where handwriting is ruled out before anything is drawn (a device with no
 * touchscreen or stylus), and the chunk is never fetched at all rather than downloaded and ignored.
 */
export function useHandwriting(enabled = true): Handwriting | null {
  const [mod, setMod] = useState<Handwriting | null>(null)
  useEffect(() => {
    if (!enabled) return
    let live = true
    load().then((m) => live && setMod(m), () => {})
    return () => {
      live = false
    }
  }, [enabled])
  return mod
}
