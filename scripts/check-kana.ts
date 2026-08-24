// Verifies the kana course — `npm run check:kana`.
import {
  defaultProgress,
  KANA_KNOWN_STREAK,
  KANA_MASTERY_FULL,
  KANA_PICK_OPTIONS,
  KANA_SEQUENCE_MAX,
  KANA_RECALL_STREAK,
  KANA_WORD_OPTIONS,
  KANA_WORD_SPELL_STREAK,
} from '../shared/constants'
import { loadContent } from '../server/content'
import { normalizeProgress } from '../shared/progress'
import type { Progress } from '../shared/types'
import {
  acceptedRomajiSequence,
  allKana,
  buildDrill,
  buildOptions,
  buildWordDrill,
  canPractiseWords,
  formatForWord,
  charsOf as wordCharsOf,
  readableWords,
  buildSequenceOptions,
  canDrill,
  charsOfScript,
  checkRomaji,
  isKnown,
  isTraced,
  kanaOf,
  knownCount,
  markTraced,
  masteryOf,
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
  tracedToPractise,
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

// One script per question — a run may mix them, a single question may not. Includes the options,
// which is where the two used to collide most visibly (ア offered against あ, か, さ).
const mixedPool = traced('あ', 'か', 'さ', 'た', 'な', 'は', 'ア', 'カ', 'サ', 'タ', 'ナ', 'ハ')
let crossScript = 0
let sawBoth = false
for (let n = 0; n < 60; n++) {
  const run = buildDrill(mixedPool, { count: 20 })
  const scripts = new Set<string>()
  for (const item of run) {
    const seen = new Set(item.chars.map(scriptOf))
    for (const o of item.options) for (const c of [...o.label]) seen.add(scriptOf(c))
    if (seen.size > 1) crossScript++
    for (const sc of seen) scripts.add(sc)
  }
  if (scripts.size > 1) sawBoth = true
}
checks.push(['no question mixes hiragana and katakana across 60 runs', crossScript === 0])
checks.push(['a run still mixes both scripts across its questions', sawBoth])

// A script below KANA_PICK_OPTIONS traced characters can't fill a multiple-choice question, so it
// isn't practised at all — one studied character used to yield questions offering only itself.
for (let n = 1; n < KANA_PICK_OPTIONS; n++) {
  const few = traced(...['あ', 'か', 'さ', 'た'].slice(0, n))
  checks.push([`${n} traced character${n === 1 ? '' : 's'} → no practice`, buildDrill(few).length === 0])
  checks.push([`${n} traced → practice reports ${KANA_PICK_OPTIONS - n} to go`, tracedToPractise(few) === KANA_PICK_OPTIONS - n])
  checks.push([`${n} traced → canDrill is false`, !canDrill(few)])
}
const enough = traced('あ', 'か', 'さ', 'た')
checks.push([`${KANA_PICK_OPTIONS} traced → practice opens`, canDrill(enough) && buildDrill(enough).length > 0])
checks.push(['every question offers a real choice', buildDrill(enough, { count: 40 }).every((i) => i.format !== 'pick' || i.options.length > 1)])
// One script short of the threshold is skipped, not padded out of the other.
const lopsided = traced('あ', 'か', 'さ', 'た', 'ア')
checks.push([
  'a script under the threshold never appears',
  buildDrill(lopsided, { count: 60 }).every((i) => i.chars.every((c) => scriptOf(c) === 'hiragana')),
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

// Chart fill: cumulative wins, capped, and never lost to a later miss.
{
  let p2 = traced('あ')
  checks.push(['an unanswered character is unfilled', masteryOf(p2, 'あ') === 0])
  for (let n = 0; n < KANA_MASTERY_FULL; n++) p2 = recordResult(p2, ['あ'], true)
  checks.push([`${KANA_MASTERY_FULL} correct fills the cell`, masteryOf(p2, 'あ') === 1])
  p2 = recordResult(p2, ['あ'], false)
  checks.push(['a later miss does not empty the cell', masteryOf(p2, 'あ') === 1])
  checks.push(['wins are capped', (p2.kana?.wins?.['あ'] ?? 0) === KANA_MASTERY_FULL])

  let half = traced('か')
  for (let n = 0; n < 5; n++) half = recordResult(half, ['か'], true)
  checks.push(['half the wins fill half the cell', Math.abs(masteryOf(half, 'か') - 0.5) < 1e-9])
  checks.push(['wins survive a round-trip', normalizeProgress(JSON.parse(JSON.stringify(half))).kana?.wins?.['か'] === 5])
  const noWins = normalizeProgress({ kana: { chars: {}, traced: { あ: 'x' } } })
  checks.push(['a profile without wins gains no wins key', noWins.kana?.wins === undefined])
}

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

// --- word practice --------------------------------------------------------
// The load-bearing rule: a word is only ever served once every chart entry in it has been traced.

const kanaWords = (await loadContent()).kanaWords
const NOW = '2026-01-01T00:00:00.000Z'

// Nothing traced: no word is readable and practice stays shut.
const blank = defaultProgress()
checks.push(['no traced characters → no readable words', readableWords(blank, kanaWords).length === 0])
checks.push(['no traced characters → word practice is closed', !canPractiseWords(blank, kanaWords)])
checks.push(['no traced characters → an empty run', buildWordDrill(blank, kanaWords).length === 0])

// Trace one script fully; every word offered must be made only of traced characters.
let hira: Progress = defaultProgress()
for (const c of charsOfScript(hiragana)) hira = markTraced(hira, c, NOW)
const hiraReadable = readableWords(hira, kanaWords)
checks.push([
  `hiragana traced → only readable words offered (${hiraReadable.length})`,
  hiraReadable.length > 0 &&
    hiraReadable.every((w) => wordCharsOf(w.word).every((c) => isTraced(hira, c))),
])
checks.push([
  'a katakana word is never offered to a hiragana-only learner',
  hiraReadable.every((w) => w.script === 'hiragana'),
])

// The strong claim: across a full run, every character of every question is one the learner traced.
const run = buildWordDrill(hira, kanaWords, { count: 40 })
checks.push([`a run fills to the requested length (${run.length})`, run.length === 40])
checks.push([
  'every character of every question was traced',
  run.every((it) => wordCharsOf(it.word.word).every((c) => isTraced(hira, c))),
])
checks.push([
  'every question has exactly one correct option',
  run.every((it) => it.options.filter((o) => o.correct).length === 1),
])
checks.push([
  'no question repeats an option',
  run.every((it) => new Set(it.options.map((o) => o.label)).size === it.options.length),
])
checks.push([
  'options are filled to the option count',
  run.every((it) => it.options.length === KANA_WORD_OPTIONS),
])

// Format flips with the weakest character, not the strongest — a word is as weak as its worst glyph.
const oneWord = hiraReadable[0]
let weak: Progress = hira
for (const c of wordCharsOf(oneWord.word)) weak = recordResult(weak, [c], true)
const strong = (() => {
  let p: Progress = hira
  for (let i = 0; i < KANA_WORD_SPELL_STREAK + 2; i++) {
    for (const c of wordCharsOf(oneWord.word)) p = recordResult(p, [c], true)
  }
  return p
})()
const fmt = (p: Progress) => formatForWord(p, oneWord)
checks.push(['a new word is asked meaning-first', fmt(hira) === 'meaning'])
checks.push(['a well-known word is asked spelling-first', fmt(strong) === 'spell'])
checks.push(['one correct answer is not enough to flip to spelling', fmt(weak) === 'meaning'])

// Yōon are single chart entries: キャベツ is キャ·ベ·ツ, and ー / small kana are skipped.
checks.push(['yōon tokenise as one entry', wordCharsOf('キャベツ').join('|') === 'キャ|ベ|ツ'])
checks.push(['the long mark is not required', wordCharsOf('コーヒー').join('|') === 'コ|ヒ'])
checks.push(['the small tsu is not required', !wordCharsOf('ショッピングモール').includes('ッ')])
checks.push([
  'every authored word tokenises to at least one chart entry',
  kanaWords.every((w) => wordCharsOf(w.word).length > 0),
])

// A tiny pool must not produce a question that offers its own answer as the only option.
const tinyPool = kanaWords.slice(0, KANA_WORD_OPTIONS - 1)
let tinyProgress: Progress = defaultProgress()
for (const w of tinyPool) {
  for (const c of wordCharsOf(w.word)) tinyProgress = markTraced(tinyProgress, c, NOW)
}
checks.push([
  'a pool below the option count does not open practice',
  buildWordDrill(tinyProgress, tinyPool).length === 0,
])

// --- report -----------------------------------------------------------------

let ok = true
for (const [name, pass] of checks) {
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}`)
  if (!pass) ok = false
}
console.log(ok ? `OK: kana course correct (${chars.length} characters)` : 'FAILED')
process.exit(ok ? 0 : 1)
