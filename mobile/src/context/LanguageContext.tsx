import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { DEFAULT_LANG, getPack } from '../lang/registry'
import type { LanguagePack } from '../lang/types'
import { getStoredLang, storeLang } from '../lib/storage'

const LanguageCtx = createContext<LanguagePack>(getPack(DEFAULT_LANG))
const SetLanguageCtx = createContext<(id: string) => void>(() => {})

/**
 * Provides the active language pack to the whole app. The chosen id is state (persisted to
 * AsyncStorage), so a picker can switch languages at runtime; ContentProvider/ProgressProvider key
 * off `useLanguage().id` and re-load per language.
 */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [id, setId] = useState<string>(DEFAULT_LANG)

  useEffect(() => {
    getStoredLang().then((stored) => {
      if (stored) setId(stored)
    })
  }, [])

  const setLang = useCallback((next: string) => {
    setId(next)
    void storeLang(next)
  }, [])

  const pack = getPack(id)
  return (
    <SetLanguageCtx.Provider value={setLang}>
      <LanguageCtx.Provider value={pack}>{children}</LanguageCtx.Provider>
    </SetLanguageCtx.Provider>
  )
}

/** The active language pack. */
export const useLanguage = (): LanguagePack => useContext(LanguageCtx)

/** Switch the active language by id (persisted). */
export const useSetLanguage = (): ((id: string) => void) => useContext(SetLanguageCtx)
