import { View, StyleSheet } from 'react-native'
import { findScript, type ChartSection } from '@lib/kana'
import { KanaGrid } from '../../components/kana/KanaGrid'

/**
 * The read-only hiragana reference behind the help button. Layout, characters and romaji all come
 * from src/lib/kana, shared with the Learn kana chart and the web twin.
 */
export function HiraganaTable() {
  const hiragana = findScript('ja', 'hiragana')
  if (!hiragana) return null
  return (
    <View style={styles.chart}>
      {hiragana.sections.map((section) => (
        <KanaGrid key={section.id} section={aligned(section)} />
      ))}
    </View>
  )
}

/**
 * The voiced block gets blank spacer rows so its columns sit under the consonants they derive from
 * (k→g, s→z, t→d, then a gap so b/p line up under は).
 */
function aligned(section: ChartSection): ChartSection {
  if (!section.id.endsWith('-dakuten')) return section
  const blank = [null, null, null, null, null]
  return {
    ...section,
    rows: [blank, ...section.rows.slice(0, 3), blank, ...section.rows.slice(3)],
  }
}

const styles = StyleSheet.create({
  // Left-aligned so the vowel column (down the left edge) lines up across all three sections.
  chart: { alignItems: 'flex-start', gap: 8 },
})
