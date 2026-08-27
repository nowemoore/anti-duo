import { useState } from 'react'
import { View, Text, Modal, FlatList, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { TapScale } from './TapScale'
import { Icon } from './Icon'
import type { BoardFilters as Filters, FilterOption } from '@lib/board'
import { fonts, radius, spacing, type Palette } from '../theme'
import { useColors, useStyles } from '../hooks/theme'

/**
 * The board's two filters — topic and radical — as a pair of chips that open a sheet of options.
 *
 * A sheet rather than an inline row of chips because of the shapes involved: 14 topics would fit,
 * but there are 129 radicals, and a horizontally-scrolling strip of them hides everything past the
 * third. The chip shows the current choice, so the bar states the query even while it's closed.
 */
export function BoardFilters({
  filters,
  onChange,
  categories,
  radicals,
}: {
  filters: Filters
  onChange: (next: Filters) => void
  categories: FilterOption[]
  radicals: FilterOption[]
}) {
  const colors = useColors()
  const styles = useStyles(makeStyles)
  /** Which sheet is open, if any. */
  const [open, setOpen] = useState<'category' | 'radical' | null>(null)
  const active = filters.category != null || filters.radical != null

  return (
    <View style={styles.bar}>
      <Chip
        icon="layer-group"
        label={filters.category ?? 'All topics'}
        on={filters.category != null}
        onPress={() => setOpen('category')}
      />
      <Chip
        icon="puzzle-piece"
        label={filters.radical ?? 'All radicals'}
        on={filters.radical != null}
        onPress={() => setOpen('radical')}
      />
      {/* Only worth offering once something is actually narrowed. */}
      {active && (
        <TapScale
          style={styles.clear}
          onPress={() => onChange({ category: null, radical: null })}
          accessibilityLabel="Clear filters"
          hitSlop={6}
        >
          <Icon name="xmark" size={12} color={colors.muted} />
        </TapScale>
      )}

      <OptionSheet
        title="Topic"
        visible={open === 'category'}
        options={categories}
        selected={filters.category ?? null}
        allLabel="All topics"
        onPick={(value) => {
          onChange({ ...filters, category: value })
          setOpen(null)
        }}
        onClose={() => setOpen(null)}
      />
      <OptionSheet
        title="Radical"
        visible={open === 'radical'}
        options={radicals}
        selected={filters.radical ?? null}
        allLabel="All radicals"
        onPick={(value) => {
          onChange({ ...filters, radical: value })
          setOpen(null)
        }}
        onClose={() => setOpen(null)}
      />
    </View>
  )
}

function Chip({
  icon,
  label,
  on,
  onPress,
}: {
  icon: 'layer-group' | 'puzzle-piece'
  label: string
  on: boolean
  onPress: () => void
}) {
  const colors = useColors()
  const styles = useStyles(makeStyles)
  return (
    <TapScale
      style={[styles.chip, on && styles.chipOn]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Icon name={icon} size={11} color={on ? colors.onAccent : colors.muted} />
      <Text style={[styles.chipText, on && styles.chipTextOn]} numberOfLines={1}>
        {label}
      </Text>
      <Icon name="chevron-down" size={10} color={on ? colors.onAccent : colors.muted} />
    </TapScale>
  )
}

/** One filter's options, as a sheet. "All" sits at the top as a real row, so clearing is a choice. */
function OptionSheet({
  title,
  visible,
  options,
  selected,
  allLabel,
  onPick,
  onClose,
}: {
  title: string
  visible: boolean
  options: FilterOption[]
  selected: string | null
  allLabel: string
  onPick: (value: string | null) => void
  onClose: () => void
}) {
  const colors = useColors()
  const styles = useStyles(makeStyles)
  const insets = useSafeAreaInsets()

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.sheet, { paddingTop: insets.top }]}>
        <View style={styles.sheetHead}>
          <Text style={styles.sheetTitle}>{title}</Text>
          <TapScale onPress={onClose} hitSlop={8} accessibilityLabel="Close">
            <Icon name="xmark" size={20} color={colors.muted} />
          </TapScale>
        </View>

        <FlatList
          data={options}
          keyExtractor={(o) => o.value}
          contentContainerStyle={styles.sheetList}
          initialNumToRender={20}
          ListHeaderComponent={
            <Row label={allLabel} on={selected == null} onPress={() => onPick(null)} />
          }
          renderItem={({ item }) => (
            <Row
              label={item.label ? `${item.value} · ${item.label}` : item.value}
              count={item.count}
              on={selected === item.value}
              onPress={() => onPick(item.value)}
            />
          )}
        />
      </View>
    </Modal>
  )
}

function Row({
  label,
  count,
  on,
  onPress,
}: {
  label: string
  count?: number
  on: boolean
  onPress: () => void
}) {
  const colors = useColors()
  const styles = useStyles(makeStyles)
  return (
    <TapScale
      style={styles.row}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
    >
      <Text style={[styles.rowLabel, on && styles.rowLabelOn]} numberOfLines={1}>
        {label}
      </Text>
      {count != null && <Text style={styles.rowCount}>{count}</Text>}
      {on && <Icon name="check" size={14} color={colors.accentInk} />}
    </TapScale>
  )
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: 190,
    backgroundColor: colors.panelStrong,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  chipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.ink, fontFamily: fonts.body, fontSize: 12, flexShrink: 1 },
  chipTextOn: { color: colors.onAccent, fontFamily: fonts.medium },
  clear: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.border,
  },
  sheet: { flex: 1, backgroundColor: colors.bg },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
  },
  sheetTitle: { color: colors.ink, fontFamily: fonts.headingBold, fontSize: 18 },
  sheetList: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 12,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
  },
  rowLabel: { flex: 1, color: colors.ink, fontFamily: fonts.body, fontSize: 15 },
  rowLabelOn: { color: colors.accentInk, fontFamily: fonts.semibold },
  rowCount: { color: colors.muted, fontFamily: fonts.body, fontSize: 12 },
})
