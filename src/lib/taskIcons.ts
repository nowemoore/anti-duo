import type { IconName } from '@fortawesome/fontawesome-svg-core'
import type { AnyTaskType } from './stats'

/**
 * The icon that stands for a task type, for lists that name tasks without room for a full label —
 * the Practice mix sliders in Settings and the per-task rates in Stats. Same glyph in both, and the
 * same one the phone uses, so a task looks like itself wherever it's mentioned.
 */
const ICONS: Partial<Record<AnyTaskType, IconName>> = {
  'type-word': 'keyboard',
  'which-words': 'list-check',
  cloze: 'puzzle-piece',
  'root-cloze': 'puzzle-piece',
  'pick-reading': 'comment',
  'pick-meaning': 'bullseye',
  draw: 'pen',
  plural: 'layer-group',
  // The kana roster. Spelling gets the keyboard (it is a production question in disguise), and the
  // two sentence questions borrow the glyphs their kanji counterparts use.
  'kana-spell': 'keyboard',
  'kana-meaning': 'bullseye',
  'kana-cloze': 'puzzle-piece',
}

export function taskIcon(kind: AnyTaskType): IconName | undefined {
  return ICONS[kind]
}
