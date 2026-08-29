import { View, Text, StyleSheet } from 'react-native'
import type { IconName } from '@fortawesome/fontawesome-svg-core'
import { Icon } from './Icon'
import { TapScale } from './TapScale'
import { btnPrimary, btnSecondary, edge, radius, spacing, type Palette } from '../theme'
import { useColors, useStyles } from '../hooks/theme'

/**
 * A section page's entry action: circular icon badge, a title over a one-line detail, and a chevron.
 *
 * Filled for the primary, plain for the others. Disabled dims the whole row rather than just the
 * label, so it reads as one unavailable control instead of a live button with grey text.
 *
 * Shared by every section page (kanji, kana), so the pages open the same way and restyling here
 * restyles all of them.
 */
/**
 * Two compact rows side by side.
 *
 * `alignItems: 'stretch'` is the load-bearing part: it's what keeps the pair the same height when
 * one label wraps and the other doesn't. It lives here rather than in each caller's stylesheet
 * because `compact` is only meaningful inside this row — a page that reimplemented the wrapper could
 * silently drop the stretch and end up with one short card beside a tall one.
 */
export function ActionPair({ children }: { children: React.ReactNode }) {
  const styles = useStyles(makeStyles)
  return <View style={styles.pair}>{children}</View>
}

export function ActionRow({
  icon,
  title,
  sub,
  primary,
  disabled,
  compact,
  onPress,
}: {
  icon: IconName
  title: string
  sub: string
  primary?: boolean
  disabled?: boolean
  /**
   * Half-width form, for two actions side by side: the badge sits above the label, both centred, and
   * the chevron goes — none of that fits across half a phone. Everything else (fill, states, text
   * sizes) stays, so a pair still reads as the same control as a full-width row.
   */
  compact?: boolean
  onPress: () => void
}) {
  const colors = useColors()
  const styles = useStyles(makeStyles)
  return (
    <TapScale
      style={[
        styles.row,
        compact && styles.rowCompact,
        primary ? styles.primary : styles.plain,
        // After the fill, so it wins the border the fill would otherwise leave at the default edge.
        compact && primary && styles.compactEdgeOnFill,
        disabled && styles.off,
      ]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
    >
      <View style={[styles.badge, primary && styles.badgePrimary]}>
        <Icon name={icon} size={14} color={primary ? colors.onAccent : colors.muted} />
      </View>
      <View style={[styles.text, compact && styles.textCompact]}>
        <Text style={[styles.title, compact && styles.titleCompact, primary && styles.onFill]}>
          {title}
        </Text>
        <Text style={[styles.sub, compact && styles.centred, primary && styles.onFillQuiet]}>
          {sub}
        </Text>
      </View>
      {/* A chevron across half a phone is noise — the pair is obviously tappable. */}
      {!compact && (
        <Icon name="chevron-right" size={15} color={primary ? colors.onAccent : colors.muted} />
      )}
    </TapScale>
  )
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  pair: { flexDirection: 'row', alignItems: 'stretch', gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 64,
    paddingHorizontal: spacing.md,
    // Rounder than the app's `radius.lg`, to sit with the home screen's cards rather than with the
    // panels — these are controls you press, and they should look softer than the surfaces.
    borderRadius: 22,
  },
  /*
   * Half-width: a column, badge over label, everything centred. Side by side the two read as a pair
   * of tiles rather than as two truncated rows — at this width a leading badge eats a third of the
   * line and pushes the label into wrapping.
   */
  rowCompact: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    /*
     * A glass edge. Two tiles sitting side by side on a dark page need a boundary of their own —
     * the translucent fill alone leaves them reading as two lighter patches of the page rather than
     * as two objects on it. The hairline is what a pane of glass has and a painted panel doesn't.
     */
    borderWidth: edge,
    borderColor: colors.border,
  },
  // On the accent fill the page's own edge disappears, so the highlight comes from the fill itself.
  compactEdgeOnFill: { borderColor: 'rgba(255,255,255,0.30)' },
  textCompact: { flex: 0, alignItems: 'center' },
  titleCompact: { fontSize: 15, textAlign: 'center' },
  centred: { textAlign: 'center' },
  // Fill only: the row owns its own layout, so it can't take the centred single-label shell the
  // button helpers carry.
  primary: { backgroundColor: btnPrimary(colors).backgroundColor },
  plain: { backgroundColor: btnSecondary(colors).backgroundColor },
  off: { opacity: 0.45 },
  badge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.panelStrong,
  },
  // A lightened well rather than a tint: on the filled row an accent-on-accent badge vanishes.
  badgePrimary: { backgroundColor: 'rgba(255,255,255,0.22)' },
  text: { flex: 1, gap: 1 },
  // No fontFamily: the system face is SF Pro on iOS, which is what makes these read as controls.
  title: { color: colors.ink, fontSize: 17, fontWeight: '600', letterSpacing: -0.4 },
  sub: { color: colors.muted, fontSize: 13, letterSpacing: -0.2 },
  onFill: { color: colors.onAccent },
  onFillQuiet: { color: 'rgba(47,47,47,0.7)' },
})
