import { StyleSheet } from 'react-native'
import type { IconName } from '@fortawesome/fontawesome-svg-core'
import { Icon } from './Icon'
import { GlassCircle } from './Glass'
import { TapScale } from './TapScale'
import { useColors } from '../hooks/theme'

/** Matches the diameter the system gives a navigation-bar button, so the two read as one control. */
const SIZE = 44
const GLYPH = 17

/**
 * The step-through control used between cards, everywhere in the app: learn, practice, the writing
 * review, the grammar minigame, the quiz footer.
 *
 * Styled to match the system back button in the navigation bar: on iOS 26 that is a chevron in a
 * round Liquid Glass well, so this is the same glyph in the same well (see {@link GlassCircle}).
 * Every pager renders this rather than its own copy, so restyling here restyles all of them; there
 * is no local `styles.chevron` left to drift.
 *
 * Three states, carried by the well rather than the glyph — the chevron itself is one colour
 * everywhere, so a row of them reads as one family and only the emphasis moves:
 *
 * - **unavailable** — the same button, faded out whole. It keeps its colour rather than going
 *   grey, so a control that is about to become the move to make doesn't change identity when
 *   it does.
 * - **the move to make** — tinted with the accent. Only the forward control earns this, and only
 *   once it's live, so at most one control in a pager is lit at a time.
 * - **available but not the point** — tinted toward the page ground, so it stays legibly a button
 *   without competing. Back is always this.
 *
 * Pass `icon` to override the glyph where the forward step means something else (a check on the
 * last card of a run, say) without giving up the shared geometry.
 */
export function PagerChevron({
  dir,
  onPress,
  disabled,
  icon,
  label,
}: {
  dir: 'prev' | 'next'
  onPress: () => void
  disabled?: boolean
  /** Overrides the direction's default glyph. */
  icon?: IconName
  /** Screen-reader name; defaults to Previous/Next. */
  label?: string
}) {
  const colors = useColors()
  const prev = dir === 'prev'
  const tint = prev ? colors.bg : colors.accent
  return (
    <TapScale
      style={disabled ? styles.off : undefined}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label ?? (prev ? 'Previous' : 'Next')}
    >
      <GlassCircle size={SIZE} tint={tint}>
        <Icon name={icon ?? (prev ? 'chevron-left' : 'chevron-right')} size={GLYPH} color={colors.ink} />
      </GlassCircle>
    </TapScale>
  )
}

const styles = StyleSheet.create({
  off: { opacity: 0.35 },
})
