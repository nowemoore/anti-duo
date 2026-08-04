// Verifies the grammar subsections — `npm run check:grammar`.
//
// The 〜ます minigame builds its items from the content db (verbs tagged u-verb / ru-verb in
// dbs/ja_kanji.csv), conjugated at runtime and scoped to what the learner has introduced. So this
// script checks three layers: the conjugation rules, the derived bank, and the unchanged engine
// behaviour (shuffling, navigation, scoring, gating, persistence).
import { loadContent } from '../server/content'
import { buildContentIndex } from '../src/lib/content'
import {
  attemptAccuracy,
  availableItemCount,
  bestAccuracy,
  hasPassed,
  isMinigameGated,
  isPartUnlocked,
  isReflectionComplete,
  markVocabDone,
  maxVisitableIndex,
  missedItems,
  prepareAttempt,
  recordAttempt,
  reflectionAnsweredCount,
  saveReflection,
  topicItems,
  topicProgress,
  topicUnitIdxs,
  topicsForLang,
} from '../src/lib/grammar'
import { learnedVerbCount, unitsNeededForVerbs } from '../src/lib/grammar/verbBank'
import { applyLearned } from '../src/lib/study'
import type { GrammarContext } from '../src/lib/grammar'
import {
  isDeceptive,
  politeNonPast,
  verbClassOf,
  wrongPoliteNonPast,
  type VerbClass,
} from '../src/lib/lang/jaVerbs'
import { normalizeProgress } from '../shared/progress'
import {
  GRAMMAR_ATTEMPT_HISTORY,
  GRAMMAR_MIN_ITEMS,
  GRAMMAR_PASS_ACCURACY,
  GRAMMAR_RUN_ITEMS,
  INTRODUCED_LEVEL,
  defaultProgress,
} from '../shared/constants'
import type { Content, GrammarItemResult, Progress, Unit } from '../shared/types'

const NOW = '2026-08-04T00:00:00.000Z'

/** The 34 verbs the exercise shipped with, frozen. The generator must still reproduce both forms. */
const LEGACY: { reading: string; cls: VerbClass; correct: string; cross: string }[] = [
  { reading: 'たべる', cls: 'ru-verb', correct: 'たべます', cross: 'たべります' },
  { reading: 'みる', cls: 'ru-verb', correct: 'みます', cross: 'みります' },
  { reading: 'おきる', cls: 'ru-verb', correct: 'おきます', cross: 'おきります' },
  { reading: 'あける', cls: 'ru-verb', correct: 'あけます', cross: 'あけります' },
  { reading: 'おしえる', cls: 'ru-verb', correct: 'おしえます', cross: 'おしえります' },
  { reading: 'こたえる', cls: 'ru-verb', correct: 'こたえます', cross: 'こたえります' },
  { reading: 'かんがえる', cls: 'ru-verb', correct: 'かんがえます', cross: 'かんがえります' },
  { reading: 'はじめる', cls: 'ru-verb', correct: 'はじめます', cross: 'はじめります' },
  { reading: 'かりる', cls: 'ru-verb', correct: 'かります', cross: 'かりります' },
  { reading: 'とめる', cls: 'ru-verb', correct: 'とめます', cross: 'とめります' },
  { reading: 'いれる', cls: 'ru-verb', correct: 'いれます', cross: 'いれります' },
  { reading: 'あつめる', cls: 'ru-verb', correct: 'あつめます', cross: 'あつめります' },
  { reading: 'のむ', cls: 'u-verb', correct: 'のみます', cross: 'のます' },
  { reading: 'よむ', cls: 'u-verb', correct: 'よみます', cross: 'よます' },
  { reading: 'かく', cls: 'u-verb', correct: 'かきます', cross: 'かます' },
  { reading: 'きく', cls: 'u-verb', correct: 'ききます', cross: 'きます' },
  { reading: 'いく', cls: 'u-verb', correct: 'いきます', cross: 'います' },
  { reading: 'あう', cls: 'u-verb', correct: 'あいます', cross: 'あます' },
  { reading: 'かう', cls: 'u-verb', correct: 'かいます', cross: 'かます' },
  { reading: 'つかう', cls: 'u-verb', correct: 'つかいます', cross: 'つかます' },
  { reading: 'まつ', cls: 'u-verb', correct: 'まちます', cross: 'まます' },
  { reading: 'もつ', cls: 'u-verb', correct: 'もちます', cross: 'もます' },
  { reading: 'はなす', cls: 'u-verb', correct: 'はなします', cross: 'はなます' },
  { reading: 'しぬ', cls: 'u-verb', correct: 'しにます', cross: 'します' },
  { reading: 'はこぶ', cls: 'u-verb', correct: 'はこびます', cross: 'はこます' },
  { reading: 'いそぐ', cls: 'u-verb', correct: 'いそぎます', cross: 'いそます' },
  { reading: 'うる', cls: 'u-verb', correct: 'うります', cross: 'うます' },
  { reading: 'しる', cls: 'u-verb', correct: 'しります', cross: 'します' },
  { reading: 'つくる', cls: 'u-verb', correct: 'つくります', cross: 'つくます' },
  { reading: 'ならう', cls: 'u-verb', correct: 'ならいます', cross: 'ならます' },
  { reading: 'かえる', cls: 'u-verb', correct: 'かえります', cross: 'かえます' },
  { reading: 'はいる', cls: 'u-verb', correct: 'はいります', cross: 'はいます' },
  { reading: 'はしる', cls: 'u-verb', correct: 'はしります', cross: 'はします' },
  { reading: 'きる', cls: 'u-verb', correct: 'きります', cross: 'きます' },
]

