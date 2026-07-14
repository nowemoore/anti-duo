import { View, Text, Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native'
import type { ReactNode } from 'react'
import type { Token, WordToken } from '@shared/types'
import { contentTokenDisplay } from '@lib/learned'
import { useLearned } from '../hooks/useLearned'
import { useDir } from '../hooks/useDir'
import { useContent } from '../context/ContentContext'
import { useLanguage } from '../context/LanguageContext'
import { useReveal } from './RevealStrip'
import { RootWord } from './RootWord'
import { fonts, type Palette } from '../theme'
import { useStyles } from '../hooks/theme'

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
}

// Sentences are a wrapping row of word-blocks (RN can't tap words inside flowing <Text>).
export function SentenceView({ tokens, overrides, revealMeanings = false }: Props) {
  const styles = useStyles(makeStyles)
  const isLearned = useLearned()
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
            <View key={i} style={[styles.block, styles.highlight]}>
              <View style={styles.blankWordBox} />
            </View>
          )
        }

        // Cloze blank: full word in native script with its reading, one char hidden.
        if (o?.blankChar) {
          const at = tok.surface.indexOf(o.blankChar)
          const before = at >= 0 ? tok.surface.slice(0, at) : tok.surface
          const after = at >= 0 ? tok.surface.slice(at + o.blankChar.length) : ''
          return (
            <View key={i} style={[styles.block, styles.highlight]}>
              <Text style={styles.rtAccent}>{tok.reading}</Text>
              <View style={styles.clozeBase}>
                {before ? <Text style={styles.baseAccent}>{before}</Text> : null}
                <View style={styles.blankBox} />
                {after ? <Text style={styles.baseAccent}>{after}</Text> : null}
              </View>
            </View>
          )
        }

        // Cloze reveal: full word in native script with its reading, highlighted, reading+meaning on hold.
        if (o?.forceReading) {
          return (
            <Hold key={i} text={`${tok.reading}  ·  ${tok.gloss}`} style={[styles.block, o.highlight && styles.highlight]}>
              {RubyView ? (
                <RubyView surface={tok.surface} reading={tok.reading} />
              ) : (
                <RootWord surface={tok.surface} spans={spansFor(tok)} style={styles.base} />
              )}
            </Hold>
          )
        }

        // The highlighted focus word is the subject of the question — always show it in native script, even
        // if answering just dropped its level below "introduced" (which would otherwise flip it to English).
        const display = contentTokenDisplay(tok, isLearned, index.lang)
        if (display === 'english' && !o?.highlight) {
          return (
            <View key={i} style={[styles.block, o?.highlight && styles.highlight]}>
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
            style={[styles.block, o?.highlight && styles.highlight]}
          >
            <RootWord surface={tok.surface} spans={spansFor(tok)} style={styles.base} />
          </Hold>
        )
      })}
    </View>
  )
}

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
  highlight: { backgroundColor: colors.accentSoft },
  // Fixed lineHeight so a sentence's rows are the same height whatever the script (kanji vs Arabic).
  base: { fontSize: 24, lineHeight: 32, color: colors.ink },
  baseAccent: { fontSize: 24, lineHeight: 32, color: colors.accentInk },
  scaffold: { fontSize: 24, lineHeight: 32, color: colors.muted },
  english: { fontSize: 20, color: colors.ink, fontFamily: fonts.body, fontVariant: ['small-caps'] },
  rtAccent: { fontSize: 11, lineHeight: 13, color: colors.accentInk, textAlign: 'center' },
  clozeBase: { flexDirection: 'row', alignItems: 'center' },
  blankBox: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderColor: colors.accent,
    borderStyle: 'dashed',
    borderRadius: 4,
    backgroundColor: colors.accentSoft,
  },
  blankWordBox: {
    width: 56,
    height: 30,
    borderWidth: 2,
    borderColor: colors.accent,
    borderStyle: 'dashed',
    borderRadius: 6,
    backgroundColor: colors.accentSoft,
  },
})
