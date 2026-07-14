import { useMemo } from 'react'
import { useLanguage } from '../context/LanguageContext'
import { jaColors, type Palette } from '../theme'

/** The active language's colour palette (falls back to the Japanese palette). */
export function useColors(): Palette {
  return useLanguage().palette ?? jaColors
}

/**
 * Build a StyleSheet from the active palette, memoised per palette. Pair with a module-level
 * `const makeStyles = (colors: Palette) => StyleSheet.create({ … })` so a component's style body is
 * unchanged — only its colours become language-aware:
 *   const styles = useStyles(makeStyles)
 */
export function useStyles<T>(make: (colors: Palette) => T): T {
  const colors = useColors()
  return useMemo(() => make(colors), [colors])
}