async function main() {
  const checks: [string, boolean][] = []
  const topics = topicsForLang('ja')
  const topic = topics[0]
  checks.push(['ja exposes at least one grammar topic', topics.length > 0])
  if (!topic) {
    console.log('FAIL  ja exposes at least one grammar topic')
    process.exit(1)
  }

  const store = await loadContent()
  const content: Content = {
    units: store.units,
    sentences: store.sentences,
    kanjiMeanings: store.kanjiMeanings,
    kanjiRadicals: store.kanjiRadicals,
    kanjiComponents: store.kanjiComponents,
  }
  const index = buildContentIndex(content)

  /** A profile with the first `n` units introduced (idx order — only the count matters here). */
  function profile(n: number): Progress {
    const p = defaultProgress()
    for (const u of store.units.slice(0, n)) p.units[u.idx] = { lvl: INTRODUCED_LEVEL }
    return p
  }
  const ctxFor = (p: Progress): GrammarContext => ({ index, progress: p })
  const ALL = store.units.length
  /** Everything learned, vocab intro done — the state most bank checks want. */
  const fullProgress = markVocabDone(profile(ALL), topic.id, NOW)
  const full = ctxFor(fullProgress)

  /** Answer a prepared attempt, getting the first `correctCount` items right. */
  function answer(ctx: GrammarContext, correctCount: number): GrammarItemResult[] {
    return prepareAttempt(topic, ctx).map((p, i) => {
      const correct = i < correctCount
      return { itemId: p.item.id, correct, picked: correct ? p.item.correct : p.item.wrong }
    })
  }
  function answerAllPrompts(pr: Progress): Progress {
    let out = pr
    for (const q of topic.reflection.prompts) out = saveReflection(out, topic.id, q.id, 'my notes', NOW)
    return out
  }

  // --- tag data integrity --------------------------------------------------
  const tagged: { word: string; reading: string; cls: VerbClass; unit: Unit }[] = []
  for (const unit of store.units) {
    for (const w of unit.examples) {
      const cls = verbClassOf(w)
      if (cls) tagged.push({ word: w.word, reading: w.reading, cls, unit })
    }
  }
  checks.push(['the db carries verb tags at all', tagged.length > 0])
  checks.push([
    'every ru-verb ends in る',
    tagged.filter((t) => t.cls === 'ru-verb').every((t) => t.reading.endsWith('る')),
  ])
  checks.push([
    'nothing tagged ru-verb fails to end in る',
    !tagged.some((t) => t.cls === 'ru-verb' && !t.reading.endsWith('る')),
  ])
  checks.push([
    'every tagged verb conjugates',
    tagged.every((t) => politeNonPast(t.reading, t.cls)?.endsWith('ます')),
  ])
  checks.push([
    'both wrong patterns differ from the correct form',
    tagged
      .filter((t) => t.cls !== 'irregular-verb')
      .every((t) => {
        const ok = politeNonPast(t.reading, t.cls)
        return (['cross', 'bolt'] as const).every((p) => {
          const w = wrongPoliteNonPast(t.reading, t.cls, p)
          return w != null && w !== ok && w.endsWith('ます')
        })
      }),
  ])

  // --- conjugation regression against the hand-authored bank ---------------
  const badCorrect = LEGACY.filter((f) => politeNonPast(f.reading, f.cls) !== f.correct)
  const badCross = LEGACY.filter((f) => wrongPoliteNonPast(f.reading, f.cls, 'cross') !== f.cross)
  checks.push([
    `generator reproduces all ${LEGACY.length} shipped correct forms${badCorrect.length ? ` (bad: ${badCorrect.map((f) => f.reading).join(' ')})` : ''}`,
    badCorrect.length === 0,
  ])
  checks.push([
    `generator reproduces all ${LEGACY.length} shipped cross-pattern wrongs${badCross.length ? ` (bad: ${badCross.map((f) => f.reading).join(' ')})` : ''}`,
    badCross.length === 0,
  ])
  checks.push(['irregulars conjugate', politeNonPast('くる', 'irregular-verb') === 'きます' && politeNonPast('する', 'irregular-verb') === 'します'])
  checks.push([
    'deceptive = u-verb ending in る',
    isDeceptive('かえる', 'u-verb') && !isDeceptive('たべる', 'ru-verb') && !isDeceptive('のむ', 'u-verb'),
  ])

  // --- the derived bank ----------------------------------------------------
  const allItems = topicItems(topic, full, 'all')
  const allIds = new Set(allItems.map((i) => i.id))
  checks.push(['the full candidate bank is non-empty', allItems.length > 0])
  checks.push(['candidate ids are unique', allIds.size === allItems.length])
  checks.push(['ids are word-derived (v:…)', allItems.every((i) => i.id === `v:${i.form}`)])
  checks.push([
    'candidate ids are deterministic across calls',
    topicItems(topic, full, 'all').map((i) => i.id).join(',') === allItems.map((i) => i.id).join(','),
  ])
  checks.push([
    'every candidate is a real example word with a matching reading',
    allItems.every((i) => tagged.some((t) => t.word === i.form && t.reading === i.reading)),
  ])
  checks.push(['no irregular in the bank', !allIds.has('v:来る')])

  const run = prepareAttempt(topic, full)
  checks.push([`a full profile's run is ${GRAMMAR_RUN_ITEMS} items`, run.length === GRAMMAR_RUN_ITEMS])
  checks.push([
    'no run repeats a unit',
    (() => {
      const byWord = new Map(tagged.map((t) => [t.word, t.unit.idx]))
      const idxs = run.map((p) => byWord.get(p.item.form))
      return new Set(idxs).size === idxs.length
    })(),
  ])
  checks.push([
    'no run repeats a (reading, correct) pair',
    new Set(run.map((p) => `${p.item.reading}|${p.item.correct}`)).size === run.length,
  ])
  checks.push([
    'a word whose kanji are outside the curriculum never appears',
    !run.some((p) => p.item.form === '間に合う'),
  ])

  // Bank size grows with what the learner knows, and gates below the minimum.
  const counts = [0, 20, 60, 120, ALL].map((n) => learnedVerbCount(index, profile(n)))
  checks.push(['verb count grows monotonically with progress', counts.every((c, i) => i === 0 || c >= counts[i - 1])])
  checks.push(['a fresh profile knows no verbs', counts[0] === 0])
  checks.push([`a full profile clears the ${GRAMMAR_MIN_ITEMS}-verb bar`, counts[counts.length - 1] >= GRAMMAR_MIN_ITEMS])

  // Tier and wrong-pattern discipline, sampled over many runs.
  const RUNS = 300
  let tierOk = true
  let exceptionsLast = true
  let deceptiveAlwaysCross = true
  let crossCount = 0
  let plainCount = 0
  for (let r = 0; r < RUNS; r++) {
    const items = prepareAttempt(topic, full).map((p) => p.item)
    const tiers = items.map((i) => i.tier)
    const firstException = tiers.indexOf('exception')
    if (firstException !== -1 && tiers.slice(firstException).some((t) => t !== 'exception')) exceptionsLast = false
    for (const it of items) {
      const t = tagged.find((x) => x.word === it.form)!
      const deceptive = isDeceptive(t.reading, t.cls)
      if (deceptive !== (it.tier === 'exception')) tierOk = false
      if (deceptive) {
        if (it.wrong !== wrongPoliteNonPast(t.reading, t.cls, 'cross')) deceptiveAlwaysCross = false
      } else {
        plainCount++
        if (it.wrong === wrongPoliteNonPast(t.reading, t.cls, 'cross')) crossCount++
      }
    }
  }
  checks.push(['tier is exactly the deceptive set', tierOk])
  checks.push(['exceptions are always presented last', exceptionsLast])
  checks.push(['deceptive verbs always get the cross-pattern wrong', deceptiveAlwaysCross])
  const crossShare = crossCount / Math.max(1, plainCount)
  checks.push([
    `non-deceptive wrong patterns stay ~50/50 (got ${(crossShare * 100).toFixed(0)}%)`,
    crossShare > 0.35 && crossShare < 0.65,
  ])
  checks.push([
    'exactly one correct option per item',
    prepareAttempt(topic, full).every((p) => p.options.filter((o) => o.correct).length === 1),
  ])
  checks.push([
    'runs reshuffle between attempts',
    prepareAttempt(topic, full).map((p) => p.item.id).join(',') !==
      prepareAttempt(topic, full).map((p) => p.item.id).join(','),
  ])
  // Cue balance: ±1 across the run, so ます never reads as a future marker.
  let cuesBalanced = true
  for (let r = 0; r < 100; r++) {
    const items = prepareAttempt(topic, full)
    const hab = items.filter((p) => p.cue.kind === 'habitual').length
    if (Math.abs(hab - (items.length - hab)) > 1) cuesBalanced = false
  }
  checks.push(['habitual/future cues stay ~50/50', cuesBalanced])

  // --- the grammar term stays hidden until part 4 --------------------------
  const preReveal = [
    topic.titleNative,
    topic.titleEn,
    topic.blurb,
    topic.vocab.title,
    topic.vocab.note ?? '',
    topic.minigame.title,
    topic.minigame.intro ?? '',
    topic.reflection.title,
    topic.explanation.title,
    ...topic.reflection.prompts.map((p) => p.prompt),
    ...topic.vocab.words.map((v) => v.word),
  ].join(' | ')
  const FORBIDDEN = ['polite', 'non-past', 'nonpast', 'non past', '丁寧', '非過去']
  const leaked = FORBIDDEN.filter((t) => preReveal.toLowerCase().includes(t.toLowerCase()))
  checks.push([`grammar term is hidden before part 4${leaked.length ? ` (leaked: ${leaked.join(', ')})` : ''}`, leaked.length === 0])
  checks.push([
    'the term is revealed inside part 4',
    topic.explanation.revealedName != null &&
      FORBIDDEN.some((t) => topic.explanation.revealedName!.en.toLowerCase().includes(t.toLowerCase())),
  ])

  // --- vocab is grounded in the db -----------------------------------------
  const wordSet = new Set(store.units.flatMap((u) => u.examples.map((e) => e.word)))
  const readingOf = new Map<string, string>()
  const meaningOf = new Map<string, string>()
  for (const u of store.units) {
    for (const e of u.examples) {
      if (!readingOf.has(e.word)) readingOf.set(e.word, e.reading)
      if (!meaningOf.has(e.word)) meaningOf.set(e.word, e.meaning)
    }
  }
  const kanaOnly = new Set(['よく'])
  checks.push([
    'every vocab word comes from ja_kanji.csv',
    topic.vocab.words.every((v) => kanaOnly.has(v.word) || wordSet.has(v.word)),
  ])
  checks.push([
    'vocab readings and glosses match ja_kanji.csv',
    topic.vocab.words.every(
      (v) => kanaOnly.has(v.word) || (readingOf.get(v.word) === v.reading && meaningOf.get(v.word) === v.meaning),
    ),
  ])
  checks.push([
    'cue glosses match ja_kanji.csv (kana-only exempt)',
    topic.minigame.cues.every((c) => kanaOnly.has(c.word) || meaningOf.get(c.word) === c.meaning),
  ])
  const creditIdxs = topicUnitIdxs(topic)
  checks.push([
    'credited unit idxs all exist in the curriculum',
    creditIdxs.length > 0 && creditIdxs.every((idx) => index.byIdx.has(idx)),
  ])
  // The topic grants the time-word units on pass; if a bank verb sat under one of them, passing
  // would feed the exercise its own new items. 来る under 来 (55) is exactly that case.
  const bankUnitIdxs = new Set(
    allItems.map((i) => tagged.find((t) => t.word === i.form)!.unit.idx),
  )
  checks.push([
    'no bank verb sits under a unit this topic credits',
    creditIdxs.every((idx) => !bankUnitIdxs.has(idx)),
  ])

  // --- navigation: free backwards, one step forwards ------------------------
  checks.push(['a fresh run cannot move past the first item', maxVisitableIndex([null, null, null]) === 0])
  checks.push(['answering opens exactly one more item', maxVisitableIndex([0, null, null]) === 1])
  checks.push(['an unanswered item blocks everything after it', maxVisitableIndex([0, null, 1]) === 1])
  checks.push(['a fully answered run is browsable end to end', maxVisitableIndex([0, 1, 0]) === 2])
  checks.push(['revisiting an earlier item never closes later ones', maxVisitableIndex([1, 1, null]) === 2])

  // --- scoring + gating ----------------------------------------------------
  checks.push([
    'accuracy is fraction correct',
    attemptAccuracy({ at: NOW, items: answer(full, GRAMMAR_RUN_ITEMS / 2) }) === 0.5,
  ])

  const unlocked = (part: 'vocab' | 'minigame' | 'reflection' | 'explanation', pr: Progress) =>
    isPartUnlocked(part, topicProgress(pr, topic.id), topic, ctxFor(pr))

  let p: Progress = defaultProgress()
  checks.push(['part 1 open from the start', unlocked('vocab', p)])
  checks.push(['part 2 locked before the vocab intro', !unlocked('minigame', p)])

  // Vocab done but too few verbs — still locked. This is the new gate.
  const thin = markVocabDone(profile(20), topic.id, NOW)
  checks.push([
    'part 2 stays locked below the verb minimum',
    learnedVerbCount(index, thin) < GRAMMAR_MIN_ITEMS && !unlocked('minigame', thin),
  ])
  checks.push([
    'availableItemCount reports what the learner can be given',
    availableItemCount(topic, ctxFor(thin)) === Math.min(GRAMMAR_RUN_ITEMS, learnedVerbCount(index, thin)),
  ])
  // Regression: reading the vocabulary intro must not count as having played, or the gate stops
  // being reported to exactly the people who are part-way in.
  checks.push([
    'finishing the vocabulary does not clear the verb gate',
    isMinigameGated(topic, topicProgress(thin, topic.id), ctxFor(thin)),
  ])
  checks.push([
    'a thin profile that has never played is gated',
    isMinigameGated(topic, topicProgress(profile(20), topic.id), ctxFor(profile(20))),
  ])
  checks.push([
    'a profile with enough verbs is not gated',
    !isMinigameGated(topic, topicProgress(fullProgress, topic.id), full),
  ])

  // unitsNeededForVerbs powers both the "learn N more kanji" line and the dev seeder, so it has to
  // be an achievable count, not an estimate: introducing exactly those units must clear the gate.
  {
    const fresh = defaultProgress()
    const idxs = unitsNeededForVerbs(index, fresh, GRAMMAR_MIN_ITEMS)
    const seeded = applyLearned(
      fresh,
      idxs.map((i) => index.byIdx.get(i)).filter((u): u is Unit => u !== undefined),
    )
    checks.push([
      `unitsNeededForVerbs(${GRAMMAR_MIN_ITEMS}) actually reaches the gate`,
      learnedVerbCount(index, seeded) >= GRAMMAR_MIN_ITEMS,
    ])
    checks.push([
      'and asks for no more units than necessary',
      idxs.length <= GRAMMAR_MIN_ITEMS + 5,
    ])
    checks.push([
      'seeding is incremental, not double-counted',
      (() => {
        const half = unitsNeededForVerbs(index, fresh, 10)
        const step1 = applyLearned(fresh, half.map((i) => index.byIdx.get(i)!).filter(Boolean))
        const rest = unitsNeededForVerbs(index, step1, 20)
        const step2 = applyLearned(step1, rest.map((i) => index.byIdx.get(i)!).filter(Boolean))
        return learnedVerbCount(index, step1) >= 10 && learnedVerbCount(index, step2) >= 20
      })(),
    ])
    checks.push([
      'a learner already past the gate needs no more kanji',
      unitsNeededForVerbs(index, fullProgress, GRAMMAR_MIN_ITEMS).length === 0,
    ])
  }

  p = fullProgress
  checks.push(['part 2 unlocks once the verb minimum is met', unlocked('minigame', p)])
  checks.push(['part 3 still locked before any attempt', !unlocked('reflection', p)])

  p = recordAttempt(p, topic, answer(ctxFor(p), 3), NOW)
  let tp = topicProgress(p, topic.id)
  checks.push(['part 3 unlocks after any completed attempt', unlocked('reflection', p)])
  checks.push(['part 4 locked below the threshold', !unlocked('explanation', p)])
  checks.push(['low score does not credit units', p.units[creditIdxs[0]]?.lvl === undefined || creditIdxs.every((i) => store.units.slice(0, ALL).some((u) => u.idx === i))])

  const missed = missedItems(topic, tp, ctxFor(p))
  checks.push([
    'missed items report verb + picked answer',
    missed.length === GRAMMAR_RUN_ITEMS - 3 && missed.every((m) => m.picked !== m.item.correct),
  ])

  const pass = Math.ceil(GRAMMAR_RUN_ITEMS * GRAMMAR_PASS_ACCURACY)
  p = recordAttempt(p, topic, answer(ctxFor(p), pass), NOW)
  tp = topicProgress(p, topic.id)
  checks.push(['threshold alone does not unlock part 4', hasPassed(tp) && !unlocked('explanation', p)])
  checks.push(['passedAt is stamped on the passing attempt', tp.passedAt === NOW])
  checks.push([
    'passing credits every vocab kanji as learned',
    creditIdxs.every((idx) => (p.units[idx]?.lvl ?? 0) >= INTRODUCED_LEVEL),
  ])
  checks.push(['best accuracy is kept, not the latest', bestAccuracy(tp) >= GRAMMAR_PASS_ACCURACY])

  const partial = saveReflection(p, topic.id, topic.reflection.prompts[0].id, 'only one', NOW)
  checks.push(['a partial reflection does not unlock part 4', !unlocked('explanation', partial)])
  checks.push([
    'blank answers do not count as reflected',
    reflectionAnsweredCount(
      topic,
      topicProgress(saveReflection(p, topic.id, topic.reflection.prompts[0].id, '   ', NOW), topic.id),
    ) === 0,
  ])

  p = answerAllPrompts(p)
  checks.push(['part 4 unlocks once reflection is done and the threshold is met', unlocked('explanation', p)])
  checks.push(['reflection completeness is all-or-nothing', isReflectionComplete(topic, topicProgress(p, topic.id))])

  let unearned = markVocabDone(profile(ALL), topic.id, NOW)
  unearned = recordAttempt(unearned, topic, answer(ctxFor(unearned), 1), NOW)
  unearned = answerAllPrompts(unearned)
  checks.push([
    'reflection alone does not unlock part 4',
    isReflectionComplete(topic, topicProgress(unearned, topic.id)) && !unlocked('explanation', unearned),
  ])

  p = recordAttempt(p, topic, answer(ctxFor(p), 0), NOW)
  checks.push(['a later failure never re-locks part 4', unlocked('explanation', p)])

  // Part 2 must not re-lock if the learner later pauses categories and drops below the minimum.
  const narrowed: Progress = {
    ...p,
    settings: { ...p.settings, disabledCategories: index.categories.map((c) => c.name) },
  }
  checks.push([
    'part 2 never re-locks once played',
    availableItemCount(topic, ctxFor(narrowed)) < GRAMMAR_MIN_ITEMS && unlocked('minigame', narrowed),
  ])

  // Credit never demotes a unit already above the introduced level.
  let advanced = markVocabDone(profile(ALL), topic.id, NOW)
  advanced = { ...advanced, units: { ...advanced.units, [creditIdxs[0]]: { lvl: 9 } } }
  advanced = recordAttempt(advanced, topic, answer(ctxFor(advanced), pass), NOW)
  checks.push(['crediting never lowers an existing level', advanced.units[creditIdxs[0]].lvl === 9])

  // --- reflections + persistence -------------------------------------------
  p = saveReflection(p, topic.id, 'q1', '  ru-verbs drop る  ', NOW)
  const saved = topicProgress(p, topic.id).reflections.q1
  checks.push(['reflection stores answer with null feedback', saved.answer === '  ru-verbs drop る  ' && saved.feedback === null])

  const round = normalizeProgress(JSON.parse(JSON.stringify(p)) as Progress)
  const rtp = round.grammar?.[topic.id]
  checks.push([
    'grammar survives the normalizeProgress round-trip',
    // Three attempts recorded above: the low score, the passing one, then the later failure.
    rtp != null &&
      rtp.attempts.length === 3 &&
      rtp.reflections.q1?.answer === saved.answer &&
      rtp.reflections.q1?.feedback === null &&
      rtp.passedAt === NOW &&
      rtp.unitsCreditedAt === NOW,
  ])
  checks.push([
    'per-item results survive for later error analytics',
    (rtp?.attempts[0].items.length ?? 0) === GRAMMAR_RUN_ITEMS &&
      rtp!.attempts[0].items.every((r) => allIds.has(r.itemId) && typeof r.picked === 'string'),
  ])

  // Attempts recorded against the old hand-authored bank still resolve to their verbs.
  const legacyProgress = recordAttempt(fullProgress, topic, [], NOW)
  const withLegacy: Progress = {
    ...legacyProgress,
    grammar: {
      [topic.id]: {
        ...topicProgress(legacyProgress, topic.id),
        attempts: [
          { at: NOW, items: [{ itemId: 'r01', correct: false, picked: 'たべります' }, { itemId: 'e31', correct: false, picked: 'かえます' }] },
        ],
      },
    },
  }
  const legacyMissed = missedItems(topic, topicProgress(withLegacy, topic.id), ctxFor(withLegacy))
  checks.push([
    'attempts recorded with legacy item ids still resolve',
    legacyMissed.length === 2 && legacyMissed.some((m) => m.item.form === '食べる') && legacyMissed.some((m) => m.item.form === '帰る'),
  ])

  const dirty = {
    ...defaultProgress(),
    grammar: {
      t1: {
        attempts: [{ at: NOW, items: [{ itemId: 'a', correct: true, picked: 'x' }, { junk: 1 }] }, { nope: true }, { at: NOW, items: [] }],
        reflections: { good: { answer: 'yes', feedback: 'later' }, bad: { feedback: 'x' } },
      },
    },
  } as unknown as Progress
  const cleaned = normalizeProgress(dirty).grammar?.t1
  checks.push([
    'malformed grammar entries are dropped',
    cleaned != null &&
      cleaned.attempts.length === 1 &&
      cleaned.attempts[0].items.length === 1 &&
      cleaned.reflections.good?.answer === 'yes' &&
      !('bad' in cleaned.reflections),
  ])

  let many = markVocabDone(profile(ALL), topic.id, NOW)
  for (let i = 0; i < GRAMMAR_ATTEMPT_HISTORY + 10; i++) many = recordAttempt(many, topic, answer(ctxFor(many), 1), NOW)
  checks.push([
    `attempt history caps at ${GRAMMAR_ATTEMPT_HISTORY}`,
    topicProgress(many, topic.id).attempts.length === GRAMMAR_ATTEMPT_HISTORY,
  ])
  checks.push(['untouched progress gains no grammar key', !('grammar' in normalizeProgress(defaultProgress()))])

  let ok = true
  for (const [name, pass_] of checks) {
    console.log(`${pass_ ? 'PASS' : 'FAIL'}  ${name}`)
    if (!pass_) ok = false
  }
  console.log()
  console.log(`verbs in db: ${tagged.length} · playable candidates: ${allItems.length} · run size: ${GRAMMAR_RUN_ITEMS} · gate: ${GRAMMAR_MIN_ITEMS}`)
  console.log(ok ? 'OK: grammar subsections correct' : 'FAILED: see issues above')
  process.exit(ok ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
