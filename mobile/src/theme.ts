// Design tokens. RN has no CSS variables or color-mix(), so the "-soft" / "-hover" washes
// (translucent versions of a solid colour) are precomputed as rgba() here.
//
// Colours are per-language: each palette below is a full theme, and a language pack selects one via
// its `palette` field (resolved at render by useColors/useStyles — see hooks/theme.ts). `fonts`,
// `spacing`, `radius`, `edge`, and `shadow` are shared across languages. JA-only components may import the
// static `colors` (= the Japanese palette) directly, since they only ever render in Japanese mode.
import { StyleSheet } from 'react-native'

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

  /*
   * A second highlight from the same family as the pink, one step toward the ground: the lavender
   * neighbour. It marks *state* — how far along you are, which tab you are on — while the accent is
   * reserved for what you can act on. Keeping the two apart is what stops a screen from reading as
   * one field of pink in which nothing is more urgent than anything else.
   */
  highlight: '#9493b7',
  highlightInk: '#b8b7d6', // text/icons on a lavender wash — the lavender itself is 3.2:1 there
  highlightSoft: 'rgba(148,147,183,0.62)', // edges — the lavender should be legible as a colour
  highlightWash: 'rgba(148,147,183,0.26)', // fills + glass tint — has to survive the material

  /*
   * Verdict colours: sage for right, slate for wrong. Both are mid-tones far too light to sit behind
   * near-white ink, so a judged card tints with the Soft variant rather than filling.
   *
   * The slate is deliberately dull — a wrong answer shouldn't shout — which also makes it the palette's
   * quietest text at 2.8:1 on the page. Fine for a verdict the card border already announces.
   *
   * `recessed` is the other half of that idea: once a question is answered, every option that isn't
   * the answer *darkens* below the glass instead of tinting, so it can't be mistaken for one still in
   * play. It's the only option state that reads as "not a choice any more".
   */
  correct: '#9cc2a1',
  correctSoft: 'rgba(156,194,161,0.18)',
  incorrect: '#6b727c',
  incorrectSoft: 'rgba(107,114,124,0.20)',
  recessed: 'rgba(0,0,0,0.22)',
  recessedInk: '#7d8489',

  /*
   * "Ready for more": a kanji that has levelled far enough to unlock example words it hasn't been
   * shown, and the task chip that heads a practice card. Deliberately off the mastery ramp — it
   * isn't more-mastered-than-solid, it's a prompt.
   *
   * A deeper violet, one step past the lavender {@link highlight}: the two are the same family, so a
   * board of pink tiles with these among them reads as one palette rather than as two. It used to be
   * a teal, which was the only colour in the app from nowhere near the rest of it.
   */
  ready: '#5a5591',
  readySoft: 'rgba(90,85,145,0.28)',
  // Light enough to sit on readySoft: the violet itself is 2.6:1 as text, this is 7.1:1.
  readyInk: '#c6c3e6',

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

  // Same role as the JA lavender: a second highlight for state, here a warm sand against the
  // chocolate — progress bars, the selected tab, anything that reports rather than invites.
  highlight: '#b6a693',
  highlightInk: '#d5c8b6',
  highlightSoft: 'rgba(182,166,147,0.62)',
  highlightWash: 'rgba(182,166,147,0.26)',

  // Shared with Japanese: light mint / lavender — legible on the dark chocolate.
  correct: '#9cc2a1',
  correctSoft: 'rgba(156,194,161,0.18)',
  incorrect: '#6b727c',
  incorrectSoft: 'rgba(107,114,124,0.20)',
  recessed: 'rgba(0,0,0,0.22)',
  recessedInk: '#7d8489',

  /*
   * "Ready for more": a kanji that has levelled far enough to unlock example words it hasn't been
   * shown, and the task chip that heads a practice card. Deliberately off the mastery ramp — it
   * isn't more-mastered-than-solid, it's a prompt.
   *
   * A deeper violet, one step past the lavender {@link highlight}: the two are the same family, so a
   * board of pink tiles with these among them reads as one palette rather than as two. It used to be
   * a teal, which was the only colour in the app from nowhere near the rest of it.
   */
  ready: '#5a5591',
  readySoft: 'rgba(90,85,145,0.28)',
  // Light enough to sit on readySoft: the violet itself is 2.6:1 as text, this is 7.1:1.
  readyInk: '#c6c3e6',

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
  /*
   * Japanese faces. The Latin families above carry no CJK glyphs, so anything Japanese either names
   * one of these or is left to the OS font — never Manrope/Fraunces, which would render tofu.
   *
   * `brush` (Yuji Syuku) is a hand-brushed display face: the big character on a Learn card, the
   * tracing guide, and the home-screen watermarks.
   *
   * The two reading faces split by what a task is asking for. `mincho` (Shippori Mincho) is a
   * printed serif — used where the character itself is the answer (which-words, type-the-word, draw)
   * and across the kana course, because its strokes are the ones a learner is trying to reproduce.
   * `klee` (Klee One) is a softer handwriting-style face for everything else, where the Japanese is
   * context to read rather than a form to copy.
   */
  brush: 'YujiSyuku_400Regular',
  mincho: 'ShipporiMincho_400Regular',
  klee: 'KleeOne_400Regular',
} as const

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const
export const radius = { sm: 8, md: 10, lg: 14, pill: 999 } as const

