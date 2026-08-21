import type { IconName } from '@fortawesome/fontawesome-svg-core'

/**
 * A glyph per curriculum category, so the settings list can be scanned by shape rather than read
 * line by line.
 *
 * Keyed by the category name as it appears in the content CSV. Names are content, not code, so a
 * renamed or newly added category simply falls back to {@link DEFAULT_CATEGORY_ICON} rather than
 * breaking — worth remembering if a category ever looks generic here.
 */
const CATEGORY_ICONS: Record<string, IconName> = {
  // Japanese
  Numbers: 'hashtag',
  Time: 'clock',
  Nature: 'leaf',
  Shopping: 'cart-shopping',
  'Humans & Family': 'users',
  Transport: 'train',
  Descriptives: 'palette',
  City: 'city',
  Actions: 'person-running',
  Learning: 'graduation-cap',
  Dining: 'utensils',
  'Function Words': 'link',
  Directions: 'compass',
  Body: 'hand',
  // Arabic
  'Core roots': 'seedling',
}

export const DEFAULT_CATEGORY_ICON: IconName = 'layer-group'

export function categoryIcon(name: string): IconName {
  return CATEGORY_ICONS[name] ?? DEFAULT_CATEGORY_ICON
}
