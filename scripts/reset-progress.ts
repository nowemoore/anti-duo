// Wipes saved user progress — `npm run reset`. The app recreates defaults on next run.
import { rm } from 'node:fs/promises'

const FILE = new URL('../data/progress.json', import.meta.url)

async function main() {
  try {
    await rm(FILE)
    console.log('Progress reset (data/progress.json removed).')
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
      console.log('No progress file to remove — already clean.')
    } else {
      throw e
    }
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
