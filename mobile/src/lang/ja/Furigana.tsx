import { View, Text, StyleSheet, type StyleProp, type TextStyle } from 'react-native'
import { colors } from '../../theme'

// RN has no <ruby>: stack the reading (rt) above the word as a small centered column.
export function Furigana({
  surface,
  reading,
  baseStyle,
  rtColor = colors.muted,
}: {
  surface: string
  reading: string
  baseStyle?: StyleProp<TextStyle>
  rtColor?: string
}) {
  return (
    <View style={styles.col}>
      <Text style={[styles.rt, { color: rtColor }]}>{reading}</Text>
      <Text style={[styles.base, baseStyle]}>{surface}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  col: { alignItems: 'center' },
  rt: { fontSize: 11, lineHeight: 13 },
  base: { fontSize: 24, color: colors.ink },
})
