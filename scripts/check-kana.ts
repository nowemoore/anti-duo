// Verifies the kana course — `npm run check:kana`.
import {
  defaultProgress,
  KANA_KNOWN_STREAK,
  KANA_PICK_OPTIONS,
  KANA_SEQUENCE_MAX,
  KANA_RECALL_STREAK,
} from '../shared/constants'
import { normalizeProgress } from '../shared/progress'
import type { Progress } from '../shared/types'
import {
  acceptedRomajiSequence,
  allKana,
  buildDrill,
  buildOptions,
  buildSequenceOptions,
  charsOfScript,
  checkRomaji,
  isKnown,
  isTraced,
  kanaOf,
  knownCount,
  markTraced,
  recordResult,
  sameSound,
  scriptOf,
  scriptProgress,
  scriptsForLang,
  soundOf,
  soundOfSequence,
  toHiragana,
  toKatakana,
  totalKanaCount,
  tracedChars,
} from '../src/lib/kana'

const scripts = scriptsForLang('ja')
const checks: [string, boolean][] = []
const hiragana = scripts.find((s) => s.id === 'hiragana')!
const katakana = scripts.find((s) => s.id === 'katakana')!

/** A learner who has traced exactly the named characters. */
function traced(...chars: string[]): Progress {
  let p = defaultProgress()
  for (const c of chars) p = markTraced(p, c, '2026-01-01T00:00:00.000Z')
  return p
}

/** …and has them all at the given streak, to force a particular question format. */
function atStreak(streak: number, ...chars: string[]): Progress {
  let p = traced(...chars)
  for (let n = 0; n < streak; n++) p = recordResult(p, chars, true)
  return p
}

// --- inventory --------------------------------------------------------------

const chars = allKana().map((k) => k.char)
checks.push(['no duplicate characters across both scripts', new Set(chars).size === chars.length])
checks.push(['two scripts: hiragana and katakana', scripts.length === 2])
checks.push(['hiragana has all 104 characters', charsOfScript(hiragana).length === 104])
checks.push(['katakana mirrors all 104', charsOfScript(katakana).length === 104])
checks.push(['208 characters in total', totalKanaCount(scripts) === 208])
checks.push([
  'every chart cell resolves to a table entry',
  scripts.every((s) => charsOfScript(s).every((c) => kanaOf(c) !== undefined)),
])
checks.push([
  'each script has basic / voiced / combined sections',
  scripts.every((s) => s.sections.length === 3),
])

// The chart these were extracted from is what learners already rely on — spot-check the data still
// says what it used to, rather than only that the counts add up.
const romajiOk =
  kanaOf('し')?.romaji === 'shi' &&
  kanaOf('つ')?.romaji === 'tsu' &&
  kanaOf('ふ')?.romaji === 'fu' &&
  kanaOf('を')?.romaji === 'wo' &&
  kanaOf('ん')?.romaji === 'n' &&
  kanaOf('きょ')?.romaji === 'kyo'
checks.push(['Hepburn romaji preserved (shi/tsu/fu/wo/n/kyo)', romajiOk])

// --- katakana derivation ----------------------------------------------------

const KATAKANA_RE = /^[ァ-ヶ]+$/
checks.push([
  'every derived katakana character is in the katakana block',
  charsOfScript(katakana).every((c) => KATAKANA_RE.test(c)),
])
checks.push([
  'hiragana → katakana → hiragana round-trips exactly',
  charsOfScript(hiragana).every((c) => toHiragana(toKatakana(c)) === c),
])
checks.push([
  'katakana carries the same romaji as its hiragana',
  charsOfScript(katakana).every((c) => kanaOf(c)?.romaji === kanaOf(toHiragana(c))?.romaji),
])
checks.push(['scriptOf distinguishes the two', scriptOf('あ') === 'hiragana' && scriptOf('ア') === 'katakana'])

// --- homophones: the correctness constraint ---------------------------------

checks.push(['お and を are recognised as the same sound', sameSound('お', 'を')])
checks.push(['じ and ぢ are the same sound', sameSound('じ', 'ぢ')])
checks.push(['ず and づ are the same sound', sameSound('ず', 'づ')])
checks.push(['あ and ア are the same sound across scripts', sameSound('あ', 'ア')])
checks.push(['か and き are NOT the same sound', !sameSound('か', 'き')])

// Sweep every character over the full mixed pool — the hardest case, since katakana duplicates
// every hiragana sound. A question with two same-sounding options has two right answers.
const everything = traced(...chars)
const fullPool = tracedChars(everything)
let ambiguous = 0
let shortfall = 0
for (const char of fullPool) {
  for (let n = 0; n < 10; n++) {
    const opts = buildOptions(char, fullPool)
    const sounds = opts.map((o) => soundOf(o.label))
    if (new Set(sounds).size !== sounds.length) ambiguous++
    if (opts.filter((o) => o.correct).length !== 1) ambiguous++
    if (opts.length !== KANA_PICK_OPTIONS) shortfall++
  }
}
checks.push([`no ambiguous single question across ${fullPool.length} chars × 10 draws`, ambiguous === 0])
checks.push(['full pool always fills every option slot', shortfall === 0])