/**
 * The width of every outline in the app: card edges, option chips, the drawing canvas' verdict ring.
 *
 * One value, and a fine one. A border's job here is to say where a surface ends, and at 1.5 or 2pt
 * it stops describing the edge and starts being a feature of it — the outline reads as heavier than
 * the thing it contains, which is what makes an interface look cheap. Two device pixels is enough to
 * survive on any screen and light enough to stay an edge.
 *
 * Kept as a token rather than a number per file so "outlines are too heavy" is one change, not forty.
 */
export const edge = StyleSheet.hairlineWidth * 2

/**
 * iOS button metrics, applied app-wide.
 *
 * Apple's numbers, not ours: a filled button is 50pt tall with 14pt corners, and its label is 17pt
 * semibold on the system font. Leaving `fontFamily` off {@link btnLabel} is the important part —
 * RN's default face on iOS *is* SF Pro, so the labels render in the real system type rather than
 * the bundled Manrope, which was the loudest tell that these weren't native controls.
 *
 * The fill is opaque. Real Liquid Glass was tried here (the material is available in Expo Go, and
 * the pager chevrons use it) and the flat fill was preferred — a frosted button competes with the
 * colour pools behind it, where a solid one just reads as the thing to press.
 */
const btnBase = {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  minHeight: 50,
  paddingHorizontal: 20,
  borderRadius: 14,
} as const

export const btnPrimary = (colors: Palette) => ({ ...btnBase, backgroundColor: colors.accent })

/** The quieter of the pair — iOS's grey filled button. Same shell, so they sit level side by side. */
export const btnSecondary = (colors: Palette) => ({ ...btnBase, backgroundColor: colors.panelStrong })

/** Label for {@link btnPrimary}: dark ink on the accent measures 6.3:1. */
export const btnLabel = (colors: Palette) =>
  ({ color: colors.onAccent, fontSize: 17, fontWeight: '600', letterSpacing: -0.4 }) as const

/** Label for {@link btnSecondary}: light ink on the grey fill measures 8.0:1. */
export const btnLabelQuiet = (colors: Palette) =>
  ({ color: colors.ink, fontSize: 17, fontWeight: '600', letterSpacing: -0.4 }) as const

/** Soft drop shadow to make frosted cards float. Spread into a card's style. */
export const shadow = {
  shadowColor: '#000',
  shadowOpacity: 0.3,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 8 },
  elevation: 6,
} as const
