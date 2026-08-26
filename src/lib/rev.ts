/**
 * The local progress revision: a millisecond timestamp bumped on every local change, and the thing
 * sync compares against the cloud's copy to decide which side is newer.
 *
 * Kept in localStorage rather than inside Progress itself, because it describes *this device's* copy
 * — pushing it inside the synced payload would mean the remote's rev overwrote the local one on
 * every pull, which is exactly the comparison it exists to make.
 */
const REV_KEY = 'anti-duo:rev'

export function getLocalRev(): number {
  try {
    const raw = localStorage.getItem(REV_KEY)
    return raw ? Number(raw) || 0 : 0
  } catch {
    return 0
  }
}

export function setLocalRev(rev: number): void {
  try {
    localStorage.setItem(REV_KEY, String(rev))
  } catch {
    // Best-effort; a missing rev just means the next sync treats local as stale.
  }
}
