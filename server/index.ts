import express from 'express'
import { getContent, validateContent } from './content'
import { FileStorage, type Storage } from './storage'

const app = express()
const PORT = Number(process.env.PORT ?? 3001)

const storage: Storage = new FileStorage()

app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

// User progress (read/write).
app.get('/api/progress', async (_req, res) => {
  try {
    res.json(await storage.getProgress())
  } catch (e) {
    res.status(500).json({ error: (e as Error).message })
  }
})

app.put('/api/progress', async (req, res) => {
  try {
    if (typeof req.body !== 'object' || req.body == null) {
      res.status(400).json({ error: 'Body must be a Progress object' })
      return
    }
    res.json(await storage.saveProgress(req.body))
  } catch (e) {
    res.status(500).json({ error: (e as Error).message })
  }
})

// Read-only content: parsed kanji + sentences.
app.get('/api/content', async (_req, res) => {
  try {
    const { kanji, sentences, kanjiMeanings, kanjiRadicals, kanjiComponents } = await getContent()
    res.json({ kanji, sentences, kanjiMeanings, kanjiRadicals, kanjiComponents })
  } catch (e) {
    res.status(500).json({ error: (e as Error).message })
  }
})

async function start() {
  // Load + validate content at startup so failures surface immediately.
  const store = await getContent()
  const report = validateContent(store)
  console.log(
    `[content] ${report.kanjiCount} kanji, ${report.sentenceCount} sentences loaded`,
  )
  if (report.kanjiWithoutSentences.length) {
    console.warn(
      `[content] ${report.kanjiWithoutSentences.length} kanji have no sentences:`,
      report.kanjiWithoutSentences.join(', '),
    )
  }
  for (const w of report.warnings) console.warn(`[content] ${w}`)

  app.listen(PORT, () => {
    console.log(`[server] listening on http://localhost:${PORT}`)
  })
}

start().catch((e) => {
  console.error('[server] failed to start:', e)
  process.exit(1)
})
