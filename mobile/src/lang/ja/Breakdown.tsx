import { View, Text, StyleSheet } from 'react-native'
import type { Unit, Content } from '@shared/types'
import { useContent } from '../../context/ContentContext'
import { colors, fonts } from '../../theme'

/** Whether a unit has any breakdown to reveal (a classifying radical or components). */
export function hasBreakdown(content: Content, unit: Unit): boolean {
  return Boolean(content.kanjiRadicals[unit.form]) || (content.kanjiComponents[unit.form] ?? []).length > 0
}

/** The collapsible kanji breakdown: the classifying radical (tagged) + component characters. */
export function Breakdown({ unit }: { unit: Unit }) {
  const { content } = useContent()
  const meanings = content.kanjiMeanings
  const radical = content.kanjiRadicals[unit.form]
  const components = content.kanjiComponents[unit.form] ?? []
  return (
    <View style={styles.breakdown}>
      {radical ? (
        <View style={styles.radicalRow}>
          <CompRow char={radical} meaning={meanings[radical]} accent />
          <Text style={styles.radicalTag}>RADICAL</Text>
        </View>
      ) : null}
      {components.map((c) => (
        <CompRow key={c} char={c} meaning={meanings[c]} />
      ))}
    </View>
  )
}

function CompRow({ char, meaning, accent }: { char: string; meaning?: string; accent?: boolean }) {
  const m = meaning ? meaning.split(';')[0].trim() : '—'
  return (
    <View style={styles.comp}>
      <Text style={[styles.compChar, accent && styles.accentText]}>{char}</Text>
      <Text style={[styles.compMeaning, accent && styles.accentText]}>{m}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  // Rows are left-aligned so the radical and component characters share one column.
  breakdown: { alignItems: 'flex-start', gap: 6, marginTop: 12 },
  radicalRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  radicalTag: { color: colors.accentInk, fontFamily: fonts.medium, fontSize: 11, letterSpacing: 1 },
  comp: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  compChar: { fontSize: 16, color: colors.muted, width: 22, textAlign: 'center' },
  compMeaning: { fontSize: 13, color: colors.muted, fontFamily: fonts.body },
  accentText: { color: colors.accentInk },
})
