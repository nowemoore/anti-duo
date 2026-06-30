import { normalizeProgress } from '../../shared/progress'
import type { Content, Progress } from '../../shared/types'

/**
 * One data interface, two backends — picked at build time by VITE_STATIC:
 *  - Server mode (default): talks to the Express API. Used by local dev and the cloned repo.
 *  - Static mode (VITE_STATIC=1, `npm run build:static`): no server — content comes from a
 *    pre-built JSON bundled into the site, progress lives in localStorage. Powers the GitHub
 *    Pages demo. See README → "Live demo".
 */
const STATIC = import.meta.env.VITE_STATIC === '1'

/** localStorage key for demo progress (static mode only). */
const PROGRESS_KEY = 'anti-duo:progress'

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error ?? `${res.status} ${res.statusText}`)
  }
  return res.json() as Promise<T>
}

export function fetchContent(): Promise<Content> {
  // Static: the pre-built payload is served as a plain asset under the site's base path.
  if (STATIC) return fetch(`${import.meta.env.BASE_URL}content.json`).then((r) => json<Content>(r))
  return fetch('/api/content').then((r) => json<Content>(r))
}

export function fetchProgress(): Promise<Progress> {
  if (STATIC) return Promise.resolve(readLocalProgress())
  return fetch('/api/progress').then((r) => json<Progress>(r))
}

export function saveProgress(progress: Progress): Promise<Progress> {
  if (STATIC) return Promise.resolve(writeLocalProgress(progress))
  return fetch('/api/progress', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(progress),
  }).then((r) => json<Progress>(r))
}

/** Read demo progress from localStorage, normalized to a valid shape (missing/corrupt → defaults). */
function readLocalProgress(): Progress {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY)
    return normalizeProgress(raw ? (JSON.parse(raw) as Progress) : null)
  } catch {
    return normalizeProgress(null)
  }
}

/** Persist demo progress to localStorage; returns the normalized value the server would have returned. */
function writeLocalProgress(progress: Progress): Progress {
  const normalized = normalizeProgress(progress)
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(normalized))
  return normalized
}
