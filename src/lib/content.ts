import type { Content, Kanji, Sentence } from '../../shared/types'

/** A topical category with the kanji it contains (idx-ordered). */
export interface Category {
  name: string
  kanji: Kanji[]
}

/** Client-side indexes over the content payload, mirroring the server's. */
export interface ContentIndex {
  content: Content
  byIdx: Map<number, Kanji>
  byChar: Map<string, Kanji>
  /** kanji idx -> sentences containing it. */
  sentencesForKanji: Map<number, Sentence[]>
  /** Categories ordered by their first (lowest) kanji idx. */
  categories: Category[]
}

export function buildContentIndex(content: Content): ContentIndex {
  const byIdx = new Map<number, Kanji>()
  const byChar = new Map<string, Kanji>()
  for (const k of content.kanji) {
    byIdx.set(k.idx, k)
    byChar.set(k.char, k)
  }
  const sentencesForKanji = new Map<number, Sentence[]>()
  for (const s of content.sentences) {
    for (const idx of s.kanjiList) {
      const list = sentencesForKanji.get(idx)
      if (list) list.push(s)
      else sentencesForKanji.set(idx, [s])
    }
  }

  // Group kanji by category (content is idx-sorted, so each group stays idx-ordered),
  // then order categories by their lowest idx.
  const grouped = new Map<string, Kanji[]>()
  for (const k of content.kanji) {
    const list = grouped.get(k.category)
    if (list) list.push(k)
    else grouped.set(k.category, [k])
  }
  const categories: Category[] = [...grouped.entries()]
    .map(([name, kanji]) => ({ name, kanji }))
    .sort((a, b) => a.kanji[0].idx - b.kanji[0].idx)

  return { content, byIdx, byChar, sentencesForKanji, categories }
}
