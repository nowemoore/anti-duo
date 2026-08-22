import { createContext, useContext } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Icon } from './Icon'
import { VoweledText } from './VoweledText'
import { fonts, spacing, type Palette } from '../theme'
import { useColors, useStyles } from '../hooks/theme'

/**
 * The band's height. Exported so a screen with nothing to reveal can hold the same space open —
 * see {@link RevealSpacer}.
 */
export const REVEAL_HEIGHT = 54

export interface RevealApi {
  show: (text: string) => void
  hide: () => void
}

const RevealContext = createContext<RevealApi | null>(null)
export const RevealContextProvider = RevealContext.Provider

const NOOP: RevealApi = { show: () => {}, hide: () => {} }

/** Access the practice card's bottom reveal strip. Returns a no-op outside a provider. */
export function useReveal(): RevealApi {
  return useContext(RevealContext) ?? NOOP
}

/**
 * Holds a strip's worth of space open on a screen that has nothing to reveal.
 *
 * Every card in the app is `flex: 1`, so a screen without a strip gives its card the strip's 54pt
 * as well and the card comes out visibly taller than every other one. Reserving the space keeps a
 * card the same size wherever it appears.
 */
export function RevealSpacer() {
  return <View pointerEvents="none" style={{ height: REVEAL_HEIGHT }} />
}

/**
 * Fixed-height dark strip showing held text or a hint.
 *
 * Always a square-cornered band spanning its container, never a floating rounded pill — `bleed` only
 * picks which container that is. `screen` cancels the study screen's side padding so the band runs
 * edge to edge below the practice card; `card` cancels a PartCard body's padding so it spans that
 * card instead. A PartCard clips its children, so `screen` inside one would simply be cut off.
 *
 * Both negative margins are load-bearing: they have to match the padding they're cancelling
 * (`studyBody` in App.tsx, and PartCard's `body`).
 */
export function RevealStrip({
  text,
  hint,
  bleed = 'screen',
}: {
  text: string | null
  hint: string
  /** Which container the band spans. See the note above. */
  bleed?: 'screen' | 'card'
}) {
  const colors = useColors()
  const styles = useStyles(makeStyles)
  return (
    <View style={[styles.strip, bleed === 'screen' ? styles.bleedScreen : styles.bleedCard]}>
      {/* Leading eye marks the strip as the place revealed text lands, in both states. */}
      <Icon name="eye" size={13} color={text ? colors.onChipAccent : colors.onChipMuted} />
      {text ? (
        <VoweledText text={text} style={styles.text} numberOfLines={2} />
      ) : (
        <Text style={styles.hint} numberOfLines={2}>
          {hint}
        </Text>
      )}
    </View>
  )
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  strip: {
    alignSelf: 'stretch',
    height: REVEAL_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.c900,
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  bleedScreen: { marginHorizontal: -spacing.lg, marginBottom: -spacing.md },
  // Only horizontal: the grammar minigame has its pager below the strip, so the card's bottom padding
  // still has to be there.
  bleedCard: { marginHorizontal: -spacing.lg },
  // flexShrink so a long reveal wraps within the strip instead of pushing the icon off the edge.
  text: { color: colors.onChip, fontFamily: fonts.body, fontSize: 13, textAlign: 'center', flexShrink: 1 },
  hint: { color: colors.onChipMuted, fontFamily: fonts.body, fontSize: 11, textAlign: 'center', flexShrink: 1 },
})
