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
  browseEntry: { native: 'تصفّح الجذور', en: 'Browse roots' },
  todayHeader: { native: 'ماذا اليوم؟', en: "What's on today?" },
  vocabSection: { native: 'المفردات', en: 'Vocab' },
  grammarSection: { native: 'القواعد', en: 'Grammar' },
  learn: { native: 'تعلّم', en: 'Learn' },
  practice: { native: 'تدرّب', en: 'Practice' },
  notNow: { native: 'لاحقاً', en: 'Not now' },
  statsTitle: { native: 'الإحصائيات', en: 'Stats' },
  summaryTitle: { native: 'ملخّص التقدّم', en: 'Progress overview' },
  learnHeader: (step, total) => ({ native: `جذر جديد ${step}/${total}`, en: `New root ${step}/${total}` }),
  questionHeader: (step, total) => ({ native: `سؤال ${step}/${total}`, en: `Question ${step}/${total}` }),
}
