# Content invariants

Rules the three Japanese dbs must satisfy together. Enforced by
[`scripts/check-invariants.ts`](../scripts/check-invariants.ts):

```bash
npm run check:invariants
```

The point is a closed loop: **every word a learner meets in a sentence is one the curriculum
teaches, and everything the curriculum teaches gets practised often enough to stick.** Break either
half and the app either shows vocabulary it never taught, or teaches vocabulary it never tests.

## The files

| File               | Holds                                       | Key columns                                                  |
| ------------------ | ------------------------------------------- | ------------------------------------------------------------ |
| `ja_kanji.csv`     | 316 kanji units                             | `idx`, `char`, `examples`, `distractors`, `complexity`, `retired`      |
| `ja_words.csv`     | 894 words written with kanji                | `idx`, `word`, `reading`, `meaning`, `kanji_idxs`, `variants`, `retired` |
| `ja_kana.csv`      | 291 kana words                              | `idx`, `word`, `script`, `examples`                                    |
| `ja_sentences.csv` | 1594 sentences                              | `id`, `kanji_list`, `kana_list`, `tokens`                              |

`ja_kanji.csv`'s `examples` reference the word registry by id, with the release tier on the
_reference_ rather than the word: `[{"idx": 7}, {"idx": 12, "batch": 2}]`. Batch belongs there
because staged release is a fact about a word **under a given kanji** — 一時 is a first-batch example
of 一 and a second-batch example of 時.

A written form is not an identity. Five are two entries apiece — 木 is き "tree" (101) and もく
"wood" (102); likewise 十分, 中, 国, 家 — so referring to a word by its surface would silently merge
them. Which reading a kanji teaches is settled by the registry's own `kanji_idxs`: 十 teaches
じゅっぷん, 分 teaches じゅうぶん, while 木 legitimately teaches both.

The loader turns sibling readings into `Word.accept`, so a learner who types もく for 木 when the card
picked き is graded correct (`checkTypeWord`). The reverse holds for **pick-the-reading**, which needs
exactly one right answer: same-surface alternates are filtered out of its distractor pool, since もく
is not a wrong reading of 木.

Accepting both readings is a _grading_ rule, not a bookkeeping one. The two are still separate
vocabulary: `Progress.words` is keyed by `wordKey`, which appends the reading only where a form has
more than one (`木|き`, `木|もく`), so missing one never walks the other backwards and getting one
right never credits the other. The 843 single-reading words keep their bare-surface key, so no
existing run is disturbed.

`variants` is the other axis: accepted alternate **spellings** of one word, where `accept` (above) is
alternate **readings** of one spelling. 子供 declares `["子ども"]` and 友達 declares `["友だち"]`, so a
sentence may write either. It stays one word — one entry, one set of progress — and both spellings
satisfy I1 while either attests it for I2.

`kanji_list` and `kana_list` are row-level indexes: the union of every token's `targets` and
`kana_targets` respectively. They exist so the loader can build a
`Map<idx, Sentence[]>` without scanning every token on every lookup.

## Structural checks (S1–S5)

Run first, because they catch typos — and a dangling index makes every coverage number below
meaningless. These are the ones that matter on an ordinary edit.

| Rule   | Checks                                                                                   |
| ------ | ---------------------------------------------------------------------------------------- |
| **S1** | `idx` is a unique integer, and `char` / `word` is unique, in both unit files             |
| **S2** | `kanji_list` and `kana_list` equal the union of their tokens' `targets` / `kana_targets` |
| **S3** | every `targets` / `kana_targets` index resolves to a real row                            |
| **S4** | every target actually appears in the token it's attached to                              |
| **S5** | `token.kanji` lists curriculum characters that are present in the surface                |
| **S6** | every `idx` still means what `content.lock.json` says it means (see below)               |

S4 is the one that catches inflection: `kana_targets: [8]` is `しまう`, which does not appear in the
surface `しまった`. Fix by adding `"lemma": "しまう"` to the token — S4 accepts a target that matches
either the surface or the lemma.

## The invariants (I1–I5)

### I1 — every sentence word is taught

Every `kind: "word"` token must resolve to one of:

- an example word of some kanji (`ja_kanji.csv` → `examples[].word`), or
- a kana word (`ja_kana.csv` → `word`), or
- a **function word** (see below).

Matching is on the token's `ja` **or** its `lemma`, so an inflected surface is fine as long as the
token declares the dictionary form it came from.

