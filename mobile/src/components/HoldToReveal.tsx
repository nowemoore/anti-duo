import { useState, type ReactNode } from 'react'
import { Pressable, Text, View, StyleSheet } from 'react-native'
import { Icon } from './Icon'
import { fonts, type Palette } from '../theme'
import { useColors, useStyles } from '../hooks/theme'

/** An eye you press-and-hold to reveal hidden content (RN: onPressIn/onPressOut). */
export function HoldToReveal({ children, label = 'Hold to reveal' }: { children: ReactNode; label?: string }) {
  const colors = useColors()
  const styles = useStyles(makeStyles)
  const [shown, setShown] = useState(false)
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPressIn={() => setShown(true)}
        onPressOut={() => setShown(false)}
        hitSlop={8}
        style={styles.btn}
      >
        <Icon name="eye" size={14} color={colors.muted} />
      </Pressable>
      <Text style={[styles.content, { opacity: shown ? 1 : 0 }]} numberOfLines={2}>
        {children}
      </Text>
    </View>
  )
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  btn: { padding: 4 },
  content: { color: colors.muted, fontFamily: fonts.body, fontSize: 13, flexShrink: 1 },
})
