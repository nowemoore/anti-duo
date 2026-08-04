import { useEffect, useRef, useState, type ReactNode } from 'react'
import { View, Text, Pressable, StyleSheet, Animated, Easing } from 'react-native'
import type { IconName } from '@fortawesome/fontawesome-svg-core'
import { Icon } from '../Icon'
import { fonts, radius, shadow, spacing, type Palette } from '../../theme'
import { useColors, useStyles } from '../../hooks/theme'

/**
 * One collapsible part of a grammar subsection. Locked parts render dimmed with a padlock and their
 * unlock condition, and can't be expanded; unlocked ones stay expandable forever, so a finished part
 * is always revisitable.
 */
export function PartCard({
  step,
  icon,
  title,
  subtitle,
  locked,
  lockedHint,
  done,
  open,
  onToggle,
  children,
}: {
  /** 1-based part number, shown in the leading badge. */
  step: number
  icon: IconName
  title: string
  subtitle?: string
  locked: boolean
  /** Why it's locked — shown in place of the subtitle. */
  lockedHint?: string
  /** Ticks the badge once the part's own goal is met. */
  done?: boolean
  open: boolean
  onToggle: () => void
  children: ReactNode
}) {
  const colors = useColors()
  const styles = useStyles(makeStyles)

  return (
    <View style={[styles.card, locked && styles.cardLocked]}>
      <Pressable
        style={styles.header}
        onPress={locked ? undefined : onToggle}
        disabled={locked}
        accessibilityRole="button"
        accessibilityState={{ expanded: open, disabled: locked }}
        accessibilityLabel={`Part ${step}: ${title}${locked ? ', locked' : ''}`}
      >
        <View style={[styles.badge, done && styles.badgeDone, locked && styles.badgeLocked]}>
          {locked ? (
            <Icon name="lock" size={13} color={colors.muted} />
          ) : done ? (
            <Icon name="check" size={14} color={colors.onAccent} />
          ) : (
            <Text style={styles.badgeText}>{step}</Text>
          )}
        </View>

        <View style={styles.headText}>
          <View style={styles.titleRow}>
            <Icon name={icon} size={13} color={locked ? colors.muted : colors.accentInk} />
            <Text style={[styles.title, locked && styles.mutedText]}>{title}</Text>
          </View>
          {(locked ? lockedHint : subtitle) ? (
            <Text style={styles.sub}>{locked ? lockedHint : subtitle}</Text>
          ) : null}
        </View>

        {!locked && (
          <Chevron open={open} color={colors.muted} />
        )}
      </Pressable>

      {/* Hidden rather than unmounted while collapsed. An unlocked part keeps its React state for
          the whole visit, so collapsing the card mid-run doesn't throw away answers you've already
          given — reopening it puts you back exactly where you were. */}
      {!locked && <View style={[styles.body, !open && styles.hidden]}>{children}</View>}
    </View>
  )
}

/** Rotates the disclosure chevron between collapsed and expanded. */
function Chevron({ open, color }: { open: boolean; color: string }) {
  const anim = useRef(new Animated.Value(open ? 1 : 0)).current
  useEffect(() => {
    Animated.timing(anim, {
      toValue: open ? 1 : 0,
      duration: 180,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start()
  }, [open, anim])
  const rotate = anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] })
  return (
    <Animated.View style={{ transform: [{ rotate }] }}>
      <Icon name="chevron-down" size={14} color={color} />
    </Animated.View>
  )
}

/** Collapsed-by-default disclosure used inside parts (e.g. the missed-items reference). */
export function Disclosure({ label, children }: { label: string; children: ReactNode }) {
  const colors = useColors()
  const styles = useStyles(makeStyles)
  const [open, setOpen] = useState(false)
  return (
    <View style={styles.disclosure}>
      <Pressable
        style={styles.disclosureHead}
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
      >
        <Chevron open={open} color={colors.accentInk} />
        <Text style={styles.disclosureLabel}>{label}</Text>
      </Pressable>
      {open && <View style={styles.disclosureBody}>{children}</View>}
    </View>
  )
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  card: {
    ...shadow,
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  cardLocked: { opacity: 0.55 },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  badge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeDone: { backgroundColor: colors.accent },
  badgeLocked: { backgroundColor: colors.border },
  badgeText: { color: colors.accentInk, fontFamily: fonts.semibold, fontSize: 13 },
  headText: { flex: 1, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { color: colors.ink, fontFamily: fonts.semibold, fontSize: 15 },
  mutedText: { color: colors.muted },
  sub: { color: colors.muted, fontFamily: fonts.body, fontSize: 12 },
  body: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingTop: spacing.lg,
  },
  // Takes the body out of layout entirely while preserving its mounted state.
  hidden: { display: 'none' },
  disclosure: { marginTop: spacing.sm },
  disclosureHead: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6 },
  disclosureLabel: { color: colors.accentInk, fontFamily: fonts.medium, fontSize: 12 },
  disclosureBody: { paddingTop: spacing.xs, gap: spacing.xs },
})
