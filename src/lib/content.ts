import type { Content, Unit, Sentence } from '../../shared/types'
import { getLangEngine, type LangEngine } from './lang'

/** A topical category with the units it contains (idx-ordered). */
export interface Category {
  name: string
  units: Unit[]
}

/** Client-side indexes over the content payload, mirroring the server's. */
export interface ContentIndex {
  content: Content
  byIdx: Map<number, Unit>
  byForm: Map<string, Unit>
  /** unit idx -> sentences containing it. */
  sentencesForUnit: Map<number, Sentence[]>
  /** Categories ordered by their first (lowest) unit idx. */
  categories: Category[]
  /** Engine-tier language logic (okurigana distractors, native-script test) for this content. */
  lang: LangEngine
}

export function buildContentIndex(content: Content): ContentIndex {
  const byIdx = new Map<number, Unit>()
  const byForm = new Map<string, Unit>()
  for (const k of content.units) {
    byIdx.set(k.idx, k)
    byForm.set(k.form, k)
  }
  const sentencesForUnit = new Map<number, Sentence[]>()
  for (const s of content.sentences) {
    for (const idx of s.unitList) {
      const list = sentencesForUnit.get(idx)
      if (list) list.push(s)
      else sentencesForUnit.set(idx, [s])
    }
  }

  // Group units by category (content is idx-sorted, so each group stays idx-ordered),
  // then order categories by their lowest idx.
  const grouped = new Map<string, Unit[]>()
  for (const k of content.units) {
    const list = grouped.get(k.category)
    if (list) list.push(k)
    else grouped.set(k.category, [k])
  }
  const categories: Category[] = [...grouped.entries()]
    .map(([name, units]) => ({ name, units }))
    .sort((a, b) => a.units[0].idx - b.units[0].idx)

  return { content, byIdx, byForm, sentencesForUnit, categories, lang: getLangEngine(content.lang) }
}
