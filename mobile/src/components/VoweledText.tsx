import { Text, type StyleProp, type TextStyle } from 'react-native'
import { fonts } from '../theme'
import { useColors } from '../hooks/theme'

// Arabic vowel/diacritic marks (harakat): tanwīn, short vowels, shadda, sukūn, and the superscript alef.
const HARAKAT = /[ً-ْٰ]/

/** Any CJK ideograph. Kana, Latin and Arabic all fall outside it, so the split is a no-op for them. */
const KANJI = /[㐀-䶿一-鿿豈-﫿]/

/**
 * Renders text run by run, so a mixed string can carry more than one treatment on one line.
 *
 * Two independent splits, neither of which can fire on the other's script:
 *
 *  - Arabic vowel marks (harakat) are painted in the accent. They're combining characters, so nesting
 *    them in coloured spans keeps them attached to their base letter — only the mark is recoloured.
 *  - Kanji runs take the mincho face while kana is left to the OS gothic, which is the house style for
 *    Japanese: 食べる renders 食 in mincho and べる in the system font, on a single flowing line.
 *
 * Text with neither (English, bare kana) renders unchanged, so this is safe to drop in anywhere.
 */
export function VoweledText({
  text,
  style,
  color,
  numberOfLines,
  shrinkToFit,
}: {
  text: string
  style?: StyleProp<TextStyle>
  color?: string
  numberOfLines?: number
  /**
   * Scale the text down rather than let it overflow its box. Pair with `numberOfLines`: the two
   * together mean "wrap up to N lines, then shrink", which is what keeps a long option the same
   * height as a short one.
   */
  shrinkToFit?: boolean
}) {
  const colors = useColors()
  const markColor = color ?? colors.vowel
  const chars = [...text]
  if (!chars.some((c) => HARAKAT.test(c) || KANJI.test(c))) {
    return (
      <Text style={style} numberOfLines={numberOfLines} {...shrink(shrinkToFit)}>
        {text}
      </Text>
    )
  }

  // Group consecutive characters that want the same treatment into as few spans as possible.
  const segs: { t: string; mark: boolean; kanji: boolean }[] = []
  for (const ch of chars) {
    const mark = HARAKAT.test(ch)
    const kanji = KANJI.test(ch)
    const last = segs[segs.length - 1]
    if (last && last.mark === mark && last.kanji === kanji) last.t += ch
    else segs.push({ t: ch, mark, kanji })
  }
  return (
    <Text style={style} numberOfLines={numberOfLines} {...shrink(shrinkToFit)}>
      {segs.map((s, i) =>
        s.mark ? (
          <Text key={i} style={{ color: markColor }}>
            {s.t}
          </Text>
        ) : s.kanji ? (
          <Text key={i} style={{ fontFamily: fonts.mincho }}>
            {s.t}
          </Text>
        ) : (
          s.t
        ),
      )}
    </Text>
  )
}

/** The two props that make a Text scale down instead of overflowing, or nothing when it shouldn't. */
function shrink(on?: boolean) {
  return on ? { adjustsFontSizeToFit: true, minimumFontScale: 0.7 } : {}
}
