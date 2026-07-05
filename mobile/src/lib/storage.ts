// RN data adapter — the mobile counterpart of the web's src/lib/api.ts. Same three signatures the
// contexts consume; content is bundled into the app, progress lives in AsyncStorage. Reuses the
// shared normalizeProgress so mobile data is coerced identically to the web/server.
import AsyncStorage from '@react-native-async-storage/async-storage'
import { normalizeProgress } from '@shared/progress'
import type { Content, Progress } from '@shared/types'
import content from '@content'

/** localStorage key on web; AsyncStorage key here (kept identical for parity). */
const PROGRESS_KEY = 'anti-duo:progress'
/** Millisecond timestamp of the last local change — the "revision" cloud sync compares against. */
const REV_KEY = 'anti-duo:progress:rev'

export async function getLocalRev(): Promise<number> {
  try {
    const r = await AsyncStorage.getItem(REV_KEY)
    return r ? Number(r) || 0 : 0
  } catch {
    return 0
  }
}

export async function setLocalRev(rev: number): Promise<void> {
  try {
    await AsyncStorage.setItem(REV_KEY, String(rev))
  } catch {
    // Best-effort; a missing rev just means the next sync treats local as stale.
  }
}

/** Content is bundled at build time (mirrors the web's static public/content.json). */
export function fetchContent(): Promise<Content> {
  return Promise.resolve(content)
}

export async function fetchProgress(): Promise<Progress> {
  try {
    const raw = await AsyncStorage.getItem(PROGRESS_KEY)
    return normalizeProgress(raw ? (JSON.parse(raw) as Progress) : null)
  } catch {
    return normalizeProgress(null)
  }
}

export async function saveProgress(progress: Progress): Promise<Progress> {
  const normalized = normalizeProgress(progress)
  await AsyncStorage.setItem(PROGRESS_KEY, JSON.stringify(normalized))
  return normalized
}
