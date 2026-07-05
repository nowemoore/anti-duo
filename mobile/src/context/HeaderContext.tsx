import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

export interface HeaderTitle {
  ja: string
  en: string
}

export interface HeaderProgress {
  current: number
  total: number
}

interface HeaderConfig {
  /** Back handler shown as a top-left button; absent → no back button. */
  back?: () => void
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

export function HeaderProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<HeaderConfig>({})
  return <Ctx.Provider value={{ config, setConfig }}>{children}</Ctx.Provider>
}

/** Read the current header config (used by the app shell to render the top bar). */
export function useHeaderConfig(): HeaderConfig {
  return useContext(Ctx)?.config ?? {}
}

/**
 * Registers this screen's back handler and/or step title in the app-level top bar,
 * clearing them when the screen unmounts. `back` is kept in a ref so passing a fresh
 * closure each render doesn't re-fire the effect — only a change in title text (or in
 * whether a back handler exists) re-registers.
 */
export function useScreenHeader(back?: () => void, title?: HeaderTitle, progress?: HeaderProgress) {
  const setConfig = useContext(Ctx)?.setConfig
  const backRef = useRef(back)
  backRef.current = back

  const hasBack = back != null
  const ja = title?.ja
  const en = title?.en
  const current = progress?.current
  const totalSteps = progress?.total

  useEffect(() => {
    if (!setConfig) return
    setConfig({
      back: hasBack ? () => backRef.current?.() : undefined,
      title: ja != null && en != null ? { ja, en } : undefined,
      progress: current != null && totalSteps != null ? { current, total: totalSteps } : undefined,
    })
    return () => setConfig({})
  }, [setConfig, hasBack, ja, en, current, totalSteps])
}
