import { useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import type { GrammarVocab } from '@lib/grammar'
import { Icon } from '../Icon'
import { SpeakButton } from '../SpeakButton'
import { fonts, radius, spacing, type Palette } from '../../theme'
import { useColors, useStyles } from '../../hooks/theme'

/**
 * Part 1 — the exercise vocabulary, as a plain list you can scan and refer back to.
 *
 * Japanese by default: each row shows the written form and its reading, and nothing more. The
 * English is behind the reveal button — hold it and the reading swaps out for the gloss, the same
 * hold-to-reveal gesture the kanji Learn card uses, so the translation is always something you ask
 * for rather than something you read past.
 */
export function VocabIntro({
  words,
  note,
  onDone,
  doneLabel,
}: {
  words: GrammarVocab[]
  /** Line above the list explaining what the words are for. */
  note?: string
  onDone: () => void
  doneLabel: string
}) {
  const colors = useColors()
  const styles = useStyles(makeStyles)
  // The word whose gloss is currently held, if any. Only ever one at a time.
  const [held, setHeld] = useState<string | null>(null)

  return (
    <View>
      {note ? <Text style={styles.note}>{note}</Text> : null}

      <View style={styles.list}>
        {words.map((w) => {
          const on = held === w.word
          return (
            <View key={w.word} style={styles.row}>
              <Text style={styles.form}>{w.word}</Text>
              <Text style={[styles.reading, on && styles.meaning]} numberOfLines={2}>
                {on ? w.meaning : w.reading}
              </Text>
              <View style={styles.actions}>
                <SpeakButton text={w.reading} label={`Pronounce ${w.word}`} />
                <Pressable
                  onPressIn={() => setHeld(w.word)}
                  onPressOut={() => setHeld(null)}
                  style={[styles.eyeBtn, on && styles.eyeBtnOn]}
                  accessibilityLabel={`Meaning of ${w.word}`}
                  hitSlop={6}
                >
                  <Icon name="eye" size={16} color={on ? colors.onAccent : colors.muted} />
                </Pressable>
              </View>
            </View>
          )
        })}
      </View>

      {/* Reassurance before the one button that advances the section — the list stays reachable, so
          moving on isn't a commitment to having memorised anything. */}
      <Text style={styles.comeBack}>
        You can come back to this list at any time.
      </Text>

      <Pressable style={styles.doneBtn} onPress={onDone} accessibilityLabel={doneLabel}>
        <Icon name="check" size={13} color={colors.onAccent} />
        <Text style={styles.doneText}>{doneLabel}</Text>
      </Pressable>
    </View>
  )
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  note: { color: colors.muted, fontFamily: fonts.body, fontSize: 13, lineHeight: 19, marginBottom: spacing.md },
  list: { alignSelf: 'stretch' },
  // Three aligned columns — form | reading | speak — mirroring the kanji Learn card's example rows.
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 46,
    gap: spacing.sm,
    borderTopColor: colors.border,
    borderTopWidth: 1,
  },
  form: { flex: 1, fontSize: 26, color: colors.ink },
  reading: { flex: 1, color: colors.muted, fontFamily: fonts.body, fontSize: 15 },
  // The held gloss takes the reading's slot; the accent colour marks it as the revealed state.
  meaning: { color: colors.accentInk },
  actions: { width: 78, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6 },
  eyeBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  eyeBtnOn: { backgroundColor: colors.accent },
  comeBack: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  doneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    alignSelf: 'center',
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingVertical: 11,
    paddingHorizontal: spacing.xl,
    marginTop: spacing.sm,
  },
  doneText: { color: colors.onAccent, fontFamily: fonts.semibold, fontSize: 13 },
})
