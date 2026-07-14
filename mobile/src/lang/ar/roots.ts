import { stripHarakat } from './normalize'

/**
 * Unify letter shapes that differ between a root's citation form and how it surfaces, so matching
 * isn't defeated by spelling: strip harakat, fold the hamza carriers to their base, and normalise
 * alif maqṣūra. (Tāʾ marbūṭa and the definite article ال are left as-is; they're never root letters.)
 */
function norm(s: string): string {
  return stripHarakat(s)
    .replace(/[آأإ]/g, 'ا') // آ أ إ → ا
    .replace(/ى/g, 'ي') // ى → ي
    .replace(/ؤ/g, 'و') // ؤ → و
    .replace(/ئ/g, 'ي') // ئ → ي
}

/**
 * Locate a triliteral (or longer) root's letters inside a surface word, returning the char indices to
 * highlight — or `null` when they can't all be found in order (weak roots whose letters mutate, e.g.
 * ق-و-ل → قال). A geminate root written once with shadda (ح-ب-ب → حبّ) reuses the doubled letter's
 * position. Indices are into `[...surface]`, so the renderer must split the same way.
 */
export function rootSpans(surface: string, rootForm: string): number[] | null {
  const letters = rootForm.split(/\s+/).filter(Boolean).map(norm)
  if (letters.length === 0) return null
  const chars = [...surface].map(norm)
  const spans: number[] = []
  let cursor = 0
  let prevLetter = ''
  let prevIdx = -1
  for (const letter of letters) {
    let found = -1
    for (let j = cursor; j < chars.length; j++) {
      if (chars[j] === letter) {
        found = j
        break
      }
    }
    if (found < 0) {
      // Gemination: a doubled root letter written once — reuse the previous match.
      if (letter === prevLetter && prevIdx >= 0) {
        spans.push(prevIdx)
        continue
      }
      return null
    }
    spans.push(found)
    cursor = found + 1
    prevLetter = letter
    prevIdx = found
  }
  return spans
}
