import { useState } from 'react'
import { View, Text, Modal, FlatList, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { TapScale } from './TapScale'
import { Icon } from './Icon'
import type { IconName } from '@fortawesome/fontawesome-svg-core'
import type { BoardFilters as Filters, FilterOption } from '@lib/board'
import { toggleInList } from '@lib/categories'
import { edge, fonts, radius, spacing, type Palette } from '../theme'
import { useColors, useStyles } from '../hooks/theme'

/** One filter in a {@link FilterBar}: what it is called, what it offers, and what is chosen. */
export interface FilterSpec {
  key: string
  icon: IconName
  /**
   * What the sheet filters by, plural — "Topics", "Radicals", "Scripts". The sheet renders it as
   * "Filter Topics", so give it the noun and not the whole heading.
   */
  title: string
  /** The chip's label when nothing is chosen — "All topics". */
  allLabel: string
  options: { value: string; count: number; label?: string }[]
  /** Everything currently chosen. Empty = no filter, so the chip reads "All topics". */
  selected: string[]
  /** Toggles one value, or clears the filter entirely when passed null. */
  onToggle: (value: string | null) => void
}

/**
 * A row of filter chips, each opening a sheet of options.
 *
 * A sheet rather than an inline row of chips because of the shapes involved: 14 topics would fit,
 * but there are 129 radicals, and a horizontally-scrolling strip of them hides everything past the
 * third. The chip shows the current choice, so the bar states the query even while it's closed.
 */
export function FilterBar({ filters, onClear }: { filters: FilterSpec[]; onClear: () => void }) {
  const colors = useColors()
  const styles = useStyles(makeStyles)
  /** Which sheet is open, if any. */
  const [open, setOpen] = useState<string | null>(null)
  const active = filters.some((f) => f.selected.length > 0)

  return (
    <View style={styles.bar}>
      {filters.map((f) => (
        <Chip
          key={f.key}
          icon={f.icon}
          // One choice names itself; several are counted, since three topic names never fit a chip.
          label={
            f.selected.length === 0
              ? f.allLabel
              : f.selected.length === 1
                ? f.selected[0]
                : `${f.selected.length} chosen`
          }
          on={f.selected.length > 0}
          onPress={() => setOpen(f.key)}
        />
      ))}
      {/* Only worth offering once something is actually narrowed. */}
      {active && (
        <TapScale
          style={styles.clear}
          onPress={onClear}
          accessibilityLabel="Clear filters"
          hitSlop={6}
        >
          <Icon name="xmark" size={12} color={colors.muted} />
        </TapScale>
      )}

      {filters.map((f) => (
        <OptionSheet
          key={f.key}
          title={f.title}
          visible={open === f.key}
          options={f.options}
          selected={f.selected}
          allLabel={f.allLabel}
          onPick={f.onToggle}
          onClose={() => setOpen(null)}
        />
      ))}
    </View>
  )
}

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
  /** Add or remove one value; `null` clears the whole filter (the sheet's "All" row). */
  const toggle = (chosen: string[] | null | undefined, value: string | null) =>
    value === null ? null : toggleInList(chosen ?? [], value)

  return (
    <FilterBar
      onClear={() => onChange({ category: null, radical: null })}
      filters={[
        {
          key: 'category',
          icon: 'layer-group',
          title: 'Topics',
          allLabel: 'All topics',
          options: categories,
          selected: filters.category ?? [],
          onToggle: (v) => onChange({ ...filters, category: toggle(filters.category, v) }),
        },
        {
          key: 'radical',
          icon: 'puzzle-piece',
          title: 'Radicals',
          allLabel: 'All radicals',
          options: radicals,
          selected: filters.radical ?? [],
          onToggle: (v) => onChange({ ...filters, radical: toggle(filters.radical, v) }),
        },
      ]}
    />
  )
}

function Chip({
  icon,
  label,
  on,
  onPress,
}: {
  icon: IconName
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

/**
 * One filter's options, as a sheet.
 *
 * It stays open as you pick: choosing topics is usually choosing *several*, and a sheet that closed
 * on the first tap made the second one cost two more. "All" sits at the top as a real row — it is
 * the way to clear, and it doubles as the way out once you are done.
 */
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
  options: { value: string; count: number; label?: string }[]
  selected: string[]
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
          {/* "Filter Topics", not "Topic": the sheet is an action you are part-way through, and its
              header should say what you are doing rather than name the column you came from. */}
          <Text style={styles.sheetTitle}>Filter {title}</Text>
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
            <Row label={allLabel} on={selected.length === 0} onPress={() => onPick(null)} />
          }
          renderItem={({ item }) => (
            <Row
              label={item.label ? `${item.value} · ${item.label}` : item.value}
              count={item.count}
              on={selected.includes(item.value)}
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
      {on && <Icon name="check" size={14} color={colors.highlightInk} />}
    </TapScale>
  )
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    bar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      flexWrap: 'wrap',
      paddingVertical: spacing.md,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      maxWidth: 190,
      backgroundColor: colors.panelStrong,
      borderColor: colors.border,
      borderWidth: edge,
      borderRadius: radius.pill,
      paddingVertical: 6,
      paddingHorizontal: 12,
    },
    // Lavender when on, like the segmented switch and the tab bar: a chip that is selected reports
    // what the board is showing, it isn't a thing to act on.
    chipOn: { backgroundColor: colors.highlight, borderColor: colors.highlight },
    /* Lower case, like the board hints around them. These are values from the data — topic names,
       radical glosses — and setting them in the app's own quiet voice keeps a filter reading as a
       narrowing of what's below rather than as a heading over it. */
    chipText: { color: colors.ink, fontFamily: fonts.body, fontSize: 12, flexShrink: 1, textTransform: 'lowercase' },
    chipTextOn: { color: colors.ink, fontFamily: fonts.medium },
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
    // Lower case, matching the chips — see `chipText`.
    // Lower case, matching the chips — see `chipText`.
    rowLabel: { flex: 1, color: colors.ink, fontFamily: fonts.body, fontSize: 15, textTransform: 'lowercase' },
    // Lavender, like the chip it turns on: both report what the board is showing.
    rowLabelOn: { color: colors.highlightInk, fontFamily: fonts.semibold },
    rowCount: { color: colors.muted, fontFamily: fonts.body, fontSize: 12 },
  })
