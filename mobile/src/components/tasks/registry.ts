import type { LanguagePack } from '../../lang/types'
import type { TaskUI } from './types'
import { typeWordTask } from './TypeWordTask'
import { whichWordsTask } from './WhichWordsTask'
import { choiceTask } from './ChoiceTask'
import { pluralTask } from './PluralTask'

/** Built-in task UIs, keyed by task kind. Draw + any language-specific tasks come from the pack. */
const BUILTIN: Record<string, TaskUI> = {
  'type-word': typeWordTask as unknown as TaskUI,
  'which-words': whichWordsTask as unknown as TaskUI,
  cloze: choiceTask as unknown as TaskUI,
  'pick-reading': choiceTask as unknown as TaskUI,
  'pick-meaning': choiceTask as unknown as TaskUI,
  plural: pluralTask as unknown as TaskUI, // opt-in, data-driven; dormant until a language has plural data
}

/** The TaskUI for a kind — a built-in, or one the active language pack contributes (draw, plural…). */
export function getTaskUI(kind: string, pack: LanguagePack): TaskUI | undefined {
  return BUILTIN[kind] ?? pack.taskUIs?.[kind]
}
