import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { defaultProgress } from '../shared/constants'
import { normalizeProgress } from '../shared/progress'
import type { Progress } from '../shared/types'

/** Persistence boundary for user progress. Swap the implementation (file → DB) without UI changes. */
export interface Storage {
  getProgress(): Promise<Progress>
  saveProgress(progress: Progress): Promise<Progress>
}

const DATA_DIR = new URL('../data/', import.meta.url)
const FILE = new URL('progress.json', DATA_DIR)
const TMP = new URL('progress.json.tmp', DATA_DIR)

/** Stores progress as data/progress.json with an atomic temp-file + rename write. */
export class FileStorage implements Storage {
  /** Serialize writes so concurrent saves can't interleave. */
  private queue: Promise<unknown> = Promise.resolve()

  async getProgress(): Promise<Progress> {
    try {
      const text = await readFile(FILE, 'utf8')
      return normalizeProgress(JSON.parse(text) as Progress)
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
        // First run: create the file with defaults.
        return this.saveProgress(defaultProgress())
      }
      throw e
    }
  }

  async saveProgress(progress: Progress): Promise<Progress> {
    const normalized = normalizeProgress(progress)
    this.queue = this.queue.then(() => writeAtomic(normalized))
    await this.queue
    return normalized
  }
}

async function writeAtomic(progress: Progress): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true })
  await writeFile(TMP, JSON.stringify(progress, null, 2), 'utf8')
  await rename(TMP, FILE)
}
