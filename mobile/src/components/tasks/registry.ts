import type { LanguagePack } from '../../lang/types'
import type { TaskUI } from './types'
import { typeWordTask } from './TypeWordTask'
import { whichWordsTask } from './WhichWordsTask'
import { choiceTask } from './ChoiceTask'
import { pluralTask } from './PluralTask'
import { kanaTask } from './KanaTask'

/** Built-in task UIs, keyed by task kind. Draw + any language-specific tasks come from the pack. */
const BUILTIN: Record<string, TaskUI> = {
  'type-word': typeWordTask as unknown as TaskUI,
  'which-words': whichWordsTask as unknown as TaskUI,
  cloze: choiceTask as unknown as TaskUI,
  'root-cloze': choiceTask as unknown as TaskUI, // same view as cloze; blanks the whole word
  'pick-reading': choiceTask as unknown as TaskUI,
  'pick-meaning': choiceTask as unknown as TaskUI,
  plural: pluralTask as unknown as TaskUI, // opt-in, data-driven; dormant until a language has plural data
  // The kana-word questions. Built in rather than pack-contributed: they're keyed off a kana word,
  // which is a shape shared/types knows about, not a Japanese-only view concern.
  'kana-spell': kanaTask as unknown as TaskUI,
  'kana-meaning': kanaTask as unknown as TaskUI,
  'kana-cloze': kanaTask as unknown as TaskUI,
}

/**
 * The TaskUI for a kind. A language pack's own task modules win over the built-ins, so a pack can both
 * add tasks (draw) and override a built-in's presentation for its script (Arabic's type-word shows the
 * meaning as the prompt instead of the written form).
 */
export function getTaskUI(kind: string, pack: LanguagePack): TaskUI | undefined {
  return pack.taskUIs?.[kind] ?? BUILTIN[kind]
}
