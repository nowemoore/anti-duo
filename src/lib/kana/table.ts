// The kana inventory, as data. Single source of truth for the Learn kana course and for the
// reference chart behind the help button (web + mobile), which previously hardcoded their own
// copies and could drift apart.
//
// Pure TS (no React, no react-native) — this folder is vendored into the mobile app by
// mobile/scripts/sync-shared.js and also type-checked by the web build.

/** One character and everything needed to hear it, show it, and grade it typed. */
export interface Kana {
  /** The character itself, e.g. か. */
  char: string
  /** Canonical romaji (Hepburn), e.g. 'ka'. What the chart displays. */
  romaji: string
  /**
   * Additional spellings accepted when typed. Covers kunrei-shiki (し → 'si'), the particle を
   * ('o'), and the ぢ/づ pair whose Hepburn spelling collides with じ/ず. Never shown.
   */
  alsoAccept?: string[]
}

/** One block of the chart: a grid of characters, `null` where the grid has a gap. */
export interface ChartSection {
  id: string
  label: string
  rows: (string | null)[][]
  /** Yōon cells hold two glyphs, so they need more width. */
  wide?: boolean
}

/** A writing system the learner can study. */
export interface KanaScript {
  id: string
  title: { native: string; en: string }
  blurb: string
  sections: ChartSection[]
}

// ---------------------------------------------------------------------------
// Hiragana — the authored source
// ---------------------------------------------------------------------------

type Cell = readonly [char: string, romaji: string, alsoAccept?: string[]]

const GOJUON_CELLS: Cell[] = [
  ['あ', 'a'], ['い', 'i'], ['う', 'u'], ['え', 'e'], ['お', 'o'],
  ['か', 'ka'], ['き', 'ki'], ['く', 'ku'], ['け', 'ke'], ['こ', 'ko'],
  ['さ', 'sa'], ['し', 'shi', ['si']], ['す', 'su'], ['せ', 'se'], ['そ', 'so'],
  ['た', 'ta'], ['ち', 'chi', ['ti']], ['つ', 'tsu', ['tu']], ['て', 'te'], ['と', 'to'],
  ['な', 'na'], ['に', 'ni'], ['ぬ', 'nu'], ['ね', 'ne'], ['の', 'no'],
  ['は', 'ha'], ['ひ', 'hi'], ['ふ', 'fu', ['hu']], ['へ', 'he'], ['ほ', 'ho'],
  ['ま', 'ma'], ['み', 'mi'], ['む', 'mu'], ['め', 'me'], ['も', 'mo'],
  ['や', 'ya'], ['ゆ', 'yu'], ['よ', 'yo'],
  ['ら', 'ra'], ['り', 'ri'], ['る', 'ru'], ['れ', 're'], ['ろ', 'ro'],
  // を is only ever the object particle, and is pronounced exactly like お — see SOUND_OVERRIDES.
  ['わ', 'wa'], ['を', 'wo', ['o']], ['ん', 'n', ['nn']],
]

const DAKUTEN_CELLS: Cell[] = [
  ['が', 'ga'], ['ぎ', 'gi'], ['ぐ', 'gu'], ['げ', 'ge'], ['ご', 'go'],
  ['ざ', 'za'], ['じ', 'ji', ['zi']], ['ず', 'zu'], ['ぜ', 'ze'], ['ぞ', 'zo'],
  // ぢ/づ duplicate じ/ず in sound. Kept because they occur (鼻血, 続く) but marked as homophones.
  ['だ', 'da'], ['ぢ', 'ji', ['di', 'dji']], ['づ', 'zu', ['du', 'dzu']], ['で', 'de'], ['ど', 'do'],
  ['ば', 'ba'], ['び', 'bi'], ['ぶ', 'bu'], ['べ', 'be'], ['ぼ', 'bo'],
  ['ぱ', 'pa'], ['ぴ', 'pi'], ['ぷ', 'pu'], ['ぺ', 'pe'], ['ぽ', 'po'],
]

