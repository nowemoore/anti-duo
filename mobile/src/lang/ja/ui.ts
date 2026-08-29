import type { UiStrings } from '../types'

/** Japanese shell copy (native Japanese + English). */
export const ui: UiStrings = {
  noun: 'kanji',
  greeting: (name, hasRecord) =>
    name
      ? { native: `おかえりなさい、${name}`, en: 'Welcome back' }
      : hasRecord
        ? { native: 'おかえりなさい', en: 'Welcome back' }
        : { native: 'はじめまして', en: 'Welcome' },
  learnEntry: { native: '漢字を学ぶ', en: 'Learn kanji' },
  grammarEntry: { native: '文法を学ぶ', en: 'Learn grammar' },
  kanaEntry: { native: 'かなを学ぶ', en: 'Learn kana' },
  browseEntry: { native: '漢字を見る', en: 'Browse kanji' },
  todayHeader: { native: '今日は何を？', en: "What's on today?" },
  kanaSection: { native: 'かな', en: 'Kana' },
  vocabSection: { native: '単語', en: 'Vocab' },
  grammarSection: { native: '文法', en: 'Grammar' },
  learn: { native: '学ぶ', en: 'Learn' },
  practice: { native: '練習', en: 'Practice' },
  notNow: { native: 'あとで', en: 'Not now' },
  statsTitle: { native: '統計', en: 'Stats' },
  summaryTitle: { native: '進捗概要', en: 'Progress overview' },
  learnHeader: (step, total) => ({ native: `新しい漢字 ${step}/${total}`, en: `New kanji ${step}/${total}` }),
  questionHeader: (step, total) => ({ native: `問題 ${step}/${total}`, en: `Question ${step}/${total}` }),
}
