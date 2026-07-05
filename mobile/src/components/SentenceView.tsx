import { View, Text, Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native'
import type { ReactNode } from 'react'
import type { Token } from '@shared/types'
import { contentTokenDisplay } from '@lib/learned'
import { useLearned } from '../hooks/useLearned'
import { Furigana } from './Furigana'
import { useReveal } from './RevealStrip'
import { colors, fonts } from '../theme'

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
  forceJaFurigana?: boolean
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
  const isLearned = useLearned()

  return (
    <View style={styles.sentence}>
      {tokens.map((tok, i) => {
        const o = overrides?.[i]

        if (tok.kind === 'particle') {
          return (
            <Text key={i} style={styles.scaffold}>
              {tok.kana}
            </Text>
          )
        }

        // Cloze blank: full word in Japanese with furigana, one char hidden.
        if (o?.blankChar) {
          const at = tok.ja.indexOf(o.blankChar)
          const before = at >= 0 ? tok.ja.slice(0, at) : tok.ja
          const after = at >= 0 ? tok.ja.slice(at + o.blankChar.length) : ''
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

        // Cloze reveal: full word in Japanese with furigana, highlighted, reading+meaning on hold.
        if (o?.forceJaFurigana) {
          return (
            <Hold key={i} text={`${tok.reading}  ·  ${tok.en}`} style={[styles.block, o.highlight && styles.highlight]}>
              <Furigana ja={tok.ja} reading={tok.reading} />
            </Hold>
          )
        }

        // The highlighted focus word is the subject of the question — always show it as kanji, even
        // if answering just dropped its level below "introduced" (which would otherwise flip it to English).
        const display = contentTokenDisplay(tok, isLearned)
        if (display === 'english' && !o?.highlight) {
          return (
            <View key={i} style={[styles.block, o?.highlight && styles.highlight]}>
              <Text style={styles.english}>{tok.en}</Text>
            </View>
          )
        }

        // Learned word: plain kanji; reading/meaning revealed on hold (into the strip).
        const parts: string[] = []
        if (!o?.hideReading) parts.push(tok.reading)
        if (revealMeanings && !o?.hideMeaning) parts.push(tok.en)
        return (
          <Hold
            key={i}
            text={parts.join('  ·  ')}
            enabled={parts.length > 0}
            style={[styles.block, o?.highlight && styles.highlight]}
          >
            <Text style={styles.base}>{tok.ja}</Text>
          </Hold>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  sentence: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    justifyContent: 'center',
    columnGap: 2,
    rowGap: 6,
  },
  block: { paddingHorizontal: 2, borderRadius: 6 },
  highlight: { backgroundColor: colors.accentSoft },
  base: { fontSize: 24, color: colors.ink },
  baseAccent: { fontSize: 24, color: colors.accentInk },
  scaffold: { fontSize: 24, color: colors.muted },
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
})