const YOON_CELLS: Cell[] = [
  ['きゃ', 'kya'], ['きゅ', 'kyu'], ['きょ', 'kyo'],
  ['しゃ', 'sha', ['sya']], ['しゅ', 'shu', ['syu']], ['しょ', 'sho', ['syo']],
  ['ちゃ', 'cha', ['tya']], ['ちゅ', 'chu', ['tyu']], ['ちょ', 'cho', ['tyo']],
  ['にゃ', 'nya'], ['にゅ', 'nyu'], ['にょ', 'nyo'],
  ['ひゃ', 'hya'], ['ひゅ', 'hyu'], ['ひょ', 'hyo'],
  ['みゃ', 'mya'], ['みゅ', 'myu'], ['みょ', 'myo'],
  ['りゃ', 'rya'], ['りゅ', 'ryu'], ['りょ', 'ryo'],
  ['ぎゃ', 'gya'], ['ぎゅ', 'gyu'], ['ぎょ', 'gyo'],
  ['じゃ', 'ja', ['jya', 'zya']], ['じゅ', 'ju', ['jyu', 'zyu']], ['じょ', 'jo', ['jyo', 'zyo']],
  ['びゃ', 'bya'], ['びゅ', 'byu'], ['びょ', 'byo'],
  ['ぴゃ', 'pya'], ['ぴゅ', 'pyu'], ['ぴょ', 'pyo'],
]

function toKana(cells: Cell[]): Kana[] {
  return cells.map(([char, romaji, alsoAccept]) => ({
    char,
    romaji,
    ...(alsoAccept ? { alsoAccept } : {}),
  }))
}

// ---------------------------------------------------------------------------
// Chart layout
// ---------------------------------------------------------------------------

/**
 * The canonical grid arrangement, characters only — `null` is a gap (や has no i/e column). Romaji
 * is not repeated here; the chart looks it up with {@link kanaOf}, so exactly one place in the
 * codebase says し is "shi".
 */
const CHART_GOJUON: (string | null)[][] = [
  ['あ', 'い', 'う', 'え', 'お'],
  ['か', 'き', 'く', 'け', 'こ'],
  ['さ', 'し', 'す', 'せ', 'そ'],
  ['た', 'ち', 'つ', 'て', 'と'],
  ['な', 'に', 'ぬ', 'ね', 'の'],
  ['は', 'ひ', 'ふ', 'へ', 'ほ'],
  ['ま', 'み', 'む', 'め', 'も'],
  ['や', null, 'ゆ', null, 'よ'],
  ['ら', 'り', 'る', 'れ', 'ろ'],
  ['わ', null, null, null, 'を'],
  ['ん', null, null, null, null],
]

const CHART_DAKUTEN: (string | null)[][] = [
  ['が', 'ぎ', 'ぐ', 'げ', 'ご'],
  ['ざ', 'じ', 'ず', 'ぜ', 'ぞ'],
  ['だ', 'ぢ', 'づ', 'で', 'ど'],
  ['ば', 'び', 'ぶ', 'べ', 'ぼ'],
  ['ぱ', 'ぴ', 'ぷ', 'ぺ', 'ぽ'],
]

const CHART_YOON: (string | null)[][] = [
  ['きゃ', 'きゅ', 'きょ'],
  ['しゃ', 'しゅ', 'しょ'],
  ['ちゃ', 'ちゅ', 'ちょ'],
  ['にゃ', 'にゅ', 'にょ'],
  ['ひゃ', 'ひゅ', 'ひょ'],
  ['みゃ', 'みゅ', 'みょ'],
  ['りゃ', 'りゅ', 'りょ'],
  ['ぎゃ', 'ぎゅ', 'ぎょ'],
  ['じゃ', 'じゅ', 'じょ'],
  ['びゃ', 'びゅ', 'びょ'],
  ['ぴゃ', 'ぴゅ', 'ぴょ'],
]

// ---------------------------------------------------------------------------
// Katakana — derived, not authored
// ---------------------------------------------------------------------------

/**
 * Hiragana and katakana occupy parallel Unicode blocks offset by exactly 0x60 (あ U+3042 →
 * ア U+30A2) across the whole range this table uses, small ゃゅょ included. Deriving katakana rather
 * than typing it out keeps the two scripts from ever disagreeing on romaji, and check-kana.ts
 * asserts every derived character really lands in the katakana block.
 */
const KANA_OFFSET = 0x60
const HIRAGANA_MIN = 0x3041
const HIRAGANA_MAX = 0x3096

export function toKatakana(hiragana: string): string {
  return [...hiragana]
    .map((c) => {
      const code = c.charCodeAt(0)
      return code >= HIRAGANA_MIN && code <= HIRAGANA_MAX ? String.fromCharCode(code + KANA_OFFSET) : c
    })
    .join('')
}

/** Back to hiragana, so a character's sound can be looked up regardless of script. */
export function toHiragana(katakana: string): string {
  return [...katakana]
    .map((c) => {
      const code = c.charCodeAt(0)
      return code >= HIRAGANA_MIN + KANA_OFFSET && code <= HIRAGANA_MAX + KANA_OFFSET
        ? String.fromCharCode(code - KANA_OFFSET)
        : c
    })
    .join('')
}

