// The idx identity lock — shared by `lock-content.ts` (which writes it) and `check-invariants.ts`
// (rule S6, which enforces it). Kept in its own module with no side effects at import time, so the
// checker can read the lock without the generator running and rewriting it first.
//
// Why it exists: `idx` is an *identity* in persisted user data, not a row position. Three places key
// off it — `Progress.units`, `Settings.disabledUnits`, and the Supabase `drawings.unit_idx` column
// (historical handwriting samples). Renumbering silently reassigns a learner's history, and the
// drawings, to a different character, with no error raised and no way to reconstruct the truth.
import { readFile } from 'node:fs/promises'
import Papa from 'papaparse'

export const ROOT = new URL('../', import.meta.url)
export const LOCK_PATH = new URL('dbs/content.lock.json', ROOT)

export interface ContentLock {
  /** idx -> character, for every live kanji unit. */
  kanji: Record<string, string>
  /** idx -> character, for kanji that have been removed. Never reuse these indexes. */
  kanjiRetired: Record<string, string>
  /** idx -> word, for every live kana unit. */
  kana: Record<string, string>
  /** idx -> word, for kana words that have been removed. Never reuse these indexes. */
  kanaRetired: Record<string, string>
}

export const EMPTY_LOCK: ContentLock = { kanji: {}, kanjiRetired: {}, kana: {}, kanaRetired: {} }

/** The committed lock, or null when there isn't one yet. */
export async function readLock(): Promise<ContentLock | null> {
  try {
    return JSON.parse(await readFile(LOCK_PATH, 'utf8')) as ContentLock
  } catch {
    return null
  }
}

/** Whether a db row is marked retired. Mirrors server/content.ts — retired rows are skipped at load. */
export function isRetired(row: Record<string, string>): boolean {
  return (row.retired ?? '').trim().toLowerCase() === 'true'
}

export async function csv(name: string): Promise<Record<string, string>[]> {
  const text = await readFile(new URL(`dbs/${name}`, ROOT), 'utf8')
  const { data, errors } = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  })
  if (errors.length) throw new Error(`${name}: ${errors[0].message} (row ${errors[0].row})`)
  return data
}