// Sequence options must be unambiguous too, and must differ from the answer by sound not spelling.
let seqAmbiguous = 0
let seqShortfall = 0
for (let n = 0; n < 400; n++) {
  const len = 2 + (n % (KANA_SEQUENCE_MAX - 1))
  const seq = Array.from({ length: len }, (_, i) => fullPool[(n * 7 + i * 13) % fullPool.length])
  const opts = buildSequenceOptions(seq, fullPool)
  if (opts.filter((o) => o.correct).length !== 1) seqAmbiguous++
  const sounds = opts.map((o) => (o.correct ? soundOfSequence(seq) : o.label))
  if (new Set(sounds).size !== sounds.length) seqAmbiguous++
  if (opts.length < 2) seqShortfall++
}
checks.push(['no ambiguous sequence question across 400 draws', seqAmbiguous === 0])
checks.push(['every sequence question is answerable', seqShortfall === 0])

// The smallest possible pool: two characters traced.
const tiny = traced('あ', 'か')
const tinyOpts = buildOptions('あ', tracedChars(tiny))
checks.push([
  'a 2-character pool still yields an answerable question',
  tinyOpts.length >= 2 && tinyOpts.filter((o) => o.correct).length === 1,
])

// --- typing -----------------------------------------------------------------

checks.push(['を accepts both "wo" and "o"', checkRomaji(['を'], 'wo') && checkRomaji(['を'], 'o')])
checks.push(['し accepts Hepburn "shi" and kunrei "si"', checkRomaji(['し'], 'shi') && checkRomaji(['し'], 'si')])
checks.push(['づ accepts "zu" and "du"', checkRomaji(['づ'], 'zu') && checkRomaji(['づ'], 'du')])
checks.push(['typing is case- and space-insensitive', checkRomaji(['か'], '  KA ')])
checks.push(['a near miss is rejected', !checkRomaji(['か'], 'ke') && !checkRomaji(['し'], 'shy')])
checks.push(['katakana grades against the same accept-set', checkRomaji(['ヲ'], 'o') && checkRomaji(['シ'], 'si')])
checks.push(['every character accepts its own canonical romaji', allKana().every((k) => checkRomaji([k.char], k.romaji))])

// Sequences: the accept-set is the product of each character's, so kunrei spellings compose.
checks.push(['かに → "kani"', checkRomaji(['か', 'に'], 'kani')])
checks.push(['すし → "sushi" and "susi"', checkRomaji(['す', 'し'], 'sushi') && checkRomaji(['す', 'し'], 'susi')])
checks.push(['a sequence rejects a one-character slip', !checkRomaji(['か', 'に'], 'kana')])
checks.push([
  'a 3-character accept-set stays small',
  acceptedRomajiSequence(['し', 'ゃ', 'つ']).length <= 64,
])

// --- practice pool ----------------------------------------------------------

checks.push(['nothing traced → no practice', buildDrill(defaultProgress()).length === 0])

// The core guarantee: practice only ever contains characters the learner opened in the chart.
const some = traced('は', 'ひ', 'ふ', 'へ', 'ほ')
const allowed = new Set(tracedChars(some))
let leaked = 0
for (let n = 0; n < 60; n++) {
  for (const item of buildDrill(some)) {
    for (const c of item.chars) if (!allowed.has(c)) leaked++
    for (const o of item.options) {
      // A sequence option is a concatenation, so check its characters via the answer's alphabet.
      if (item.chars.length === 1 && !allowed.has(o.label)) leaked++
    }
  }
}
checks.push(['practice never serves an untraced character', leaked === 0])

const scriptFiltered = buildDrill(traced('あ', 'か', 'さ', 'ア', 'カ', 'サ'), {
  only: (c) => scriptOf(c) === 'katakana',
})
checks.push([
  'a script filter restricts the pool',
  scriptFiltered.every((i) => i.chars.every((c) => scriptOf(c) === 'katakana')),
])

// --- formats ----------------------------------------------------------------

const fresh = buildDrill(traced('あ', 'か', 'さ', 'た'), { count: 40 })
checks.push(['fresh characters are always recognition', fresh.every((i) => i.format === 'pick')])
checks.push([
  'pick items carry options, others do not',
  fresh.every((i) => (i.format === 'pick') === (i.options.length > 0)),
])

