import type { TaskType } from '@lib/tasks'
import type { TaskUI } from '../../components/tasks/types'
import type { LanguagePack } from '../types'
import { ui } from './ui'
import { arTypeWordTask } from './TypeWordTask'
import { ArabicChart } from './ArabicChart'
import { rootSpans } from './roots'
import { stripHarakat } from './normalize'
import { arColors } from '../../theme'

/**
 * The tasks Arabic offers. Recognition + production over roots and their words: no `draw` (kanji
 * recognizer only) and no single-char `cloze` (a root's letters aren't contiguous in the surface) —
 * `root-cloze` replaces it. `plural` (broken plurals) and `root-cloze` are opt-in, so listing them
 * here is what turns them on.
 */
const tasks: TaskType[] = ['which-words', 'root-cloze', 'pick-reading', 'pick-meaning', 'type-word', 'plural']

/** Arabic pack — root-and-pattern vocabulary, right-to-left. */
export const ar: LanguagePack = {
  id: 'ar',
  label: { native: 'العربية', en: 'Arabic' },
  direction: 'rtl',
  palette: arColors,
  ttsLang: 'ar-SA',
  toReading: (raw) => stripHarakat(raw), // grading is lenient about short vowels
  inputHint: 'اكتب بالعربية',
  tasks,
  // Hold the "?" in the top bar for the alphabet + vowel-mark reference.
  reference: { title: { native: 'الحروف والحركات', en: 'Alphabet & vowels' }, Chart: ArabicChart },
  // AR type-word is production (meaning → word); its pack view overrides the built-in reading-recall one.
  taskUIs: { 'type-word': arTypeWordTask as unknown as TaskUI },
  // Highlight the root letters inside a word (in Learn, and on reveal in tasks).
  rootSpans,
  // Show a root as its letters divided by dots: "ك ت ب" → "ك · ت · ب".
  displayForm: (form) => form.trim().split(/\s+/).join(' · '),
  ui,
}