Numbers are exempt. A token written only in kanji numerals (`千二百`, `二十四`, and `何`/`数` with
them) is formed by rule from digits the curriculum already teaches one by one, and there are
infinitely many of them — so there is nothing to add to a db. Counters are *not* exempt: `円`, `分`,
`本` are ordinary vocabulary, which is why a number+counter phrase is written as two tokens.

### I2 — every kanji example word appears in ≥1 sentence

If a word is good enough to teach on a kanji's Learn card, the learner should meet it in context at
least once. Same surface-or-lemma matching as I1.

### I3 — every kanji appears in ≥3 sentences

Counted through `kanji_list`. Three is the floor at which the cloze builder can vary the sentence it
picks instead of always serving the same one.

### I4 — every kana word appears in ≥2 sentences

Counted through `kana_list`. Lower bar than kanji because kana words are also drilled directly in
kana practice — the sentences are reinforcement, not the only exposure. Function words are exempt.

### I5 — no kanji outside `ja_kanji.csv`

A kanji character appearing in a sentence that isn't a curriculum unit is unreadable unless the UI
furiganas it. The curriculum is meant to stay at roughly its current size, so this is the guard
against it drifting upward one convenient compound at a time.

The iteration mark `々` is exempt: it has no reading of its own and only repeats the character before
it (`時々` = ときどき), so it can never be a unit. Words using it (`別々`, `各々`, `時々`) are taught
as ordinary vocabulary in `ja_words.csv`.

## Function words

Grammar the sentences may use without teaching it as vocabulary: copula and helper verbs
(`する`, `ある`, `いる`, `なる`, `ください` and their inflections), demonstratives
(`この`/`その`/`あの`/`どの` and the `これ`/`ここ`/`こちら` families), interrogatives and indefinite
pro-forms (`なぜ`, `いつ`, `何か`, `何も`, `あちこち`), the nominalisers (`つもり`, `はず`, `せい`,
`おかげ`, `わけ`, `ため`), and a few connective adverbs (`とても`, `よく`, `また`, `もう`, `まだ`,
`いい`). A learner picks these up from exposure rather than from a card, so they are exempt from
**I1** and **I4**.

The list lives in `FUNCTION_WORDS` at the top of the checker. Extend it deliberately — every
addition is a word the app will show without ever teaching it.

**Okurigana is not on the list** and doesn't need to be: it is never its own token, it rides inside
the word it inflects (`食べる` is one token, not `食べ` + `る`).

## Tokenising a sentence

Where a token boundary falls is a content decision, and it decides what I1 can be satisfied by. Three
conventions, in the order to try them:

**Numbers and counters are separate tokens.** `一万円` is `一万` + `円`, `二十分` is `二十` + `分`. The
number half then passes free (numbers are exempt, above) and the counter half is ordinary vocabulary
that the curriculum teaches: `円`, `時間`, `本`, `人`, `分`, `半` all have their own registry entry.
Readings are assigned per half by hand, not cut out of the whole-word reading — counters change sound
with the number in front of them (`八本` はっぽん, `三百` さんびゃく, `二十分` にじゅっぷん).

**Verbal noun + する is two tokens.** `旅行します` is `旅行` + `します`: the noun is taught, and the
する half is already a function word, so the split costs nothing and shows the construction rather
than hiding it. This does *not* apply to verbs that merely end in する-shaped kana — `訳して` is the
te-form of `訳す`, one word, and wants a lemma instead.

**Otherwise, split only if the reading survives it.** A compound whose reading is exactly its pieces'
readings concatenated is a phrase, and splitting loses nothing: `男の人` = 男(おとこ) + の + 人(ひと),
`塩味` = 塩(しお) + 味(あじ). A compound with a reading of its own is a *word* and needs an entry:
`白米` is はくまい, not しろこめ; `市内` is しない; `美術館` is びじゅつかん. That test is the whole
distinction — if you cannot derive the reading from the parts, neither can a learner.

Every word token carries `kanji` and `targets`, **even when empty**. The loader iterates `targets`
unconditionally when checking cloze coverage, so a kana-only token that omits them (`グラム`) loads
as a crash rather than a warning. Note the invariants checker will not catch this: it reads the CSVs
directly and never exercises the loader, so run `npm run check` too.

## Changing content

### Sentences — free

Nothing persists a sentence id. `Progress` has no sentence-keyed state at all, so sentences can be
added, edited, deleted or renumbered with no effect on any learner. The only thing to watch is
coverage: deleting sentences can drop a kanji below **I3** or a kana word below **I4**, and the
checker will say so.

### Retiring a row