const known = buildDrill(atStreak(KANA_RECALL_STREAK, 'あ', 'か', 'さ', 'た'), { count: 60 })
checks.push([
  `single characters graduate from picking to drawing at streak ${KANA_RECALL_STREAK}`,
  known.filter((i) => i.chars.length === 1).every((i) => i.format === 'draw'),
])
checks.push(['sequences stay on recognition however well known', known.every((i) => i.chars.length === 1 || i.format === 'pick')])
checks.push(['only pick and draw exist as formats', known.every((i) => i.format === 'pick' || i.format === 'draw')])

// Sequences need a pool; below the threshold every question is a single.
const twoOnly = buildDrill(traced('あ', 'か'), { count: 40 })
checks.push(['a 2-character pool produces no sequences', twoOnly.every((i) => i.chars.length === 1)])
const many = buildDrill(traced('あ', 'か', 'さ', 'た', 'な', 'は'), { count: 80 })
checks.push(['a larger pool does produce sequences', many.some((i) => i.chars.length > 1)])
checks.push([
  `sequences are 2..${KANA_SEQUENCE_MAX} characters`,
  many.every((i) => i.chars.length >= 1 && i.chars.length <= KANA_SEQUENCE_MAX),
])
checks.push(['a sequence target matches its characters', many.every((i) => i.target === i.chars.join(''))])
checks.push(['no sequence repeats a character back to back', many.every((i) => i.chars.every((c, n) => n === 0 || c !== i.chars[n - 1]))])

// --- mastery ----------------------------------------------------------------

let mastered = traced('あ')
for (let n = 0; n < KANA_KNOWN_STREAK; n++) mastered = recordResult(mastered, ['あ'], true)
checks.push([`${KANA_KNOWN_STREAK} correct in a row makes a character known`, isKnown(mastered, 'あ')])
const slipped = recordResult(mastered, ['あ'], false)
checks.push(['a miss decrements the run', (slipped.kana?.chars['あ'] ?? 0) < (mastered.kana?.chars['あ'] ?? 0)])
let floored = slipped
for (let n = 0; n < 20; n++) floored = recordResult(floored, ['あ'], false)
checks.push(['a run floors at 0 and never goes negative', (floored.kana?.chars['あ'] ?? 0) === 0])

// A sequence is evidence about every character in it — there's no way to tell which one failed.
const seqCredit = recordResult(traced('か', 'に'), ['か', 'に'], true)
checks.push([
  'a correct sequence credits every character',
  seqCredit.kana?.chars['か'] === 1 && seqCredit.kana?.chars['に'] === 1,
])

checks.push(['tracing does not by itself make a character known', isTraced(mastered, 'あ') && !isKnown(traced('い'), 'い')])
checks.push(['knownCount counts across both scripts', knownCount(mastered, scripts) === 1])
const sp = scriptProgress(mastered, hiragana)
checks.push(['scriptProgress reports known / traced / total', sp.known === 1 && sp.traced === 1 && sp.total === 104])

// --- persistence ------------------------------------------------------------

const round = normalizeProgress(JSON.parse(JSON.stringify(mastered)) as Progress)
checks.push(['kana runs survive a normalizeProgress round-trip', round.kana?.chars['あ'] === mastered.kana?.chars['あ']])
checks.push(['traced timestamps survive', round.kana?.traced['あ'] === mastered.kana?.traced['あ']])
checks.push(['an untouched profile gains no kana key', normalizeProgress(defaultProgress()).kana === undefined])
checks.push([
  'tracing alone persists, with no runs recorded',
  normalizeProgress(traced('ぬ')).kana?.traced['ぬ'] !== undefined,
])

const dirty = normalizeProgress({
  ...defaultProgress(),
  kana: {
    chars: { あ: 999, い: -4, う: Number.NaN, '': 3, え: 2 },
    traced: { お: '2026-01-01T00:00:00.000Z', か: 5 as unknown as string, '': 'x', '𠮷': '2026-01-01T00:00:00.000Z' },
  },
} as Progress)
checks.push(['out-of-range runs are clamped', (dirty.kana?.chars['あ'] ?? 0) <= 8])
checks.push([
  'negative / NaN / empty-key runs are dropped',
  !('い' in (dirty.kana?.chars ?? {})) && !('う' in (dirty.kana?.chars ?? {})) && !('' in (dirty.kana?.chars ?? {})),
])
checks.push(['valid runs alongside junk are kept', dirty.kana?.chars['え'] === 2])
checks.push([
  'malformed traced entries are dropped, valid ones kept',
  dirty.kana?.traced['お'] !== undefined && !('か' in (dirty.kana?.traced ?? {})) && !('' in (dirty.kana?.traced ?? {})),
])
checks.push([
  'a traced character this build does not know is preserved',
  dirty.kana?.traced['𠮷'] !== undefined,
])

// --- report -----------------------------------------------------------------

let ok = true
for (const [name, pass] of checks) {
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}`)
  if (!pass) ok = false
}
console.log(ok ? `OK: kana course correct (${chars.length} characters)` : 'FAILED')
process.exit(ok ? 0 : 1)
