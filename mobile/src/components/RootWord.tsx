import { Text, StyleSheet, type StyleProp, type TextStyle } from 'react-native'
import { type Palette } from '../theme'
import { useStyles } from '../hooks/theme'

/**
 * Renders a word with some of its characters highlighted (Arabic: the root letters). Emits a single
 * <Text> run with nested spans for the highlighted stretches, so cursive shaping/joining is preserved
 * (splitting a word into sibling <Text>s would disconnect Arabic letters). With no spans it's just the
 * plain word — so this is safe to use for any language (JA passes none and renders unchanged).
 */
export function RootWord({
  surface,
  spans,
  style,
  highlightStyle,
}: {
  surface: string
  spans?: number[] | null
  style?: StyleProp<TextStyle>
  highlightStyle?: StyleProp<TextStyle>
}) {
  const styles = useStyles(makeStyles)
  if (!spans || spans.length === 0) return <Text style={style}>{surface}</Text>

  const on = new Set(spans)
  // Group consecutive same-state characters into as few segments as possible.
  const segments: { text: string; hit: boolean }[] = []
  ;[...surface].forEach((ch, i) => {
    const hit = on.has(i)
    const last = segments[segments.length - 1]
    if (last && last.hit === hit) last.text += ch
    else segments.push({ text: ch, hit })
  })

  return (
    <Text style={style}>
      {segments.map((seg, i) =>
        seg.hit ? (
          <Text key={i} style={[styles.root, highlightStyle]}>
            {seg.text}
          </Text>
        ) : (
          seg.text
        ),
      )}
    </Text>
  )
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  root: { color: colors.accentInk, fontWeight: '700' },
})
