import { View, Text, StyleSheet } from 'react-native'
import { colors, fonts } from '../theme'

// Stacked Japanese-over-English label (mirrors the web Bilingual). Japanese text is left on the
// system font on purpose — the bundled Latin fonts (Manrope/Fraunces) have no kanji/kana glyphs,
// so forcing them would tofu; the OS substitutes a JP font for those runs.
export function Bilingual({ ja, en, large }: { ja: string; en: string; large?: boolean }) {
  return (
    <View style={styles.wrap}>
      <Text style={large ? styles.jaLarge : styles.ja}>{ja}</Text>
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
