import { useCallback, useRef, type ReactNode } from 'react'
import {
  Pressable,
  Text,
  View,
  StyleSheet,
  Dimensions,
  type StyleProp,
  type ViewStyle,
  type GestureResponderEvent,
} from 'react-native'
import { useOverlay } from './Overlay'
import { fonts, type Palette } from '../theme'
import { useStyles } from '../hooks/theme'

// RN counterpart of the web HoverGloss: press-and-hold a word to reveal its gloss in a bubble above
// the finger (hover doesn't exist on touch). Glossable words are pressable BLOCKS, not inline text.

/**
 * Returns a factory that builds press handlers for a given gloss, so a single Pressable can do both
 * tap (e.g. select an option) and long-press (show the gloss). Shares one touch-point ref — fine
 * since only one press happens at a time.
 */
export function useGlossHandlers() {
  const { show, hide } = useOverlay()
  const pt = useRef({ x: 0, y: 0 })
  return useCallback(
    (gloss: string, enabled = true) => {
      const canShow = enabled && gloss.length > 0
      return {
        delayLongPress: 150,
        onPressIn: (e: GestureResponderEvent) => {
          pt.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY }
        },
        onLongPress: canShow
          ? () => show(<GlossBubble text={gloss} x={pt.current.x} y={pt.current.y} />)
          : undefined,
        onPressOut: () => hide(),
      }
    },
    [show, hide],
  )
}

export function GlossOverlay({
  gloss,
  enabled = true,
  children,
  style,
}: {
  gloss: string
  enabled?: boolean
  children: ReactNode
  style?: StyleProp<ViewStyle>
}) {
  const handlers = useGlossHandlers()
  return (
    <Pressable {...handlers(gloss, enabled)} style={style}>
      {children}
    </Pressable>
  )
}

function GlossBubble({ text, x, y }: { text: string; x: number; y: number }) {
  const styles = useStyles(makeStyles)
  const screen = Dimensions.get('window')
  const maxW = Math.min(240, screen.width - 24)
  const left = Math.max(12, Math.min(x - maxW / 2, screen.width - maxW - 12))
  const top = Math.max(8, y - 52)
  return (
    <View pointerEvents="none" style={[styles.bubble, { left, top, maxWidth: maxW }]}>
      <Text style={styles.text}>{text}</Text>
    </View>
  )
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  bubble: {
    position: 'absolute',
    backgroundColor: colors.ink,
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  text: { color: colors.bg, fontFamily: fonts.body, fontSize: 13 },
})
