import { ja } from './ja'
import { ar } from './ar'
import type { LanguagePack } from './types'

/** All registered language packs, keyed by id. */
export const PACKS: Record<string, LanguagePack> = { ja, ar }

export const DEFAULT_LANG = 'ja'

/**
 * Languages offered in the switcher. Everything else about a hidden pack still works — its content,
 * progress and engine are untouched, and a profile already on it keeps running — it simply isn't
 * advertised. Arabic is parked here while the Japanese course is the focus; drop 'ar' back in to
 * bring it out again.
 */
const HIDDEN: readonly string[] = ['ar']

/** The packs the language switcher shows. */
export function selectablePacks(): LanguagePack[] {
  return Object.values(PACKS).filter((p) => !HIDDEN.includes(p.id))
}

/** Resolve a pack by id, falling back to the default. */
export function getPack(id: string | undefined): LanguagePack {
  return (id && PACKS[id]) || PACKS[DEFAULT_LANG]
}
