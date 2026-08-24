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
| `ja_kanji.csv`     | 306 kanji units                             | `idx`, `char`, `examples`, `distractors`, `retired`          |
| `ja_words.csv`     | 853 words written with kanji                | `idx`, `word`, `reading`, `meaning`, `kanji_idxs`, `retired` |
| `ja_kana.csv`      | 268 kana words (123 hiragana, 145 katakana) | `idx`, `word`, `script`, `examples`                          |
| `ja_sentences.csv` | 1100 sentences                              | `id`, `kanji_list`, `kana_list`, `tokens`                    |

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

## Function words

Grammar the sentences may use without teaching it as vocabulary: copula and helper verbs
(`する`, `ある`, `いる`, `なる`, `ください` and their inflections), demonstratives
(`この`/`その`/`あの`/`どの` and the `これ`/`ここ`/`こちら` families), and a few connective adverbs
(`とても`, `よく`, `また`, `もう`, `まだ`, `いい`). A learner picks these up from exposure rather
than from a card, so they are exempt from **I1** and **I4**.

The list lives in `FUNCTION_WORDS` at the top of the checker. Extend it deliberately — every
addition is a word the app will show without ever teaching it.

**Okurigana is not on the list** and doesn't need to be: it is never its own token, it rides inside
the word it inflects (`食べる` is one token, not `食べ` + `る`).

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
| **I1** — inflected form (`食べた`, `待って`, `書いて`) | Add `"lemma": "食べる"` to the token. This is the existing convention — 45 tokens already use it.  |
| **I1** — compound (`会社員`, `一万円`, `一年間`)       | Add it to the `examples` of one of its kanji, or split it into tokens that are each taught.        |
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

|     | Status | Notes                                                                                                                    |
| --- | ------ | ------------------------------------------------------------------------------------------------------------------------ |
| S1  | ✓      |                                                                                                                          |
| S2  | ✓      |                                                                                                                          |
| S3  | ✓      |                                                                                                                          |
| S4  | ✗ 15   | All inflected kana targets — add `lemma`.                                                                                |
| S5  | ✗ 1    | `s265` declares 民 in 市民, which isn't a unit.                                                                          |
| S6  | ✓      |                                                                                                                          |
| S7  | ✓      |                                                                                                                          |
| I1  | ✗ 356  | Mostly inflections and compounds.                                                                                        |
| I2  | ✗ 231  | Many are counting compounds (`二日`, `四時`) never used in a sentence.                                                   |
| I3  | ✗ 55   | The 55 newly added kanji have no sentences yet.                                                                          |
| I4  | ✗ 241  | Most kana words appear exactly once — expected, the corpus was written kanji-first.                                      |
| I5  | ✗ 72   | 179 of the 182 affected sentences are pre-existing (`s001`–`s882`); the new batch added three: `s983`, `s1022`, `s1068`. |

Because four of the five fail today, the checker is **not** wired into `npm run check` — it would
break the whole chain. Add it there once it goes green:

```jsonc
"check": "... && tsx scripts/check-kana.ts && tsx scripts/check-invariants.ts"
```
