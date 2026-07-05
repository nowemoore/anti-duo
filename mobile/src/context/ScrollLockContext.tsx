import { createContext, useContext } from 'react'

/**
 * Lets a nested drag control (e.g. `MiniSlider`) freeze the surrounding ScrollView for the duration
 * of its gesture. Without this, iOS's native scroll view keeps creeping while you drag a slider,
 * because the JS responder can't fully suppress it.
 */
export const ScrollLockContext = createContext<(locked: boolean) => void>(() => {})

export const useScrollLock = () => useContext(ScrollLockContext)
