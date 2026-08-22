import { View, Text, StyleSheet } from 'react-native'
import type { IconName } from '@fortawesome/fontawesome-svg-core'
import { Icon } from './Icon'
import { TapScale } from './TapScale'
import { btnPrimary, btnSecondary, radius, spacing, type Palette } from '../theme'
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
export function ActionRow({
  icon,
  title,
  sub,
  primary,
  disabled,
  onPress,
}: {
  icon: IconName
  title: string
  sub: string
  primary?: boolean
  disabled?: boolean
  onPress: () => void
}) {
  const colors = useColors()
  const styles = useStyles(makeStyles)
  return (
    <TapScale
      style={[styles.row, primary ? styles.primary : styles.plain, disabled && styles.off]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
    >
      <View style={[styles.badge, primary && styles.badgePrimary]}>
        <Icon name={icon} size={14} color={primary ? colors.onAccent : colors.muted} />
      </View>
      <View style={styles.text}>
        <Text style={[styles.title, primary && styles.onFill]}>{title}</Text>
        <Text style={[styles.sub, primary && styles.onFillQuiet]}>{sub}</Text>
      </View>
      <Icon name="chevron-right" size={15} color={primary ? colors.onAccent : colors.muted} />
    </TapScale>
  )
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 64,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
  },
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
