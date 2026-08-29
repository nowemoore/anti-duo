import { View, Text, Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import type { ReactNode } from 'react'
import type { Token, WordToken } from '@shared/types'
import { contentTokenDisplay } from '@lib/learned'
import { useLearned, useMetWord } from '../hooks/useLearned'
import { useDir } from '../hooks/useDir'
import { useContent } from '../context/ContentContext'
import { useLanguage } from '../context/LanguageContext'
import { useReveal } from './RevealStrip'
import { RootWord } from './RootWord'
import { fonts, type Palette } from '../theme'
import { useColors, useStyles } from '../hooks/theme'

/** The blank's wave: amplitude from the midline, one full period's width, and the stroke's weight. */
const WAVE_AMPLITUDE = 1.6
const WAVE_PERIOD = 7
const WAVE_STROKE = 1

/**
 * The gap in a sentence, drawn as a wave on the baseline.
 *
 * A straight rule is the same mark the app uses for a divider, a card edge and a text field; a wave
 * is a mark that only ever means "something belongs here". It is also how a gap has been written by
 * hand for as long as people have left them, which is the register this wants — a pen's mark in a
 * sentence, not a slot in a form.
 *
 * Sized in pixels rather than by a viewBox, so the stroke stays hairline-fine whatever the width the
 * caller gives it.
 */
function WaveRule({ width, color }: { width: number; color: string }) {
  // Room for the crest, the trough and the stroke's own width, so neither end is clipped.
  const height = WAVE_AMPLITUDE * 2 + WAVE_STROKE
  const mid = height / 2
  /*
   * A run of quadratic arcs, alternating up and down — one period is a crest then a trough. The
   * control point sits at twice the amplitude, because a quadratic curve only reaches halfway to it.
   */
  const half = WAVE_PERIOD / 2
  let d = `M0 ${mid}`
  for (let x = 0, up = true; x < width; x += half, up = !up) {
    const to = Math.min(x + half, width)
    const ctrl = mid + (up ? -2 : 2) * WAVE_AMPLITUDE
    d += ` Q${x + (to - x) / 2} ${ctrl} ${to} ${mid}`
  }
  return (
    <Svg width={width} height={height} pointerEvents="none">
      <Path d={d} stroke={color} strokeWidth={WAVE_STROKE} fill="none" strokeLinecap="round" />
    </Svg>
  )
}

/** A word-block that reveals its reading/meaning in the practice strip while held. */
function Hold({
  text,
  enabled = true,
  style,
  children,
}: {
  text: string
  enabled?: boolean
  style?: StyleProp<ViewStyle>
  children: ReactNode
}) {
  const reveal = useReveal()
  const can = enabled && text.length > 0
  return (
    <Pressable
      onPressIn={can ? () => reveal.show(text) : undefined}
      onPressOut={can ? reveal.hide : undefined}
      style={style}
    >
      {children}
    </Pressable>
  )
}

export interface TokenOverride {
  blankChar?: string
  /** Hide the entire focus word (root-cloze: which unit fills the slot?). */
  blankWord?: boolean
  forceReading?: boolean
  highlight?: boolean
  hideReading?: boolean
  hideMeaning?: boolean
}

interface Props {
  tokens: Token[]
  overrides?: Record<number, TokenOverride>
  revealMeanings?: boolean
  /**
   * Rendered as the sentence's last item, inside the wrapping row.
   *
   * For the play button, which belongs *to* the sentence: beside the block it centred itself against
   * however many lines the sentence happened to take, floating in the margin. Flowed in with the
   * words it lands after the final character, the way a full stop does.
   */
  trailing?: ReactNode
}

// Sentences are a wrapping row of word-blocks (RN can't tap words inside flowing <Text>).
export function SentenceView({ tokens, overrides, revealMeanings = false, trailing }: Props) {
  const styles = useStyles(makeStyles)
  const colors = useColors()
  const isLearned = useLearned()
  const isMetWord = useMetWord()
  const index = useContent()
  const pack = useLanguage()
  const RubyView = pack.Ruby
  const { rtl } = useDir()
  // Root letters to highlight within a word token (Arabic); null/absent → plain word.
  const spansFor = (t: WordToken) => pack.rootSpans?.(t.surface, t.units[0] ?? '')

  return (
    <View style={[styles.sentence, rtl && styles.sentenceRtl]}>
      {tokens.map((tok, i) => {
        const o = overrides?.[i]

        if (tok.kind === 'particle') {
          return (
            <Text key={i} style={styles.scaffold}>
              {tok.surface}
            </Text>
          )
        }

        // Root-cloze blank: the whole focus word is hidden — the question is which unit fills it.
        if (o?.blankWord) {
          return (
            <View key={i} style={styles.block}>
              <View style={styles.blankWordBox}>
                <WaveRule width={BLANK_WORD_WIDTH} color={colors.accent} />
              </View>
            </View>
          )
        }

        // Cloze blank: full word in native script with its reading, one char hidden.
        if (o?.blankChar) {
          const at = tok.surface.indexOf(o.blankChar)
          const before = at >= 0 ? tok.surface.slice(0, at) : tok.surface
          const after = at >= 0 ? tok.surface.slice(at + o.blankChar.length) : ''
          return (
            <View key={i} style={styles.block}>
              {/* Plain furigana, not accented. The reading is the one part of a cloze that isn't
                  being asked about — it's the clue you read *off* to work out the missing character
                  — so colouring it made the question look like it was about the reading too. */}
              <Text style={styles.rt}>{tok.reading}</Text>
              <View style={styles.clozeBase}>
                {before ? <Text style={styles.baseAccent}>{before}</Text> : null}
                <View style={styles.blankBox}>
                  <WaveRule width={BLANK_CHAR_WIDTH} color={colors.accent} />
                </View>
                {after ? <Text style={styles.baseAccent}>{after}</Text> : null}
              </View>
            </View>
          )
        }

        // Cloze reveal: full word in native script with its reading, highlighted, reading+meaning on hold.
        if (o?.forceReading) {
          return (
            <Hold key={i} text={`${tok.reading}  ·  ${tok.gloss}`} style={styles.block}>
              {RubyView ? (
                <RubyView surface={tok.surface} reading={tok.reading} />
              ) : (
                <RootWord
                  surface={tok.surface}
                  spans={spansFor(tok)}
                  style={o.highlight ? styles.baseAccent : styles.base}
                />
              )}
            </Hold>
          )
        }

        // The highlighted focus word is the subject of the question — always show it in native script, even
        // if answering just dropped its level below "introduced" (which would otherwise flip it to English).
        const display = contentTokenDisplay(tok, isLearned, index.lang, isMetWord)
        if (display === 'english' && !o?.highlight) {
          return (
            <View key={i} style={styles.block}>
              <Text style={styles.english}>{tok.gloss}</Text>
            </View>
          )
        }

        // Learned word: plain native form; reading/meaning revealed on hold (into the strip).
        const parts: string[] = []
        if (!o?.hideReading) parts.push(tok.reading)
        if (revealMeanings && !o?.hideMeaning) parts.push(tok.gloss)
        return (
          <Hold
            key={i}
            text={parts.join('  ·  ')}
            enabled={parts.length > 0}
            style={styles.block}
          >
            <RootWord
              surface={tok.surface}
              spans={spansFor(tok)}
              style={o?.highlight ? styles.baseAccent : styles.base}
            />
          </Hold>
        )
      })}
      {/* A hair of space, so it reads as following the sentence rather than being stuck to it. */}
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
    </View>
  )
}

/** One CJK glyph's advance at the sentence font size, and a short word's — see `blankBox`. */
const BLANK_CHAR_WIDTH = 24
const BLANK_WORD_WIDTH = 56

const makeStyles = (colors: Palette) => StyleSheet.create({
  sentence: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    justifyContent: 'center',
    columnGap: 2,
    rowGap: 6,
  },
  // RTL (Arabic): word-blocks flow right-to-left so sentence order reads correctly.
  sentenceRtl: { flexDirection: 'row-reverse' },
  block: { paddingHorizontal: 2, borderRadius: 6 },
  trailing: { marginLeft: 4 },
  // Fixed lineHeight so a sentence's rows are the same height whatever the script (kanji vs Arabic).
  // Klee One for every Japanese run. Sentences are context to read rather than forms to copy, and
  // pinning the family keeps them identical across devices where the OS default would not. The
  // English gloss below stays on the Latin body face.
  base: { fontSize: 24, lineHeight: 32, color: colors.ink, fontFamily: fonts.klee },
  /*
   * The focus word: coloured, not filled.
   *
   * A tinted block behind it read as a UI element sitting in the sentence — a chip, a button,
   * something you might tap — when all it means is "this is the word the question is about". Ink
   * says that without putting furniture in the middle of a line you are trying to read.
   */
  baseAccent: { fontSize: 24, lineHeight: 32, color: colors.accentInk, fontFamily: fonts.klee },
  scaffold: { fontSize: 24, lineHeight: 32, color: colors.muted, fontFamily: fonts.klee },
  english: { fontSize: 20, color: colors.ink, fontFamily: fonts.body, fontVariant: ['small-caps'] },
  // Same as the pack's own furigana (see lang/ja/Furigana): small, muted, above the word.
  rt: { fontSize: 11, lineHeight: 13, color: colors.muted, textAlign: 'center', fontFamily: fonts.klee },
  /*
   * Fixed to the base line box so blanked and revealed states occupy identical space. The blank used
   * to be a 22px box where the kanji that replaces it is a 24px glyph on a 32px line, so revealing
   * an answer nudged the whole sentence sideways and down.
   */
  clozeBase: { flexDirection: 'row', alignItems: 'center', height: 32 },
  /*
   * A wave on the baseline, not a box.
   *
   * The gap in a sentence is a space to be filled, and a pen's squiggle is how that has been written
   * for as long as people have left gaps; a dashed box says "form field". The box is still here as a
   * container — its width is what keeps the line from shifting when the answer replaces it — but it
   * draws nothing itself.
   */
  blankBox: {
    // Matches one CJK glyph's advance at the base font size, so the swap is width-stable.
    width: BLANK_CHAR_WIDTH,
    height: 24,
    justifyContent: 'flex-end',
  },
  blankWordBox: {
    width: BLANK_WORD_WIDTH,
    height: 30,
    justifyContent: 'flex-end',
  },
})