const katakanaCells = (cells: Cell[]): Cell[] =>
  cells.map(([char, romaji, also]) => [toKatakana(char), romaji, also] as Cell)

const katakanaRows = (rows: (string | null)[][]): (string | null)[][] =>
  rows.map((r) => r.map((c) => (c === null ? null : toKatakana(c))))

// ---------------------------------------------------------------------------
// Scripts
// ---------------------------------------------------------------------------

function sections(
  prefix: string,
  gojuon: (string | null)[][],
  dakuten: (string | null)[][],
  yoon: (string | null)[][],
): ChartSection[] {
  return [
    { id: `${prefix}-gojuon`, label: 'Basic', rows: gojuon },
    { id: `${prefix}-dakuten`, label: 'Voiced', rows: dakuten },
    { id: `${prefix}-yoon`, label: 'Combined', rows: yoon, wide: true },
  ]
}

export const JA_SCRIPTS: KanaScript[] = [
  {
    id: 'hiragana',
    title: { native: 'ひらがな', en: 'Hiragana' },
    blurb: 'The everyday script — grammar, native words, and every reading in the app.',
    sections: sections('h', CHART_GOJUON, CHART_DAKUTEN, CHART_YOON),
  },
  {
    id: 'katakana',
    title: { native: 'カタカナ', en: 'Katakana' },
    blurb: 'The same sounds again, used for foreign words, names, and emphasis.',
    sections: sections(
      'k',
      katakanaRows(CHART_GOJUON),
      katakanaRows(CHART_DAKUTEN),
      katakanaRows(CHART_YOON),
    ),
  },
]

const ALL_KANA: Kana[] = [
  ...toKana([...GOJUON_CELLS, ...DAKUTEN_CELLS, ...YOON_CELLS]),
  ...toKana(katakanaCells([...GOJUON_CELLS, ...DAKUTEN_CELLS, ...YOON_CELLS])),
]

const BY_CHAR: Map<string, Kana> = new Map(ALL_KANA.map((k) => [k.char, k] as const))

/** Every character in both scripts. */
export function allKana(): Kana[] {
  return ALL_KANA
}

export function kanaOf(char: string): Kana | undefined {
  return BY_CHAR.get(char)
}

export function scriptOf(char: string): string {
  return toHiragana(char) === char ? 'hiragana' : 'katakana'
}

/** Every character of one script, in chart order. */
export function charsOfScript(script: KanaScript): string[] {
  return script.sections.flatMap((s) => s.rows.flat().filter((c): c is string => c !== null))
}

/** Romaji for a chart cell, or '' if the character somehow isn't in the table. */
export function chartRomaji(char: string): string {
  return kanaOf(char)?.romaji ?? ''
}

// ---------------------------------------------------------------------------
// Sound identity — the correctness constraint
// ---------------------------------------------------------------------------

/**
 * Characters whose sound differs from their canonical romaji. Without these, a "pick the kana you
 * heard" question could show both お and を — two characters pronounced identically — and have two
 * correct answers.
 */
const SOUND_OVERRIDES: Record<string, string> = {
  を: 'o', // the particle; spelled 'wo', said 'o'
  ぢ: 'ji', // merged with じ in modern Japanese
  づ: 'zu', // merged with ず
}

/**
 * What this character actually sounds like. Script-independent — あ and ア return the same thing, so
 * a mixed drill can't offer both as options for one played sound.
 */
export function soundOf(char: string): string {
  const hira = toHiragana(char)
  return SOUND_OVERRIDES[hira] ?? BY_CHAR.get(hira)?.romaji ?? hira
}

/** Whether two characters are indistinguishable by ear, and so can never share a question. */
export function sameSound(a: string, b: string): boolean {
  return soundOf(a) === soundOf(b)
}

/** How a whole sequence sounds, for the same homophone check across multi-character targets. */
export function soundOfSequence(chars: string[]): string {
  return chars.map(soundOf).join('-')
}

/** Everything a learner may type for one character, lowercased. */
export function acceptedRomaji(char: string): string[] {
  const k = BY_CHAR.get(toHiragana(char))
  if (!k) return []
  return [k.romaji, ...(k.alsoAccept ?? [])].map((r) => r.toLowerCase())
}

/** Cap on the accept-set size for a sequence, so the cartesian product can't blow up. */
const MAX_ACCEPTED = 64

