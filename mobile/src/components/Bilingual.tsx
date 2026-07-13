import { View, Text, StyleSheet } from 'react-native'
import { colors, fonts } from '../theme'

// Stacked Japanese-over-English label (mirrors the web Bilingual). Japanese text is left on the
// system font on purpose — the bundled Latin fonts (Manrope/Fraunces) have no non-Latin (CJK/Arabic) glyphs,
// so forcing them would tofu; the OS substitutes a JP font for those runs.
export function Bilingual({ native, en, large }: { native: string; en: string; large?: boolean }) {
  return (
    <View style={styles.wrap}>
      <Text style={large ? styles.jaLarge : styles.ja}>{native}</Text>
      <Text style={large ? styles.enLarge : styles.en}>{en}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  ja: { color: colors.ink, fontSize: 16, fontWeight: '600' },
  en: { color: colors.muted, fontFamily: fonts.body, fontSize: 11 },
  jaLarge: { color: colors.ink, fontSize: 26, fontWeight: '700' },
  enLarge: { color: colors.muted, fontFamily: fonts.heading, fontSize: 14, marginTop: 2 },
})
