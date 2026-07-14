import { ja } from './ja'
import { ar } from './ar'
import type { LanguagePack } from './types'

/** All registered language packs, keyed by id. */
export const PACKS: Record<string, LanguagePack> = { ja, ar }

export const DEFAULT_LANG = 'ja'

/** Resolve a pack by id, falling back to the default. */
export function getPack(id: string | undefined): LanguagePack {
  return (id && PACKS[id]) || PACKS[DEFAULT_LANG]
}
