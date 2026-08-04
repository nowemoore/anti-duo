// Topic: Polite non-past (〜ます).
//
// The minigame's verbs are NOT listed here — they're built from dbs/ja_kanji.csv at runtime, scoped
// to the verbs this learner has introduced, and conjugated from the `u-verb` / `ru-verb` tags in that
// file (see ../verbBank and ../../lang/jaVerbs). Only the time-word vocabulary and the frames are
// authored, since those teach rather than test. `unitIdxs` are ja_kanji.csv `idx` values, so passing
// this subsection credits the same units the kanji curriculum tracks; よく is kana-only and so has
// none.
import { GRAMMAR_MIN_ITEMS } from '../../../../shared/constants'
import { allVerbItems, buildVerbBank } from '../verbBank'
import type { GrammarCue, GrammarTopic, GrammarVocab } from '../types'

/** Part 1 — the time/frequency words the minigame frames are built from. */
const VOCAB: GrammarVocab[] = [
  { word: '毎日', reading: 'まいにち', meaning: 'every day', unitIdxs: [28, 14] },
  { word: '毎朝', reading: 'まいあさ', meaning: 'every morning', unitIdxs: [28, 162] },
  { word: '毎週', reading: 'まいしゅう', meaning: 'every week', unitIdxs: [28, 27] },
  { word: '今日', reading: 'きょう', meaning: 'today', unitIdxs: [24, 14] },
  { word: '明日', reading: 'あした', meaning: 'tomorrow', unitIdxs: [209, 14] },
  { word: '今', reading: 'いま', meaning: 'now', unitIdxs: [24] },
  { word: '来週', reading: 'らいしゅう', meaning: 'next week', unitIdxs: [55, 27] },
  { word: '来月', reading: 'らいげつ', meaning: 'next month', unitIdxs: [55, 15] },
  { word: '時々', reading: 'ときどき', meaning: 'sometimes', unitIdxs: [22] },
  // よく is kana-only, so ja_kanji.csv has no entry to source this gloss from.
  { word: 'よく', reading: 'よく', meaning: 'often', unitIdxs: [] },
]

/**
 * Frames the minigame drops each verb into. `habitual` and `future` are drawn ~50/50 per attempt so
 * the game can't imply ます is a future tense — it's non-past, and covers both readings.
 * 今日 and 今 are omitted: both are ambiguous between the two, which would muddy the balance.
 */
const CUES: GrammarCue[] = [
  { word: '毎日', reading: 'まいにち', meaning: 'every day', kind: 'habitual' },
  { word: '毎朝', reading: 'まいあさ', meaning: 'every morning', kind: 'habitual' },
  { word: '毎週', reading: 'まいしゅう', meaning: 'every week', kind: 'habitual' },
  { word: '時々', reading: 'ときどき', meaning: 'sometimes', kind: 'habitual' },
  // よく is the one gloss not taken from ja_kanji.csv — it's kana-only, so the db has no entry.
  { word: 'よく', reading: 'よく', meaning: 'often', kind: 'habitual' },
  { word: '明日', reading: 'あした', meaning: 'tomorrow', kind: 'future' },
  { word: '来週', reading: 'らいしゅう', meaning: 'next week', kind: 'future' },
  { word: '来月', reading: 'らいげつ', meaning: 'next month', kind: 'future' },
]

/**
 * The item ids this topic shipped with, before the bank became learner-derived. Attempt history is
 * keyed by item id, so without this map every attempt recorded earlier would lose its per-item
 * detail — the reflection's "what you missed" panel would come up empty for them. Frozen: never
 * edit these. Self-expiring in practice, as GRAMMAR_ATTEMPT_HISTORY ages old attempts out.
 */
const LEGACY_ITEM_IDS: Record<string, string> = {
  r01: 'v:食べる', r02: 'v:見る', r03: 'v:起きる',
  r04: 'v:開ける', r05: 'v:教える', r06: 'v:答える',
  r07: 'v:考える', r08: 'v:始める', r09: 'v:借りる',
  r10: 'v:止める', r11: 'v:入れる', r12: 'v:集める',
  r13: 'v:飲む', r14: 'v:読む', r15: 'v:書く',
  r16: 'v:聞く', r17: 'v:行く', r18: 'v:会う',
  r19: 'v:買う', r20: 'v:使う', r21: 'v:待つ',
  r22: 'v:持つ', r23: 'v:話す', r24: 'v:死ぬ',
  r25: 'v:運ぶ', r26: 'v:急ぐ', r27: 'v:売る',
  r28: 'v:知る', r29: 'v:作る', r30: 'v:習う',
  e31: 'v:帰る', e32: 'v:入る', e33: 'v:走る',
  e34: 'v:切る',
}

