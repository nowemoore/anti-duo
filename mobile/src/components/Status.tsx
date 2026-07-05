import { View, Text } from 'react-native'
import { colors, fonts } from '../theme'

/** Full-screen loading / error message (replaces the web's .status divs). */
export function Status({ text, error }: { text: string; error?: boolean }) {
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.bg,
        padding: 24,
      }}
    >
      <Text style={{ color: error ? colors.incorrect : colors.muted, fontFamily: fonts.body }}>
        {text}
      </Text>
    </View>
  )
}
