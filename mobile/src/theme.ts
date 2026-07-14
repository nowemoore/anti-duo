// Design tokens. RN has no CSS variables or color-mix(), so the "-soft" / "-hover" washes
// (translucent versions of a solid colour) are precomputed as rgba() here.
//
// Colours are per-language: each palette below is a full theme, and a language pack selects one via
// its `palette` field (resolved at render by useColors/useStyles — see hooks/theme.ts). `fonts`,
// `spacing`, `radius`, and `shadow` are shared across languages. JA-only components may import the
// static `colors` (= the Japanese palette) directly, since they only ever render in Japanese mode.

/** Japanese palette — the original dark theme (unchanged). */
export const jaColors = {
  c900: '#2f2f2f',
  c700: '#484a4f',
  c600: '#5e6970',
  c500: '#738a90',
  c400: '#8aacab',
  c300: '#a9cec2',
  pink: '#e398dd',

  bg: '#2f2f2f',
  // Frosted-glass surfaces: translucent light fills + lighter edges, layered over the dark bg + glow.
  panel: 'rgba(255,255,255,0.07)',
  panelStrong: 'rgba(255,255,255,0.12)',
  border: 'rgba(255,255,255,0.14)',

  ink: '#edf1ef',
  muted: '#93acaa',

  accent: '#e398dd',
  accentInk: '#ecb0e6',
  accentSoft: 'rgba(227,152,221,0.16)', // color-mix(accent 16%, transparent)
  accentHover: 'rgba(227,152,221,0.28)', // color-mix(accent 28%, transparent)
  onAccent: '#2f2f2f',

  correct: '#d3fbd8',
  correctSoft: 'rgba(211,251,216,0.18)',
  incorrect: '#efedff',
  incorrectSoft: 'rgba(239,237,255,0.22)',

  // Dark "chip" strips (the reveal strip + Learn caption): light text on a dark surface in both themes.
  onChip: '#edf1ef',
  onChipMuted: '#93acaa',
  onChipAccent: '#ecb0e6',
  // Modal/overlay card (the script-reference chart behind the ? button).
  overlay: '#4d4152',
  overlayEdge: '#6b5a70',

  // Decorative colour pools behind the frosted panels.
  glow1: 'rgba(227,152,221,0.11)',
  glow2: 'rgba(138,172,171,0.08)',

  // Colour for Arabic vowel marks (harakat) shown against a word. Unused where a script has no marks.
  vowel: '#ecb0e6',
} as const

/** The shape every palette shares (values are plain strings so alternate palettes fit). */
export type Palette = Record<keyof typeof jaColors, string>

/**
 * Arabic palette — a deep-chocolate dark theme. The browns are muted to roughly the saturation of the
 * Japanese charcoal (#2f2f2f), just warm, so it reads as dark chocolate rather than milk brown. Cream
 * text, with gold ("light brown", #FFCC65) and green (#007663) highlights. correct/incorrect are
 * shared with the Japanese palette (and, being light, read well on the dark chocolate).
 */
export const arColors: Palette = {
  c900: '#1b1613', // deepest — the recessed reveal/caption strips
  c700: '#302823',
  c600: '#413830',
  c500: '#574b41',
  c400: '#77685b',
  c300: '#b6a693',
  pink: '#ffcc65', // gold highlight (occupies the JA 'pink' secondary slot)

  bg: '#2a231f', // deep chocolate, charcoal-muted
  // Frosted warm surfaces layered over the deep-chocolate bg + glow (mirrors the JA frosted-glass look).
  panel: 'rgba(255,240,222,0.06)',
  panelStrong: 'rgba(255,240,222,0.11)',
  border: 'rgba(255,240,222,0.15)',

  ink: '#efe6d7', // warm cream text
  muted: '#b6a693', // muted tan

  accent: '#007663', // green — buttons, selected states, dots
  accentInk: '#ffcc65', // gold — highlights, root letters, active labels
  accentSoft: 'rgba(0,118,99,0.24)',
  accentHover: 'rgba(0,118,99,0.36)',
  onAccent: '#fbf3e6', // cream text on the green accent

  // Shared with Japanese: light mint / lavender — legible on the dark chocolate.
  correct: '#d3fbd8',
  correctSoft: 'rgba(211,251,216,0.18)',
  incorrect: '#efedff',
  incorrectSoft: 'rgba(239,237,255,0.22)',

  // Dark chip strips carry cream / gold text (like the rest of the theme).
  onChip: '#efe6d7',
  onChipMuted: '#b6a693',
  onChipAccent: '#ffcc65',
  // The reference-chart card is a slightly-raised chocolate with cream text.
  overlay: '#332a24',
  overlayEdge: '#4a3f37',

  glow1: 'rgba(255,204,101,0.10)', // gold pool
  glow2: 'rgba(0,118,99,0.09)', // green pool

  vowel: '#f0863a', // orange — Arabic vowel marks (harakat)
}

/** Default palette for components that import colours statically (JA-only views). */
export const colors = jaColors

// Font family names as loaded via expo-font / @expo-google-fonts (see App.tsx useFonts).
export const fonts = {
  body: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  heading: 'Fraunces_400Regular',
  headingBold: 'Fraunces_700Bold',
} as const

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const
export const radius = { sm: 8, md: 10, lg: 14, pill: 999 } as const

/** Soft drop shadow to make frosted cards float. Spread into a card's style. */
export const shadow = {
  shadowColor: '#000',
  shadowOpacity: 0.3,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 8 },
  elevation: 6,
} as const
