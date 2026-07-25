import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native'
import type { Unit } from '@shared/types'
import { introducedUnits } from '@lib/study'
import { useContent } from '../context/ContentContext'
import { useProgress } from '../context/ProgressContext'
import { useLanguage } from '../context/LanguageContext'
import { useScreenHeader } from '../context/HeaderContext'
import { Bilingual } from './Bilingual'
import { Icon } from './Icon'
import { fonts, radius, shadow, spacing, type Palette } from '../theme'
import { useColors, useStyles } from '../hooks/theme'

/** The list of already-studied units: form + meaning + a mastery chip. Tap one to open its detail. */
export function BrowseList({ onBack, onSelect }: { onBack: () => void; onSelect: (u: Unit) => void }) {
  const colors = useColors()
  const styles = useStyles(makeStyles)
  const index = useContent()
  const { progress } = useProgress()
  const { ui } = useLanguage()
  const units = introducedUnits(index, progress) // curriculum order (content order, filtered)

  useScreenHeader(onBack)

  return (
    <View style={styles.panel}>
      <View style={styles.head}>
        <Bilingual native={ui.browseEntry.native} en={ui.browseEntry.en} />
        <Text style={styles.count}>{units.length}</Text>
      </View>

      {units.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Nothing studied yet — learn some first.</Text>
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.list} showsVerticalScrollIndicator>
          {units.map((u) => {
            const lvl = progress.units[u.idx]?.lvl ?? 0
            return (
              <Pressable key={u.idx} style={styles.row} onPress={() => onSelect(u)}>
                <Text style={styles.form}>{u.form}</Text>
                <Text style={styles.gloss} numberOfLines={1}>
                  {u.gloss.join(', ')}
                </Text>
                <View style={styles.lvlPill}>
                  <Text style={styles.lvlText}>Lv {lvl.toFixed(1)}</Text>
                </View>
                <Icon name="chevron-right" size={14} color={colors.muted} />
              </Pressable>
            )
          })}
        </ScrollView>
      )}
    </View>
  )
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  panel: {
    ...shadow,
    flex: 1,
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  count: { color: colors.muted, fontFamily: fonts.body, fontSize: 14, fontVariant: ['tabular-nums'] },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: colors.muted, fontFamily: fonts.body, textAlign: 'center' },
  scroll: { flex: 1 },
  list: { gap: 2, paddingBottom: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  form: { width: 40, textAlign: 'center', fontSize: 28, color: colors.ink },
  gloss: { flex: 1, color: colors.ink, fontFamily: fonts.body, fontSize: 14 },
  lvlPill: { backgroundColor: colors.accentSoft, borderRadius: radius.pill, paddingVertical: 3, paddingHorizontal: 9 },
  lvlText: { color: colors.accentInk, fontFamily: fonts.semibold, fontSize: 12, fontVariant: ['tabular-nums'] },
})
