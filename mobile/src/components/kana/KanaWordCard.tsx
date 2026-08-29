import { useState } from 'react'
import { View, Text, ScrollView, StyleSheet } from 'react-native'
import type { KanaWord } from '@shared/types'
import { TapScale } from '../TapScale'
import { Icon } from '../Icon'
import { RevealStrip, useReveal } from '../RevealStrip'
import { SpeakButton } from '../SpeakButton'
import { useScreenHeader } from '../../context/HeaderContext'
import { edge, fonts, radius, shadow, spacing, type Palette } from '../../theme'
import { useColors, useStyles } from '../../hooks/theme'

/** How many usage phrases the card has room for. The db ships one today; the list takes more. */
const MAX_EXAMPLES = 3

/**
 * One kana word, on the kanji Learn card's layout: the word large and centred, the magnifying glass
 * balanced beside it, then the meaning, then the phrases it turns up in.
 *
 * What the glass reveals is what differs by course. A kanji opens onto its radical and components; a
 * word written phonetically has no such parts, so it opens onto where the word came from instead
 * (ビル ← ビルディング) — the only breakdown it can have.
 *
 * A screen of its own, pushed on the stack the way a kanji's card is: same back chevron, same swipe.
 * Nothing here is a step to complete — a kana word needs no tracing and no example vocabulary of its
 * own, because it is already the word. This is a place to meet it, not a card to finish.
 *
 * The phrases carry no English on screen: hold one and its meaning lands in the strip below, the way
 * every other card in the app treats a translation. Reading the Japanese has to be the thing you try
 * first, and a gloss sitting next to it removes the trying.
 *
 * `embedded` is the same card inside a Learn deck rather than on a screen of its own: the deck owns
 * the panel, the header and the reveal strip, so the card drops all three and speaks to the deck's
 * reveal channel instead. Everything above the chrome — what the card actually says — is identical,
 * which is the point: a word met in Learn and a word looked up in the list are the same page.
 */
export function KanaWordCard({ word, embedded = false }: { word: KanaWord; embedded?: boolean }) {
  const colors = useColors()
  const styles = useStyles(makeStyles)
  const [expanded, setExpanded] = useState(false)
  const examples = word.examples.slice(0, MAX_EXAMPLES)
  const hasNote = Boolean(word.note)
  /** The phrase currently being held, shown in the strip. */
  const [held, setHeld] = useState<string | null>(null)
  // Embedded, the deck's strip is the one on screen — so hold text goes to its channel, not ours.
  const reveal = useReveal()
  const show = (text: string | null) => (embedded ? (text ? reveal.show(text) : reveal.hide()) : setHeld(text))

  useScreenHeader() // the system bar owns the back control; the deck sets its own step label

  return (
    <View style={embedded ? styles.embedded : styles.screen}>
      <View style={[styles.card, embedded && styles.cardBare]}>
        <View style={styles.formRow}>
          {/* Balances the glass so the word itself stays centred, as on the kanji card. */}
          {hasNote && <View style={styles.formSpacer} />}
          <Text style={styles.bigForm}>{word.word}</Text>
          {hasNote && (
            <TapScale
              style={[styles.revealBtn, expanded && styles.revealBtnOn]}
              onPress={() => setExpanded((v) => !v)}
              accessibilityLabel="Where this word comes from"
            >
              <Icon
                name="magnifying-glass"
                size={13}
                color={expanded ? colors.onAccent : colors.ink}
              />
            </TapScale>
          )}
        </View>

        {/*
          The kanji spelling that exists but isn't normally used (有る for ある). Small and grey: a
          footnote about the word, not how you should write it. The line is rendered either way, so a
          word without one is the same height as a word with one.
        */}
        <Text style={styles.rare}>{word.rareKanji ?? ' '}</Text>

        {expanded && word.note ? (
          <ScrollView style={styles.noteWrap}>
            <Text style={styles.note}>{word.note}</Text>
          </ScrollView>
        ) : null}

        <View style={styles.glossRow}>
          <Text style={styles.gloss}>{word.gloss.join(', ')}</Text>
          <SpeakButton text={word.word} label={`Pronounce ${word.word}`} />
        </View>

        {/* The word in use. Phrases, not vocabulary: a kana word teaches no other words. */}
        <View style={styles.examples}>
          {examples.map((ex, i) => (
            <TapScale
              key={i}
              style={styles.example}
              onPressIn={() => show(`${ex.word}  ·  ${ex.meaning}`)}
              onPressOut={() => show(null)}
              accessibilityLabel={`Meaning of ${ex.word}`}
            >
              <Text style={styles.exWord}>{ex.word}</Text>
              <Text style={styles.exReading}>{ex.reading}</Text>
            </TapScale>
          ))}
        </View>
      </View>

      {/* The same band Practice and Learn use, below the card and edge to edge. */}
      {!embedded && <RevealStrip text={held} hint="Hold a phrase to reveal its meaning here" />}
    </View>
  )
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  // The card floats in the screen rather than filling it — a word is a small thing to say.
  screen: { flex: 1, justifyContent: 'center' },
  // Inside a Learn deck the panel is already drawn around us; we're just the contents of it.
  embedded: { alignSelf: 'stretch' },
  // The strip is edge to edge below the card, so the screen's own gutter is cancelled by it.
  // The kanji Learn card's panel, exactly: same fill, same hairline, same radius. A kana word and a
  // kanji are the same kind of object — something you opened to look at — so they get the same one.
  card: {
    ...shadow,
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderWidth: edge,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  cardBare: { ...shadow, shadowOpacity: 0, elevation: 0, backgroundColor: 'transparent', borderWidth: 0, padding: 0 },
  formRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', gap: 8 },
  formSpacer: { width: 34 },
  // No fontFamily: the bundled Latin faces carry no kana, and the OS gothic is what kana is set in
  // everywhere else in the course — the brush face is reserved for kanji as objects of study.
  bigForm: { color: colors.ink, fontSize: 56, lineHeight: 66, textAlign: 'center' },
  rare: { color: colors.muted, fontFamily: fonts.body, fontSize: 13, minHeight: 18 },
  revealBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  revealBtnOn: { backgroundColor: colors.accent },
  noteWrap: { alignSelf: 'stretch', maxHeight: 140, marginTop: spacing.xs },
  note: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  glossRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  gloss: { color: colors.ink, fontFamily: fonts.body, fontSize: 15, lineHeight: 22 },
  examples: { alignSelf: 'stretch' },
  example: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 48,
    borderTopColor: colors.border,
    borderTopWidth: 1,
  },
  exWord: { flex: 1, color: colors.ink, fontSize: 22 },
  // The reading, not the meaning: it says how to say the phrase without saying what it means.
  exReading: { color: colors.muted, fontFamily: fonts.body, fontSize: 12 },
})
