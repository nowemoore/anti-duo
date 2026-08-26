import type { IconName } from '@fortawesome/fontawesome-svg-core'
import type { TaskType } from './tasks'

/**
 * The icon that stands for a task type, for lists that name tasks without room for a full label —
 * the Practice mix sliders in Settings and the per-task rates in Stats. Same glyph in both, and the
 * same one the phone uses, so a task looks like itself wherever it's mentioned.
 */
const ICONS: Partial<Record<TaskType, IconName>> = {
  'type-word': 'keyboard',
  'which-words': 'list-check',
  cloze: 'puzzle-piece',
  'root-cloze': 'puzzle-piece',
  'pick-reading': 'comment',
  'pick-meaning': 'bullseye',
  draw: 'pen',
  plural: 'layer-group',
}

export function taskIcon(kind: TaskType): IconName | undefined {
  return ICONS[kind]
}
