// The kana question roster, on its own so both the generators and the stats ledger can name it
// without importing each other — kanaTasks.ts reaches into stats.ts for the word-streak writer, so
// stats.ts must not reach back.

/** Question kinds whose target is a kana word. Deliberately not `TaskType`: never asked of a kanji. */
export type KanaTaskType = 'kana-spell' | 'kana-meaning' | 'kana-cloze'

export const KANA_TASK_TYPES: KanaTaskType[] = ['kana-spell', 'kana-meaning', 'kana-cloze']

/** How many options each kana question offers. */
export const KANA_TASK_OPTIONS = 4

/** Appearance weight and label per kind, mirroring TASK_TUNING for the kanji roster. */
export const KANA_TASK_TUNING: Record<KanaTaskType, { weight: number; label: string }> = {
  'kana-spell': { weight: 1, label: 'Pick the spelling' },
  'kana-meaning': { weight: 1, label: 'Pick the meaning (kana)' },
  'kana-cloze': { weight: 1, label: 'Fill in the kana word' },
}
