import { Alert, Text, StyleSheet } from 'react-native'
import type { IconName } from '@fortawesome/fontawesome-svg-core'
import type { DrillFormat, WordFormat } from '@lib/kana'
import type { AnyTaskType } from '@lib/stats'
import { Icon } from './Icon'
import { TapScale } from './TapScale'
import { fonts, radius, spacing, type Palette } from '../theme'
import { useColors, useStyles } from '../hooks/theme'

/**
 * What each task is called on its card, and what tapping the chip explains.
 *
 * **This is the one place to edit the wording.** `label` is the chip itself — keep it to two to
 * four words, since it shares a line with the card. `blurb` is the popup, one or two sentences
 * saying how the task works and what counts as answering it.
 *
 * Keyed by every {@link AnyTaskType} — the kanji roster including the two only Arabic offers, plus
 * the three kana-word questions — so a language turning one on can't land an unlabelled card. Wording is close to `TASK_LABELS` (the Practice mix sliders in
 * Settings) on purpose: the chip and the control that tunes how often you see it should read as the
 * same thing.
 */
const TASKS: Record<AnyTaskType, { icon: IconName; label: string; blurb: string }> = {
  'type-word': {
    icon: 'keyboard',
    label: 'Type reading in kana',
    blurb:
      'A word is shown in kanji and you type how its reading, in kana. Spelling has to match exactly, no mercy for mismatch in long vowels, accents, or small kana!',
  },
  'which-words': {
    icon: 'list-check',
    label: 'Spot all real words',
    blurb:
      'Some of these words exist and some were invented for the question. Find all real ones for full points. Partially correct answers still earn something though.',
  },
  cloze: {
    icon: 'puzzle-piece',
    label: 'Fill in the blank',
    blurb:
      'A sentence is missing one word. Choose the word that belongs in the gap.',
  },
  'root-cloze': {
    icon: 'puzzle-piece',
    label: 'Fill in the root',
    blurb:
      'A word is shown with its root letters removed. Choose the root that fills the gaps and makes the word.',
  },
  'pick-reading': {
    icon: 'comment',
    label: 'Pick the reading',
    blurb:
      "Choose how the word on the card is pronounced. The wrong options are readings of other words you may have seen, so make sure to not let them fool you!",
  },
  'pick-meaning': {
    icon: 'bullseye',
    label: 'Pick the meaning',
    blurb: 'Choose what the word on the card means. Only one option is right.',
  },
  draw: {
    icon: 'pen',
    label: 'Handwrite the word',
    blurb:
      'Write the word by hand on the canvas. Your strokes are matched against the real character.',
  },
  plural: {
    icon: 'layer-group',
    label: 'Pick the plural',
    blurb: 'A singular noun is shown. Choose its plural form from the options.',
  },
  /*
   * The kana-word questions. Wording matches KANA_WORD_TASKS below, which asks the same three things
   * in the kana course's own drill — the same question shouldn't be described two ways depending on
   * which screen you met it on.
   */
  'kana-spell': {
    icon: 'keyboard',
    label: 'Pick the spelling',
    blurb:
      'A meaning is shown and you pick the word that spells it. The wrong options differ only in long vowels, small kana or voicing marks.',
  },
  'kana-meaning': {
    icon: 'bullseye',
    label: 'Pick the meaning',
    blurb: 'One word in the sentence is highlighted. Choose what it means.',
  },
  'kana-cloze': {
    icon: 'puzzle-piece',
    label: 'Fill in the kana word',
    blurb:
      'A sentence is missing one word written in kana. Pick the spelling that fills the gap — the sentence tells you which meaning you want.',
  },
}

/**
 * The icon that stands for a task type, for lists that name tasks without room for the full chip —
 * the Practice mix sliders in Settings and the per-task rates in Stats. Same glyph as the chip, so a
 * task looks the same wherever it's mentioned.
 */
export function taskIcon(kind: AnyTaskType): IconName | undefined {
  return TASKS[kind]?.icon
}

/**
 * The same, for the kana drill's two question shapes. Sequences share the single-character wording:
 * from the learner's side it's the same job, just more of it.
 */
const KANA_TASKS: Record<DrillFormat, { icon: IconName; label: string; blurb: string }> = {
  pick: {
    icon: 'ear-listen',
    label: 'Pick what you hear',
    blurb:
      'A sound plays and you pick the character or sequence that spells it. Tap the replay button to hear it again.',
  },
  draw: {
    icon: 'pen-nib',
    label: 'Write what you hear',
    blurb: 'Write the character from memory. Compare it to the actual answer to earn points.',
  },
}

/** The kana drill's chip. Same control as {@link TaskChip}, keyed by question shape rather than task. */
export function KanaChip({ format }: { format: DrillFormat }) {
  return <Chip {...KANA_TASKS[format]} />
}

/** The same, for kana *word* practice — reading whole words rather than single characters. */
const KANA_WORD_TASKS: Record<WordFormat, { icon: IconName; label: string; blurb: string }> = {
  spell: {
    icon: 'ear-listen',
    label: 'Pick the spelling',
    blurb:
      'A word plays and its meaning is shown. Pick the option that spells it correctly — the wrong ones differ only in long vowels, small kana or voicing marks.',
  },
  meaning: {
    icon: 'bullseye',
    label: 'Pick the meaning',
    blurb: 'A word written in kana is shown. Choose what it means.',
  },
}

export function KanaWordChip({ format }: { format: WordFormat }) {
  return <Chip {...KANA_WORD_TASKS[format]} />
}

/**
 * The small label in a practice card's top-left corner, naming the task. Tap it for the longer
 * explanation.
 *
 * The card header only ever said "Question 3 / 10", so what you were being asked had to be inferred
 * from the card's shape. This says it outright, in the same words every time.
 *
 * The explanation is `Alert.alert`, which is a real `UIAlertController` — a hand-drawn modal was
 * tried twice and read as part of the app rather than as the system telling you something. The cost
 * is the task's icon: an alert takes a title and a body and nothing else, so the glyph that
 * identifies the task everywhere else can't appear in the one place that explains it.
 */
export function TaskChip({ kind }: { kind: AnyTaskType }) {
  const task = TASKS[kind]
  if (!task) return null
  return <Chip {...task} />
}

/** The chip itself. Both maps above render through this, so the two practices look identical. */
function Chip({ icon, label, blurb }: { icon: IconName; label: string; blurb: string }) {
  const colors = useColors()
  const styles = useStyles(makeStyles)
  return (
    <TapScale
      style={styles.chip}
      onPress={() => Alert.alert(label, blurb, [{ text: 'Got it', style: 'cancel' }])}
      accessibilityRole="button"
      accessibilityLabel={`${label}. How this task works`}
      hitSlop={8}
    >
      <Icon name={icon} size={10} color={colors.readyInk} />
      <Text style={styles.label}>{label}</Text>
    </TapScale>
  )
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  chip: {
    // Centred: the chip names the card it heads, and a card whose content is centred reads oddly
    // with its own label pinned to one corner.
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.readySoft,
    // Its own gap: the chip is always a card header, so the task below shouldn't have to allow for it.
    marginBottom: spacing.sm,
  },
  label: { color: colors.readyInk, fontFamily: fonts.medium, fontSize: 11 },
})
