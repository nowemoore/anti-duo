// Re-stamp dbs/content.lock.json from the current CSVs — `npm run lock:content`.
//
// The lock pins idx -> form for every unit, because `idx` is an *identity* in persisted user data,
// not a row position: Progress.units, Settings.disabledUnits and the Supabase `drawings.unit_idx`
// column are all keyed by it. Renumbering silently reassigns a learner's history to a different
// character, with no error and no way back.
//
// Deleting a unit is safe — its idx retires and its progress lies dormant, ready if the unit ever
// returns. Reusing a retired idx for a different character is not. `check-invariants.ts` rule S6
// enforces both against this file; running this script is how you record an intentional change, so
// the diff shows up in review.
import { writeFile } from 'node:fs/promises'
import { csv, EMPTY_LOCK, isRetired, LOCK_PATH, readLock, type ContentLock } from './content-lock'

/**
 * idx -> form for one unit file, split into live and retired, in numeric idx order so the lock diffs
 * cleanly. A row marked `retired` keeps its identity recorded — that is the whole point of retiring
 * rather than deleting — it just moves out of the live map.
 */
function formsByIdx(
  rows: Record<string, string>[],
  key: 'char' | 'word',
): { live: Record<string, string>; retired: Record<string, string> } {
  const live: Record<string, string> = {}
  const retired: Record<string, string> = {}
  for (const r of [...rows].sort((a, b) => Number(a.idx) - Number(b.idx))) {
    ;(isRetired(r) ? retired : live)[r.idx] = r[key]
  }
  return { live, retired }
}

/** Anything the old lock knew about that the CSV no longer has, folded into the retired map. */
function retire(
  live: Record<string, string>,
  wasLive: Record<string, string>,
  wasRetired: Record<string, string>,
): { retired: Record<string, string>; newlyRetired: string[]; revived: string[] } {
  const retired = { ...wasRetired }
  const newlyRetired: string[] = []
  for (const [idx, form] of Object.entries(wasLive)) {
    if (idx in live) continue
    retired[idx] = form
    newlyRetired.push(`${idx}=${form}`)
  }
  // A retired idx that comes back as the same form is simply un-retired.
  const revived: string[] = []
  for (const idx of Object.keys(live)) {
    if (idx in retired && retired[idx] === live[idx]) {
      delete retired[idx]
      revived.push(`${idx}=${live[idx]}`)
    }
  }
  return { retired, newlyRetired, revived }
}

async function main() {
  const previous = (await readLock()) ?? EMPTY_LOCK
  const kanjiSplit = formsByIdx(await csv('ja_kanji.csv'), 'char')
  const kanaSplit = formsByIdx(await csv('ja_kana.csv'), 'word')
  const kanji = kanjiSplit.live
  const kana = kanaSplit.live

  // A row that vanished from the file entirely is retired here; one marked `retired` in the file is
  // already retired and simply carries across.
  const k = retire(kanji, previous.kanji, { ...previous.kanjiRetired, ...kanjiSplit.retired })
  const n = retire(kana, previous.kana, { ...previous.kanaRetired, ...kanaSplit.retired })

  const lock: ContentLock = {
    kanji,
    kanjiRetired: k.retired,
    kana,
    kanaRetired: n.retired,
  }
  await writeFile(LOCK_PATH, JSON.stringify(lock, null, 2) + '\n', 'utf8')

  const changed: string[] = []
  for (const [label, live, was] of [
    ['kanji', kanji, previous.kanji],
    ['kana', kana, previous.kana],
  ] as const)
    for (const [idx, form] of Object.entries(live))
      if (idx in was && was[idx] !== form) changed.push(`${label} ${idx}: ${was[idx]} -> ${form}`)

  const added =
    Object.keys(kanji).filter((i) => !(i in previous.kanji)).length +
    Object.keys(kana).filter((i) => !(i in previous.kana)).length

  console.log(`locked ${Object.keys(kanji).length} kanji, ${Object.keys(kana).length} kana words`)
  if (added) console.log(`  added:   ${added} new idx`)
  for (const line of [...k.newlyRetired, ...n.newlyRetired]) console.log(`  retired: ${line}`)
  for (const line of [...k.revived, ...n.revived]) console.log(`  revived: ${line}`)
  if (changed.length) {
    console.log('\n  !! idx reassigned to a different form — this rewrites user history:')
    for (const line of changed) console.log(`     ${line}`)
    console.log('     If that was not deliberate, revert the CSV rather than the lock.')
  }
  console.log('\nwrote dbs/content.lock.json')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
