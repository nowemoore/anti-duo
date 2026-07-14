import type { LangEngine } from './types'
import { jaEngine } from './ja'
import { arEngine } from './ar'

/** Engine-tier language logic, keyed by content language id. Add a language = add an entry here. */
const ENGINES: Record<string, LangEngine> = {
  ja: jaEngine,
  ar: arEngine,
}

/** The engine logic for a content language id (defaults to Japanese, the reference language). */
export function getLangEngine(id: string | undefined): LangEngine {
  return ENGINES[id ?? 'ja'] ?? jaEngine
}

export type { LangEngine }
