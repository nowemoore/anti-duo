// Design tokens ported from src/colors.css. RN has no CSS variables or color-mix(), so the "-soft"
// / "-hover" washes (translucent versions of the solid colour) are precomputed as rgba() here.
export const colors = {
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
} as const

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
