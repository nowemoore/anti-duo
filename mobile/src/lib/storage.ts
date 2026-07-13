// RN data adapter — the mobile counterpart of the web's src/lib/api.ts. Same three signatures the
// contexts consume; content is bundled into the app, progress lives in AsyncStorage. Reuses the
// shared normalizeProgress so mobile data is coerced identically to the web/server.
import AsyncStorage from '@react-native-async-storage/async-storage'
import { normalizeProgress } from '@shared/progress'
import type { Content, Progress } from '@shared/types'
import content from '@content'

const HISTORICAL_DEFAULT = 'ja'
/** JA keeps the original (unprefixed) key so existing progress is never touched; any other language
 *  gets a `:<lang>` suffix — that's how Japanese and Arabic progress stay separate on-device. */
const progressKey = (lang: string) => (lang === HISTORICAL_DEFAULT ? 'anti-duo:progress' : `anti-duo:progress:${lang}`)
/** Millisecond timestamp of the last local change — the "revision" cloud sync compares against. */
const revKey = (lang: string) => `${progressKey(lang)}:rev`

export async function getLocalRev(lang: string): Promise<number> {
  try {
    const r = await AsyncStorage.getItem(revKey(lang))
    return r ? Number(r) || 0 : 0
  } catch {
    return 0
  }
}

export async function setLocalRev(lang: string, rev: number): Promise<void> {
  try {
    await AsyncStorage.setItem(revKey(lang), String(rev))
  } catch {
    // Best-effort; a missing rev just means the next sync treats local as stale.
  }
}

/** Content is bundled at build time (mirrors the web's static public/content.json). */
export function fetchContent(): Promise<Content> {
  return Promise.resolve(content)
}

export async function fetchProgress(lang: string): Promise<Progress> {
  try {
    const raw = await AsyncStorage.getItem(progressKey(lang))
    return normalizeProgress(raw ? (JSON.parse(raw) as Progress) : null)
  } catch {
    return normalizeProgress(null)
  }
}

export async function saveProgress(lang: string, progress: Progress): Promise<Progress> {
  const normalized = normalizeProgress(progress)
  await AsyncStorage.setItem(progressKey(lang), JSON.stringify(normalized))
  return normalized
}