/**
 * Every spelling accepted for a sequence: the cartesian product of each character's accept-set.
 * Three characters with three variants each is 27 strings, so the cap is generous headroom.
 */
export function acceptedRomajiSequence(chars: string[]): string[] {
  let out: string[] = ['']
  for (const c of chars) {
    const next: string[] = []
    for (const prefix of out) {
      for (const r of acceptedRomaji(c)) {
        if (next.length < MAX_ACCEPTED) next.push(prefix + r)
      }
    }
    out = next
  }
  return out
}

/** Grade a typed answer: trimmed, case-insensitive, against the full accept-set. */
export function checkRomaji(chars: string[], typed: string): boolean {
  return acceptedRomajiSequence(chars).includes(typed.trim().toLowerCase())
}

// ---------------------------------------------------------------------------
// Confusable characters — better distractors
// ---------------------------------------------------------------------------

/**
 * Characters that are genuinely easy to mix up by *shape*. Used to prefer distractors that make a
 * question worth answering; purely an ordering hint, never a correctness rule (that's `sameSound`).
 * Listed one way round and mirrored at load.
 */
const CONFUSABLE_PAIRS: [string, string][] = [
  // Hiragana
  ['あ', 'お'], ['あ', 'め'], ['い', 'り'], ['う', 'つ'], ['え', 'ん'],
  ['き', 'さ'], ['く', 'へ'], ['け', 'は'], ['こ', 'に'],
  ['さ', 'ち'], ['し', 'つ'], ['す', 'む'], ['せ', 'ぜ'], ['そ', 'ろ'],
  ['た', 'な'], ['ぬ', 'め'], ['ね', 'れ'], ['ね', 'わ'], ['れ', 'わ'],
  ['は', 'ほ'], ['ま', 'も'], ['る', 'ろ'], ['を', 'わ'], ['を', 'ぬ'],
  // Katakana — a different set of traps entirely, so authored rather than derived
  ['ソ', 'ン'], ['シ', 'ツ'], ['ク', 'ワ'], ['ク', 'タ'], ['ス', 'ヌ'],
  ['チ', 'テ'], ['ナ', 'メ'], ['マ', 'ム'], ['ラ', 'ヲ'], ['ル', 'レ'],
  ['コ', 'ユ'], ['ウ', 'ワ'], ['ノ', 'ソ'], ['ハ', 'ヘ'], ['ヌ', 'ス'],
]

/**
 * Characters that are the *same shape* and so cannot be told apart from a drawing alone.
 *
 * The recogniser normalises size and position before matching, which is what makes it robust to
 * where on the canvas you drew — but size is precisely and only what separates a small ゃ from a
 * full-size や, and へ/ヘ are the same glyph in both scripts. On a blank canvas with nothing to
 * judge scale against, these are genuinely indistinguishable, so grading treats them as equal.
 *
 * Deliberately minimal. Dakuten pairs (す/ず, は/ば) are *not* here: the marks are a real difference
 * the learner has to produce, so writing ず when asked for す is wrong, not merely ambiguous.
 */
const SHAPE_CLASSES: string[][] = [
  ['や', 'ゃ'], ['ゆ', 'ゅ'], ['よ', 'ょ'], ['つ', 'っ'], ['あ', 'ぁ'],
  ['ヤ', 'ャ'], ['ユ', 'ュ'], ['ヨ', 'ョ'], ['ツ', 'ッ'], ['ア', 'ァ'],
  ['へ', 'ヘ'], // identical glyph in both scripts
  ['り', 'リ'], // differ only in whether the strokes join
]

const SHAPE_OF: Map<string, string> = new Map(
  SHAPE_CLASSES.flatMap((cls) => cls.map((c) => [c, cls[0]] as const)),
)

/** Whether a drawing of `b` should be accepted when `a` was asked for. */
export function sameShape(a: string, b: string): boolean {
  if (a === b) return true
  return (SHAPE_OF.get(a) ?? a) === (SHAPE_OF.get(b) ?? b)
}

export const CONFUSABLE: Map<string, string[]> = (() => {
  const m = new Map<string, string[]>()
  const add = (a: string, b: string): void => {
    if (!BY_CHAR.has(a) || !BY_CHAR.has(b)) return // skip pairs naming a non-table glyph
    m.set(a, [...(m.get(a) ?? []), b])
  }
  for (const [a, b] of CONFUSABLE_PAIRS) {
    add(a, b)
    add(b, a)
  }
  return m
})()
