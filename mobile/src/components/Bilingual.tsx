import { View, Text, StyleSheet } from 'react-native'
import { useDir } from '../hooks/useDir'
import { fonts, type Palette } from '../theme'
import { useStyles } from '../hooks/theme'

// Stacked native-over-English label (mirrors the web Bilingual). Native text is left on the
// system font on purpose — the bundled Latin fonts (Manrope/Fraunces) have no non-Latin (CJK/Arabic) glyphs,
// so forcing them would tofu; the OS substitutes a JP/Arabic font for those runs. The native line gets
// the active script's base direction so mixed Arabic + numerals (e.g. headers) read correctly.
export function Bilingual({ native, en, large }: { native: string; en: string; large?: boolean }) {
  const { writingDirection } = useDir()
  const styles = useStyles(makeStyles)
  return (
    <View style={styles.wrap}>
      <Text style={[large ? styles.jaLarge : styles.ja, { writingDirection }]}>{native}</Text>
      <Text style={large ? styles.enLarge : styles.en}>{en}</Text>
    </View>
  )
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  wrap: { alignItems: 'center' },
  ja: { color: colors.ink, fontSize: 16, fontWeight: '600' },
  en: { color: colors.muted, fontFamily: fonts.body, fontSize: 11 },
  jaLarge: { color: colors.ink, fontSize: 26, fontWeight: '700' },
  enLarge: { color: colors.muted, fontFamily: fonts.heading, fontSize: 14, marginTop: 2 },
})
