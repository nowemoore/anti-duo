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
  learn: { native: '学ぶ', en: 'Learn' },
  practice: { native: '練習', en: 'Practice' },
  notNow: { native: 'あとで', en: 'Not now' },
  statsTitle: { native: '統計', en: 'Stats' },
  summaryTitle: { native: '進捗概要', en: 'Progress overview' },
  learnHeader: (step, total) => ({ native: `新しい漢字 ${step} / ${total}`, en: `New kanji ${step} / ${total}` }),
  questionHeader: (step, total) => ({ native: `問題 ${step} / ${total}`, en: `Question ${step} / ${total}` }),
  manual: {
    tasks: [
      {
        title: 'Type the reading',
        desc: "You're shown a word — type its reading in kana. Type romaji and it converts as you go. After you answer, the 🔊 reads it and the meaning appears.",
      },
      {
        title: 'Which words are real',
        desc: 'You see one kanji and four words; select those that use it correctly. After answering, the real words turn green — hold one for its reading & meaning.',
      },
      {
        title: 'Fill in the blank',
        desc: 'A sentence is missing one kanji (its reading stays above the blank). Pick the kanji that belongs there.',
      },
      {
        title: 'Pick the reading',
        desc: 'One word in a sentence is highlighted — choose its correct reading. Tap the 🔊 on each option to hear it.',
      },
      {
        title: 'Pick the meaning',
        desc: "One kanji in a sentence is highlighted — choose the kanji's meaning.",
      },
      {
        title: 'Draw the word',
        desc: "You're given a word's reading — write it on the canvas with your finger, then lock in your answer. Your strokes are recognized on-device (Undo/Clear, or No clue to give up). Only offered once you've learned every kanji in the word, and you also write each new set right after learning it.",
      },
    ],
    points: [
      'Pick your kanji. In Settings → Your learning, switch whole categories on/off, or expand one to toggle individual kanji.',
      'Tune the mix. In Settings → Practice mix, drag a slider to change how often each question type appears (0 = off).',
      'Set your name. In Settings → Profile, so the home screen greets you.',
      'Hiragana chart. Hold the ? in the top-right any time for a kana reference (release to hide).',
      'Start over. Use reset progress on the Study home to clear your unlocked kanji and levels (name + selection are kept).',
    ],
  },
}
