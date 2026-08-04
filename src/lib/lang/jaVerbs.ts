// Japanese verb conjugation, driven by the part-of-speech tags authored in dbs/ja_kanji.csv.
//
// Lives in lang/ rather than grammar/ because this is language knowledge, not exercise logic — the
// past (〜ました), te-form and negative will all read the same class off the same tags.
//
// Everything here works on the kana READING, never the written form: a verb's ending is okurigana,
// so 食べる/たべる conjugate identically, and the exercise's answer options are kana.
//
// Pure TS (no React) — vendored into the mobile app by mobile/scripts/sync-shared.js.
import type { Word } from '../../../shared/types'

/** Conjugation class, matching the tag strings used in the content db. */
export type VerbClass = 'u-verb' | 'ru-verb' | 'irregular-verb'

const CLASSES: VerbClass[] = ['u-verb', 'ru-verb', 'irregular-verb']

/**
 * う-row kana → its い-row partner. This shift *is* the u-verb rule: 飲む→飲み, 書く→書き, 帰る→帰り.
 * A verb whose final kana isn't here can't be conjugated as a u-verb.
 */
const I_ROW: Record<string, string> = {
  う: 'い',
  つ: 'ち',
  る: 'り',
  む: 'み',
  ぶ: 'び',
  ぬ: 'に',
  く: 'き',
  ぐ: 'ぎ',
  す: 'し',
}

/** The two genuine irregulars, keyed by reading. Neither is used by the 〜ます exercise. */
const IRREGULAR: Record<string, string> = { する: 'し', くる: 'き' }

/** The verb class from a content word's tags, or null when it carries none (i.e. isn't a verb). */
export function verbClassOf(word: Word): VerbClass | null {
  return CLASSES.find((c) => word.tags?.includes(c)) ?? null
}

/**
 * The ます-stem: the part that survives before ます.
 *   ru-verb  たべる → たべ   (drop る)
 *   u-verb   のむ  → のみ   (final kana shifts to its い-row partner)
 *   irregular くる  → き
 * Returns null rather than guessing when the reading doesn't fit its class, so bad data drops the
 * item instead of teaching a wrong form.
 */
function stem(reading: string, cls: VerbClass): string | null {
  if (cls === 'irregular-verb') {
    const key = Object.keys(IRREGULAR).find((k) => reading.endsWith(k))
    return key ? reading.slice(0, -key.length) + IRREGULAR[key] : null
  }
  const last = reading.slice(-1)
  if (cls === 'ru-verb') return last === 'る' ? reading.slice(0, -1) : null
  const shifted = I_ROW[last]
  return shifted ? reading.slice(0, -1) + shifted : null
}

/** Polite non-past. たべる→たべます, のむ→のみます, かえる→かえります, くる→きます. */
export function politeNonPast(reading: string, cls: VerbClass): string | null {
  const s = stem(reading, cls)
  return s === null ? null : `${s}ます`
}

/**
 * How a wrong answer is wrong:
 *   'cross' — conjugate as if it belonged to the OTHER class. たべる→たべります, のむ→のます.
 *             This is the pattern that forces the learner to know the class.
 *   'bolt'  — bolt ます onto the dictionary form. かく→かくます.
 *             Answerable without knowing the class, so it never spoils the る-ending trap.
 */
export type WrongPattern = 'cross' | 'bolt'

/** A plausible-but-wrong polite form. Never equal to {@link politeNonPast} for well-formed input. */
export function wrongPoliteNonPast(
  reading: string,
  cls: VerbClass,
  pattern: WrongPattern,
): string | null {
  if (pattern === 'bolt') return `${reading}ます`
  // 'cross': the mistake of misfiling the verb in the other class.
  //   a u-verb treated as a ru-verb — drop the final mora whatever it is: のむ→のます, かえる→かえます
  //   a ru-verb treated as a u-verb — shift the final る to り:            たべる→たべります
  // Note the u-verb case can't reuse `stem(…, 'ru-verb')`: that one correctly insists on a final る,
  // whereas the mistake being modelled is exactly the learner not checking. Irregulars have no
  // meaningful opposite class.
  if (cls === 'irregular-verb') return null
  const wrongStem = cls === 'u-verb' ? reading.slice(0, -1) : stem(reading, 'u-verb')
  if (!wrongStem) return null
  const wrong = `${wrongStem}ます`
  return wrong === politeNonPast(reading, cls) ? null : wrong
}

/**
 * A u-verb whose dictionary form ends in る — 帰る, 入る, 走る, 切る, 売る, 知る, 作る…
 * Indistinguishable from a ru-verb by sight, which is the whole difficulty of the 〜ます form.
 */
export function isDeceptive(reading: string, cls: VerbClass): boolean {
  return cls === 'u-verb' && reading.endsWith('る')
}
