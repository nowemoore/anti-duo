// Kana course registry. A language either has a script course or it doesn't — Arabic returns an
// empty list and the Learn kana card never renders, the same mechanism that hides Learn grammar.
import { JA_SCRIPTS, type KanaScript } from './table'

/** Script courses, keyed by content language. */
export const KANA_SCRIPTS: Record<string, KanaScript[]> = {
  ja: JA_SCRIPTS,
}

export function scriptsForLang(lang: string): KanaScript[] {
  return KANA_SCRIPTS[lang] ?? []
}

export function findScript(lang: string, id: string): KanaScript | undefined {
  return scriptsForLang(lang).find((s) => s.id === id)
}

export * from './drill'
export * from './engine'
export * from './table'
