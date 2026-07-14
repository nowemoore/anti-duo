import { Text, type StyleProp, type TextStyle } from 'react-native'
import { useColors } from '../hooks/theme'

// Arabic vowel/diacritic marks (harakat): tanwīn, short vowels, shadda, sukūn, and the superscript alef.
const HARAKAT = /[ً-ْٰ]/

/**
 * Renders Arabic text with the vowel marks (harakat) painted in a separate colour (the accent — teal
 * for Arabic). The marks are combining characters, so nesting them in coloured <Text> spans keeps them
 * attached to their base letter — only the mark's glyph is recoloured. Text with no harakat (kana,
 * bare Arabic, English) renders unchanged, so this is safe to drop in anywhere a reading shows.
 */
export function VoweledText({
  text,
  style,
  color,
  numberOfLines,
}: {
  text: string
  style?: StyleProp<TextStyle>
  color?: string
  numberOfLines?: number
}) {
  const colors = useColors()
  const markColor = color ?? colors.vowel
  const chars = [...text]
  if (!chars.some((c) => HARAKAT.test(c))) {
    return (
      <Text style={style} numberOfLines={numberOfLines}>
        {text}
      </Text>
    )
  }

  // Group consecutive base vs. mark characters into as few spans as possible.
  const segs: { t: string; mark: boolean }[] = []
  for (const ch of chars) {
    const mark = HARAKAT.test(ch)
    const last = segs[segs.length - 1]
    if (last && last.mark === mark) last.t += ch
    else segs.push({ t: ch, mark })
  }
  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {segs.map((s, i) =>
        s.mark ? (
          <Text key={i} style={{ color: markColor }}>
            {s.t}
          </Text>
        ) : (
          s.t
        ),
      )}
    </Text>
  )
}
