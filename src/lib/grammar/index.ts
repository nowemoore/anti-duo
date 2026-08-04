// Grammar topic registry. A second topic is added by writing one module under ./topics (an item
// bank + explanation, no component logic) and listing it here — the UI reads everything from data.
import { politeNonPast } from './topics/politeNonPast'
import type { GrammarTopic } from './types'

/** All grammar topics, in teaching order, keyed by content language. */
export const GRAMMAR_TOPICS: Record<string, GrammarTopic[]> = {
  ja: [politeNonPast],
}

export function topicsForLang(lang: string): GrammarTopic[] {
  return GRAMMAR_TOPICS[lang] ?? []
}

export function findTopic(lang: string, id: string): GrammarTopic | undefined {
  return topicsForLang(lang).find((t) => t.id === id)
}

export * from './engine'
export * from './types'
export * from './verbBank'
