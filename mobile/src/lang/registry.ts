import { ja } from './ja'
import type { LanguagePack } from './types'

/** All registered language packs, keyed by id. Add Arabic here once its pack exists. */
export const PACKS: Record<string, LanguagePack> = { ja }

export const DEFAULT_LANG = 'ja'

/** Resolve a pack by id, falling back to the default. */
export function getPack(id: string | undefined): LanguagePack {
  return (id && PACKS[id]) || PACKS[DEFAULT_LANG]
}
