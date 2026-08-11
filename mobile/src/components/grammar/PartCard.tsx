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

      {/* Animated open/close rather than an instant swap. Children stay mounted throughout, so
          collapsing a part mid-run never throws away answers already given — reopening puts you back
          exactly where you were. */}
      {!locked && (
        <Collapse open={open}>
          <View style={styles.body}>{children}</View>
        </Collapse>
      )}
    </View>
  )
}

/**
 * Height + fade reveal, matching the kanji Learn card's breakdown. LayoutAnimation is a no-op on
 * react-native-web, so the height is animated explicitly and the content measured out of flow —
 * otherwise the section would pop open on the PWA instead of sliding.
 *
 * The inner is always rendered, so a part that has never been opened still has a measured height to
 * animate to, and a part whose content grows (a reflection answer wrapping onto another line)
 * re-measures and follows.
 */
function Collapse({ open, children }: { open: boolean; children: ReactNode }) {
  const anim = useRef(new Animated.Value(open ? 1 : 0)).current
  const [height, setHeight] = useState(0)

  useEffect(() => {
    Animated.timing(anim, {
      toValue: open ? 1 : 0,
      duration: 260,
      easing: Easing.inOut(Easing.cubic),
      // Height can't be driven natively; the fade rides along on the same value for one timing call.
      useNativeDriver: false,
    }).start()
  }, [open, anim])

  return (
    <Animated.View
      style={{
        height: anim.interpolate({ inputRange: [0, 1], outputRange: [0, height] }),
        opacity: anim,
        overflow: 'hidden',
      }}
      // Collapsed content stays mounted but must not be reachable by touch or a screen reader.
      pointerEvents={open ? 'auto' : 'none'}
      accessibilityElementsHidden={!open}
      importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}
    >
      <View
        style={styles_collapseInner}
        onLayout={(e) => setHeight(e.nativeEvent.layout.height)}
      >
        {children}
      </View>
    </Animated.View>
  )
}

/** Out of flow so the animated wrapper's height is the only thing driving layout. */
const styles_collapseInner = { position: 'absolute' as const, left: 0, right: 0 }

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
  disclosure: { marginTop: spacing.sm },
  disclosureHead: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6 },
  disclosureLabel: { color: colors.accentInk, fontFamily: fonts.medium, fontSize: 12 },
  disclosureBody: { paddingTop: spacing.xs, gap: spacing.xs },
})