// The form's grammatical name is deliberately absent from every pre-reveal string below — titles,
// blurb, section labels. It appears only in `explanation.revealedName`, which part 4 renders; until
// then the learner sees nothing but 〜ます and has to derive the pattern from the game.
export const politeNonPast: GrammarTopic = {
  id: 'ja.polite-non-past',
  titleNative: '〜ます',
  titleEn: 'The 〜ます form',
  blurb: 'Turn dictionary-form verbs into 〜ます.',

  vocab: {
    title: 'Vocabulary',
    note: 'You may need these words throughout the exercise.',
    words: VOCAB,
  },

  minigame: {
    title: 'Which form is right?',
    intro:
      "If you're new to Japanese grammar, you may get a lot of these wrong. That's okay. Focus on the patterns you notice rather than the score — you'll write down what you spot in the next part, and you can retry as many times as you like.",
    // Items are drawn from the verbs this learner has learned, conjugated from the class tagged in
    // dbs/ja_kanji.csv — so the exercise tests vocabulary they own and grows as they study.
    buildItems: (ctx, scope) => (scope === 'all' ? allVerbItems(ctx.index) : buildVerbBank(ctx)),
    minItems: GRAMMAR_MIN_ITEMS,
    legacyItemIds: LEGACY_ITEM_IDS,
    cues: CUES,
  },

  reflection: {
    title: 'Reflection',
    prompts: [
      {
        id: 'q1',
        prompt: 'Which items did you get wrong (and what did they have in common)?',
        showMissedItems: true,
      },
      {
        id: 'q2',
        prompt:
          "Write a rule you noticed as you'd explain it to someone: Do all verbs follow the same paradigm? If not, what makes the difference?",
      },
      { id: 'q3', prompt: 'Do you suspect any exceptions?' },
      { id: 'q4', prompt: 'When do you think it is appropriate to use this form?' },
    ],
  },

  explanation: {
    title: 'How 〜ます works',
    // First time the form is named — everything before this point says only 〜ます.
    revealedName: { native: '丁寧形（非過去）', en: 'Polite non-past' },
    blocks: [
      {
        heading: 'Two verb classes, two ways to build ます',
        body: [
          'Every Japanese verb belongs to one of two regular classes, and the class decides how you get to the polite form.',
          'Ru-verbs (一段) are the simple case: drop the final る and add ます. Nothing else changes.',
          'U-verbs (五段) end in a consonant sound. Shift that final kana to its い-row partner, then add ます — む becomes み, く becomes き, つ becomes ち, す becomes し, ぬ becomes に, ぶ becomes び, ぐ becomes ぎ, う becomes い, and る becomes り.',
        ],
        examples: [
          {
            from: [
              { text: 'たべ', role: 'stem' },
              { text: 'る', role: 'dropped' },
            ],
            to: [
              { text: 'たべ', role: 'stem' },
              { text: 'ます', role: 'ending' },
            ],
            note: 'Ru-verb: 食べる → 食べます. The る is simply dropped.',
          },
          {
            from: [
              { text: 'の', role: 'stem' },
              { text: 'む', role: 'dropped' },
            ],
            to: [
              { text: 'の', role: 'stem' },
              { text: 'み', role: 'dropped' },
              { text: 'ます', role: 'ending' },
            ],
            note: 'U-verb: 飲む → 飲みます. む shifts to み, then ます is added.',
          },
          {
            from: [
              { text: 'か', role: 'stem' },
              { text: 'く', role: 'dropped' },
            ],
            to: [
              { text: 'か', role: 'stem' },
              { text: 'き', role: 'dropped' },
              { text: 'ます', role: 'ending' },
            ],
            note: 'U-verb: 書く → 書きます. く shifts to き.',
          },
        ],
      },
      {
        heading: 'The る-ending verbs that fool you',
        body: [
          'A verb ending in る is usually a ru-verb — but not always. 帰る, 入る, 走る and 切る all end in る and all behave as u-verbs, so their る shifts to り rather than being dropped.',
          'That gives 帰ります, 入ります, 走ります and 切ります. The tempting 帰ます and 入ます are simply wrong.',
          "The game draws on the verbs you've learned so far, so depending on which kanji you know, several of these — or none of them — may have come up. They're the group to watch for either way.",
          'There is no reliable way to tell these apart by looking at them: class membership has to be memorized with the verb. 売る, 知る, 作る, 分かる and 通る belong to the same group.',
        ],
        examples: [
          {
            from: [
              { text: 'かえ', role: 'stem' },
              { text: 'る', role: 'dropped' },
            ],
            to: [
              { text: 'かえ', role: 'stem' },
              { text: 'り', role: 'dropped' },
              { text: 'ます', role: 'ending' },
            ],
            note: '帰る → 帰ります, not 帰ます. It looks like a ru-verb but conjugates as a u-verb.',
          },
        ],
      },
      {
        heading: 'ます is non-past, not future',
        body: [
          'One form covers both what you do regularly and what you will do. Japanese draws the line between past and non-past, not between present and future — the time word tells you which reading is meant.',
          'So the same 起きます means "get up" habitually or "will get up" tomorrow, depending only on the frame around it.',
        ],
        examples: [
          {
            from: [
              { text: '毎朝 ', role: 'plain' },
              { text: 'おき', role: 'stem' },
              { text: 'ます', role: 'ending' },
            ],
            to: [
              { text: '明日 ', role: 'plain' },
              { text: 'おき', role: 'stem' },
              { text: 'ます', role: 'ending' },
            ],
            note: '毎朝起きます "I get up every morning" vs 明日起きます "I will get up tomorrow" — identical verb, different time word.',
          },
        ],
      },
      {
        heading: 'Footnote: the two true irregulars',
        footnote: true,
        body: [
          'Only two verbs are genuinely irregular: する becomes します, and 来る becomes きます. Neither appears in the game above.',
          'Everything else follows one of the two patterns — including the deceptive る-enders, which are ordinary u-verbs wearing a disguise.',
        ],
      },
    ],
  },
}
