import { createContext, useContext, type ReactNode } from 'react'
import { DEFAULT_LANG, getPack } from '../lang/registry'
import type { LanguagePack } from '../lang/types'

const LanguageCtx = createContext<LanguagePack>(getPack(DEFAULT_LANG))

/**
 * Provides the active language pack to the whole app. For now the language is fixed to the default;
 * a picker + per-language content/progress swapping plug in here next (the picker sets the id, this
 * resolves the pack, and ContentProvider/ProgressProvider key off it).
 */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const pack = getPack(DEFAULT_LANG)
  return <LanguageCtx.Provider value={pack}>{children}</LanguageCtx.Provider>
}

export const useLanguage = (): LanguagePack => useContext(LanguageCtx)
