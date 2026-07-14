import type { UiStrings } from '../types'

/** Arabic shell copy (native Arabic + English). */
export const ui: UiStrings = {
  noun: 'root',
  greeting: (name, hasRecord) =>
    name
      ? { native: `مرحباً بعودتك، ${name}`, en: 'Welcome back' }
      : hasRecord
        ? { native: 'مرحباً بعودتك', en: 'Welcome back' }
        : { native: 'أهلاً وسهلاً', en: 'Welcome' },
  learnEntry: { native: 'تعلّم الجذور', en: 'Learn roots' },
  grammarEntry: { native: 'تعلّم القواعد', en: 'Learn grammar' },
  learn: { native: 'تعلّم', en: 'Learn' },
  practice: { native: 'تدرّب', en: 'Practice' },
  notNow: { native: 'لاحقاً', en: 'Not now' },
  statsTitle: { native: 'الإحصائيات', en: 'Stats' },
  summaryTitle: { native: 'ملخّص التقدّم', en: 'Progress overview' },
  learnHeader: (step, total) => ({ native: `جذر جديد ${step} / ${total}`, en: `New root ${step} / ${total}` }),
  questionHeader: (step, total) => ({ native: `سؤال ${step} / ${total}`, en: `Question ${step} / ${total}` }),
  manual: {
    tasks: [
      {
        title: 'Type the word',
        desc: "You're shown a meaning — type the Arabic word for it. Short vowels (harakat) are optional. After you answer, the 🔊 reads it and the fully-vowelled form appears.",
      },
      {
        title: 'Which words are real',
        desc: 'You see one root and four words; select those built on it. After answering, the real words turn green — hold one for its vowelling & meaning.',
      },
      {
        title: 'Fill in the root',
        desc: 'A word is missing from the sentence. Pick the three-letter root that belongs in the gap.',
      },
      {
        title: 'Pick the reading',
        desc: 'One word in a sentence is highlighted — choose its correctly-vowelled form. Tap the 🔊 on each option to hear it.',
      },
      {
        title: 'Pick the meaning',
        desc: 'One word in a sentence is highlighted — choose its meaning.',
      },
      {
        title: 'Pick the plural',
        desc: "You're shown a singular noun — choose its plural (Arabic plurals are often “broken”, reshaping the word rather than adding a suffix).",
      },
    ],
    points: [
      'Pick your roots. In Settings → Your learning, switch whole categories on/off, or expand one to toggle individual roots.',
      'Tune the mix. In Settings → Practice mix, drag a slider to change how often each question type appears (0 = off).',
      'Set your name. In Settings → Profile, so the home screen greets you.',
      'Alphabet & vowels. Hold the ? in the top-right any time for the Arabic letters and vowel marks (release to hide).',
      'Switch language. Use the 日本語 / العربية toggle at the top of the Study screen — each keeps its own progress.',
      'Start over. Use reset progress on the Study home to clear your unlocked roots and levels (name + selection are kept).',
    ],
  },
}