Every unit file has a `retired` column. **Mark rows retired rather than deleting them.** The loader
skips them, so their progress lies dormant and returns intact if they are ever un-retired, and the
row keeps the identity visible in the file itself rather than only in the lock. A live kanji
referencing a retired word is a load error, not a silent omission.

`npm run lock:content` folds retired rows into the lock's retired maps; a row that vanishes from the
file entirely is retired there too.

### Units — `idx` is an identity, not a row number

`idx` is a **stable identifier**, and three places key persisted data off it:

- `Progress.units` — the learner's level per kanji
- `Settings.disabledUnits` — which units they switched off
- the Supabase `drawings.unit_idx` column — every handwriting sample ever collected

**Deleting a unit is safe.** `normalizeProgress` passes `units` through verbatim
(`units: legacy.units ?? legacy.kanji ?? {}`), so the progress for a removed kanji is not erased —
it lies dormant, and returns intact if the unit ever comes back. The loader never assumes the
indexes are contiguous either: it builds a `byIdx` Map and sorts by idx, so gaps are fine.

**Renumbering is not safe, and nothing about it looks wrong.** Delete idx 50 and shift 51 down into
its place, and every learner's level-7 on the old kanji silently becomes level-7 on a different one,
along with all their handwriting samples. No error, no way to reconstruct the truth.

So the rule is: **retire indexes, never reuse them.** Leave the gap.

`dbs/content.lock.json` records `idx -> form` for every unit plus a `retired` map, and **S6** fails
if a live idx changes form, if an idx vanishes without being retired, or if a retired idx is reused
for something else. When a change is deliberate:

```bash
npm run lock:content     # re-stamps the lock, moving vanished indexes into `retired`
```

The lock diff is then the audit trail — a one-line change to `content.lock.json` in review means
someone reassigned an index, and that is exactly the change worth a second look.

## Fix recipes

| Failure                                                | Fix                                                                                                |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| **I1** — inflected form (`食べた`, `待って`, `書いて`) | Add `"lemma": "食べる"` to the token — the dictionary form has to be a word the registry already holds, or the lemma resolves to nothing. |
| **I1** — compound (`美術館`, `一万円`, `旅行します`)   | Split it if the reading survives the split, otherwise add it to the `examples` of one of its kanji. See **Tokenising a sentence**. |
| **I1** — proper noun (`田中`)                          | Add to `FUNCTION_WORDS` only if it's genuinely scaffolding; otherwise teach it.                    |
| **I2** — unused example word                           | Write a sentence using it, or add `lemma` where it already appears inflected.                      |
| **I3** — thin kanji                                    | Write more sentences targeting it.                                                                 |
| **I4** — thin kana word                                | Write a second sentence, or drop the word if it isn't worth two.                                   |
| **I5** — new kanji                                     | Either add the kanji as a unit (budget: a few, not a hundred) or rewrite the sentence to avoid it. |

Note how much of I1, I2 and I4 collapses into **one fix**: adding `lemma` to inflected tokens. A
token with a lemma satisfies I1, marks its dictionary form as "seen" for I2, and lets the kana
cloze find a word it currently cannot blank. Do that pass first and re-run before writing any new
sentences.

## Status

As of the last run — `npm run check:invariants` for the live numbers:

|     | Status | Notes                                                                                     |
| --- | ------ | ----------------------------------------------------------------------------------------- |
| S1  | ✓      |                                                                                           |
| S2  | ✓      |                                                                                           |
| S3  | ✓      |                                                                                           |
| S4  | ✓      |                                                                                           |
| S5  | ✓      |                                                                                           |
| S6  | ✓      |                                                                                           |
| S7  | ✓      |                                                                                           |
| I1  | ✗ 49   | 22 blocked on a dictionary form the registry lacks (`出来る`, `数える`, `訳す`…); 27 are compounds needing an entry (`美術館`, `白米`, `市内`…) or a split (`男の人`, `塩味`). |
| I2  | ✗ 1    | `飲料` — it only ever appears inside `飲料水`, so it needs a sentence of its own.          |
| I3  | ✓      |                                                                                           |
| I4  | ✓      |                                                                                           |
| I5  | ✓      |                                                                                           |

All twelve pass, so the checker runs as the last link of `npm run check` — breaking one of these
now breaks the build rather than being noticed later:

```jsonc
"check": "... && tsx scripts/check-kana.ts && tsx scripts/check-invariants.ts"
```

It reads the CSVs directly and never loads the content, so it is not a substitute for
`check-content.ts` earlier in the same chain: a token missing its `targets` array satisfies every
rule here and still fails to load.
