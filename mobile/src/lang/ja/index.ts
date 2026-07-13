import { toKana } from 'wanakana'
import { ALL_TASK_TYPES } from '@lib/tasks'
import { HiraganaTable } from './HiraganaTable'
import { drawable } from './handwriting'
import { DrawReview } from './DrawReview'
import { drawTask } from './DrawTask'
import type { TaskUI } from '../../components/tasks/types'
import { Furigana } from './Furigana'
import { Breakdown, hasBreakdown } from './Breakdown'
import { ui } from './ui'
import type { LanguagePack } from '../types'

/** Japanese pack — the reference implementation. */
export const ja: LanguagePack = {
  id: 'ja',
  label: { native: '日本語', en: 'Japanese' },
  direction: 'ltr',
  ttsLang: 'ja-JP',
  toReading: (raw) => toKana(raw), // commit: a trailing held "n" resolves to ん for grading
  toReadingLive: (raw) => toKana(raw, { IMEMode: true }), // as-you-type: buffer "n" (kana → かな)
  inputHint: 'かな / romaji',
  tasks: ALL_TASK_TYPES,
  reference: { title: { native: 'ひらがな', en: 'Hiragana' }, Chart: HiraganaTable },
  draw: {
    isDrawable: drawable,
    Review: DrawReview,
  },
  taskUIs: { draw: drawTask as unknown as TaskUI },
  Ruby: Furigana, // JA: reading stacked over the word (furigana)
  charGloss: (content, char) => content.kanjiMeanings[char],
  detail: { has: hasBreakdown, View: Breakdown }, // JA: the radical + components breakdown
  ui,
}
