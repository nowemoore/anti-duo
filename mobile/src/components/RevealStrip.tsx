import { createContext, useContext } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Icon } from './Icon'
import { VoweledText } from './VoweledText'
import { fonts, radius, spacing, type Palette } from '../theme'
import { useColors, useStyles } from '../hooks/theme'

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

/** Fixed-size dark strip pinned to the bottom of a practice card; shows held text or a hint. */
export function RevealStrip({ text, hint }: { text: string | null; hint: string }) {
  const colors = useColors()
  const styles = useStyles(makeStyles)
  return (
    <View style={styles.strip}>
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
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.c900,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  // flexShrink so a long reveal wraps within the strip instead of pushing the icon off the edge.
  text: { color: colors.onChip, fontFamily: fonts.body, fontSize: 13, textAlign: 'center', flexShrink: 1 },
  hint: { color: colors.onChipMuted, fontFamily: fonts.body, fontSize: 11, textAlign: 'center', flexShrink: 1 },
})
