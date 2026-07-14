import { createContext, useContext } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { VoweledText } from './VoweledText'
import { fonts, radius, spacing, type Palette } from '../theme'
import { useStyles } from '../hooks/theme'

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
  const styles = useStyles(makeStyles)
  return (
    <View style={styles.strip}>
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
    justifyContent: 'center',
    backgroundColor: colors.c900,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  text: { color: colors.onChip, fontFamily: fonts.body, fontSize: 15, textAlign: 'center' },
  hint: { color: colors.onChipMuted, fontFamily: fonts.body, fontSize: 12, textAlign: 'center', fontStyle: 'italic' },
})
