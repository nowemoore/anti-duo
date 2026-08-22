import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export interface HeaderTitle {
  ja: string
  en: string
}

export interface HeaderProgress {
  current: number
  total: number
}

interface HeaderConfig {
  /** Step label shown above the card (e.g. "Question 3 / 10"); absent → no label. */
  title?: HeaderTitle
  /** Step count rendered as dots under the label; absent → no dots. */
  progress?: HeaderProgress
}

interface HeaderCtx {
  config: HeaderConfig
  setConfig: (c: HeaderConfig) => void
}

const Ctx = createContext<HeaderCtx | null>(null)

/**
 * Scopes a header registration to one screen.
 *
 * Mounted per screen, not once for the app: a native stack keeps the screen you left alive for the
 * duration of the pop animation, so a single shared config meant the screen underneath rendered the
 * departing screen's title and dots — practice's "question 4 / 10" sitting over the kanji board.
 * One provider per screen means a screen can only ever see its own.
 */
export function HeaderProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<HeaderConfig>({})
  return <Ctx.Provider value={{ config, setConfig }}>{children}</Ctx.Provider>
}

/** Read the current header config (used by the study stack's screen frame). */
export function useHeaderConfig(): HeaderConfig {
  return useContext(Ctx)?.config ?? {}
}

/**
 * Registers this screen's step title and dots, clearing them when the screen unmounts.
 *
 * Back is not part of this any more: the study stack is a native stack, so the system bar draws
 * the back control and owns the pop. Screens that still take an `onExit` use it for their own
 * in-content exits, not for the header.
 */
export function useScreenHeader(title?: HeaderTitle, progress?: HeaderProgress) {
  const setConfig = useContext(Ctx)?.setConfig

  const ja = title?.ja
  const en = title?.en
  const current = progress?.current
  const totalSteps = progress?.total

  useEffect(() => {
    if (!setConfig) return
    setConfig({
      title: ja != null && en != null ? { ja, en } : undefined,
      progress: current != null && totalSteps != null ? { current, total: totalSteps } : undefined,
    })
    return () => setConfig({})
  }, [setConfig, ja, en, current, totalSteps])
}
